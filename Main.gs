function doGet(e) {
  const providedToken = safeText(e?.parameter?.token ?? '');
  if (!expectedToken || providedToken !== expectedToken) {
    return jsonOutput({
      error: 'Access denied',
      message: 'Token tidak valid'
    });
  }

  const kw = normalizeText(e?.parameter?.kw ?? '');
  const loc = normalizeText(e?.parameter?.loc ?? '') || 'Sidoarjo, Jawa Timur';
  const antiSpam = checkAntiSpamRequest(providedToken, kw, loc);
  
  if (!antiSpam.allowed) {
    Logger.log(`[ANTI_SPAM] blocked token=${providedToken} kw=${kw} loc=${loc} retryAfter=${antiSpam.retryAfter} count=${antiSpam.count}`);
    return jsonOutput({
      error: 'Too Many Requests',
      message: antiSpam.message,
      retryAfter: antiSpam.retryAfter,
      count: antiSpam.count
    });
  }

  const cache = CacheService.getScriptCache();
  const CACHE_KEY = buildCacheKey(kw, loc);
  const cached = getCachedJson(cache, CACHE_KEY);
  
  if (cached) {
    Logger.log(`[CACHE] hit key=${CACHE_KEY} count=${antiSpam.count}`);
    return jsonOutputString(cached);
  }

  if (!apiKey) {
    return errorOutput(
      cache, CACHE_KEY,
      'JOOBLE_KEY belum di-set di Script Properties',
      `[CACHE] miss key=${CACHE_KEY} error=JOOBLE_KEY missing`
    );
  }

  const payload = {
    keywords: kw,
    location: loc,
    radius: JOOBLE_RADIUS,
    page: JOOBLE_PAGE,
    ResultOnPage: JOOBLE_RESULT_ON_PAGE
  };

  try {
    const fetchResult = fetchJoobleWithRetry(apiKey, payload);

    if (!fetchResult.ok) {
      const msg = fetchResult.error || 'Data lowongan sedang tidak tersedia';
      return errorOutput(
        cache, CACHE_KEY, msg,
        `[FETCH] jooble error key=${CACHE_KEY} msg=${msg}`
      );
    }

    if (isHtmlResponse(fetchResult.text)) {
      return errorOutput(
        cache, CACHE_KEY,
        'Data lowongan sedang tidak tersedia',
        `[FETCH] html response key=${CACHE_KEY}`
      );
    }

    const data = JSON.parse(fetchResult.text || '{}');
    const jobs = normalizeJobs(data.jobs || []);
    const jsonStr = JSON.stringify(jobs);

    if (shouldCacheResponse(jsonStr)) {
      saveCachedJson(cache, CACHE_KEY, jsonStr, CACHE_TTL);
      Logger.log(`[CACHE] store key=${CACHE_KEY} len=${jsonStr.length} ttl=${CACHE_TTL}`);
    }

    Logger.log(`[FETCH] success key=${CACHE_KEY} jobs=${Array.isArray(data.jobs) ? data.jobs.length : 0} count=${antiSpam.count}`);
    return jsonOutputString(jsonStr);

  } catch (err) {
    return errorOutput(
      cache, CACHE_KEY, String(err),
      `[FETCH] exception key=${CACHE_KEY} err=${String(err)}`
    );
  }
}
