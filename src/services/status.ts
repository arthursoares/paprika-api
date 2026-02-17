import type { PaprikaHttpClient } from '../client/http';
import { SyncStatus, SyncStatusSchema } from '../types';

export class StatusService {
  constructor(private client: PaprikaHttpClient) {}

  async get(): Promise<SyncStatus> {
    const response = await this.client.request<{ result: unknown }>({
      method: 'GET',
      endpoint: '/status/',
      apiVersion: 'v2',
    });
    return SyncStatusSchema.parse(response.result);
  }
}
