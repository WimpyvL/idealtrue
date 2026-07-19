import assert from 'node:assert/strict';
import test from 'node:test';

import {
  allowsStagingEncoreBackend,
  copyRequestHeaders,
  getSessionTokenFromCookieHeader,
  isSecureRequest,
  parseCookies,
  resolveEncoreApiUrl,
  sanitizeSessionPayload,
  serializeClearedSessionCookie,
  serializeSessionCookie,
  shouldPersistSessionToken,
} from '../lib/server/session-cookie.js';

test('local dev can fall back to the local Encore URL only when explicitly allowed', () => {
  assert.equal(resolveEncoreApiUrl({}, { allowLocalDefault: true }), 'http://127.0.0.1:4000');

  assert.throws(
    () => resolveEncoreApiUrl({ NODE_ENV: 'production' }, { allowLocalDefault: true }),
    /Missing ENCORE_API_URL/,
  );

  assert.throws(() => resolveEncoreApiUrl({}), /Missing ENCORE_API_URL/);
});

test('configured Encore API URL is normalized without trailing slashes', () => {
  assert.equal(
    resolveEncoreApiUrl({ ENCORE_API_URL: 'https://api.example.com///' }),
    'https://api.example.com',
  );
});

test('production-like env blocks staging Encore hosts by default', () => {
  assert.throws(
    () =>
      resolveEncoreApiUrl({
        ENCORE_API_URL: 'https://staging-ideal-stay-online-gh5i.encr.app',
        NODE_ENV: 'production',
      }),
    /staging Encore backend/,
  );
});

test('explicit override allows staging Encore hosts in production-like environments', () => {
  assert.equal(
    resolveEncoreApiUrl({
      ENCORE_API_URL: 'https://staging-ideal-stay-online-gh5i.encr.app/',
      NODE_ENV: 'production',
      ALLOW_STAGING_ENCORE_BACKEND: 'true',
    }),
    'https://staging-ideal-stay-online-gh5i.encr.app',
  );
});

test('staging Encore override accepts common truthy values only', () => {
  assert.equal(allowsStagingEncoreBackend({ ALLOW_STAGING_ENCORE_BACKEND: 'yes' }), true);
  assert.equal(allowsStagingEncoreBackend({ ALLOW_STAGING_ENCORE_BACKEND: '1' }), true);
  assert.equal(allowsStagingEncoreBackend({ ALLOW_STAGING_ENCORE_BACKEND: 'false' }), false);
});

test('parseCookies tolerates malformed cookie encoding without breaking the whole header', () => {
  const cookies = parseCookies('broken=%E0%A4%A; idealstay_session=valid-token; theme=dark');

  assert.equal(cookies.broken, '%E0%A4%A');
  assert.equal(cookies.idealstay_session, 'valid-token');
  assert.equal(cookies.theme, 'dark');
});

test('getSessionTokenFromCookieHeader still returns the session token when another cookie is malformed', () => {
  assert.equal(
    getSessionTokenFromCookieHeader('tracking=%E0%A4%A; idealstay_session=session-token-123'),
    'session-token-123',
  );
});

test('session cookies keep auth tokens HttpOnly and secure only for secure contexts', () => {
  const insecureCookie = serializeSessionCookie('token with spaces', false);
  assert.equal(insecureCookie.includes('idealstay_session=token%20with%20spaces'), true);
  assert.equal(insecureCookie.includes('HttpOnly'), true);
  assert.equal(insecureCookie.includes('SameSite=Lax'), true);
  assert.equal(insecureCookie.includes('Max-Age=604800'), true);
  assert.equal(insecureCookie.includes('Secure'), false);

  const secureCookie = serializeSessionCookie('secret-token', true);
  assert.equal(secureCookie.includes('Secure'), true);

  const clearedCookie = serializeClearedSessionCookie(true);
  assert.equal(clearedCookie.includes('Max-Age=0'), true);
  assert.equal(clearedCookie.includes('Expires=Thu, 01 Jan 1970 00:00:00 GMT'), true);
  assert.equal(clearedCookie.includes('Secure'), true);
});

test('secure request detection accepts forwarded HTTPS among multiple proxy values', () => {
  assert.equal(isSecureRequest({ 'x-forwarded-proto': 'http, https' }), true);
  assert.equal(isSecureRequest({ 'x-forwarded-proto': ['http', 'https'] }), true);
  assert.equal(isSecureRequest({ 'x-forwarded-proto': 'http' }), false);
});

test('copyRequestHeaders strips browser and proxy-owned headers before forwarding upstream', () => {
  const headers = copyRequestHeaders({
    authorization: 'Bearer explicit-token',
    connection: 'keep-alive',
    'content-length': '123',
    'content-type': 'application/json',
    cookie: 'idealstay_session=session-token',
    host: 'www.idealstay.co.za',
    'x-custom-header': 'kept',
    'x-forwarded-host': 'spoofed.example.com',
    'x-forwarded-port': '443',
    'x-forwarded-proto': 'https',
  });

  assert.equal(headers.get('authorization'), 'Bearer explicit-token');
  assert.equal(headers.get('content-type'), 'application/json');
  assert.equal(headers.get('x-custom-header'), 'kept');
  assert.equal(headers.has('connection'), false);
  assert.equal(headers.has('content-length'), false);
  assert.equal(headers.has('cookie'), false);
  assert.equal(headers.has('host'), false);
  assert.equal(headers.has('x-forwarded-host'), false);
  assert.equal(headers.has('x-forwarded-port'), false);
  assert.equal(headers.has('x-forwarded-proto'), false);
});

test('auth responses persist tokens only for the expected session-bearing paths', () => {
  assert.equal(shouldPersistSessionToken('/auth/login', { token: 'abc' }), true);
  assert.equal(shouldPersistSessionToken('/auth/session', { token: 'abc' }), true);
  assert.equal(shouldPersistSessionToken('/users/me', { token: 'abc' }), true);
  assert.equal(shouldPersistSessionToken('/auth/request-password-reset', { token: 'abc' }), false);
  assert.equal(shouldPersistSessionToken('/auth/login', { token: '' }), false);
});

test('sanitizeSessionPayload removes the raw token from persisted auth responses', () => {
  assert.deepEqual(
    sanitizeSessionPayload('/auth/signup', {
      token: 'secret-token',
      user: { id: 'user-1' },
      verificationEmailStatus: 'sent',
    }),
    {
      user: { id: 'user-1' },
      verificationEmailStatus: 'sent',
    },
  );

  assert.deepEqual(
    sanitizeSessionPayload('/auth/request-password-reset', {
      token: 'secret-token',
      ok: true,
    }),
    {
      token: 'secret-token',
      ok: true,
    },
  );
});