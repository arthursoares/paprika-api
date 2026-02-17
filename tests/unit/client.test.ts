import { describe, it, expect } from 'vitest';
import { PaprikaClient } from '../../src';

describe('PaprikaClient', () => {
  it('exposes all services', () => {
    const client = new PaprikaClient({
      email: 'test@example.com',
      password: 'password',
    });

    expect(client.recipes).toBeDefined();
    expect(client.categories).toBeDefined();
    expect(client.meals).toBeDefined();
    expect(client.pantry).toBeDefined();
    expect(client.groceries).toBeDefined();
    expect(client.photos).toBeDefined();
  });

  it('validates config', () => {
    expect(() => new PaprikaClient({
      email: 'invalid-email',
      password: 'password',
    })).toThrow();
  });
});
