/**
 * CACHE.GS - Menggunakan Google Sheets sebagai Database Cache
 */

function getCacheSheet() {
  const ss = SpreadsheetApp.openById(CACHE_SHEET_ID);
  let sheet = ss.getSheetByName(CACHE_SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(CACHE_SHEET_NAME);
    sheet.appendRow(['CacheKey', 'Keyword', 'Location', 'DataJSON', 'Timestamp']);
  }
  return sheet;
}

function buildCacheKey(kw, loc) {
  const rawKey = 'jooble:' + normalizeText(kw).toLowerCase() + ':' + normalizeText(loc).toLowerCase();
  return hashString(rawKey);
}

function shouldCacheResponse(jsonString) {
  return !!jsonString && jsonString.length > 0 && jsonString.length < 200000; // Limit dinaikin jadi 200KB
}

function getCachedJson(kw, loc) {
  const cacheKey = buildCacheKey(kw, loc);
  const sheet = getCacheSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return null;

  const now = new Date().getTime();
  const ttlMs = CACHE_TTL_HOURS * 60 * 60 * 1000;

  // Loop dari bawah ke atas (data terbaru)
  for (let i = data.length - 1; i >= 1; i--) {
    const rowKey = data[i][0];
    if (rowKey === cacheKey) {
      const timestamp = new Date(data[i][4]).getTime();
      const age = now - timestamp;

      if (age < ttlMs) {
        Logger.log(`[CACHE SHEET] Hit key=${cacheKey}`);
        return data[i][3]; // Return DataJSON
      } else {
        Logger.log(`[CACHE SHEET] Expired key=${cacheKey}`);
        sheet.deleteRow(i + 1); // Hapus baris yang basi
        return null;
      }
    }
  }
  return null;
}

function saveCachedJson(kw, loc, jsonString) {
  const cacheKey = buildCacheKey(kw, loc);
  const sheet = getCacheSheet();
  
  // Hapus data lama jika ada (biar ga dobel)
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === cacheKey) {
      sheet.deleteRow(i + 1);
    }
  }
  
  // Simpan data baru
  sheet.appendRow([
    cacheKey,
    kw,
    loc,
    jsonString,
    new Date()
  ]);
  
  Logger.log(`[CACHE SHEET] Saved key=${cacheKey}`);
  
  // Bersihkan data yang udah basi
  cleanupExpiredCache();
}

function cleanupExpiredCache() {
  const sheet = getCacheSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return;

  const now = new Date().getTime();
  const ttlMs = CACHE_TTL_HOURS * 60 * 60 * 1000;

  for (let i = data.length - 1; i >= 1; i--) {
    const timestamp = new Date(data[i][4]).getTime();
    if ((now - timestamp) > ttlMs) {
      sheet.deleteRow(i + 1);
    }
  }
}
