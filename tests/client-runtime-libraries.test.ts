import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { createIdealStayQueryClient } from '../src/lib/query-client';
import { getClientRuntimeConfig } from '../src/lib/runtime-config';
import { initializeClientMonitoring } from '../src/lib/monitoring';

describe('client runtime library integration', () => {
  it('creates a query client with conservative retry and freshness defaults', () => {
    const queryClient = createIdealStayQueryClient();
    const queryDefaults = queryClient.getDefaultOptions().queries;
    const mutationDefaults = queryClient.getDefaultOptions().mutations;

    assert.equal(queryDefaults?.retry, 1);
    assert.equal(queryDefaults?.refetchOnWindowFocus, true);
    assert.equal(queryDefaults?.staleTime, 30_000);
    assert.equal(mutationDefaults?.retry, 0);
  });

  it('validates optional client runtime config without inventing fake monitoring config', () => {
    assert.deepEqual(getClientRuntimeConfig({}), {
      sentryDsn: null,
      sentryEnvironment: 'development',
      sentryRelease: null,
    });

    assert.throws(() => getClientRuntimeConfig({ VITE_SENTRY_DSN: 'not-a-url' }), /Sentry DSN/);
  });

  it('only initializes Sentry when a real DSN is configured', () => {
    const init = mock.fn();

    assert.equal(initializeClientMonitoring({ sentryDsn: null, sentryEnvironment: 'development', sentryRelease: null }, init), false);
    assert.equal(init.mock.callCount(), 0);

    assert.equal(initializeClientMonitoring({
      sentryDsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
      sentryEnvironment: 'production',
      sentryRelease: 'ideal-stay@1.0.0',
    }, init), true);
    assert.deepEqual(init.mock.calls[0]?.arguments[0], {
      dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
      environment: 'production',
      release: 'ideal-stay@1.0.0',
      tracesSampleRate: 0.1,
    });
  });
});
