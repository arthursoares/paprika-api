import { randomUUID } from 'crypto';
import type { PaprikaHttpClient } from '../client/http';
import { Meal, MealSchema, MealType } from '../types';
import { z } from 'zod';

export class MealService {
  constructor(private client: PaprikaHttpClient) {}

  async list(): Promise<Meal[]> {
    const response = await this.client.request<{ result: unknown[] }>({
      method: 'GET',
      endpoint: '/meals/',
      apiVersion: 'v2',
    });

    return z.array(MealSchema).parse(response.result);
  }

  async add(
    recipeUid: string,
    date: string,
    type: MealType = MealType.Dinner,
    name = '',
  ): Promise<{ uid: string }> {
    const uid = randomUUID().toUpperCase();

    const meal = {
      uid,
      recipe_uid: recipeUid,
      date: `${date} 00:00:00`,
      type,
      name,
      order_flag: 0,
    };

    // v2 API expects array
    await this.client.request({
      method: 'POST',
      endpoint: '/meals/',
      apiVersion: 'v2',
      data: [meal],
    });

    return { uid };
  }

  async delete(uid: string): Promise<void> {
    await this.client.request({
      method: 'POST',
      endpoint: '/meals/',
      apiVersion: 'v2',
      data: [{ uid, deleted: true }],
    });
  }
}
