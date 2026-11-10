import { expect, type Page } from '@playwright/test';
import { type Account } from './api';

/** Sign in through the real form, the way a person does. */
export async function signInViaForm(page: Page, who: Pick<Account, 'email' | 'password'>) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password').fill(who.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByTestId('current-user')).toBeVisible();
}

/**
 * Faster sign-in for tests that are about something else: log in through the API using the
 * browser's own cookie jar, then open the app (it restores the session from the refresh cookie).
 */
export async function signInFast(page: Page, who: Pick<Account, 'email' | 'password'>, path = '/') {
  const res = await page.request.post('/api/auth/login', { data: { email: who.email, password: who.password } });
  expect(res.status()).toBe(200);
  await page.goto(path);
  await expect(page.getByTestId('current-user')).toBeVisible();
}

export async function submitReviewInUi(page: Page, verdict: 'pass' | 'fail' | 'unsure', rating: number, notes?: string) {
  await page.getByLabel(verdict, { exact: true }).check();
  await page.getByLabel(String(rating), { exact: true }).check();
  if (notes) await page.getByLabel(/Notes/).fill(notes);
  await page.getByRole('button', { name: 'Submit review' }).click();
}
