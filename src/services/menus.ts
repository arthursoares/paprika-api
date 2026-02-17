import { randomUUID } from 'crypto';
import type { PaprikaHttpClient } from '../client/http';
import { Menu, MenuSchema } from '../types';
import { z } from 'zod';

export class MenuService {
  constructor(private client: PaprikaHttpClient) {}

  async list(): Promise<Menu[]> {
    const response = await this.client.request<{ result: unknown[] }>({
      method: 'GET',
      endpoint: '/menus/',
      apiVersion: 'v2',
    });
    return z.array(MenuSchema).parse(response.result);
  }

  async create(name: string, days = 7, notes = ''): Promise<{ uid: string }> {
    const existing = await this.list();
    const maxOrder = existing.reduce((max, m) => Math.max(max, m.order_flag ?? 0), 0);

    const uid = randomUUID().toUpperCase();
    const menu: Menu = {
      uid,
      name,
      notes,
      order_flag: maxOrder + 1,
      days,
    };

    await this.client.request({
      method: 'POST',
      endpoint: '/menus/',
      apiVersion: 'v2',
      data: [menu],
    });

    return { uid };
  }

  async delete(uid: string): Promise<void> {
    await this.client.request({
      method: 'POST',
      endpoint: '/menus/',
      apiVersion: 'v2',
      data: [{ uid, deleted: true }],
    });
  }
}
