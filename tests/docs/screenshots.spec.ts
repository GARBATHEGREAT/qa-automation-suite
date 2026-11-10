import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { expect, test, type APIRequestContext } from '@playwright/test';
import { ADMIN, loginAs, submitReview, type Account } from '../../helpers/api';

/**
 * Not a test: takes the screenshots used in the ReviewDesk README.
 *   npm run docs:screenshots        (needs the demo data from `npm run seed` in ReviewDesk)
 */
const outDir = path.resolve(process.env.SCREENSHOT_DIR ?? '../reviewdesk/docs/screenshots');
mkdirSync(outDir, { recursive: true });

async function acct(request: APIRequestContext, email: string): Promise<Account> {
  const b = await loginAs(request, email, ADMIN.password);
  return { id: b.user.id, name: b.user.name, email, password: ADMIN.password, role: b.user.role, token: b.accessToken, auth: { Authorization: `Bearer ${b.accessToken}` } };
}

test('README screenshots', async ({ page, request, browser, baseURL }) => {
  const root = await acct(request, ADMIN.email);
  const rita = await acct(request, 'rita@reviewdesk.dev');
  const ravi = await acct(request, 'ravi@reviewdesk.dev');

  const projects = (await (await request.get('/api/projects', { headers: root.auth })).json()).items as { id: string; name: string }[];
  const demo = projects.find((p) => p.name.startsWith('Fact and code check'));
  expect(demo, 'run `npm run seed` in ReviewDesk first').toBeTruthy();

  // Give the demo project realistic reviews (repeat reviews are refused, which is fine)
  const tasks = (await (await request.get(`/api/projects/${demo!.id}/tasks?pageSize=100`, { headers: root.auth })).json()).items as { id: string }[];
  const ritaVerdicts = ['fail', 'pass', 'pass', 'fail', 'pass', 'fail', 'pass', 'pass'] as const;
  const raviVerdicts = ['fail', 'pass', 'pass', 'fail', 'pass', 'pass', 'pass', 'pass'] as const;
  for (let i = 0; i < ritaVerdicts.length; i++) {
    await submitReview(request, rita, tasks[i]!.id, { rating: ritaVerdicts[i] === 'pass' ? 5 : 2, verdict: ritaVerdicts[i]!, notes: ritaVerdicts[i] === 'fail' ? 'Contains an error' : 'Correct' });
    await submitReview(request, ravi, tasks[i]!.id, { rating: raviVerdicts[i] === 'pass' ? 4 : 1, verdict: raviVerdicts[i]! });
  }

  await page.goto('/login');
  await page.screenshot({ path: path.join(outDir, '1-sign-in.png') });

  await page.getByLabel('Email').fill(ADMIN.email);
  await page.getByLabel('Password').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByTestId('current-user')).toBeVisible();
  await page.screenshot({ path: path.join(outDir, '2-projects.png') });

  await page.goto(`/projects/${demo!.id}`);
  await page.getByRole('tab', { name: 'Tasks' }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await page.screenshot({ path: path.join(outDir, '3-tasks.png') });

  await page.getByRole('tab', { name: 'Insights' }).click();
  await expect(page.getByTestId('kappa')).not.toHaveText('n/a');
  await page.screenshot({ path: path.join(outDir, '4-insights.png') });

  // The reviewer's screen, on a project with a fresh task
  const created = await (await request.post('/api/projects', { headers: root.auth, data: { name: 'Screenshot project', description: 'Rate each answer', rubric: 'Pass = fully correct', requiredReviews: 2 } })).json();
  const projectId = created.project.id as string;
  await request.post(`/api/projects/${projectId}/tasks`, { headers: root.auth, data: { tasks: [{ prompt: 'Write a Python function that returns the largest number in a list.', response: 'def largest(xs):\n    return sorted(xs)[0]' }] } });
  const ctx = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
  const p2 = await ctx.newPage();
  await p2.request.post('/api/auth/login', { data: { email: 'rita@reviewdesk.dev', password: ADMIN.password } });
  await p2.goto(`/projects/${projectId}`);
  await expect(p2.getByTestId('task-prompt')).toBeVisible();
  await p2.getByLabel('fail', { exact: true }).check();
  await p2.getByLabel('2', { exact: true }).check();
  await p2.getByLabel(/Notes/).fill('sorted()[0] returns the smallest number, not the largest.');
  await p2.screenshot({ path: path.join(outDir, '5-review.png') });
  await ctx.close();
  await request.delete(`/api/projects/${projectId}`, { headers: root.auth });
});
