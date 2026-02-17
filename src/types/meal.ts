import { z } from 'zod';

export enum MealType {
  Breakfast = 0,
  Lunch = 1,
  Dinner = 2,
  Snack = 3,
}

export const MealSchema = z.object({
  uid: z.string(),
  recipe_uid: z.string(),
  date: z.string(),
  type: z.nativeEnum(MealType),
  name: z.string(),
  order_flag: z.number(),
});

export type Meal = z.infer<typeof MealSchema>;
