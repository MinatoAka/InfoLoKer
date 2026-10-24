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

      // SUKSES: HTTP 200, ada teks, dan bukan HTML (Cloudflare error page)
      if (responseCode === 200 && text && !isHtmlResponse(text)) {
        incrementApiUsage(); // Catat pemakaian kuota
        return {
          ok: true,
          text: text
        };
      }

      // Kalau status 4xx/5xx, catat error-nya buat log
      if (responseCode !== 200) {
        lastError = 'Jooble API Error (HTTP ' + responseCode + '): ' + text;
      } else {
        lastError = 'Jooble API gagal merespons dengan format yang valid';
      }
      
    } catch (err) {
      lastError = String(err);
    }

    if (attempt < 3) {
      // Jeda lebih lega: 1 detik, lalu 2 detik
      Utilities.sleep(1000 * Math.pow(2, attempt - 1));
    }
  }

  return {
    ok: false,
    text: lastText,
    error: lastError
  };
}
