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

  // 1. CEK CACHE DARI GOOGLE SHEETS
  const cached = getCachedJson(kw, loc);
  
  if (cached) {
    Logger.log(`[CACHE SHEET] hit kw=${kw} loc=${loc} count=${antiSpam.count}`);
    return jsonOutputString(cached);
  }

  if (!apiKey) {
    return errorOutput(kw, loc, 'JOOBLE_KEY belum di-set di Script Properties', `[CACHE] miss kw=${kw} error=JOOBLE_KEY missing`);
  }

  // ==========================================
  // LOGIKA SEDOT MULTI HALAMAN
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
      if (pageNum === 1) break; 
    }
  }

  if (!hasSuccess) {
    return errorOutput(kw, loc, lastError, `[FETCH] all pages failed kw=${kw}`);
  }

  // ==========================================
  // PROSES GABUNGAN DATA & SIMPAN KE SHEET
  // ==========================================
  try {
    const jobs = normalizeJobs(allJobs);
    const jsonStr = JSON.stringify(jobs);

    if (shouldCacheResponse(jsonStr)) {
      // Simpan ke Google Sheets
      saveCachedJson(kw, loc, jsonStr); 
      Logger.log(`[CACHE SHEET] store kw=${kw} loc=${loc} len=${jsonStr.length} total_jobs=${jobs.length}`);
    }

    Logger.log(`[FETCH] success kw=${kw} total_jobs=${jobs.length} count=${antiSpam.count}`);
    return jsonOutputString(jsonStr);

  } catch (err) {
    return errorOutput(kw, loc, String(err), `[FETCH] exception kw=${kw} err=${String(err)}`);
  }
}
