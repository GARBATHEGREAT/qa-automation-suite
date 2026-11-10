import { expect, test } from '@playwright/test';
import { PASSWORD, createUser, uid } from '../../helpers/api';
import { signInViaForm } from '../../helpers/ui';

test.describe('Browser: sign in, sign up and sessions', () => {
  test('signed-out visitors are sent to the sign in page @smoke', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('a new person can create an account and lands in the app @smoke', async ({ page }) => {
    const name = `Newcomer ${uid()}`;
    await page.goto('/login');
    await page.getByRole('button', { name: /create an account/i }).click();
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Email').fill(`new-${uid()}@qa.example.com`);
    await page.getByLabel(/^Password/).fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByTestId('current-user')).toContainText(name);
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
  });

  test('registration shows which field is wrong', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /create an account/i }).click();
    await page.getByLabel('Name').fill('Ada');
    await page.getByLabel('Email').fill(`weak-${uid()}@qa.example.com`);
    await page.getByLabel(/^Password/).fill('short');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Password must be at least 10 characters')).toBeVisible();
  });

  test('a wrong password shows an error and keeps you on the page', async ({ page, request }) => {
    const user = await createUser(request, 'reviewer');
    await page.goto('/login');
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill('definitely-wrong-1');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toContainText('Incorrect email or password');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('the session survives a page reload', async ({ page, request }) => {
    const user = await createUser(request, 'reviewer');
    await signInViaForm(page, user);
    await page.reload();
    await expect(page.getByTestId('current-user')).toContainText(user.name);
  });

  test('signing out ends the session, even after a reload', async ({ page, request }) => {
    const user = await createUser(request, 'reviewer');
    await signInViaForm(page, user);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('the form can be switched between sign in and create account', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /create an account/i }).click();
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await page.getByRole('button', { name: /have an account/i }).click();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
});
