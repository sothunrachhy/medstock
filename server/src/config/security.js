// Security headers shared by the Express server (helmet) and Vercel (vercel.json).
// tests/security.test.js checks that vercel.json stays in sync with these values.

export const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  // Google Fonts stylesheet; inline styles are used by React/recharts style props
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
  'img-src': ["'self'", 'data:', 'blob:'],
  'connect-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
};

export const cspHeader = () =>
  Object.entries(CSP_DIRECTIVES)
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');

export const SECURITY_HEADERS = {
  'Content-Security-Policy': cspHeader(),
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

/** Allowed browser origins for CORS. Same-origin only in production unless CLIENT_ORIGIN is set. */
export function corsOrigin(env = process.env) {
  const list = (env.CLIENT_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length) return list;
  return env.NODE_ENV === 'production' ? false : true;
}
