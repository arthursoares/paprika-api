import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PaprikaConfigSchema, configFromEnv } from '../../src/config';

describe('PaprikaConfig', () => {
  it('validates minimal config', () => {
    const config = { email: 'test@example.com', password: 'secret' };
    const result = PaprikaConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('applies default values', () => {
    const config = { email: 'test@example.com', password: 'secret' };
    const result = PaprikaConfigSchema.parse(config);
    expect(result.timeout).toBe(30000);
    expect(result.retries).toBe(3);
  });

  it('allows custom values', () => {
    const config = {
      email: 'test@example.com',
      password: 'secret',
      timeout: 60000,
      retries: 5,
    };
    const result = PaprikaConfigSchema.parse(config);
    expect(result.timeout).toBe(60000);
    expect(result.retries).toBe(5);
  });
});

describe('configFromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('reads from environment variables', () => {
    process.env.PAPRIKA_EMAIL = 'env@example.com';
    process.env.PAPRIKA_PASSWORD = 'envpassword';

    const config = configFromEnv();
    expect(config.email).toBe('env@example.com');
    expect(config.password).toBe('envpassword');
  });

  it('throws when env vars missing', () => {
    delete process.env.PAPRIKA_EMAIL;
    delete process.env.PAPRIKA_PASSWORD;

    expect(() => configFromEnv()).toThrow('Missing PAPRIKA_EMAIL');
  });
});
