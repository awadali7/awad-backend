/**
 * Fail fast at boot on missing configuration.
 *
 * Most secrets were already enforced at construction time (JWT_SECRET,
 * ADMIN_JWT_SECRET, the Razorpay keys), but API_KEY was only read inside a
 * guard — so a deploy missing it would boot green and then 500 on every
 * /bills and /income request. Checking everything here means one clear error
 * listing every missing variable, before the process starts serving.
 */
const ALWAYS_REQUIRED = [
  'DATABASE_URL',
  'API_KEY',
  'JWT_SECRET',
  'ADMIN_JWT_SECRET',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
] as const;

/**
 * Only required in production: CORS_ORIGIN falls back to localhost:3000, which
 * is silently wrong once deployed — every browser call from the real frontend
 * would fail CORS with nothing in the logs to explain it.
 */
const REQUIRED_IN_PRODUCTION = ['CORS_ORIGIN'] as const;

export function assertRequiredEnv(env: NodeJS.ProcessEnv = process.env): void {
  const required: string[] = [
    ...ALWAYS_REQUIRED,
    ...(env.NODE_ENV === 'production' ? REQUIRED_IN_PRODUCTION : []),
  ];

  const missing = required.filter((name) => !env[name]?.trim());

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'See .env.example for the full list.',
    );
  }
}
