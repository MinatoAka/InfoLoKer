// Global Config & Script Properties
const props = PropertiesService.getScriptProperties();
const expectedToken = (props.getProperty('APP_TOKEN') || '').trim();
const apiKey = (props.getProperty('JOOBLE_KEY') || '').trim();
const PROP_LIMIT_USED = 'JOOBLE_REQUESTS_USED';
const PROP_LIMIT_TOTAL = 'JOOBLE_REQUESTS_TOTAL';
const DEFAULT_TOTAL_LIMIT = 500;
const CACHE_TTL = 86400;
const ERROR_CACHE_TTL = 300;
const JOOBLE_RADIUS = '24';
const JOOBLE_MAX_PAGES = '1';
const JOOBLE_RESULT_ON_PAGE = '20';
