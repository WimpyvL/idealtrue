import { z } from 'zod';

const optionalUrl = z
  .string()
  .trim()
  .url('Sentry DSN must be a valid URL.')
  .optional()
  .or(z.literal(''))
  .transform((value) => value || null);

const optionalText = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''))
  .transform((value) => value || null);

const clientRuntimeConfigSchema = z.object({
  VITE_SENTRY_DSN: optionalUrl,
  VITE_SENTRY_ENVIRONMENT: z.string().trim().optional().default('development'),
  VITE_SENTRY_RELEASE: optionalText,
});

export interface ClientRuntimeConfig {
  sentryDsn: string | null;
  sentryEnvironment: string;
  sentryRelease: string | null;
}

// Author: (|/) Klaasvaakie
export function getClientRuntimeConfig(env: Record<string, unknown> = import.meta.env): ClientRuntimeConfig {
  const parsed = clientRuntimeConfigSchema.parse(env);

  return {
    sentryDsn: parsed.VITE_SENTRY_DSN,
    sentryEnvironment: parsed.VITE_SENTRY_ENVIRONMENT || 'development',
    sentryRelease: parsed.VITE_SENTRY_RELEASE,
  };
}
