// Returns `path` only if it is a same-site page path (e.g. "/patients?page=2").
// Anything that could leave the site ("//evil.com", "/\evil.com", "https://...")
// or loop back to the login page falls back to `fallback`.
export function safeRedirect(path, fallback = '/') {
  if (typeof path !== 'string' || path.length > 2000) return fallback;
  // must start with exactly one "/" (not "//" or "/\")
  if (!/^\/(?![/\\])/.test(path)) return fallback;
  // no control characters, backslashes or encoded line breaks
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\\]|%0[ad]/i.test(path)) return fallback;
  if (path === '/login' || path.startsWith('/login?') || path.startsWith('/login/')) return fallback;
  return path;
}
