import { describe, it, expect, vi } from 'vitest';
import { BasicAuth, JwtAuth, type AuthStrategy } from '../../src/client/auth';

describe('BasicAuth', () => {
  it('generates correct Authorization header', async () => {
    const auth = new BasicAuth('user@example.com', 'password123');
    const headers = await auth.getHeaders();

    const expected = Buffer.from('user@example.com:password123').toString('base64');
    expect(headers.Authorization).toBe(`Basic ${expected}`);
  });
});

describe('JwtAuth', () => {
  it('implements AuthStrategy interface', () => {
    const auth = new JwtAuth('user@example.com', 'password123');
    expect(auth.getHeaders).toBeDefined();
  });
});

describe('AuthStrategy interface', () => {
  it('BasicAuth implements AuthStrategy', () => {
    const auth: AuthStrategy = new BasicAuth('a', 'b');
    expect(auth.getHeaders).toBeDefined();
  });
});
