import { z } from 'zod';

export const BookmarkSchema = z.object({
  uid: z.string(),
  recipe_uid: z.string(),
  order_flag: z.number(),
});

export type Bookmark = z.infer<typeof BookmarkSchema>;
