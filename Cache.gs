/**
 * CACHE.GS - Google Sheets as a Key-Value Cache
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
  return !!jsonString && jsonString.length > 0 && jsonString.length < 200000; 
}

function getCachedJson(kw, loc) {
  const cacheKey = buildCacheKey(kw, loc);
  const sheet = getCacheSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return null;

  const now = new Date().getTime();
  const ttlMs = CACHE_TTL_HOURS * 60 * 60 * 1000;

  // Cek baris ke-2 (karena cuma ada 1 key statis)
  const row = data[1]; 
  
  if (row[0] === cacheKey) {
    const timestamp = new Date(row[4]).getTime();
    if ((now - timestamp) < ttlMs) {
      Logger.log(`[CACHE SHEET] Hit!`);
      return row[3]; 
    } else {
      Logger.log(`[CACHE SHEET] Expired!`);
      return null; 
    }
  }
  return null;
}

function saveCachedJson(kw, loc, jsonString) {
  const cacheKey = buildCacheKey(kw, loc);
  const sheet = getCacheSheet();
  const data = sheet.getDataRange().getValues();
  const now = new Date();

  // Kalau belum ada data, tambah baris baru
  if (data.length <= 1) {
    sheet.appendRow([cacheKey, kw, loc, jsonString, now]);
    Logger.log(`[CACHE SHEET] Inserted.`);
  } else {
    // Kalau udah ada, TIMPA baris ke-2 (Overwrite)
    sheet.getRange(2, 1, 1, 5).setValues([[cacheKey, kw, loc, jsonString, now]]);
    Logger.log(`[CACHE SHEET] Overwritten.`);
  }
}
