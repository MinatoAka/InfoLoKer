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
    const errJobs = buildErrorJobs('JOOBLE_KEY belum di-set di Script Properties');
    return jsonOutput(errJobs);
  }

  const payload = {
    keywords: kw,
    location: loc,
    radius: '25',
    page: '1',
    ResultOnPage: '20'
  };

  try {
    const res = UrlFetchApp.fetch('https://id.jooble.org/api/' + apiKey, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const text = safeText(res && res.getContentText ? res.getContentText() : '');

    if (isHtmlResponse(text)) {
      const errJobs = buildErrorJobs('Data lowongan sedang tidak tersedia');
      const jsonStr = JSON.stringify(errJobs);
      cache.put(CACHE_KEY, jsonStr, 300);
      return jsonOutputString(jsonStr);
    }

    const data = JSON.parse(text || '{}');
    const jobs = normalizeJobs(data.jobs || []);
    const jsonStr = JSON.stringify(jobs);

    if (jsonStr.length < 100000) {
      cache.put(CACHE_KEY, jsonStr, CACHE_TTL);
    }

    return jsonOutputString(jsonStr);
  } catch (err) {
    const errJobs = buildErrorJobs(String(err));
    return jsonOutput(errJobs);
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
  return text && (text.trim().charAt(0) === '<' || text.indexOf('<!DOCTYPE') > -1);
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
  return safeText(snippet).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().substring(0, 200);
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
