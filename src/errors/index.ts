export class PaprikaError extends Error {
  constructor(message: string, public override cause?: Error) {
    super(message);
    this.name = 'PaprikaError';
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class AuthError extends PaprikaError {
  constructor(message = 'Authentication failed') {
    super(message);
    this.name = 'AuthError';
  }
}

export class NotFoundError extends PaprikaError {
  constructor(
    public resourceType: string,
    public uid: string,
  ) {
    super(`${resourceType} not found: ${uid}`);
    this.name = 'NotFoundError';
  }
}

export class ApiError extends PaprikaError {
  constructor(
    public statusCode: number,
    public body: unknown,
  ) {
    super(`API error ${statusCode}`);
    this.name = 'ApiError';
  }
}

export class NetworkError extends PaprikaError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends PaprikaError {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}
