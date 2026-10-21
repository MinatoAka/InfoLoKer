function hashString(value) {
  try {
    const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value);
    return digest.map(function(byte) {
      return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('');
  } catch (err) {
    return Utilities.base64EncodeWebSafe(value).replace(/=+$/g, '').substring(0, 200);
  }
}

function safeText(value) {
  return String(value == null ? '' : value);
}

function normalizeText(value) {
  return safeText(value).replace(/\s+/g, ' ').trim();
}

function checkAntiSpamRequest(token, kw, loc) {
  const cache = CacheService.getScriptCache();
  const windowMs = 60000;
  const maxRequestsPerMinute = 12;
  const fingerprint = [
    normalizeText(token || '').toLowerCase(),
    normalizeText(kw || '').toLowerCase(),
    normalizeText(loc || '').toLowerCase()
  ].join('|');

  const cacheKey = 'anti_spam_' + hashString(fingerprint);
  const lock = LockService.getScriptLock();
  const now = Date.now();

  try {
    lock.waitLock(1000);
  } catch (err) {
    Logger.log('[ANTI_SPAM] lock timeout key=' + cacheKey + ' err=' + String(err));
    return {
      allowed: false,
      message: 'Server sedang sibuk. Silakan coba beberapa saat lagi.',
      retryAfter: 5,
      count: 0
    };
  }

  try {
    let state = { count: 0, windowStart: now };

    try {
      const rawState = cache.get(cacheKey);
      if (rawState) {
        state = JSON.parse(rawState);
      }
    } catch (err) {
      state = { count: 0, windowStart: now };
    }

    if (!state.windowStart || (now - Number(state.windowStart)) > windowMs) {
      state = { count: 0, windowStart: now };
    }

    if (state.count >= maxRequestsPerMinute) {
      const elapsed = Math.max(0, now - Number(state.windowStart));
      const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
      Logger.log('[ANTI_SPAM] limit reached key=' + cacheKey + ' count=' + state.count + ' retryAfter=' + retryAfterSeconds);
      return {
        allowed: false,
        message: 'Terlalu banyak request. Silakan tunggu beberapa detik sebelum mengirim permintaan lagi.',
        retryAfter: retryAfterSeconds,
        count: state.count
      };
    }

    state.count += 1;
    cache.put(cacheKey, JSON.stringify(state), Math.ceil(windowMs / 1000));
    Logger.log('[ANTI_SPAM] allowed key=' + cacheKey + ' count=' + state.count + ' windowStart=' + state.windowStart);

    return {
      allowed: true,
      count: state.count
    };
  } finally {
    lock.releaseLock();
  }
}

function isHtmlResponse(text) {
  return !!text && (text.trim().charAt(0) === '<' || text.indexOf('<!DOCTYPE') > -1);
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
