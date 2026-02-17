import { z } from 'zod';

export const GroceryItemSchema = z.object({
  uid: z.string(),
  name: z.string(),
  ingredient: z.string().optional(),
  recipe_uid: z.string().nullable().optional(),
  aisle: z.string().optional(),
  quantity: z.string().optional(),
  purchased: z.boolean().optional(),
});

export type GroceryItem = z.infer<typeof GroceryItemSchema>;
