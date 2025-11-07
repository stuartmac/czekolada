// Central configuration for URL prefixing.
// Supports separate prefixes for the app (router basename), API, and media.
// Build-time via REACT_APP_BASENAME, REACT_APP_API_PREFIX, REACT_APP_MEDIA_PREFIX
// Optional runtime override via window.__BASENAME, window.__API_PREFIX, window.__MEDIA_PREFIX
// Empty or '/' means no prefix.

function normalizePrefix(p) {
  if (!p) return '';
  // Trim whitespace
  p = ('' + p).trim();
  if (p === '' || p === '/') return '';
  // Ensure leading slash, remove trailing slash
  if (!p.startsWith('/')) p = '/' + p;
  if (p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

// App basename (where the SPA is mounted), e.g. '/slivka/czekolada'
export const APP_BASENAME = normalizePrefix(
  process.env.REACT_APP_BASENAME || (typeof window !== 'undefined' && window.__BASENAME)
);

// API prefix (where the backend API is mounted), e.g. '/slivka/api' (default '/api')
export const API_PREFIX = normalizePrefix(
  process.env.REACT_APP_API_PREFIX || (typeof window !== 'undefined' && window.__API_PREFIX) || '/api'
);

// Media prefix (where media files are served), e.g. '/slivka/media'
const inferredMedia = API_PREFIX.endsWith('/api') ? API_PREFIX.slice(0, -4) + 'media' : '/media';
export const MEDIA_PREFIX = normalizePrefix(
  process.env.REACT_APP_MEDIA_PREFIX || (typeof window !== 'undefined' && window.__MEDIA_PREFIX) || inferredMedia
);

// Build API path under API_PREFIX. Path should be relative to API root (e.g. '/jobs/123').
export function apiPath(path) {
  if (!path.startsWith('/')) path = '/' + path;
  return API_PREFIX + path;
}

// Build media path under MEDIA_PREFIX. Path should be relative to media root (e.g. '/uploads/xyz').
export function mediaPath(path) {
  if (!path.startsWith('/')) path = '/' + path;
  return MEDIA_PREFIX + path;
}

// Prefix any app-relative path with the SPA basename
export function withAppPrefix(path) {
  if (!path) return path;
  if (!path.startsWith('/')) path = '/' + path;
  return APP_BASENAME + path;
}

// For react-router basename usage
export const ROUTER_BASENAME = APP_BASENAME || undefined;
