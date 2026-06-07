import * as Sentry from '@sentry/react';
import type { ClientRuntimeConfig } from './runtime-config';

type SentryInit = typeof Sentry.init;

// Author: (|/) Klaasvaakie
export function initializeClientMonitoring(
  config: ClientRuntimeConfig,
  init: SentryInit = Sentry.init,
) {
  if (!config.sentryDsn) {
    return false;
  }

  init({
    dsn: config.sentryDsn,
    environment: config.sentryEnvironment,
    release: config.sentryRelease ?? undefined,
    tracesSampleRate: config.sentryEnvironment === 'production' ? 0.1 : 1.0,
  });

  return true;
}
