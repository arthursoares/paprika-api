import { vi } from 'vitest';
import type { PaprikaHttpClient, RequestOptions } from '../../src/client/http';

type MockResponse = Record<string, unknown>;

export function createMockClient(
  responses: Record<string, MockResponse>,
): PaprikaHttpClient {
  return {
    request: vi.fn(async <T>(options: RequestOptions): Promise<T> => {
      const key = `${options.method} ${options.apiVersion} ${options.endpoint}`;
      const response = responses[key];
      if (!response) {
        throw new Error(`No mock for: ${key}`);
      }
      return response as T;
    }),
  } as unknown as PaprikaHttpClient;
}
