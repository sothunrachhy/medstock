import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { corsOrigin, SECURITY_HEADERS } from '../src/config/security.js';
import { api } from './helpers.js';

const vercel = JSON.parse(fs.readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
const vercelHeaders = (source) =>
  Object.fromEntries((vercel.headers.find((h) => h.source === source)?.headers || []).map((h) => [h.key, h.value]));

describe('security headers', () => {
  it('vercel.json sends the same security headers as the Express server', () => {
    expect(vercelHeaders('/(.*)')).toMatchObject(SECURITY_HEADERS);
    expect(vercelHeaders('/api/(.*)')['Cache-Control']).toBe('no-store');
  });

  it('API responses are not cacheable and carry the security headers', async () => {
    const res = await api().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    const norm = (v) => v.replace(/;\s*/g, ';');
    expect(norm(res.headers['content-security-policy'])).toBe(norm(SECURITY_HEADERS['Content-Security-Policy']));
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('the CSP blocks inline scripts and framing', () => {
    const csp = SECURITY_HEADERS['Content-Security-Policy'];
    expect(csp).toContain("script-src 'self';");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('unsafe-eval');
  });
});

describe('CORS', () => {
  it('is same-origin only in production when CLIENT_ORIGIN is not set', () => {
    expect(corsOrigin({ NODE_ENV: 'production' })).toBe(false);
  });
  it('uses the configured origins', () => {
    expect(corsOrigin({ NODE_ENV: 'production', CLIENT_ORIGIN: 'https://a.example, https://b.example' })).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });
  it('allows any origin in development', () => {
    expect(corsOrigin({ NODE_ENV: 'development' })).toBe(true);
  });
});
