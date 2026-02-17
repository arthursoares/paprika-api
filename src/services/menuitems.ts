import { randomUUID } from 'crypto';
import type { PaprikaHttpClient } from '../client/http';
import { MenuItem, MenuItemSchema } from '../types';
import { z } from 'zod';

export class MenuItemService {
  constructor(private client: PaprikaHttpClient) {}

  async list(): Promise<MenuItem[]> {
    const response = await this.client.request<{ result: unknown[] }>({
      method: 'GET',
      endpoint: '/menuitems/',
      apiVersion: 'v2',
    });
    return z.array(MenuItemSchema).parse(response.result);
  }

  async add(
    menuUid: string,
    day: number,
    name: string,
    recipeUid?: string,
    typeUid?: string,
  ): Promise<{ uid: string }> {
    const uid = randomUUID().toUpperCase();
    const item: MenuItem = {
      uid,
      name,
      order_flag: 0,
      recipe_uid: recipeUid ?? null,
      menu_uid: menuUid,
      type_uid: typeUid ?? null,
      day,
      scale: null,
      is_ingredient: false,
    };

    await this.client.request({
      method: 'POST',
      endpoint: '/menuitems/',
      apiVersion: 'v2',
      data: [item],
    });

    return { uid };
  }

  async delete(uid: string): Promise<void> {
    await this.client.request({
      method: 'POST',
      endpoint: '/menuitems/',
      apiVersion: 'v2',
      data: [{ uid, deleted: true }],
    });
  }
}
