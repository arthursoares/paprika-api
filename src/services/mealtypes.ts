import { randomUUID } from 'crypto';
import type { PaprikaHttpClient } from '../client/http';
import { MealTypeEntity, MealTypeSchema } from '../types';
import { z } from 'zod';

export class MealTypeService {
  constructor(private client: PaprikaHttpClient) {}

  async list(): Promise<MealTypeEntity[]> {
    const response = await this.client.request<{ result: unknown[] }>({
      method: 'GET',
      endpoint: '/mealtypes/',
      apiVersion: 'v2',
    });
    return z.array(MealTypeSchema).parse(response.result);
  }

  async create(
    name: string,
    color = '#000000',
    exportTime = 0,
    exportAllDay = false,
  ): Promise<{ uid: string }> {
    const existing = await this.list();
    const maxOrder = existing.reduce((max, t) => Math.max(max, t.order_flag ?? 0), 0);

    const uid = randomUUID().toUpperCase();
    const mealType: MealTypeEntity = {
      uid,
      name,
      order_flag: maxOrder + 1,
      color,
      export_all_day: exportAllDay,
      export_time: exportTime,
      original_type: 0,
    };

    await this.client.request({
      method: 'POST',
      endpoint: '/mealtypes/',
      apiVersion: 'v2',
      data: [mealType],
    });

    return { uid };
  }

  async delete(uid: string): Promise<void> {
    await this.client.request({
      method: 'POST',
      endpoint: '/mealtypes/',
      apiVersion: 'v2',
      data: [{ uid, deleted: true }],
    });
  }
}
