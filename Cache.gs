function buildCacheKey(kw, loc) {
  const rawKey = 'jooble:' + normalizeText(kw).toLowerCase() + ':' + normalizeText(loc).toLowerCase();
  return hashString(rawKey);
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
