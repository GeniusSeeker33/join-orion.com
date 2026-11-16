import { test, expect } from '@playwright/test';

test('employee share → sales landing → application → hire → verified payroll', async ({ page, request }) => {
  const errors = []; page.on('pageerror',error => errors.push(error.message));
  await page.addInitScript(() => sessionStorage.setItem('referral-test-user','2'));
  await page.goto('/referrals');
  await expect(page.getByRole('heading',{name:/Good people know/})).toBeVisible();
  const code = await page.getByLabel('Your referral code',{exact:true}).inputValue();
  await page.getByLabel('Where are you sharing?').selectOption('email');
  const link = new URL(await page.getByLabel('Your personal link').inputValue());
  expect(link.searchParams.get('ref')).toBe(code); expect(link.searchParams.get('utm_source')).toBe('email');
  await expect(page.getByRole('link',{name:'Open email draft'})).toHaveAttribute('href',/mailto:/);
  await page.screenshot({path:'test-results/referral-ui/employee-desktop.png',fullPage:true});
  await page.goto(link.pathname + link.search);
  const applyLink = page.locator('a[href^="/careers?"]').first();
  await expect(applyLink).toHaveAttribute('href',new RegExp(`ref=${code}`)); await applyLink.click();
  await expect(page.getByLabel('Employee referral code (optional)')).toHaveValue(code);
  await page.locator('input[name=firstName]').fill('Browser'); await page.locator('input[name=lastName]').fill('Candidate');
  await page.locator('input[name=email]').fill('browser@example.test'); await page.locator('input[name=phone]').fill('5551234567');
  await page.getByRole('button',{name:/apply for Sales Executive/i}).click();
  await expect(page.getByText(/application received|application has been|thank you|application submitted/i).first()).toBeVisible();
  await request.post('/__referral_test',{data:{operation:'historical-hire',args:{email:'browser@example.test'}}});
  await page.evaluate(() => sessionStorage.setItem('referral-test-user','1'));
  // addInitScript otherwise restores employee identity on each navigation.
  await page.addInitScript(() => sessionStorage.setItem('referral-test-user','1'));
  await page.goto('/admin/referrals');
  await page.getByRole('button',{name:'Review Browser Candidate',exact:true}).click();
  await page.getByLabel('Consultant hire date').fill('2024-02-29');
  await page.getByLabel('I verified this Sales Consultant hire and their employment dates.').check();
  await page.getByRole('button',{name:'Save verified hire'}).click();
  await expect(page.getByText('2024-03-30',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Verify employment',exact:true}).first().click();
  await page.getByLabel('I verified both employees were employed at this milestone and are still employed today.').check();
  await page.getByLabel('Employment verification note').fill('HR verified active employment today.');
  await page.getByRole('button',{name:'Approve for payroll',exact:true}).click();
  await page.getByRole('button',{name:'Record payroll payment',exact:true}).click();
  await page.getByLabel('I verified both employees were employed at this milestone and are still employed today.').check();
  await page.getByLabel('Payroll reference (completed payment)').fill('PAYROLL-TEST-123');
  await page.getByLabel('Payroll has completed this payment. I am recording it, not requesting a transfer.').check();
  await page.getByRole('button',{name:'Record completed payment'}).click();
  await page.getByLabel('Show unpaid milestones due now').uncheck();
  await expect(page.getByText('Payroll: PAYROLL-TEST-123')).toBeVisible();
  await page.screenshot({path:'test-results/referral-ui/admin-desktop.png',fullPage:true});
  expect(errors).toEqual([]);
});

test('mobile employee page has no horizontal overflow and no candidate identities', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('referral-test-user','2'));
  await page.setViewportSize({width:390,height:844}); await page.goto('/referrals');
  await expect(page.getByLabel('Your referral code',{exact:true})).toBeVisible();
  await expect(page.getByText('browser@example.test')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/referral-ui/employee-mobile.png',fullPage:true});
});

test('outsider cannot read admin ledger and signed out users see login', async ({ page }) => {
  await page.goto('/referrals'); await expect(page.getByLabel('Work email')).toBeVisible();
  await page.evaluate(() => sessionStorage.setItem('referral-test-user','3'));
  await page.goto('/admin/referrals'); await expect(page.getByRole('alert')).toContainText('administrator access required');
  await expect(page.getByText('browser@example.test')).toHaveCount(0);
});

test('invalid applicant code is explained and can be removed without losing the form', async ({ page }) => {
  await page.goto('/careers?job=00000000-0000-4000-8000-000000000010&ref=BAD');
  await page.locator('input[name=firstName]').fill('Organic'); await page.locator('input[name=lastName]').fill('Candidate');
  await page.locator('input[name=email]').fill('organic-browser@example.test'); await page.locator('input[name=phone]').fill('5551234567');
  await page.getByRole('button',{name:/apply for Sales Executive/i}).click();
  await expect(page.getByText(/This referral code is unavailable/)).toBeVisible();
  await expect(page.locator('input[name=firstName]')).toHaveValue('Organic');
  await page.getByLabel('Employee referral code (optional)').fill('');
  await page.getByRole('button',{name:/apply for Sales Executive/i}).click();
  await expect(page.getByText(/application received|application has been|thank you|application submitted/i).first()).toBeVisible();
});

