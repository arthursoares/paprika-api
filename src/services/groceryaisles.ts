import { randomUUID } from 'crypto';
import type { PaprikaHttpClient } from '../client/http';
import { GroceryAisle, GroceryAisleSchema } from '../types';
import { z } from 'zod';

export class GroceryAisleService {
  constructor(private client: PaprikaHttpClient) {}

  async list(): Promise<GroceryAisle[]> {
    const response = await this.client.request<{ result: unknown[] }>({
      method: 'GET',
      endpoint: '/groceryaisles/',
      apiVersion: 'v2',
    });
    return z.array(GroceryAisleSchema).parse(response.result);
  }

  async create(name: string): Promise<{ uid: string }> {
    const existing = await this.list();
    const maxOrder = existing.reduce((max, a) => Math.max(max, a.order_flag ?? 0), 0);

    const uid = randomUUID().toUpperCase();
    const aisle: GroceryAisle = {
      uid,
      name,
      order_flag: maxOrder + 1,
    };

    await this.client.request({
      method: 'POST',
      endpoint: '/groceryaisles/',
      apiVersion: 'v2',
      data: [aisle],
    });

    return { uid };
  }

  async delete(uid: string): Promise<void> {
    await this.client.request({
      method: 'POST',
      endpoint: '/groceryaisles/',
      apiVersion: 'v2',
      data: [{ uid, deleted: true }],
    });
  }
}
