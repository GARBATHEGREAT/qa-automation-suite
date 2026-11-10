import { expect, test } from '@playwright/test';
import { addTasks, createProject, createUser, sampleTasks, submitReview, uid } from '../../helpers/api';
import { signInFast, submitReviewInUi } from '../../helpers/ui';

test.describe('Browser: the review workflow', () => {
  test('an admin creates a project and adds a task', async ({ page, request }) => {
    const admin = await createUser(request, 'admin');
    await signInFast(page, admin);
    const name = `E2E project ${uid()}`;
    const form = page.getByRole('form', { name: 'Create project' });
    await form.getByLabel('Project name').fill(name);
    await form.getByLabel('Description').fill('Made in a browser test');
    await form.getByRole('button', { name: 'Create project' }).click();
    await page.getByRole('link', { name: name }).click();

    await page.getByRole('tab', { name: 'Tasks' }).click();
    const add = page.getByRole('form', { name: 'Add task' });
    await add.getByLabel('Prompt').fill('What is the capital of France?');
    await add.getByLabel('AI response to rate').fill('Paris.');
    await add.getByRole('button', { name: 'Add task' }).click();
    await expect(page.getByRole('cell', { name: 'What is the capital of France?' })).toBeVisible();
    await expect(page.getByText('1 tasks')).toBeVisible();
  });

  test('the form refuses an empty project name and shows the server message', async ({ page, request }) => {
    const admin = await createUser(request, 'admin');
    await signInFast(page, admin);
    await page.getByRole('form', { name: 'Create project' }).getByLabel('Project name').fill('   ');
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('a reviewer works through every task, then sees "all caught up" @smoke', async ({ page, request }) => {
    const project = await createProject(request, { requiredReviews: 3 });
    await addTasks(request, project.id, sampleTasks(2));
    const reviewer = await createUser(request, 'reviewer');
    await signInFast(page, reviewer, `/projects/${project.id}`);

    await expect(page.getByTestId('task-prompt')).toContainText('Question 1');
    await submitReviewInUi(page, 'pass', 5, 'Looks right');
    await expect(page.getByTestId('task-prompt')).toContainText('Question 2');
    await submitReviewInUi(page, 'fail', 2);
    await expect(page.getByTestId('all-done')).toContainText('You are all caught up');
    await expect(page.getByTestId('all-done')).toContainText('2 tasks');
  });

  test('submitting without a verdict and rating shows a helpful message', async ({ page, request }) => {
    const project = await createProject(request);
    await addTasks(request, project.id, sampleTasks(1));
    const reviewer = await createUser(request, 'reviewer');
    await signInFast(page, reviewer, `/projects/${project.id}`);
    await page.getByRole('button', { name: 'Submit review' }).click();
    await expect(page.getByRole('alert')).toContainText('Choose a rating and a verdict');
    await expect(page.getByTestId('task-prompt')).toContainText('Question 1');
  });

  test('a reviewer is not shown a task assigned to someone else', async ({ page, request }) => {
    const project = await createProject(request);
    const [mine, theirs] = await addTasks(request, project.id, [
      { prompt: 'Mine: 1+1?', response: '2' },
      { prompt: 'Theirs: 2+2?', response: '4' },
    ]);
    const me = await createUser(request, 'reviewer');
    const other = await createUser(request, 'reviewer');
    const { admin } = await import('../../helpers/api');
    const root = await admin(request);
    await request.patch(`/api/tasks/${mine!.id}`, { headers: root.auth, data: { assigneeId: me.id } });
    await request.patch(`/api/tasks/${theirs!.id}`, { headers: root.auth, data: { assigneeId: other.id } });

    await signInFast(page, me, `/projects/${project.id}`);
    await expect(page.getByTestId('task-prompt')).toContainText('Mine');
    await submitReviewInUi(page, 'pass', 4);
    await expect(page.getByTestId('all-done')).toBeVisible();
  });

  test('the Tasks tab filters by status and paginates', async ({ page, request }) => {
    const project = await createProject(request, { requiredReviews: 1 });
    const tasks = await addTasks(request, project.id, sampleTasks(12));
    const reviewer = await createUser(request, 'reviewer');
    await submitReview(request, reviewer, tasks[0]!.id, { rating: 4, verdict: 'pass' });
    const admin = await createUser(request, 'admin');
    await signInFast(page, admin, `/projects/${project.id}`);
    await page.getByRole('tab', { name: 'Tasks' }).click();

    await expect(page.getByText('Page 1 of 2')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Page 2 of 2')).toBeVisible();
    await page.getByLabel('Status').selectOption('done');
    await expect(page.getByText('1 tasks')).toBeVisible();
    await expect(page.getByText('Page 1 of 1')).toBeVisible();
  });
});
