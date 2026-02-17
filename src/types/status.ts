import { z } from 'zod';

export const SyncStatusSchema = z.object({
  categories: z.number(),
  recipes: z.number(),
  photos: z.number(),
  groceries: z.number(),
  grocerylists: z.number(),
  groceryaisles: z.number(),
  groceryingredients: z.number(),
  meals: z.number(),
  mealtypes: z.number(),
  bookmarks: z.number(),
  pantry: z.number(),
  pantrylocations: z.number(),
  menus: z.number(),
  menuitems: z.number(),
});

export type SyncStatus = z.infer<typeof SyncStatusSchema>;
