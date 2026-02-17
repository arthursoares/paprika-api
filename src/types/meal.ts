import { z } from 'zod';

// Note: MealType enum kept for backwards compat, but actual type is determined by type_uid
export enum MealType {
  Breakfast = 0,
  Lunch = 1,
  Dinner = 2,
  Snack = 3,
}

export const MealSchema = z.object({
  uid: z.string(),
  recipe_uid: z.string().nullable(),  // Can be null for note-only meals
  date: z.string(),
  type: z.number(),  // Legacy type number
  name: z.string(),
  order_flag: z.number(),
  type_uid: z.string().nullable().optional(),  // References custom meal type
  scale: z.string().nullable().optional(),  // Recipe scaling e.g. "2/1"
  is_ingredient: z.boolean().optional().default(false),
});

export type Meal = z.infer<typeof MealSchema>;

// MealType entity (custom meal types with colors)
export const MealTypeSchema = z.object({
  uid: z.string(),
  name: z.string(),
  order_flag: z.number(),
  color: z.string(),  // Hex color e.g. "#E36C0C"
  export_all_day: z.boolean(),
  export_time: z.number(),  // Seconds from midnight
  original_type: z.number(),  // Maps to MealType enum
});

export type MealTypeEntity = z.infer<typeof MealTypeSchema>;
