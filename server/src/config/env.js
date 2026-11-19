// Validates environment variables once at startup. Error messages name the variable
// and the rule, never the value (secrets must not end up in logs).
import { z } from 'zod';

const PLACEHOLDER_SECRET = 'change-me-to-a-long-random-string';

const origins = z
  .string()
  .optional()
  .refine(
    (v) =>
      !v ||
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .every((o) => /^https?:\/\/[^/\s]+$/.test(o)),
    'must be a comma-separated list of origins like https://medstock.example.com (no trailing slash)',
  );

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    MONGO_URI: z
      .string()
      .regex(/^mongodb(\+srv)?:\/\//, 'must start with mongodb:// or mongodb+srv://')
      .optional(),
    JWT_SECRET: z
      .string({ required_error: 'is required' })
      .min(32, 'must be at least 32 characters (use a long random string)'),
    CLIENT_ORIGIN: origins,
    EXPIRY_WARN_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
    TRUST_PROXY: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (!env.MONGO_URI) ctx.addIssue({ code: 'custom', path: ['MONGO_URI'], message: 'is required in production' });
      if (env.JWT_SECRET === PLACEHOLDER_SECRET) {
        ctx.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'is still the example value; generate a new secret' });
      }
    }
  });

/** Returns { ok: true, env } or { ok: false, errors: ['JWT_SECRET must be ...'] }. */
export function checkEnv(source = process.env) {
  // treat empty strings as "not set"
  const values = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== ''));
  const result = schema.safeParse(values);
  if (result.success) return { ok: true, env: result.data };
  return { ok: false, errors: result.error.issues.map((i) => `${i.path.join('.')} ${i.message}`) };
}
