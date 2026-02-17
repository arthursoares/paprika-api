import { describe, it, expect } from 'vitest';
import { RecipeSchema, RecipeListItemSchema, MealType } from '../../src/types';

describe('Recipe schemas', () => {
  it('validates full recipe', () => {
    const recipe = {
      uid: 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890',
      name: 'Test Recipe',
      ingredients: '1 cup flour',
      directions: 'Mix well',
      description: '',
      notes: '',
      nutritional_info: '',
      servings: '4',
      prep_time: '10 min',
      cook_time: '20 min',
      total_time: '30 min',
      difficulty: 'Easy',
      source: '',
      source_url: '',
      image_url: null,
      photo: null,
      photo_large: null,
      photo_hash: null,
      categories: [],
      rating: 3,
      in_trash: false,
      is_pinned: false,
      on_favorites: false,
      created: '2024-01-15 12:00:00',
      hash: 'ABC123',
    };

    const result = RecipeSchema.safeParse(recipe);
    expect(result.success).toBe(true);
  });

  it('validates recipe list item', () => {
    const item = {
      uid: 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890',
      hash: 'ABC123',
    };

    const result = RecipeListItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it('rejects invalid rating', () => {
    const recipe = {
      uid: 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890',
      name: 'Test',
      rating: 6,
    };

    const result = RecipeSchema.partial().safeParse(recipe);
    expect(result.success).toBe(false);
  });
});

describe('MealType enum', () => {
  it('has correct values', () => {
    expect(MealType.Breakfast).toBe(0);
    expect(MealType.Lunch).toBe(1);
    expect(MealType.Dinner).toBe(2);
    expect(MealType.Snack).toBe(3);
  });
});
