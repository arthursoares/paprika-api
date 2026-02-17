import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaprikaHttpClient } from '../../src/client/http';
import { BasicAuth, JwtAuth } from '../../src/client/auth';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('PaprikaHttpClient', () => {
  let client: PaprikaHttpClient;
  let basicAuth: BasicAuth;
  let jwtAuth: JwtAuth;

  beforeEach(() => {
    mockFetch.mockReset();
    basicAuth = new BasicAuth('test@example.com', 'password');
    jwtAuth = new JwtAuth('test@example.com', 'password');
    client = new PaprikaHttpClient(basicAuth, jwtAuth);
  });

  it('uses BasicAuth for v1 API', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Map(),
      arrayBuffer: async () => Buffer.from(JSON.stringify({ result: [] })),
    });

    await client.request({
      method: 'GET',
      endpoint: '/recipes/',
      apiVersion: 'v1',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/sync/recipes/'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Basic /),
        }),
      }),
    );
  });

  it('builds correct URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Map(),
      arrayBuffer: async () => Buffer.from(JSON.stringify({ result: [] })),
    });

    await client.request({
      method: 'GET',
      endpoint: '/recipes/',
      apiVersion: 'v1',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.paprikaapp.com/api/v1/sync/recipes/',
      expect.anything(),
    );
  });

  it('includes FormData for POST with data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Map(),
      arrayBuffer: async () => Buffer.from(JSON.stringify({ result: true })),
    });

    await client.request({
      method: 'POST',
      endpoint: '/recipe/ABC/',
      apiVersion: 'v1',
      data: { name: 'Test Recipe' },
    });

    const call = mockFetch.mock.calls[0];
    expect(call[1].body).toBeInstanceOf(FormData);
  });
});
