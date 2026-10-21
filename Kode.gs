function doGet(e) {
  
  // === VALIDASI TOKEN ===
  const expectedToken = PropertiesService.getScriptProperties().getProperty('APP_TOKEN');
  const providedToken = (e && e.parameter && e.parameter.token) ? e.parameter.token : '';
  
  if (!expectedToken || providedToken !== expectedToken) {
    return ContentService
      .createTextOutput(JSON.stringify({
        error: 'Access denied',
        message: 'Token tidak valid'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // === PARAMETER ===
  const kw = (e && e.parameter && e.parameter.kw) ? e.parameter.kw : "";
  const loc = (e && e.parameter && e.parameter.loc) ? e.parameter.loc : "Sidoarjo, Jawa Timur";
  
  const CACHE_TTL = 21600; // 6 jam
  const CACHE_KEY = 'jooble_' + kw + '_' + loc;
  const cache = CacheService.getScriptCache();
  
  // === CACHE CHECK ===
  const cached = cache.get(CACHE_KEY);
  if (cached) {
    return ContentService
      .createTextOutput(cached)
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // === FETCH JOOBLE ===
  try {
    
    const apiKey = PropertiesService.getScriptProperties().getProperty('JOOBLE_KEY');
    if (!apiKey) throw new Error('JOOBLE_KEY belum di-set di Script Properties');
    
    const url = "https://id.jooble.org/api/" + apiKey.trim();
    
    const payload = {
      keywords: kw,
      location: loc,
      radius: "25",
      page: "1",
      ResultOnPage: "20"
    };
    
    const res = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    
    const text = res.getContentText();
    
    // Deteksi HTML error dari Jooble
    if (text.trim().charAt(0) === "<" || text.indexOf("<!DOCTYPE") > -1) {
      const errJobs = [{
        id: 1,
        title: "Data lowongan sedang tidak tersedia",
        company: "Silakan coba lagi nanti",
        location: "Sidoarjo",
        subLocation: "Sidoarjo",
        salary: "-",
        type: "Info",
        category: "Info",
        date: "-",
        description: "Sistem sedang mengalami gangguan. Silakan coba beberapa saat lagi.",
        source: "Error",
        link: "#",
        isVerified: false
      }];
      const jsonStr = JSON.stringify(errJobs);
      cache.put(CACHE_KEY, jsonStr, 300); // cache 5 menit biar cepet retry
      return ContentService
        .createTextOutput(jsonStr)
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    const data = JSON.parse(text);
    const jobs = (data.jobs || []).map(function(j, i) {
      
      // Mapping kategori
      const titleLower = (j.title || '').toLowerCase();
      let category = 'Lainnya';
      if (titleLower.indexOf('admin') > -1) category = 'Admin';
      else if (titleLower.indexOf('sales') > -1 || titleLower.indexOf('marketing') > -1) category = 'Sales';
      else if (titleLower.indexOf('operator') > -1 || titleLower.indexOf('teknisi') > -1) category = 'Teknik';
      else if (titleLower.indexOf('staff') > -1) category = 'Staff';
      else if (titleLower.indexOf('manager') > -1) category = 'Manajemen';
      
      return {
        id: i + 1,
        title: j.title || 'Lowongan kerja',
        company: j.company || 'Perusahaan tidak disebutkan',
        location: j.location || 'Sidoarjo',
        subLocation: j.location || 'Sidoarjo',
        salary: j.salary || 'Tidak disebutkan',
        type: j.type || 'Tidak disebutkan',
        category: category,
        date: j.updated || 'Tidak diketahui',
        description: (j.snippet || '').replace(/<[^>]+>/g, "").substring(0, 200),
        source: "Jooble API",
        link: j.link || '#',
        isVerified: true
      };
      
    });
    
    const jsonStr = JSON.stringify(jobs);
    
    // Simpan ke cache kalau nggak kegedean (max 100KB)
    if (jsonStr.length < 100000) {
      cache.put(CACHE_KEY, jsonStr, CACHE_TTL);
    }
    
    return ContentService
      .createTextOutput(jsonStr)
      .setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    
    const errJobs = [{
      id: 1,
      title: "Terjadi kesalahan sistem",
      company: "Silakan coba lagi nanti",
      location: "Sidoarjo",
      subLocation: "Sidoarjo",
      salary: "-",
      type: "-",
      category: "Info",
      date: "-",
      description: String(err),
      source: "Error",
      link: "#",
      isVerified: false
    }];
    return ContentService
      .createTextOutput(JSON.stringify(errJobs))
      .setMimeType(ContentService.MimeType.JSON);
      
  }
}
