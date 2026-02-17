import { randomUUID } from 'crypto';
import type { PaprikaHttpClient } from '../client/http';
import { Bookmark, BookmarkSchema } from '../types';
import { z } from 'zod';

export class BookmarkService {
  constructor(private client: PaprikaHttpClient) {}

  async list(): Promise<Bookmark[]> {
    const response = await this.client.request<{ result: unknown[] }>({
      method: 'GET',
      endpoint: '/bookmarks/',
      apiVersion: 'v2',
    });
    return z.array(BookmarkSchema).parse(response.result);
  }

  async add(recipeUid: string): Promise<{ uid: string }> {
    const existing = await this.list();
    const maxOrder = existing.reduce((max, b) => Math.max(max, b.order_flag ?? 0), 0);

    const uid = randomUUID().toUpperCase();
    const bookmark: Bookmark = {
      uid,
      recipe_uid: recipeUid,
      order_flag: maxOrder + 1,
    };

    await this.client.request({
      method: 'POST',
      endpoint: '/bookmarks/',
      apiVersion: 'v2',
      data: [bookmark],
    });

    return { uid };
  }

  async delete(uid: string): Promise<void> {
    await this.client.request({
      method: 'POST',
      endpoint: '/bookmarks/',
      apiVersion: 'v2',
      data: [{ uid, deleted: true }],
    });
  }
}
