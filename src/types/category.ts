import { z } from 'zod';

export const CategorySchema = z.object({
  uid: z.string(),
  name: z.string(),
  parent_uid: z.string().nullable(),
  order_flag: z.number(),
  deleted: z.boolean().optional().default(false),
});

export type Category = z.infer<typeof CategorySchema>;
