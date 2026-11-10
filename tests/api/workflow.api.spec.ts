import { expect, test } from '@playwright/test';
import { addTasks, admin, createProject, createUser, sampleTasks, submitReview } from '../../helpers/api';

test.describe('API: review workflow', () => {
  test('a task moves open -> in_review -> done as reviews arrive', async ({ request }) => {
    const project = await createProject(request, { requiredReviews: 2 });
    const [task] = await addTasks(request, project.id, sampleTasks(1));
    const [a, b] = [await createUser(request, 'reviewer'), await createUser(request, 'reviewer')];

    const first = await submitReview(request, a, task!.id, { rating: 5, verdict: 'pass', notes: 'Correct' });
    expect(first.status()).toBe(201);
    expect((await first.json()).review.taskStatus).toBe('in_review');

    const second = await submitReview(request, b, task!.id, { rating: 4, verdict: 'pass' });
    expect((await second.json()).review.taskStatus).toBe('done');
  });

  test('the same reviewer cannot review a task twice', async ({ request }) => {
    const project = await createProject(request, { requiredReviews: 3 });
    const [task] = await addTasks(request, project.id, sampleTasks(1));
    const a = await createUser(request, 'reviewer');
    expect((await submitReview(request, a, task!.id, { rating: 5, verdict: 'pass' })).status()).toBe(201);
    const dup = await submitReview(request, a, task!.id, { rating: 1, verdict: 'fail' });
    expect(dup.status()).toBe(409);
    expect((await dup.json()).error.code).toBe('ALREADY_REVIEWED');
  });

  test('a finished task refuses extra reviews', async ({ request }) => {
    const project = await createProject(request, { requiredReviews: 1 });
    const [task] = await addTasks(request, project.id, sampleTasks(1));
    const [a, b] = [await createUser(request, 'reviewer'), await createUser(request, 'reviewer')];
    await submitReview(request, a, task!.id, { rating: 5, verdict: 'pass' });
    const late = await submitReview(request, b, task!.id, { rating: 2, verdict: 'fail' });
    expect(late.status()).toBe(409);
    expect((await late.json()).error.code).toBe('TASK_CLOSED');
  });

  test('two reviewers submitting at the same moment both succeed and close the task once', async ({ request }) => {
    const project = await createProject(request, { requiredReviews: 2 });
    const [task] = await addTasks(request, project.id, sampleTasks(1));
    const [a, b] = [await createUser(request, 'reviewer'), await createUser(request, 'reviewer')];
    const [ra, rb] = await Promise.all([
      submitReview(request, a, task!.id, { rating: 5, verdict: 'pass' }),
      submitReview(request, b, task!.id, { rating: 4, verdict: 'pass' }),
    ]);
    expect([ra.status(), rb.status()]).toEqual([201, 201]);
    const root = await admin(request);
    const t = await request.get(`/api/tasks/${task!.id}`, { headers: root.auth });
    expect((await t.json()).task.status).toBe('done');
  });

  test('reviews are blind until you have submitted your own', async ({ request }) => {
    const project = await createProject(request, { requiredReviews: 3 });
    const [task] = await addTasks(request, project.id, sampleTasks(1));
    const [a, b] = [await createUser(request, 'reviewer'), await createUser(request, 'reviewer')];
    await submitReview(request, b, task!.id, { rating: 2, verdict: 'fail' });

    const before = await (await request.get(`/api/tasks/${task!.id}/reviews`, { headers: a.auth })).json();
    expect(before).toMatchObject({ items: [], blind: true });

    await submitReview(request, a, task!.id, { rating: 5, verdict: 'pass' });
    const after = await (await request.get(`/api/tasks/${task!.id}/reviews`, { headers: a.auth })).json();
    expect(after.items).toHaveLength(2);
    expect(after.blind).toBe(false);
  });

  test('next-task serves assigned work first and never repeats a reviewed task', async ({ request }) => {
    const project = await createProject(request);
    const [t1, t2, t3] = await addTasks(request, project.id, sampleTasks(3));
    const rita = await createUser(request, 'reviewer', 'rita');
    const root = await admin(request);
    await request.patch(`/api/tasks/${t3!.id}`, { headers: root.auth, data: { assigneeId: rita.id } });

    const first = await (await request.get(`/api/projects/${project.id}/next-task`, { headers: rita.auth })).json();
    expect(first.task.id).toBe(t3!.id);
    await submitReview(request, rita, t3!.id, { rating: 3, verdict: 'pass' });
    const second = await (await request.get(`/api/projects/${project.id}/next-task`, { headers: rita.auth })).json();
    expect([t1!.id, t2!.id]).toContain(second.task.id);
  });

  test('stats report agreement between reviewers (Cohen\'s kappa)', async ({ request }) => {
    const project = await createProject(request, { requiredReviews: 2 });
    const tasks = await addTasks(request, project.id, sampleTasks(4));
    const [a, b] = [await createUser(request, 'reviewer'), await createUser(request, 'reviewer')];
    const va = ['pass', 'pass', 'fail', 'fail'] as const;
    const vb = ['pass', 'pass', 'fail', 'pass'] as const;
    for (let i = 0; i < 4; i++) {
      await submitReview(request, a, tasks[i]!.id, { rating: 4, verdict: va[i]! });
      await submitReview(request, b, tasks[i]!.id, { rating: 3, verdict: vb[i]! });
    }
    const root = await admin(request);
    const stats = await (await request.get(`/api/projects/${project.id}/stats`, { headers: root.auth })).json();
    // observed 0.75, expected 0.5 -> kappa 0.5
    expect(stats.agreement.averageKappa).toBeCloseTo(0.5, 3);
    expect(stats.agreement.interpretation).toContain('moderate');
    expect(stats.tasks).toMatchObject({ done: 4, total: 4 });
    expect(stats.reviews).toMatchObject({ total: 8, averageRating: 3.5 });
  });

  test('CSV export is complete and safe to open in a spreadsheet', async ({ request }) => {
    const project = await createProject(request, { requiredReviews: 1 });
    const [task] = await addTasks(request, project.id, [{ prompt: 'Say, "hello"', response: '=1+1' }]);
    const a = await createUser(request, 'reviewer');
    await submitReview(request, a, task!.id, { rating: 5, verdict: 'pass', notes: '@note' });
    const root = await admin(request);
    const res = await request.get(`/api/projects/${project.id}/export.csv`, { headers: root.auth });
    const text = await res.text();
    expect(text.split('\n')[0]).toBe('task_id,prompt,response,status,reviewer,rating,verdict,notes');
    expect(text).toContain('"Say, ""hello"""');
    expect(text).toContain("'=1+1");
    expect(text).toContain("'@note");
    expect(res.headers()['content-disposition']).toContain('attachment');
  });
});
