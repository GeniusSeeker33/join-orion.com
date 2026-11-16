import { test, expect } from '@playwright/test';

test('signed-out visitors cannot load workspace data and can request an existing-account sign-in link', async ({ page }) => {
  let reads = 0;
  page.on('request', request => { if (request.url().includes('__marketing_rpc')) reads++; });
  await page.goto('/marketing/campaigns?user=signedout');
  await expect(page.getByRole('heading', { name: 'Marketing Hub' })).toBeVisible();
  expect(reads).toBe(0);
  await page.getByLabel('Email address').fill('admin@example.test');
  await page.getByRole('button', { name: 'Email sign-in link' }).click();
  await expect(page.getByRole('status')).toHaveText('Check your email for the sign-in link.');
  expect(await page.evaluate(() => window.__signInRequest.options.shouldCreateUser)).toBe(false);
});

test('existing session loads the hub and sign-out removes private workspace UI', async ({ page }) => {
  await page.goto('/marketing/campaigns?user=1');
  await expect(page.getByRole('heading', { name: 'Marketing Command Center' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'New campaign' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Marketing Hub' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'New campaign' })).toHaveCount(0);
});

test('a signed-in nonmember sees an access error, never campaign controls', async ({ page }) => {
  await page.route('**/__marketing_rpc', route => route.fulfill({ json: { data: null, error: { message: 'Marketing workspace unavailable' } } }));
  await page.goto('/marketing?user=4');
  await expect(page.getByText('Workspace unavailable.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'New campaign' })).toHaveCount(0);
});
