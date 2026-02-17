import { z } from 'zod';

export const PantryItemSchema = z.object({
  uid: z.string(),
  ingredient: z.string(),
  quantity: z.string(),
  aisle: z.string(),
  purchase_date: z.string(),
  expiration_date: z.string().nullable(),
  in_stock: z.boolean(),
});

export type PantryItem = z.infer<typeof PantryItemSchema>;
