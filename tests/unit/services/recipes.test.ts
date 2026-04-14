import { describe, it, expect } from 'vitest';
import { RecipeService } from '../../../src/services/recipes';
import { createMockClient } from '../../helpers/mock-client';
import { NotFoundError } from '../../../src/errors';

describe('RecipeService', () => {
  describe('list', () => {
    it('returns recipe list items', async () => {
      const client = createMockClient({
        'GET v2 /recipes/': {
          result: [
            { uid: 'ABC123', hash: 'hash1' },
            { uid: 'DEF456', hash: 'hash2' },
          ],
        },
      });
      const service = new RecipeService(client);

      const recipes = await service.list();

      expect(recipes).toHaveLength(2);
      expect(recipes[0].uid).toBe('ABC123');
    });
  });

  describe('get', () => {
    it('returns full recipe', async () => {
      const client = createMockClient({
        'GET v2 /recipe/ABC123/': {
          result: {
            uid: 'ABC123',
            name: 'Test Recipe',
            ingredients: '1 cup flour',
            directions: 'Mix',
            description: '',
            notes: '',
            nutritional_info: '',
            servings: '4',
            prep_time: '',
            cook_time: '',
            total_time: '',
            difficulty: '',
            source: '',
            source_url: '',
            image_url: null,
            photo: null,
            photo_large: null,
            photo_hash: null,
            categories: [],
            rating: 0,
            in_trash: false,
            is_pinned: false,
            on_favorites: false,
            created: '2024-01-01 00:00:00',
            hash: 'abc123',
          },
        },
      });
      const service = new RecipeService(client);

      const recipe = await service.get('ABC123');

      expect(recipe.name).toBe('Test Recipe');
    });

    it('throws NotFoundError when recipe missing', async () => {
      const client = createMockClient({
        'GET v2 /recipe/MISSING/': { result: null },
      });
      const service = new RecipeService(client);

      await expect(service.get('MISSING')).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    const baseRecipe = {
      uid: 'ABC123',
      name: 'Test Recipe',
      ingredients: '1 cup flour',
      directions: 'Mix',
      description: '',
      notes: '',
      nutritional_info: '',
      servings: '4',
      prep_time: '',
      cook_time: '',
      total_time: '',
      difficulty: '',
      source: '',
      source_url: '',
      image_url: null,
      photo: null,
      photo_large: null,
      photo_hash: null,
      categories: ['CAT1', 'CAT2'],
      rating: 0,
      in_trash: false,
      is_pinned: false,
      on_favorites: false,
      created: '2024-01-01 00:00:00',
      hash: 'abc123',
    };

    const postedBody = (client: { request: { mock: { calls: [{ data: Record<string, unknown> }][] } } }) => {
      const calls = client.request.mock.calls.map(([o]) => o as unknown as { method: string; data: Record<string, unknown> });
      return calls.find((o) => o.method === 'POST')?.data;
    };

    it('merges patch onto existing recipe and preserves the uid', async () => {
      const client = createMockClient({
        'GET v2 /recipe/ABC123/': { result: baseRecipe },
        'POST v2 /recipe/ABC123/': {},
      });
      const service = new RecipeService(client);

      const result = await service.update('ABC123', { categories: ['CAT3', 'CAT4'] });

      expect(result.uid).toBe('ABC123');
      const body = postedBody(client as unknown as Parameters<typeof postedBody>[0]);
      expect(body?.uid).toBe('ABC123');
      expect(body?.categories).toEqual(['CAT3', 'CAT4']);
      // Non-patched fields survive.
      expect(body?.name).toBe('Test Recipe');
      expect(body?.ingredients).toBe('1 cup flour');
    });

    it('preserves in_trash/is_pinned/deleted/scale across update', async () => {
      const pinnedTrashedScaled = {
        ...baseRecipe,
        in_trash: true,
        is_pinned: true,
        deleted: false,
        scale: '2/1',
      };
      const client = createMockClient({
        'GET v2 /recipe/ABC123/': { result: pinnedTrashedScaled },
        'POST v2 /recipe/ABC123/': {},
      });
      const service = new RecipeService(client);

      await service.update('ABC123', { categories: ['CAT3'] });

      const body = postedBody(client as unknown as Parameters<typeof postedBody>[0]);
      expect(body?.in_trash).toBe(true);
      expect(body?.is_pinned).toBe(true);
      expect(body?.scale).toBe('2/1');
      expect(body?.categories).toEqual(['CAT3']);
    });

    it('can set rating without touching other fields', async () => {
      const client = createMockClient({
        'GET v2 /recipe/ABC123/': { result: baseRecipe },
        'POST v2 /recipe/ABC123/': {},
      });
      const service = new RecipeService(client);

      await service.update('ABC123', { rating: 5 });

      const body = postedBody(client as unknown as Parameters<typeof postedBody>[0]);
      expect(body?.rating).toBe(5);
      expect(body?.categories).toEqual(['CAT1', 'CAT2']);
    });
  });
});
