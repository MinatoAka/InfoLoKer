function doGet(e) {
  const providedToken = safeText(e?.parameter?.token ?? '');
  if (!expectedToken || providedToken !== expectedToken) {
    return jsonOutput({ error: 'Access denied', message: 'Token tidak valid' });
  }

  const kw = normalizeText(e?.parameter?.kw ?? '');
  const loc = normalizeText(e?.parameter?.loc ?? '') || 'Sidoarjo, Jawa Timur';
  const antiSpam = checkAntiSpamRequest(providedToken, kw, loc);
  
  if (!antiSpam.allowed) {
    Logger.log(`[ANTI_SPAM] blocked token=${providedToken} kw=${kw} loc=${loc} retryAfter=${antiSpam.retryAfter} count=${antiSpam.count}`);
    return jsonOutput({
      error: 'Too Many Requests', message: antiSpam.message, retryAfter: antiSpam.retryAfter, count: antiSpam.count
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
    return errorOutput(cache, CACHE_KEY, 'JOOBLE_KEY belum di-set di Script Properties', `[CACHE] miss key=${CACHE_KEY} error=JOOBLE_KEY missing`);
  }

  // ==========================================
  // LOGIKA SEDOT 2 HALAMAN
  // ==========================================
  let allJobs = [];
  let hasSuccess = false;
  let lastError = 'Data lowongan sedang tidak tersedia';

  const maxPages = parseInt(JOOBLE_MAX_PAGES, 10) || 1;
  for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
    const payload = {
      keywords: kw,
      location: loc,
      radius: JOOBLE_RADIUS,
      page: String(pageNum),
      ResultOnPage: JOOBLE_RESULT_ON_PAGE
    };

    Logger.log(`[FETCH] Mencoba mengambil halaman ${pageNum}...`);
    const fetchResult = fetchJoobleWithRetry(apiKey, payload);

    if (fetchResult.ok) {
      try {
        const data = JSON.parse(fetchResult.text || '{}');
        if (Array.isArray(data.jobs) && data.jobs.length > 0) {
          allJobs = allJobs.concat(data.jobs); // Gabungkan data
        }
        hasSuccess = true;
      } catch (err) {
        Logger.log(`[PARSE] Gagal parse JSON halaman ${pageNum}: ${err}`);
      }
    } else {
      lastError = fetchResult.error;
      Logger.log(`[FETCH] Halaman ${pageNum} gagal: ${lastError}`);
      // Kalau halaman 1 gagal, biasanya nggak usah lanjut ke halaman 2
      if (pageNum === 1) break; 
    }
  }

  // Jika halaman 1 & 2 gagal semua
  if (!hasSuccess) {
    return errorOutput(cache, CACHE_KEY, lastError, `[FETCH] all pages failed key=${CACHE_KEY}`);
  }

  // ==========================================
  // PROSES GABUNGAN DATA
  // ==========================================
  try {
    // Normalisasi semua data yang udah digabung
    const jobs = normalizeJobs(allJobs);
    const jsonStr = JSON.stringify(jobs);

    if (shouldCacheResponse(jsonStr)) {
      saveCachedJson(cache, CACHE_KEY, jsonStr, CACHE_TTL);
      Logger.log(`[CACHE] store key=${CACHE_KEY} len=${jsonStr.length} total_jobs=${jobs.length}`);
    }

    Logger.log(`[FETCH] success key=${CACHE_KEY} total_jobs=${jobs.length} count=${antiSpam.count}`);
    return jsonOutputString(jsonStr);

  } catch (err) {
    return errorOutput(cache, CACHE_KEY, String(err), `[FETCH] exception key=${CACHE_KEY} err=${String(err)}`);
  }
}
