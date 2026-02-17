import { z } from 'zod';
import { execSync } from 'child_process';
import { ValidationError } from '../errors';

export const PaprikaConfigSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  apiBaseUrl: z.string().url().optional().default('https://www.paprikaapp.com'),
  timeout: z.number().positive().optional().default(30000),
  retries: z.number().min(0).max(10).optional().default(3),
});

export type PaprikaConfig = z.infer<typeof PaprikaConfigSchema>;

export function configFromEnv(): PaprikaConfig {
  const email = process.env.PAPRIKA_EMAIL;
  const password = process.env.PAPRIKA_PASSWORD;

  if (!email) {
    throw new ValidationError('Missing PAPRIKA_EMAIL environment variable');
  }
  if (!password) {
    throw new ValidationError('Missing PAPRIKA_PASSWORD environment variable');
  }

  return PaprikaConfigSchema.parse({
    email,
    password,
    timeout: process.env.PAPRIKA_TIMEOUT ? parseInt(process.env.PAPRIKA_TIMEOUT, 10) : undefined,
    retries: process.env.PAPRIKA_RETRIES ? parseInt(process.env.PAPRIKA_RETRIES, 10) : undefined,
  });
}

export function configFromSops(secretsPath?: string): PaprikaConfig {
  const path = secretsPath
    ?? process.env.PAPRIKA_SECRETS
    ?? `${process.env.HOME}/clawd/secrets/api-keys.enc.yaml`;

  try {
    const email = execSync(`sops -d --extract '["paprika"]["email"]' "${path}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    const password = execSync(`sops -d --extract '["paprika"]["password"]' "${path}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    return PaprikaConfigSchema.parse({ email, password });
  } catch (error) {
    throw new ValidationError(`Failed to load credentials from SOPS: ${path}`, error);
  }
}

export function resolveConfig(): PaprikaConfig {
  // Try env vars first (for automation)
  if (process.env.PAPRIKA_EMAIL && process.env.PAPRIKA_PASSWORD) {
    return configFromEnv();
  }

  // Fall back to SOPS
  return configFromSops();
}
