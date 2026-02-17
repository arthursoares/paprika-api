import { randomUUID } from 'crypto';
import type { PaprikaHttpClient } from '../client/http';
import { PantryItem, PantryItemSchema } from '../types';
import { z } from 'zod';

export class PantryService {
  constructor(private client: PaprikaHttpClient) {}

  async list(): Promise<PantryItem[]> {
    const response = await this.client.request<{ result: unknown[] }>({
      method: 'GET',
      endpoint: '/pantry/',
      apiVersion: 'v1',
    });

    return z.array(PantryItemSchema).parse(response.result);
  }

  async add(ingredient: string, quantity = '', aisle = ''): Promise<{ uid: string }> {
    const uid = randomUUID().toUpperCase();
    const now = new Date().toISOString().split('T')[0] + ' 00:00:00';

    const item: PantryItem = {
      uid,
      ingredient,
      quantity,
      aisle,
      purchase_date: now,
      expiration_date: null,
      in_stock: true,
    };

    await this.client.request({
      method: 'POST',
      endpoint: '/pantry/',
      apiVersion: 'v2',
      data: [item],
    });

    return { uid };
  }

  async delete(uid: string): Promise<void> {
    await this.client.request({
      method: 'POST',
      endpoint: '/pantry/',
      apiVersion: 'v2',
      data: [{ uid, deleted: true }],
    });
  }
}
