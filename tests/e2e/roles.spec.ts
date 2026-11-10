import { expect, test } from '@playwright/test';
import { createProject, createUser } from '../../helpers/api';
import type { Page } from '@playwright/test';
import { signInFast } from '../../helpers/ui';

// Search only inside the main navigation: project names on the page can contain words like "team".
const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' });

test.describe('Browser: what each role can see and do', () => {
  test('admins see the team and audit pages and the project form @smoke', async ({ page, request }) => {
    const admin = await createUser(request, 'admin');
    await signInFast(page, admin);
    await expect(nav(page).getByRole('link', { name: 'Team', exact: true })).toBeVisible();
    await expect(nav(page).getByRole('link', { name: 'Audit log', exact: true })).toBeVisible();
    await expect(page.getByRole('form', { name: 'Create project' })).toBeVisible();
  });

  test('reviewers do not see admin tools', async ({ page, request }) => {
    const reviewer = await createUser(request, 'reviewer');
    await signInFast(page, reviewer);
    await expect(nav(page).getByRole('link', { name: 'Team', exact: true })).toHaveCount(0);
    await expect(nav(page).getByRole('link', { name: 'Audit log', exact: true })).toHaveCount(0);
    await expect(page.getByRole('form', { name: 'Create project' })).toHaveCount(0);
  });

  test('opening an admin page directly as a reviewer shows "No access"', async ({ page, request }) => {
    const reviewer = await createUser(request, 'reviewer');
    await signInFast(page, reviewer);
    await page.goto('/team');
    await expect(page.getByRole('heading', { name: 'No access' })).toBeVisible();
  });

  test('viewers see insights but no review tab', async ({ page, request }) => {
    const project = await createProject(request);
    const viewer = await createUser(request, 'viewer');
    await signInFast(page, viewer, `/projects/${project.id}`);
    await expect(page.getByRole('tab', { name: 'Insights' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Review' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Download CSV' })).toBeVisible();
  });

  test('an admin can change a role from the Team page', async ({ page, request }) => {
    const admin = await createUser(request, 'admin');
    const person = await createUser(request, 'reviewer');
    await signInFast(page, admin, '/team');
    const select = page.getByLabel(`Role for ${person.email}`);
    await select.selectOption('viewer');
    await expect(select).toHaveValue('viewer');
    await page.reload();
    await expect(page.getByLabel(`Role for ${person.email}`)).toHaveValue('viewer');
  });
});
