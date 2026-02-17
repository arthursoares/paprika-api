import { AuthError } from '../errors';

export interface AuthStrategy {
  getHeaders(): Promise<Record<string, string>>;
}

export class BasicAuth implements AuthStrategy {
  constructor(
    private email: string,
    private password: string,
  ) {}

  async getHeaders(): Promise<Record<string, string>> {
    const token = Buffer.from(`${this.email}:${this.password}`).toString('base64');
    return { Authorization: `Basic ${token}` };
  }
}

export class JwtAuth implements AuthStrategy {
  private token: string | null = null;
  private apiBaseUrl: string;

  constructor(
    private email: string,
    private password: string,
    apiBaseUrl = 'https://www.paprikaapp.com',
  ) {
    this.apiBaseUrl = apiBaseUrl;
  }

  async getHeaders(): Promise<Record<string, string>> {
    if (!this.token) {
      this.token = await this.login();
    }
    return { Authorization: `Bearer ${this.token}` };
  }

  private async login(): Promise<string> {
    const postData = `email=${encodeURIComponent(this.email)}&password=${encodeURIComponent(this.password)}`;

    const response = await fetch(`${this.apiBaseUrl}/api/v2/account/login/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Paprika Recipe Manager 3/3.8.4',
      },
      body: postData,
    });

    if (!response.ok) {
      throw new AuthError(`Login failed: ${response.status}`);
    }

    const data = await response.json() as { result?: { token?: string } };
    if (!data.result?.token) {
      throw new AuthError('No token in login response');
    }

    return data.result.token;
  }

  // Allow token reset for re-auth
  clearToken(): void {
    this.token = null;
  }
}
