function isHtmlResponse(text) {
  return !!text && (text.trim().charAt(0) === '<' || text.indexOf('<!DOCTYPE') > -1);
}

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

      const responseCode = Number(res.getResponseCode());
      const text = safeText(res && res.getContentText ? res.getContentText() : '');
      lastText = text;

      if (responseCode === 200 && text && !isHtmlResponse(text)) {
        incrementApiUsage();
        return {
          ok: true,
          text: text
        };
      }

      if (responseCode !== 200) {
        lastError = 'Jooble API Error (HTTP ' + responseCode + '): ' + text;
      } else {
        lastError = 'Jooble API gagal merespons dengan format yang valid';
      }
      
    } catch (err) {
      lastError = String(err);
    }

    if (attempt < 3) {
      Utilities.sleep(1000 * Math.pow(2, attempt - 1));
    }
  }

  return {
    ok: false,
    text: lastText,
    error: lastError
  };
}
