function doGet(e) {
  const scriptProps = PropertiesService.getScriptProperties();
  const expectedToken = (scriptProps.getProperty('APP_TOKEN') || '').trim();
  const providedToken = safeText((e && e.parameter && e.parameter.token) ? e.parameter.token : '');

  if (!expectedToken || providedToken !== expectedToken) {
    return jsonOutput({
      error: 'Access denied',
      message: 'Token tidak valid'
    });
  }

  const kw = normalizeText((e && e.parameter && e.parameter.kw) ? e.parameter.kw : '');
  const loc = normalizeText((e && e.parameter && e.parameter.loc) ? e.parameter.loc : 'Sidoarjo, Jawa Timur') || 'Sidoarjo, Jawa Timur';

  const antiSpam = checkAntiSpamRequest(providedToken, kw, loc);
  if (!antiSpam.allowed) {
    Logger.log('[ANTI_SPAM] blocked token=' + providedToken + ' kw=' + kw + ' loc=' + loc + ' retryAfter=' + antiSpam.retryAfter + ' count=' + antiSpam.count);
    return jsonOutput({
      error: 'Too Many Requests',
      message: antiSpam.message,
      retryAfter: antiSpam.retryAfter,
      count: antiSpam.count
    });
  }

  const cache = CacheService.getScriptCache();
  const CACHE_TTL = 43200;
  const ERROR_CACHE_TTL = 300;
  const CACHE_KEY = buildCacheKey(kw, loc);

  const cached = getCachedJson(cache, CACHE_KEY);
  if (cached) {
    Logger.log('[CACHE] hit key=' + CACHE_KEY + ' count=' + antiSpam.count);
    return jsonOutputString(cached);
  }

  const apiKey = (scriptProps.getProperty('JOOBLE_KEY') || '').trim();
  if (!apiKey) {
    const errJobs = buildErrorJobs('JOOBLE_KEY belum di-set di Script Properties');
    const jsonStr = JSON.stringify(errJobs);
    saveCachedJson(cache, CACHE_KEY, jsonStr, ERROR_CACHE_TTL);
    Logger.log('[CACHE] miss key=' + CACHE_KEY + ' error=JOOBLE_KEY missing');
    return jsonOutputString(jsonStr);
  }

  const payload = {
    keywords: kw,
    location: loc,
    radius: '25',
    page: '1',
    ResultOnPage: '20'
  };

  try {
    const fetchResult = fetchJoobleWithRetry(apiKey, payload);

    if (!fetchResult.ok) {
      const errJobs = buildErrorJobs(fetchResult.error || 'Data lowongan sedang tidak tersedia');
      const jsonStr = JSON.stringify(errJobs);
      saveCachedJson(cache, CACHE_KEY, jsonStr, ERROR_CACHE_TTL);
      Logger.log('[FETCH] jooble error key=' + CACHE_KEY + ' msg=' + (fetchResult.error || 'Data lowongan sedang tidak tersedia'));
      return jsonOutputString(jsonStr);
    }

    if (isHtmlResponse(fetchResult.text)) {
      const errJobs = buildErrorJobs('Data lowongan sedang tidak tersedia');
      const jsonStr = JSON.stringify(errJobs);
      saveCachedJson(cache, CACHE_KEY, jsonStr, ERROR_CACHE_TTL);
      Logger.log('[FETCH] html response key=' + CACHE_KEY);
      return jsonOutputString(jsonStr);
    }

    const data = JSON.parse(fetchResult.text || '{}');
    const jobs = normalizeJobs(data.jobs || []);
    const jsonStr = JSON.stringify(jobs);

    if (shouldCacheResponse(jsonStr)) {
      saveCachedJson(cache, CACHE_KEY, jsonStr, CACHE_TTL);
      Logger.log('[CACHE] store key=' + CACHE_KEY + ' len=' + jsonStr.length + ' ttl=' + CACHE_TTL);
    }

    Logger.log('[FETCH] success key=' + CACHE_KEY + ' jobs=' + (Array.isArray(data.jobs) ? data.jobs.length : 0) + ' count=' + antiSpam.count);
    return jsonOutputString(jsonStr);
  } catch (err) {
    const errJobs = buildErrorJobs(String(err));
    const jsonStr = JSON.stringify(errJobs);
    saveCachedJson(cache, CACHE_KEY, jsonStr, ERROR_CACHE_TTL);
    Logger.log('[FETCH] exception key=' + CACHE_KEY + ' err=' + String(err));
    return jsonOutputString(jsonStr);
  }
}

function normalizeText(value) {
  return safeText(value).replace(/\s+/g, ' ').trim();
}

function safeText(value) {
  return String(value == null ? '' : value);
}

function buildCacheKey(kw, loc) {
  const rawKey = 'jooble:' + normalizeText(kw).toLowerCase() + ':' + normalizeText(loc).toLowerCase();
  return hashString(rawKey);
}

function hashString(value) {
  try {
    const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value);
    return digest.map(function(byte) {
      return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('');
  } catch (err) {
    return Utilities.base64EncodeWebSafe(value).replace(/=+$/g, '').substring(0, 200);
  }
}

function shouldCacheResponse(jsonString) {
  return !!jsonString && jsonString.length > 0 && jsonString.length < 100000;
}

function getCachedJson(cache, cacheKey) {
  try {
    return cache.get(cacheKey) || null;
  } catch (err) {
    return null;
  }
}

function saveCachedJson(cache, cacheKey, value, ttlSeconds) {
  if (!cacheKey || !value || !ttlSeconds) return;

  try {
    cache.put(cacheKey, value, ttlSeconds);
  } catch (err) {
    Logger.log('[CACHE] save failed key=' + cacheKey + ' err=' + String(err));
  }
}

function checkAntiSpamRequest(token, kw, loc) {
  const cache = CacheService.getScriptCache();
  const windowMs = 60000;
  const maxRequestsPerMinute = 12;
  const fingerprint = [
    normalizeText(token || '').toLowerCase(),
    normalizeText(kw || '').toLowerCase(),
    normalizeText(loc || '').toLowerCase()
  ].join('|');

  const cacheKey = 'anti_spam_' + hashString(fingerprint);
  const lock = LockService.getScriptLock();
  const now = Date.now();

  try {
    lock.waitLock(1000);
  } catch (err) {
    Logger.log('[ANTI_SPAM] lock timeout key=' + cacheKey + ' err=' + String(err));
    return {
      allowed: false,
      message: 'Server sedang sibuk. Silakan coba beberapa saat lagi.',
      retryAfter: 5,
      count: 0
    };
  }

  try {
    let state = { count: 0, windowStart: now };

    try {
      const rawState = cache.get(cacheKey);
      if (rawState) {
        state = JSON.parse(rawState);
      }
    } catch (err) {
      state = { count: 0, windowStart: now };
    }

    if (!state.windowStart || (now - Number(state.windowStart)) > windowMs) {
      state = { count: 0, windowStart: now };
    }

    if (state.count >= maxRequestsPerMinute) {
      const elapsed = Math.max(0, now - Number(state.windowStart));
      const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
      Logger.log('[ANTI_SPAM] limit reached key=' + cacheKey + ' count=' + state.count + ' retryAfter=' + retryAfterSeconds);
      return {
        allowed: false,
        message: 'Terlalu banyak request. Silakan tunggu beberapa detik sebelum mengirim permintaan lagi.',
        retryAfter: retryAfterSeconds,
        count: state.count
      };
    }

    state.count += 1;
    cache.put(cacheKey, JSON.stringify(state), Math.ceil(windowMs / 1000));
    Logger.log('[ANTI_SPAM] allowed key=' + cacheKey + ' count=' + state.count + ' windowStart=' + state.windowStart);

    return {
      allowed: true,
      count: state.count
    };
  } finally {
    lock.releaseLock();
  }
}

function isHtmlResponse(text) {
  return !!text && (text.trim().charAt(0) === '<' || text.indexOf('<!DOCTYPE') > -1);
}

function fetchJoobleWithRetry(apiKey, payload) {
  let lastText = '';
  let lastError = 'Data lowongan sedang tidak tersedia';

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = UrlFetchApp.fetch('https://id.jooble.org/api/' + apiKey, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      const text = safeText(res && res.getContentText ? res.getContentText() : '');
      lastText = text;

      if (text && !isHtmlResponse(text)) {
        return {
          ok: true,
          text: text
        };
      }

      lastError = 'Jooble API gagal merespons dengan format yang valid';
    } catch (err) {
      lastError = String(err);
    }

    if (attempt < 3) {
      Utilities.sleep(250 * attempt);
    }
  }

  return {
    ok: false,
    text: lastText,
    error: lastError
  };
}

function normalizeJobs(jobs) {
  return jobs.map(function(job, index) {
    const title = safeText(job && job.title).trim() || 'Lowongan kerja';
    const titleLower = title.toLowerCase();
    let category = 'Lainnya';

    if (titleLower.indexOf('admin') > -1) {
      category = 'Admin';
    } else if (titleLower.indexOf('sales') > -1 || titleLower.indexOf('marketing') > -1) {
      category = 'Sales';
    } else if (titleLower.indexOf('operator') > -1 || titleLower.indexOf('teknisi') > -1) {
      category = 'Teknik';
    } else if (titleLower.indexOf('staff') > -1) {
      category = 'Staff';
    } else if (titleLower.indexOf('manager') > -1) {
      category = 'Manajemen';
    }

    return {
      id: index + 1,
      title: title,
      company: safeText(job && job.company).trim() || 'Perusahaan tidak disebutkan',
      location: safeText(job && job.location).trim() || 'Sidoarjo',
      subLocation: safeText(job && job.location).trim() || 'Sidoarjo',
      salary: safeText(job && job.salary).trim() || 'Tidak disebutkan',
      type: safeText(job && job.type).trim() || 'Tidak disebutkan',
      category: category,
      date: safeText(job && job.updated).trim() || 'Tidak diketahui',
      description: sanitizeDescription(job && job.snippet),
      source: 'Jooble API',
      link: safeText(job && job.link).trim() || '#',
      isVerified: true
    };
  });
}

function sanitizeDescription(snippet) {
  return safeText(snippet)
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);
}

function buildErrorJobs(message) {
  return [{
    id: 1,
    title: 'Terjadi kesalahan sistem',
    company: 'Silakan coba lagi nanti',
    location: 'Sidoarjo',
    subLocation: 'Sidoarjo',
    salary: '-',
    type: '-',
    category: 'Info',
    date: '-',
    description: String(message),
    source: 'Error',
    link: '#',
    isVerified: false
  }];
}

function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonOutputString(jsonString) {
  return ContentService
    .createTextOutput(jsonString)
    .setMimeType(ContentService.MimeType.JSON);
}
