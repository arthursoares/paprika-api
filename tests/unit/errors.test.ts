import { describe, it, expect } from 'vitest';
import {
  PaprikaError,
  AuthError,
  NotFoundError,
  ApiError,
  NetworkError,
  ValidationError,
} from '../../src/errors';

describe('Error types', () => {
  it('PaprikaError is base error', () => {
    const err = new PaprikaError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('PaprikaError');
    expect(err.message).toBe('test');
  });

  it('AuthError includes default message', () => {
    const err = new AuthError();
    expect(err).toBeInstanceOf(PaprikaError);
    expect(err.name).toBe('AuthError');
    expect(err.message).toBe('Authentication failed');
  });

  it('NotFoundError includes resource info', () => {
    const err = new NotFoundError('Recipe', 'ABC123');
    expect(err).toBeInstanceOf(PaprikaError);
    expect(err.resourceType).toBe('Recipe');
    expect(err.uid).toBe('ABC123');
    expect(err.message).toBe('Recipe not found: ABC123');
  });

  it('ApiError includes status and body', () => {
    const err = new ApiError(400, { error: 'bad request' });
    expect(err).toBeInstanceOf(PaprikaError);
    expect(err.statusCode).toBe(400);
    expect(err.body).toEqual({ error: 'bad request' });
  });

  it('NetworkError includes cause', () => {
    const cause = new Error('ECONNREFUSED');
    const err = new NetworkError('Connection failed', cause);
    expect(err).toBeInstanceOf(PaprikaError);
    expect(err.cause).toBe(cause);
  });

  it('ValidationError includes details', () => {
    const err = new ValidationError('Invalid input', { field: 'name' });
    expect(err).toBeInstanceOf(PaprikaError);
    expect(err.details).toEqual({ field: 'name' });
  });
});
