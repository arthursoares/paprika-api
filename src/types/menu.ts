import { z } from 'zod';

// Menu entity (weekly meal planning)
export const MenuSchema = z.object({
  uid: z.string(),
  name: z.string(),
  notes: z.string(),
  order_flag: z.number(),
  days: z.number(),
});

export type Menu = z.infer<typeof MenuSchema>;

// Menu Item entity
export const MenuItemSchema = z.object({
  uid: z.string(),
  name: z.string(),
  order_flag: z.number(),
  recipe_uid: z.string().nullable(),
  menu_uid: z.string(),
  type_uid: z.string().nullable(),
  day: z.number(),
  scale: z.string().nullable(),
  is_ingredient: z.boolean(),
});

export type MenuItem = z.infer<typeof MenuItemSchema>;
