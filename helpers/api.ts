import { expect, type APIRequestContext } from '@playwright/test';

/** Accounts created by `npm run seed` in the ReviewDesk repository. */
export const ADMIN = { email: 'admin@reviewdesk.dev', password: 'ReviewDesk2024' };
export const PASSWORD = 'Passw0rd-long-enough';

export type Role = 'admin' | 'reviewer' | 'viewer';
export type Headers = { Authorization: string };

/** Short unique text so parallel tests never collide on emails or project names. */
export const uid = () => `${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 6)}`;

export interface Account {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  token: string;
  auth: Headers;
}

export async function loginAs(request: APIRequestContext, email: string, password: string) {
  const res = await request.post('/api/auth/login', { data: { email, password } });
  expect(res.status(), `login as ${email}`).toBe(200);
  const body = (await res.json()) as { accessToken: string; user: { id: string; name: string; role: Role } };
  return body;
}

let cachedAdmin: Account | undefined;

/** The seeded administrator (logged in once per worker). */
export async function admin(request: APIRequestContext): Promise<Account> {
  if (cachedAdmin) return cachedAdmin;
  const b = await loginAs(request, ADMIN.email, ADMIN.password);
  cachedAdmin = {
    id: b.user.id,
    name: b.user.name,
    email: ADMIN.email,
    password: ADMIN.password,
    role: 'admin',
    token: b.accessToken,
    auth: { Authorization: `Bearer ${b.accessToken}` },
  };
  return cachedAdmin;
}

/** Create a brand new user through the public API, then give them a role as the administrator. */
export async function createUser(request: APIRequestContext, role: Role, label: string = role): Promise<Account> {
  const root = await admin(request);
  const name = `${label}-${uid()}`;
  const email = `${name}@qa.example.com`;
  const reg = await request.post('/api/auth/register', { data: { name, email, password: PASSWORD } });
  expect(reg.status(), 'register').toBe(201);
  const id = ((await reg.json()) as { user: { id: string } }).user.id;
  if (role !== 'reviewer') {
    const r = await request.patch(`/api/users/${id}/role`, { headers: root.auth, data: { role } });
    expect(r.status(), 'set role').toBe(200);
  }
  const b = await loginAs(request, email, PASSWORD);
  return { id, name, email, password: PASSWORD, role, token: b.accessToken, auth: { Authorization: `Bearer ${b.accessToken}` } };
}

export async function createProject(
  request: APIRequestContext,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; name: string }> {
  const root = await admin(request);
  const name = `QA project ${uid()}`;
  const res = await request.post('/api/projects', {
    headers: root.auth,
    data: { name, description: 'Created by the QA suite', rubric: 'Pass = correct. Fail = wrong.', requiredReviews: 2, ...overrides },
  });
  expect(res.status(), 'create project').toBe(201);
  const p = ((await res.json()) as { project: { id: string; name: string } }).project;
  return { id: p.id, name: p.name };
}

export async function addTasks(
  request: APIRequestContext,
  projectId: string,
  tasks: { prompt: string; response: string }[],
): Promise<{ id: string; prompt: string }[]> {
  const root = await admin(request);
  const res = await request.post(`/api/projects/${projectId}/tasks`, { headers: root.auth, data: { tasks } });
  expect(res.status(), 'add tasks').toBe(201);
  return ((await res.json()) as { items: { id: string; prompt: string }[] }).items;
}

export const sampleTasks = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ prompt: `Question ${i + 1}: what is ${i + 1} + ${i + 1}?`, response: `The answer is ${(i + 1) * 2}.` }));

export function submitReview(
  request: APIRequestContext,
  who: Account,
  taskId: string,
  body: { rating: number; verdict: 'pass' | 'fail' | 'unsure'; notes?: string },
) {
  return request.post(`/api/tasks/${taskId}/reviews`, { headers: who.auth, data: body });
}
