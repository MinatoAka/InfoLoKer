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
  const cache = CacheService.getScriptCache();
  const CACHE_TTL = 21600;
  const CACHE_KEY = buildCacheKey(kw, loc);

  const cached = cache.get(CACHE_KEY);
  if (cached) {
    return jsonOutputString(cached);
  }

  const apiKey = (scriptProps.getProperty('JOOBLE_KEY') || '').trim();
  if (!apiKey) {
    const errorJobs = buildErrorJobs('JOOBLE_KEY belum di-set di Script Properties');
    const jsonStr = JSON.stringify(errorJobs);
    cache.put(CACHE_KEY, jsonStr, 300);
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
      cache.put(CACHE_KEY, jsonStr, 300);
      return jsonOutputString(jsonStr);
    }

    if (isHtmlResponse(fetchResult.text)) {
      const errJobs = buildErrorJobs('Data lowongan sedang tidak tersedia');
      const jsonStr = JSON.stringify(errJobs);
      cache.put(CACHE_KEY, jsonStr, 300);
      return jsonOutputString(jsonStr);
    }

    const data = JSON.parse(fetchResult.text || '{}');
    const jobs = normalizeJobs(data.jobs || []);
    const jsonStr = JSON.stringify(jobs);

    if (jsonStr.length < 100000) {
      cache.put(CACHE_KEY, jsonStr, CACHE_TTL);
    }

    return jsonOutputString(jsonStr);
  } catch (err) {
    const errJobs = buildErrorJobs(String(err));
    const jsonStr = JSON.stringify(errJobs);
    cache.put(CACHE_KEY, jsonStr, 300);
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
  return 'jooble_' + normalizeText(kw).toLowerCase() + '_' + normalizeText(loc).toLowerCase();
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
