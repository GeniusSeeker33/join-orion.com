# Sales employee referral program

Program version: `sales-2026-11`.

## Routes and daily operation

- `/referrals`: employee sign-in, unique referral code, channel links, suggested message, email draft, original recruiting flyer, and personal aggregate totals. No applicant identities are exposed to employees.
- `/admin/referrals`: verified Sales roster, immutable referral attribution, hire dates, employment status, milestone approvals, payroll recording, CSV export, audit history.
- `/sales-executive?ref=ORION-…`: public recruitment landing page. Existing tracking parameters and the code flow into `/careers`.
- `/careers`: visible optional referral code; validates the code for the selected job before uploading a resume. The database validates it again atomically when the application is inserted.

Enroll Sales employees using their verified work email, name, and employment start date if known. When unknown, record the date their current employment was verified separately; never substitute that date for a hire date. Do not infer employment from CRM lifecycle labels or the old sales rep list. Employees sign in using that email; enrollment does not send an invitation. Share the employee portal URL with them through your normal internal channel.

Mark a referred candidate Hired in Recruiting, then record their verified Sales Consultant start date in referral administration. Update each employee’s last day employed when employment ends. Dates are inclusive, and the program uses America/New_York dates. Review due milestones regularly; there is no scheduled email notification or automatic payment.

## Agreed rules

- Only enrolled Sales employees can refer. Only explicitly enabled Sales Executive / Sales Consultant job postings qualify. The migration enables currently active postings in the Sales department with those title prefixes; it does not enable Sales Trainer or other roles.
- The first valid code **submitted** with an application gets credit. Visiting a link alone does not reserve credit. The code remains visible and editable before submission, then locks.
- Duplicate normalized applicant emails create only one claim, even across repeated applications. Different emails cannot be reliably recognized as the same person: administrators must check duplicate identities before approving a hire and disqualify duplicates. Self-referrals matching the enrolled employee email are rejected.
- $250 at hire date + 30 days; $250 at + 6 calendar months; $500 at + 12 calendar months. Calendar month arithmetic clamps to the last day of a shorter month, including leap years.
- Both employees must be employed at each interval and still employed when payment is recorded. Administrators explicitly attest to both. This is a verified roster, not a live HR/payroll integration. Employment gaps and rehires require manual review and disqualification where applicable; do not clear a departure date to bypass an ineligible milestone.
- Approve each due milestone after employment verification. Export approved, currently eligible rows to payroll. **Export does not pay or mark paid.** After payroll completes payment, record its reference with a second employment confirmation. Payment entries cannot be duplicated or edited through the app.
- Employment record changes invalidate outstanding approvals. Reverify before recording payroll. Hire dates lock after any milestone approval. Disqualification stops further payments and preserves earlier recorded payments.
- Pausing sharing blocks new applications and employee portal access; it does not cancel otherwise eligible past claims. Marking Sales eligibility false blocks outstanding awards. Existing paid history stays intact.

## Deployment order

1. Apply `supabase/migrations/20261116135929_sales_employee_referrals.sql` to the same Supabase project used by join-orion.com. This is additive; it preserves legacy `referred_by`, `referred_by_id`, and referral payout columns. Do not run the full historical migration directory against an already provisioned project.
2. Deploy the frontend. It uses the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The referral feature needs no AI credentials, service-role key in the browser, new email provider, cron, or payment provider.
3. Allow `https://join-orion.com/referrals` and `https://join-orion.com/admin/referrals` in Supabase Auth redirect URLs (or the existing same-site wildcard). Email authentication and signups must be enabled for new employees. Existing confirmed accounts work. If the email template provides an OTP code, the portal also accepts it directly.
4. Sign in with a confirmed, nonanonymous account whose email is an active `admin_users` row with role `admin`. The database checks this on every admin operation. Current Recruiting access is independently controlled by the site's existing rules.
5. Verify the eligible job list in the admin response, enroll the verified Sales roster (preserve existing rep codes when supplied), and test sign-in and one referral end to end using designated test identities. Do not use real payroll to test.

Only database owners can manage `referrals.eligible_jobs`. When creating a replacement job, enable its actual ID after confirming it is a Sales Consultant opening; deleting a referenced job is intentionally restricted. No automated title matching is run after initial migration.

## Audit and security findings

The existing sales landing page already forwarded query parameters to Careers, so this extends the existing recruiting flow. Legacy referral fields did not provide unique codes, employment histories, or a duplicate-safe milestone ledger. The simulator CRM had employee lifecycle labels but no authoritative employment dates, so no unrelated CRM or Marketing Hub schemas are copied.

Private `referrals` tables have RLS and no direct anonymous/authenticated access. Security-definer RPCs use empty search paths and verified identities from `auth.users`, not editable user metadata. The public validation RPC returns only a boolean. Server-generated claim timestamps, employee bindings, fixed award amounts, uniqueness constraints, row locks, revision checks, and immutable audit records protect the ledger. Existing public applicant intake remains public; HR verification is required before any approval. Public form fields and UTM values are never payroll authority.

Codes use an ORION prefix and either an existing supplied rep code or a random generated suffix. Codes are public attribution identifiers, not credentials. Share links use the production join-orion.com origin. Social share buttons open user-controlled composers; email opens a draft. No message is sent automatically. The flyer is the supplied original, including its printed generic URL; employees must include their unique clickable link alongside it for attribution.

## Verification

`npm run test:referrals` executes the real migration and RPCs in PGlite, including access boundaries, duplicate attribution, employment checks, leap dates, stale approvals, immutability and duplicate payment prevention. `npm run test:referral-ui` runs Chrome against a local synthetic identity adapter backed by the same SQL. Test adapters live only under tests and are not part of the production Vite configuration. No tests send confirmation emails or real payroll payments.

Also run `npm run build` with configured public Supabase environment variables, and `npx eslint src/components/referrals src/lib/referrals.js`. Legacy repository lint errors outside these additions predate this feature.
