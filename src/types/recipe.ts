import { z } from 'zod';

export const RecipeSchema = z.object({
  uid: z.string(),
  name: z.string(),
  ingredients: z.string(),
  directions: z.string(),
  description: z.string(),
  notes: z.string(),
  nutritional_info: z.string(),
  servings: z.string(),
  prep_time: z.string(),
  cook_time: z.string(),
  total_time: z.string(),
  difficulty: z.string(),
  source: z.string(),
  source_url: z.string(),
  image_url: z.string().nullable(),
  photo: z.string().nullable(),
  photo_large: z.string().nullable(),
  photo_hash: z.string().nullable(),
  categories: z.array(z.string()),
  rating: z.number().min(0).max(5),
  in_trash: z.boolean(),
  is_pinned: z.boolean(),
  on_favorites: z.boolean(),
  created: z.string(),
  hash: z.string(),
});

export type Recipe = z.infer<typeof RecipeSchema>;

export const RecipeInputSchema = RecipeSchema.partial().required({ name: true });
export type RecipeInput = z.infer<typeof RecipeInputSchema>;

export const RecipeListItemSchema = z.object({
  uid: z.string(),
  hash: z.string(),
});

export type RecipeListItem = z.infer<typeof RecipeListItemSchema>;
