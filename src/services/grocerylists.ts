import { randomUUID } from 'crypto';
import type { PaprikaHttpClient } from '../client/http';
import { GroceryList, GroceryListSchema } from '../types';
import { z } from 'zod';

export class GroceryListService {
  constructor(private client: PaprikaHttpClient) {}

  async list(): Promise<GroceryList[]> {
    const response = await this.client.request<{ result: unknown[] }>({
      method: 'GET',
      endpoint: '/grocerylists/',
      apiVersion: 'v2',
    });
    return z.array(GroceryListSchema).parse(response.result);
  }

  async create(name: string, isDefault = false): Promise<{ uid: string }> {
    const existing = await this.list();
    const maxOrder = existing.reduce((max, l) => Math.max(max, l.order_flag ?? 0), 0);

    const uid = randomUUID().toUpperCase();
    const list: GroceryList = {
      uid,
      name,
      order_flag: maxOrder + 1,
      is_default: isDefault,
      reminders_list: 'Paprika',
    };

    await this.client.request({
      method: 'POST',
      endpoint: '/grocerylists/',
      apiVersion: 'v2',
      data: [list],
    });

    return { uid };
  }

  async delete(uid: string): Promise<void> {
    await this.client.request({
      method: 'POST',
      endpoint: '/grocerylists/',
      apiVersion: 'v2',
      data: [{ uid, deleted: true }],
    });
  }
}
