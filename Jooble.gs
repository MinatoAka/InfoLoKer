function fetchJoobleWithRetry(apiKey, payload) {
  let lastText = '';
  let lastError = 'Data lowongan sedang tidak tersedia';

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = UrlFetchApp.fetch('https://id.jooble.org/api/' + apiKey, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      const text = safeText(res && res.getContentText ? res.getContentText() : '');
      lastText = text;

      if (text && !isHtmlResponse(text)) {
        return {
          ok: true,
          text: text
        };
      }

      lastError = 'Jooble API gagal merespons dengan format yang valid';
    } catch (err) {
      lastError = String(err);
    }

    if (attempt < 3) {
      Utilities.sleep(250 * attempt);
    }
  }

  return {
    ok: false,
    text: lastText,
    error: lastError
  };
}
