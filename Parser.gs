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
    } else if (titleLower.indexOf('kasir') > -1 || titleLower.indexOf('cashier') > -1) {
      category = 'Kasir';
    } else if (titleLower.indexOf('gudang') > -1 || titleLower.indexOf('warehouse') > -1) {
      category = 'Gudang';
    } else if (titleLower.indexOf('driver') > -1 || titleLower.indexOf('supir') > -1) {
      category = 'Driver';
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

function errorOutput(cache, cacheKey, message, logMessage) {
  const jsonStr = JSON.stringify(buildErrorJobs(message));
  saveCachedJson(cache, cacheKey, jsonStr, ERROR_CACHE_TTL);
  Logger.log(logMessage);
  return jsonOutputString(jsonStr);
}
