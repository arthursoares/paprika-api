import { randomUUID } from 'crypto';
import type { PaprikaHttpClient } from '../client/http';
import { Category, CategorySchema } from '../types';
import { NotFoundError } from '../errors';
import { z } from 'zod';

export class CategoryService {
  constructor(private client: PaprikaHttpClient) {}

  async list(): Promise<Category[]> {
    const response = await this.client.request<{ result: unknown[] }>({
      method: 'GET',
      endpoint: '/categories/',
      apiVersion: 'v2',
    });

    return z.array(CategorySchema).parse(response.result);
  }

  async create(name: string, parentUid?: string): Promise<{ uid: string }> {
    const existing = await this.list();
    const maxOrder = existing.reduce((max, c) => Math.max(max, c.order_flag ?? 0), 0);

    const uid = randomUUID().toUpperCase();
    const category: Category = {
      uid,
      name,
      parent_uid: parentUid ?? null,
      order_flag: maxOrder + 1,
      deleted: false,
    };

    // QUIRK: Categories use collection endpoint with array body
    await this.client.request({
      method: 'POST',
      endpoint: '/categories/',
      apiVersion: 'v2',
      data: [category],
    });

    return { uid };
  }

  async update(uid: string, updates: Partial<Pick<Category, 'name' | 'parent_uid'>>): Promise<void> {
    const existing = await this.list();
    const category = existing.find(c => c.uid === uid);

    if (!category) {
      throw new NotFoundError('Category', uid);
    }

    const updated: Category = {
      ...category,
      name: updates.name ?? category.name,
      parent_uid: updates.parent_uid !== undefined ? updates.parent_uid : category.parent_uid,
    };

    await this.client.request({
      method: 'POST',
      endpoint: '/categories/',
      apiVersion: 'v2',
      data: [updated],
    });
  }

  async nest(childUid: string, parentUid: string): Promise<void> {
    await this.update(childUid, { parent_uid: parentUid });
  }

  async rename(uid: string, name: string): Promise<void> {
    await this.update(uid, { name });
  }

  async delete(uid: string): Promise<void> {
    const existing = await this.list();
    const category = existing.find(c => c.uid === uid);

    if (!category) {
      throw new NotFoundError('Category', uid);
    }

    const deleted: Category = { ...category, deleted: true };

    await this.client.request({
      method: 'POST',
      endpoint: '/categories/',
      apiVersion: 'v2',
      data: [deleted],
    });
  }
}
