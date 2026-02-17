import { describe, it, expect, vi } from 'vitest';
import { CategoryService } from '../../../src/services/categories';
import { createMockClient } from '../../helpers/mock-client';
import { NotFoundError } from '../../../src/errors';

describe('CategoryService', () => {
  describe('list', () => {
    it('returns categories', async () => {
      const client = createMockClient({
        'GET v2 /categories/': {
          result: [
            { uid: 'CAT1', name: 'Desserts', parent_uid: null, order_flag: 0 },
          ],
        },
      });
      const service = new CategoryService(client);

      const categories = await service.list();

      expect(categories).toHaveLength(1);
      expect(categories[0].name).toBe('Desserts');
    });

    it('returns empty array when no categories', async () => {
      const client = createMockClient({
        'GET v2 /categories/': { result: [] },
      });
      const service = new CategoryService(client);

      const categories = await service.list();

      expect(categories).toHaveLength(0);
    });
  });

  describe('create', () => {
    it('sends array to collection endpoint', async () => {
      const mockRequest = vi.fn()
        .mockResolvedValueOnce({ result: [] })  // list call
        .mockResolvedValueOnce({ result: true }); // create call
      const client = { request: mockRequest } as any;
      const service = new CategoryService(client);

      await service.create('New Category');

      // Second call is the create
      expect(mockRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({
          endpoint: '/categories/',  // Collection endpoint, no UID
          apiVersion: 'v2',
          data: expect.arrayContaining([
            expect.objectContaining({ name: 'New Category' }),
          ]),
        }),
      );
    });

    it('supports parent_uid for nesting', async () => {
      const mockRequest = vi.fn()
        .mockResolvedValueOnce({ result: [] })
        .mockResolvedValueOnce({ result: true });
      const client = { request: mockRequest } as any;
      const service = new CategoryService(client);

      await service.create('Subcategory', 'PARENT_UID');

      expect(mockRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ parent_uid: 'PARENT_UID' }),
          ]),
        }),
      );
    });

    it('sets order_flag based on existing categories', async () => {
      const mockRequest = vi.fn()
        .mockResolvedValueOnce({
          result: [
            { uid: 'CAT1', name: 'Existing', parent_uid: null, order_flag: 5 },
          ],
        })
        .mockResolvedValueOnce({ result: true });
      const client = { request: mockRequest } as any;
      const service = new CategoryService(client);

      await service.create('New Category');

      expect(mockRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ order_flag: 6 }),
          ]),
        }),
      );
    });

    it('returns the generated uid', async () => {
      const mockRequest = vi.fn()
        .mockResolvedValueOnce({ result: [] })
        .mockResolvedValueOnce({ result: true });
      const client = { request: mockRequest } as any;
      const service = new CategoryService(client);

      const result = await service.create('New Category');

      expect(result.uid).toBeDefined();
      expect(typeof result.uid).toBe('string');
      expect(result.uid.length).toBeGreaterThan(0);
    });
  });

  describe('update', () => {
    it('updates category name', async () => {
      const mockRequest = vi.fn()
        .mockResolvedValueOnce({
          result: [
            { uid: 'CAT1', name: 'Old Name', parent_uid: null, order_flag: 0 },
          ],
        })
        .mockResolvedValueOnce({ result: true });
      const client = { request: mockRequest } as any;
      const service = new CategoryService(client);

      await service.update('CAT1', { name: 'New Name' });

      expect(mockRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({
          endpoint: '/categories/',
          apiVersion: 'v2',
          data: expect.arrayContaining([
            expect.objectContaining({ uid: 'CAT1', name: 'New Name' }),
          ]),
        }),
      );
    });

    it('throws NotFoundError when category does not exist', async () => {
      const mockRequest = vi.fn()
        .mockResolvedValueOnce({ result: [] });
      const client = { request: mockRequest } as any;
      const service = new CategoryService(client);

      await expect(service.update('NONEXISTENT', { name: 'Test' }))
        .rejects.toThrow(NotFoundError);
    });

    it('preserves existing values when not updated', async () => {
      const mockRequest = vi.fn()
        .mockResolvedValueOnce({
          result: [
            { uid: 'CAT1', name: 'Original', parent_uid: 'PARENT', order_flag: 3 },
          ],
        })
        .mockResolvedValueOnce({ result: true });
      const client = { request: mockRequest } as any;
      const service = new CategoryService(client);

      await service.update('CAT1', { name: 'Updated' });

      expect(mockRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              uid: 'CAT1',
              name: 'Updated',
              parent_uid: 'PARENT',
              order_flag: 3,
            }),
          ]),
        }),
      );
    });
  });

  describe('nest', () => {
    it('sets parent_uid on child category', async () => {
      const mockRequest = vi.fn()
        .mockResolvedValueOnce({
          result: [
            { uid: 'CHILD', name: 'Child', parent_uid: null, order_flag: 0 },
          ],
        })
        .mockResolvedValueOnce({ result: true });
      const client = { request: mockRequest } as any;
      const service = new CategoryService(client);

      await service.nest('CHILD', 'PARENT');

      expect(mockRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ uid: 'CHILD', parent_uid: 'PARENT' }),
          ]),
        }),
      );
    });
  });

  describe('rename', () => {
    it('updates category name', async () => {
      const mockRequest = vi.fn()
        .mockResolvedValueOnce({
          result: [
            { uid: 'CAT1', name: 'Old', parent_uid: null, order_flag: 0 },
          ],
        })
        .mockResolvedValueOnce({ result: true });
      const client = { request: mockRequest } as any;
      const service = new CategoryService(client);

      await service.rename('CAT1', 'New');

      expect(mockRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ uid: 'CAT1', name: 'New' }),
          ]),
        }),
      );
    });
  });

  describe('delete', () => {
    it('sets deleted flag to true', async () => {
      const mockRequest = vi.fn()
        .mockResolvedValueOnce({
          result: [
            { uid: 'CAT1', name: 'Category', parent_uid: null, order_flag: 0, deleted: false },
          ],
        })
        .mockResolvedValueOnce({ result: true });
      const client = { request: mockRequest } as any;
      const service = new CategoryService(client);

      await service.delete('CAT1');

      expect(mockRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({
          endpoint: '/categories/',
          apiVersion: 'v2',
          data: expect.arrayContaining([
            expect.objectContaining({ uid: 'CAT1', deleted: true }),
          ]),
        }),
      );
    });

    it('throws NotFoundError when category does not exist', async () => {
      const mockRequest = vi.fn()
        .mockResolvedValueOnce({ result: [] });
      const client = { request: mockRequest } as any;
      const service = new CategoryService(client);

      await expect(service.delete('NONEXISTENT'))
        .rejects.toThrow(NotFoundError);
    });
  });
});
