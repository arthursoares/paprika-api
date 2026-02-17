import { z } from 'zod';

export const GroceryItemSchema = z.object({
  uid: z.string(),
  recipe_uid: z.string().nullable(),
  name: z.string(),
  order_flag: z.number(),
  purchased: z.boolean(),
  aisle: z.string(),
  ingredient: z.string(),
  recipe: z.string().nullable(),  // Recipe name (not uid)
  instruction: z.string(),
  quantity: z.string(),
  separate: z.boolean(),
  aisle_uid: z.string().nullable(),
  list_uid: z.string().nullable(),
});

export type GroceryItem = z.infer<typeof GroceryItemSchema>;

// Grocery List entity
export const GroceryListSchema = z.object({
  uid: z.string(),
  name: z.string(),
  order_flag: z.number(),
  is_default: z.boolean(),
  reminders_list: z.string(),
});

export type GroceryList = z.infer<typeof GroceryListSchema>;

// Grocery Aisle entity
export const GroceryAisleSchema = z.object({
  uid: z.string(),
  name: z.string(),
  order_flag: z.number(),
});

export type GroceryAisle = z.infer<typeof GroceryAisleSchema>;

// Grocery Ingredient entity (for ingredient database)
export const GroceryIngredientSchema = z.object({
  uid: z.string(),
  name: z.string(),
  aisle_uid: z.string().nullable(),
});

export type GroceryIngredient = z.infer<typeof GroceryIngredientSchema>;
