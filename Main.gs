function doGet(e) {
  const providedToken = safeText((e && e.parameter && e.parameter.token) ? e.parameter.token : '');
  if (!expectedToken || providedToken !== expectedToken) {
    return jsonOutput({
      error: 'Access denied',
      message: 'Token tidak valid'
    });
  }

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

  const CACHE_KEY = buildCacheKey(kw, loc);
  const cached = getCachedJson(cache, CACHE_KEY);
  if (cached) {
    Logger.log('[CACHE] hit key=' + CACHE_KEY + ' count=' + antiSpam.count);
    return jsonOutputString(cached);
  }

  if (!apiKey) {
    const errJobs = buildErrorJobs('JOOBLE_KEY belum di-set di Script Properties');
    const jsonStr = JSON.stringify(errJobs);
    saveCachedJson(cache, CACHE_KEY, jsonStr, ERROR_CACHE_TTL);
    Logger.log('[CACHE] miss key=' + CACHE_KEY + ' error=JOOBLE_KEY missing');
    return jsonOutputString(jsonStr);
  }

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
