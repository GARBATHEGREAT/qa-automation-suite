import { expect, test } from '@playwright/test';
import { admin, createProject, createUser } from '../../helpers/api';

const MISSING = '00000000-0000-4000-8000-000000000000';

test.describe('API: validation and error handling', () => {
  test('rejects bad project input with field-level messages', async ({ request }) => {
    const root = await admin(request);
    const res = await request.post('/api/projects', { headers: root.auth, data: { name: '', requiredReviews: 99 } });
    expect(res.status()).toBe(400);
    const fields = (await res.json()).error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'requiredReviews']));
  });

  test('rejects malformed ids and unknown records', async ({ request }) => {
    const root = await admin(request);
    expect((await request.get('/api/projects/not-a-uuid', { headers: root.auth })).status()).toBe(400);
    expect((await request.get(`/api/projects/${MISSING}`, { headers: root.auth })).status()).toBe(404);
    expect((await request.get(`/api/tasks/${MISSING}`, { headers: root.auth })).status()).toBe(404);
  });

  test('answers invalid JSON with a clean 400', async ({ request }) => {
    const root = await admin(request);
    const res = await request.post('/api/projects', {
      headers: { ...root.auth, 'Content-Type': 'application/json' },
      data: '{not json',
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe('BAD_JSON');
  });

  test('limits bulk task creation to 100 and requires both fields', async ({ request }) => {
    const root = await admin(request);
    const project = await createProject(request);
    const tooMany = Array.from({ length: 101 }, () => ({ prompt: 'p', response: 'r' }));
    expect((await request.post(`/api/projects/${project.id}/tasks`, { headers: root.auth, data: { tasks: tooMany } })).status()).toBe(400);
    expect((await request.post(`/api/projects/${project.id}/tasks`, { headers: root.auth, data: { tasks: [{ prompt: 'only prompt' }] } })).status()).toBe(400);
  });

  test('keeps review ratings between 1 and 5 and verdicts to the allowed set', async ({ request }) => {
    const project = await createProject(request);
    const root = await admin(request);
    const [task] = (
      await (await request.post(`/api/projects/${project.id}/tasks`, { headers: root.auth, data: { tasks: [{ prompt: 'p', response: 'r' }] } })).json()
    ).items as { id: string }[];
    const reviewer = await createUser(request, 'reviewer');
    for (const bad of [{ rating: 0, verdict: 'pass' }, { rating: 6, verdict: 'pass' }, { rating: 3.5, verdict: 'pass' }, { rating: 3, verdict: 'great' }]) {
      const res = await request.post(`/api/tasks/${task!.id}/reviews`, { headers: reviewer.auth, data: bad });
      expect(res.status(), JSON.stringify(bad)).toBe(400);
    }
  });

  test('archived projects accept no new tasks', async ({ request }) => {
    const root = await admin(request);
    const project = await createProject(request);
    expect((await request.delete(`/api/projects/${project.id}`, { headers: root.auth })).status()).toBe(204);
    const res = await request.post(`/api/projects/${project.id}/tasks`, { headers: root.auth, data: { tasks: [{ prompt: 'p', response: 'r' }] } });
    expect(res.status()).toBe(409);
    expect((await res.json()).error.code).toBe('PROJECT_ARCHIVED');
  });

  test('never leaks internals in error responses', async ({ request }) => {
    const root = await admin(request);
    const res = await request.get('/api/projects/not-a-uuid', { headers: root.auth });
    const text = await res.text();
    expect(text).not.toMatch(/node_modules|at .*\.ts|SELECT |stack/i);
  });
});
