import { assertRequiredEnv } from './validate-env';

const complete: NodeJS.ProcessEnv = {
  DATABASE_URL: 'postgresql://localhost:5432/db',
  API_KEY: 'key',
  JWT_SECRET: 'secret',
  ADMIN_JWT_SECRET: 'admin-secret',
  RAZORPAY_KEY_ID: 'rzp_test_x',
  RAZORPAY_KEY_SECRET: 'rzp-secret',
  RAZORPAY_WEBHOOK_SECRET: 'webhook-secret',
  CORS_ORIGIN: 'https://awadali.com',
};

describe('assertRequiredEnv', () => {
  it('passes when everything is set', () => {
    expect(() => assertRequiredEnv(complete)).not.toThrow();
  });

  it('rejects a missing API_KEY, which used to only surface at request time', () => {
    const env = { ...complete };
    delete env.API_KEY;
    expect(() => assertRequiredEnv(env)).toThrow(/API_KEY/);
  });

  it('treats a blank value as missing', () => {
    expect(() => assertRequiredEnv({ ...complete, JWT_SECRET: '   ' })).toThrow(
      /JWT_SECRET/,
    );
  });

  it('lists every missing variable at once', () => {
    const env = { ...complete };
    delete env.API_KEY;
    delete env.JWT_SECRET;
    expect(() => assertRequiredEnv(env)).toThrow(/API_KEY, JWT_SECRET/);
  });

  it('only requires CORS_ORIGIN in production', () => {
    const env = { ...complete };
    delete env.CORS_ORIGIN;
    expect(() =>
      assertRequiredEnv({ ...env, NODE_ENV: 'development' }),
    ).not.toThrow();
    expect(() => assertRequiredEnv({ ...env, NODE_ENV: 'production' })).toThrow(
      /CORS_ORIGIN/,
    );
  });
});
