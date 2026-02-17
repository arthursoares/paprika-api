import type { PaprikaHttpClient } from '../client/http';
import { GroceryItem, GroceryItemSchema } from '../types';
import { z } from 'zod';

export class GroceryService {
  constructor(private client: PaprikaHttpClient) {}

  async list(): Promise<GroceryItem[]> {
    const response = await this.client.request<{ result: unknown[] }>({
      method: 'GET',
      endpoint: '/groceries/',
      apiVersion: 'v1',
    });

    return z.array(GroceryItemSchema).parse(response.result);
  }

  async delete(uid: string): Promise<void> {
    await this.client.request({
      method: 'POST',
      endpoint: `/grocery/${uid}/`,
      apiVersion: 'v1',
      data: { uid, deleted: true },
    });
  }

  async clear(): Promise<number> {
    const groceries = await this.list();
    for (const g of groceries) {
      await this.delete(g.uid);
    }
    return groceries.length;
  }
}
