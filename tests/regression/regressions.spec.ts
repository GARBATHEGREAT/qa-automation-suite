import { expect, test } from '@playwright/test';
import { addTasks, admin, createProject, createUser, uid } from '../../helpers/api';
import { signInFast } from '../../helpers/ui';

/**
 * One test for every bug that was found and fixed. If any of these fails, an old bug has come back.
 * Details of each bug are in docs/bugs/.
 */
test.describe('Regression tests @regression', () => {
  test('BUG-001: an unknown API route answers 404 JSON, not 401, even when signed out', async ({ request }) => {
    const res = await request.get(`/api/this-route-does-not-exist-${uid()}`);
    expect(res.status()).toBe(404);
    expect((await res.json()).error.code).toBe('NOT_FOUND');
  });

  test('BUG-002: tasks added in one batch are listed in the order they were added', async ({ request }) => {
    const project = await createProject(request);
    const tasks = await addTasks(
      request,
      project.id,
      Array.from({ length: 12 }, (_, i) => ({ prompt: `Batch item ${String(i + 1).padStart(2, '0')}`, response: 'r' })),
    );
    const root = await admin(request);
    const listed = await request.get(`/api/projects/${project.id}/tasks?pageSize=100`, { headers: root.auth });
    const ids = ((await listed.json()).items as { id: string }[]).map((t) => t.id);
    expect(ids).toEqual(tasks.map((t) => t.id));
  });

  test('BUG-002: a reviewer is served the first imported task first', async ({ page, request }) => {
    const project = await createProject(request);
    await addTasks(
      request,
      project.id,
      Array.from({ length: 6 }, (_, i) => ({ prompt: `Order check ${i + 1}`, response: 'r' })),
    );
    const reviewer = await createUser(request, 'reviewer');
    await signInFast(page, reviewer, `/projects/${project.id}`);
    await expect(page.getByTestId('task-prompt')).toHaveText('Order check 1');
  });

  test('BUG-003: the sign up form shows every password rule that failed', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /create an account/i }).click();
    await page.getByLabel('Name').fill('Rule Checker');
    await page.getByLabel('Email').fill(`rules-${uid()}@qa.example.com`);
    await page.getByLabel(/^Password/).fill('short');
    await page.getByRole('button', { name: 'Create account' }).click();
    // The error text under the field (not the always-visible hint) must list both rules
    const fieldError = page.locator('small.error');
    await expect(fieldError).toContainText('at least 10 characters');
    await expect(fieldError).toContainText('letter and a number');
  });

  test.describe('BUG-004: small screens', () => {
    test.use({ viewport: { width: 390, height: 800 } });

    test('the Tasks table scrolls inside its own box instead of widening the page', async ({ page, request }) => {
      const project = await createProject(request);
      await addTasks(request, project.id, [{ prompt: 'A fairly long prompt that would make a table wide on a phone screen', response: 'r' }]);
      const admin = await createUser(request, 'admin');
      await signInFast(page, admin, `/projects/${project.id}`);
      await page.getByRole('tab', { name: 'Tasks' }).click();
      await expect(page.getByRole('region', { name: 'Tasks' })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  });
});
