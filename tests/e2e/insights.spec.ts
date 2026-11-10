import { expect, test } from '@playwright/test';
import { addTasks, createProject, createUser, sampleTasks, submitReview } from '../../helpers/api';
import { signInFast } from '../../helpers/ui';

test.describe('Browser: insights and export', () => {
  test('shows the agreement score between two reviewers', async ({ page, request }) => {
    const project = await createProject(request, { requiredReviews: 2 });
    const tasks = await addTasks(request, project.id, sampleTasks(4));
    const [a, b] = [await createUser(request, 'reviewer', 'anna'), await createUser(request, 'reviewer', 'ben')];
    const va = ['pass', 'pass', 'fail', 'fail'] as const;
    const vb = ['pass', 'pass', 'fail', 'pass'] as const; // 3 of 4 agree -> kappa 0.5
    for (let i = 0; i < 4; i++) {
      await submitReview(request, a, tasks[i]!.id, { rating: 4, verdict: va[i]! });
      await submitReview(request, b, tasks[i]!.id, { rating: 3, verdict: vb[i]! });
    }
    const admin = await createUser(request, 'admin');
    await signInFast(page, admin, `/projects/${project.id}`);
    await page.getByRole('tab', { name: 'Insights' }).click();

    await expect(page.getByTestId('kappa')).toHaveText('0.50');
    await expect(page.getByTestId('kappa-meaning')).toContainText('moderate agreement');
    await expect(page.getByText('4 / 4')).toBeVisible();
    const row = page.getByRole('row', { name: /75%/ });
    await expect(row).toContainText('4');
  });

  test('shows "n/a" instead of a made-up number when nothing can be measured', async ({ page, request }) => {
    const project = await createProject(request);
    const admin = await createUser(request, 'admin');
    await signInFast(page, admin, `/projects/${project.id}`);
    await page.getByRole('tab', { name: 'Insights' }).click();
    await expect(page.getByTestId('kappa')).toHaveText('n/a');
  });

  test('downloads the CSV with the signed-in user\'s permission', async ({ page, request }) => {
    const project = await createProject(request, { requiredReviews: 1 });
    const [task] = await addTasks(request, project.id, sampleTasks(1));
    const reviewer = await createUser(request, 'reviewer');
    await submitReview(request, reviewer, task!.id, { rating: 5, verdict: 'pass' });
    const admin = await createUser(request, 'admin');
    await signInFast(page, admin, `/projects/${project.id}`);
    await page.getByRole('tab', { name: 'Insights' }).click();

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download CSV' }).click()]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    const { readFile } = await import('node:fs/promises');
    const text = await readFile((await download.path())!, 'utf8');
    expect(text).toContain('task_id,prompt,response,status,reviewer,rating,verdict,notes');
    expect(text).toContain(reviewer.email);
  });
});
