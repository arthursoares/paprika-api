import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import type { PaprikaHttpClient } from '../client/http';
import { Recipe, RecipeInput, RecipeListItem, RecipeSchema, RecipeListItemSchema } from '../types';
import { NotFoundError } from '../errors';
import { z } from 'zod';

export class RecipeService {
  constructor(private client: PaprikaHttpClient) {}

  async list(): Promise<RecipeListItem[]> {
    const response = await this.client.request<{ result: unknown[] }>({
      method: 'GET',
      endpoint: '/recipes/',
      apiVersion: 'v1',
    });

    return z.array(RecipeListItemSchema).parse(response.result);
  }

  async get(uid: string): Promise<Recipe> {
    const response = await this.client.request<{ result: unknown }>({
      method: 'GET',
      endpoint: `/recipe/${uid}/`,
      apiVersion: 'v1',
    });

    if (!response.result) {
      throw new NotFoundError('Recipe', uid);
    }

    return RecipeSchema.parse(response.result);
  }

  async save(recipe: RecipeInput): Promise<{ uid: string }> {
    const uid = recipe.uid ?? randomUUID().toUpperCase();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const fullRecipe: Recipe = {
      uid,
      name: recipe.name,
      ingredients: recipe.ingredients ?? '',
      directions: recipe.directions ?? '',
      description: recipe.description ?? '',
      notes: recipe.notes ?? '',
      nutritional_info: recipe.nutritional_info ?? '',
      servings: recipe.servings ?? '',
      prep_time: recipe.prep_time ?? '',
      cook_time: recipe.cook_time ?? '',
      total_time: recipe.total_time ?? '',
      difficulty: recipe.difficulty ?? '',
      source: recipe.source ?? '',
      source_url: recipe.source_url ?? '',
      image_url: recipe.image_url ?? null,
      photo: recipe.photo ?? null,
      photo_large: recipe.photo_large ?? null,
      photo_hash: recipe.photo_hash ?? null,
      categories: recipe.categories ?? [],
      rating: recipe.rating ?? 0,
      in_trash: false,
      is_pinned: false,
      on_favorites: recipe.on_favorites ?? false,
      created: recipe.created ?? now,
      hash: this.computeHash(recipe),
    };

    await this.client.request({
      method: 'POST',
      endpoint: `/recipe/${uid}/`,
      apiVersion: 'v1',
      data: fullRecipe,
    });

    return { uid };
  }

  async delete(uid: string, permanent = false): Promise<void> {
    const recipe = await this.get(uid);

    // Two-stage deletion
    const updatedRecipe = { ...recipe };
    if (permanent || recipe.in_trash) {
      (updatedRecipe as Record<string, unknown>).deleted = true;
      updatedRecipe.in_trash = true;
    } else {
      updatedRecipe.in_trash = true;
    }

    (updatedRecipe as Record<string, unknown>).hash = this.computeHash(updatedRecipe);

    await this.client.request({
      method: 'POST',
      endpoint: `/recipe/${uid}/`,
      apiVersion: 'v2',
      data: updatedRecipe,
    });
  }

  private computeHash(recipe: unknown): string {
    return createHash('sha256').update(JSON.stringify(recipe)).digest('hex').toUpperCase();
  }
}
