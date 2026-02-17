import { gzipSync, gunzipSync, brotliDecompressSync, inflateSync } from 'zlib';
import { AuthStrategy } from './auth';
import { ApiError, NetworkError } from '../errors';

export interface RequestOptions {
  method: 'GET' | 'POST';
  endpoint: string;
  apiVersion: 'v1' | 'v2';
  data?: unknown;
  files?: FileUpload[];
}

export interface FileUpload {
  name: string;
  filename: string;
  contentType: string;
  data: Buffer;
}

export class PaprikaHttpClient {
  private apiBaseUrl: string;

  constructor(
    private basicAuth: AuthStrategy,
    private jwtAuth: AuthStrategy,
    apiBaseUrl = 'https://www.paprikaapp.com',
  ) {
    this.apiBaseUrl = apiBaseUrl;
  }

  async request<T>(options: RequestOptions): Promise<T> {
    const auth = options.apiVersion === 'v1' ? this.basicAuth : this.jwtAuth;
    const authHeaders = await auth.getHeaders();

    const url = `${this.apiBaseUrl}/api/${options.apiVersion}/sync${options.endpoint}`;

    const headers: Record<string, string> = {
      ...authHeaders,
      'User-Agent': 'Paprika Recipe Manager 3/3.8.4 (com.hindsightlabs.paprika.mac.v3; build:41; macOS 15.5.0) Alamofire/5.2.2',
      Accept: '*/*',
    };

    let body: FormData | undefined;

    if (options.method === 'POST' && (options.data || options.files)) {
      body = new FormData();

      if (options.data) {
        const gzipped = gzipSync(JSON.stringify(options.data));
        body.append('data', new Blob([gzipped]), 'file');
      }

      if (options.files) {
        for (const file of options.files) {
          body.append(
            file.name,
            new Blob([new Uint8Array(file.data)], { type: file.contentType }),
            file.filename,
          );
        }
      }
    }

    try {
      const response = await fetch(url, {
        method: options.method,
        headers,
        body,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new ApiError(response.status, errorBody);
      }

      const responseData = await this.parseResponse(response);
      return responseData as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new NetworkError('Request failed', error as Error);
    }
  }

  private async parseResponse(response: Response): Promise<unknown> {
    // Node's fetch automatically decompresses gzip/brotli/deflate,
    // so we just need to parse the JSON directly
    const text = await response.text();
    return JSON.parse(text);
  }
}
