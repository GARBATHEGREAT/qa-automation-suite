import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { addTasks, createProject, createUser, sampleTasks } from '../../helpers/api';
import { signInFast } from '../../helpers/ui';

test.describe('Browser: accessibility and responsive layout', () => {
  test('the sign in page has no serious accessibility violations @smoke', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  });

  test('the projects page has no serious accessibility violations', async ({ page, request }) => {
    await createProject(request);
    const admin = await createUser(request, 'admin');
    await signInFast(page, admin);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  });

  test('the review screen has no serious accessibility violations', async ({ page, request }) => {
    const project = await createProject(request);
    await addTasks(request, project.id, sampleTasks(1));
    const reviewer = await createUser(request, 'reviewer');
    await signInFast(page, reviewer, `/projects/${project.id}`);
    await expect(page.getByTestId('task-prompt')).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  });

  test('the sign in form can be completed with the keyboard only', async ({ page, request }) => {
    const user = await createUser(request, 'reviewer');
    await page.goto('/login');
    await page.getByLabel('Email').focus();
    await page.keyboard.type(user.email);
    await page.keyboard.press('Tab');
    await page.keyboard.type(user.password);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('current-user')).toBeVisible();
  });

  test('the page does not scroll sideways on a small screen @smoke', async ({ page, request }) => {
    const project = await createProject(request);
    await addTasks(request, project.id, sampleTasks(2));
    const admin = await createUser(request, 'admin');
    await signInFast(page, admin, `/projects/${project.id}`);
    await page.getByRole('tab', { name: 'Tasks' }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
