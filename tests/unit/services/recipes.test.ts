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
});
