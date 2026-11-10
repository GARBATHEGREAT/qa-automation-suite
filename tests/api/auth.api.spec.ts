import { expect, test } from '@playwright/test';
import { PASSWORD, uid } from '../../helpers/api';

test.describe('API: authentication', () => {
  test('registers a user and returns a token but never the password hash', async ({ request }) => {
    const email = `new-${uid()}@qa.example.com`;
    const res = await request.post('/api/auth/register', { data: { name: 'New User', email, password: PASSWORD } });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.user).toMatchObject({ email, name: 'New User' });
    expect(JSON.stringify(body)).not.toMatch(/password/i);
  });

  test('self-registration can never create an admin', async ({ request }) => {
    const res = await request.post('/api/auth/register', {
      data: { name: 'Sneaky', email: `sneaky-${uid()}@qa.example.com`, password: PASSWORD, role: 'admin' },
    });
    expect(res.status()).toBe(201);
    expect((await res.json()).user.role).not.toBe('admin');
  });

  test('rejects a duplicate email in any letter case', async ({ request }) => {
    const email = `dup-${uid()}@qa.example.com`;
    await request.post('/api/auth/register', { data: { name: 'A', email, password: PASSWORD } });
    const again = await request.post('/api/auth/register', { data: { name: 'B', email: email.toUpperCase(), password: PASSWORD } });
    expect(again.status()).toBe(409);
    expect((await again.json()).error.code).toBe('EMAIL_TAKEN');
  });

  const badRegistrations: [string, Record<string, unknown>, string][] = [
    ['an invalid email', { name: 'A', email: 'not-an-email', password: PASSWORD }, 'email'],
    ['an empty name', { name: '', email: 'x@qa.example.com', password: PASSWORD }, 'name'],
    ['a short password', { name: 'A', email: 'x@qa.example.com', password: 'abc123' }, 'password'],
    ['a password with no number', { name: 'A', email: 'x@qa.example.com', password: 'onlyletterspassword' }, 'password'],
    ['a missing body', {}, 'email'],
  ];
  for (const [label, data, field] of badRegistrations) {
    test(`validation: rejects ${label}`, async ({ request }) => {
      const res = await request.post('/api/auth/register', { data });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details.map((d: { field: string }) => d.field)).toContain(field);
    });
  }

  test('login gives the same message for a wrong password and an unknown email', async ({ request }) => {
    const email = `who-${uid()}@qa.example.com`;
    await request.post('/api/auth/register', { data: { name: 'Who', email, password: PASSWORD } });
    const wrong = await request.post('/api/auth/login', { data: { email, password: 'not-the-password-1' } });
    const unknown = await request.post('/api/auth/login', { data: { email: `ghost-${uid()}@qa.example.com`, password: 'not-the-password-1' } });
    expect(wrong.status()).toBe(401);
    expect(unknown.status()).toBe(401);
    expect((await wrong.json()).error.message).toBe((await unknown.json()).error.message);
  });

  test('the refresh cookie is httpOnly and SameSite=Strict', async ({ request }) => {
    const email = `cookie-${uid()}@qa.example.com`;
    const res = await request.post('/api/auth/register', { data: { name: 'Cookie', email, password: PASSWORD } });
    const header = res.headers()['set-cookie'] ?? '';
    expect(header).toMatch(/rd_refresh=/);
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=Strict/i);
  });

  test('refresh issues a new token, and re-using the old refresh token is refused', async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL });
    const email = `refresh-${uid()}@qa.example.com`;
    const reg = await ctx.post('/api/auth/register', { data: { name: 'Refresh', email, password: PASSWORD } });
    const oldCookie = (reg.headers()['set-cookie'] ?? '').split(';')[0] as string;

    const refreshed = await ctx.post('/api/auth/refresh');
    expect(refreshed.status()).toBe(200);
    expect((await refreshed.json()).accessToken).toEqual(expect.any(String));

    // A stolen, already-used token must not work
    const stolen = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Cookie: oldCookie } });
    expect((await stolen.post('/api/auth/refresh')).status()).toBe(401);
    await ctx.dispose();
    await stolen.dispose();
  });

  test('protected routes need a valid bearer token', async ({ request }) => {
    expect((await request.get('/api/auth/me')).status()).toBe(401);
    expect((await request.get('/api/auth/me', { headers: { Authorization: 'Bearer garbage' } })).status()).toBe(401);
    expect((await request.get('/api/projects')).status()).toBe(401);
  });
});
