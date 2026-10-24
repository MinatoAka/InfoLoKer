// Global Config & Script Properties
const props = PropertiesService.getScriptProperties();
const expectedToken = (props.getProperty('APP_TOKEN') || '').trim();
const apiKey = (props.getProperty('JOOBLE_KEY') || '').trim();
const PROP_LIMIT_USED = 'JOOBLE_REQUESTS_USED';
const PROP_LIMIT_TOTAL = 'JOOBLE_REQUESTS_TOTAL';
const DEFAULT_TOTAL_LIMIT = 500;

const kw = normalizeText((e && e.parameter && e.parameter.kw) ? e.parameter.kw : '');
const loc = normalizeText((e && e.parameter && e.parameter.loc) ? e.parameter.loc : 'Sidoarjo, Jawa Timur') || 'Sidoarjo, Jawa Timur';
const cache = CacheService.getScriptCache();
const CACHE_TTL = 43200;
const ERROR_CACHE_TTL = 300;
const payload = {
    keywords: kw,
    location: loc,
    radius: '25',
    page: '1',
    ResultOnPage: '20'
};
