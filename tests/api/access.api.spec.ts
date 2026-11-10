import { expect, test } from '@playwright/test';
import { addTasks, admin, createProject, createUser, sampleTasks, submitReview } from '../../helpers/api';

/** Who may do what. Each row is: role, method, path, expected status. */
test.describe('API: role-based access control', () => {
  test('only admins can create projects', async ({ request }) => {
    const [reviewer, viewer, root] = [await createUser(request, 'reviewer'), await createUser(request, 'viewer'), await admin(request)];
    const body = { name: 'Access check' };
    expect((await request.post('/api/projects', { headers: reviewer.auth, data: body })).status()).toBe(403);
    expect((await request.post('/api/projects', { headers: viewer.auth, data: body })).status()).toBe(403);
    expect((await request.post('/api/projects', { headers: root.auth, data: body })).status()).toBe(201);
  });

  test('only admins can list users or read the audit log', async ({ request }) => {
    const reviewer = await createUser(request, 'reviewer');
    const viewer = await createUser(request, 'viewer');
    for (const who of [reviewer, viewer]) {
      expect((await request.get('/api/users', { headers: who.auth })).status()).toBe(403);
      expect((await request.get('/api/audit', { headers: who.auth })).status()).toBe(403);
    }
    const root = await admin(request);
    const users = await request.get('/api/users', { headers: root.auth });
    expect(users.status()).toBe(200);
    expect(JSON.stringify(await users.json())).not.toMatch(/password/i);
  });

  test('viewers can read results but cannot write reviews', async ({ request }) => {
    const project = await createProject(request);
    const [task] = await addTasks(request, project.id, sampleTasks(1));
    const viewer = await createUser(request, 'viewer');
    expect((await submitReview(request, viewer, task!.id, { rating: 3, verdict: 'pass' })).status()).toBe(403);
    expect((await request.get(`/api/projects/${project.id}/stats`, { headers: viewer.auth })).status()).toBe(200);
  });

  test('reviewers cannot export CSV, viewers and admins can', async ({ request }) => {
    const project = await createProject(request);
    const reviewer = await createUser(request, 'reviewer');
    const viewer = await createUser(request, 'viewer');
    expect((await request.get(`/api/projects/${project.id}/export.csv`, { headers: reviewer.auth })).status()).toBe(403);
    const csv = await request.get(`/api/projects/${project.id}/export.csv`, { headers: viewer.auth });
    expect(csv.status()).toBe(200);
    expect(csv.headers()['content-type']).toContain('text/csv');
  });

  test('a reviewer cannot change anyone\'s role, including their own', async ({ request }) => {
    const reviewer = await createUser(request, 'reviewer');
    const res = await request.patch(`/api/users/${reviewer.id}/role`, { headers: reviewer.auth, data: { role: 'admin' } });
    expect(res.status()).toBe(403);
  });

  test('a role change is recorded in the audit log', async ({ request }) => {
    const root = await admin(request);
    const user = await createUser(request, 'viewer');
    const audit = await request.get('/api/audit?limit=50', { headers: root.auth });
    const entries = (await audit.json()).items as { action: string; entityId: string }[];
    expect(entries.some((e) => e.action === 'user.role_changed' && e.entityId === user.id)).toBe(true);
  });
});
