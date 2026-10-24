// Nama properti di Script Properties
const PROP_LIMIT_USED = 'JOOBLE_REQUESTS_USED';
const PROP_LIMIT_TOTAL = 'JOOBLE_REQUESTS_TOTAL';
const DEFAULT_TOTAL_LIMIT = 500;
const props = PropertiesService.getScriptProperties();

/**
 * Inisialisasi counter — panggil sekali saat project baru dipasang
 */
function initLimitCounter() {
  if (!props.getProperty(PROP_LIMIT_TOTAL)) {
    props.setProperty(PROP_LIMIT_TOTAL, DEFAULT_TOTAL_LIMIT.toString());
  }
  
  if (!props.getProperty(PROP_LIMIT_USED)) {
    props.setProperty(PROP_LIMIT_USED, '0');
  }
}


/**
 * Tambah hitungan — panggil HANYA saat request BENAR-BENAR dikirim ke Jooble
 * (jangan panggil kalau ambil dari cache!)
 */
function incrementApiUsage() {
  let used = parseInt(props.getProperty(PROP_LIMIT_USED) || '0', 10);
  const total = parseInt(props.getProperty(PROP_LIMIT_TOTAL) || DEFAULT_TOTAL_LIMIT, 10);
  
  used += 1;
  props.setProperty(PROP_LIMIT_USED, used.toString());
  
  const remaining = total - used;
  
  if (remaining <= 10) {
    console.warn(`⚠️  Kuota Jooble HAMPIR HABIS! Sisa: ${remaining} request`);
  } else if (remaining <= 50) {
    console.info(`ℹ️  Sisa kuota Jooble: ${remaining} request`);
  }
  
  return remaining;
}


/**
 * Ambil status kuota saat ini — untuk ditampilkan di log/dashboard
 */
function getLimitStatus() {
  const total = parseInt(props.getProperty(PROP_LIMIT_TOTAL) || DEFAULT_TOTAL_LIMIT, 10);
  const used = parseInt(props.getProperty(PROP_LIMIT_USED) || '0', 10);
  const remaining = total - used;
  const percentUsed = ((used / total) * 100).toFixed(1);
  
  return {
    total: total,
    used: used,
    remaining: remaining,
    percentUsed: percentUsed
  };
}


/**
 * Tampilkan ringkasan di log
 */
function logLimitStatus() {
  const status = getLimitStatus();
  console.info('─────────────────────────────');
  console.info(`📊 Kuota Jooble: ${status.used}/${status.total}`);
  console.info(`✅ Sisa: ${status.remaining} (${status.percentUsed}% terpakai)`);
  console.info('─────────────────────────────');
}

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
