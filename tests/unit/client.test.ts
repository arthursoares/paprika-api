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
    // New services:
    expect(client.groceryLists).toBeDefined();
    expect(client.groceryAisles).toBeDefined();
    expect(client.mealTypes).toBeDefined();
    expect(client.menus).toBeDefined();
    expect(client.menuItems).toBeDefined();
    expect(client.bookmarks).toBeDefined();
    expect(client.status).toBeDefined();
  });

  it('validates config', () => {
    expect(() => new PaprikaClient({
      email: 'invalid-email',
      password: 'password',
    })).toThrow();
  });
});
