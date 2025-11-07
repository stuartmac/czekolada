// Central configuration for URL prefixing.
// Supports build-time prefix via REACT_APP_URL_PREFIX and optional runtime override
// through window.__URL_PREFIX. Empty or '/' means no prefix.

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

export const URL_PREFIX = normalizePrefix(process.env.REACT_APP_URL_PREFIX || (typeof window !== 'undefined' && window.__URL_PREFIX));

// Build API path under prefix
export function apiPath(path) {
  // path expected to start with '/'
  if (!path.startsWith('/')) path = '/' + path;
  return URL_PREFIX + path;
}

export function mediaPath(path) {
  if (!path.startsWith('/')) path = '/' + path;
  return URL_PREFIX + path;
}

// Generic prefixer
export function withPrefix(path) {
  if (!path) return path;
  if (!path.startsWith('/')) path = '/' + path;
  return URL_PREFIX + path;
}

// For react-router basename usage
export const ROUTER_BASENAME = URL_PREFIX || undefined;
