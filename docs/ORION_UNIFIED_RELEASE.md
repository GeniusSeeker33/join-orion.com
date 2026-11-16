# Orion unified release — integration gate (2026-11-16)

Branch: `release/orion-unified-staging`, forked from `feature/ats-candidate-directory`.
This branch is staging-only. Do not merge into `main` or point it at production databases before the gates below pass.

## Preserved routes
- `/ats` MUST render `ATSWorkspace`, not the legacy `RecruitingDashboard`.
- `/admin/recruiting` retains its current recruiting dashboard.
- `/careers` and `/sales-executive` must preserve applicant intake and tracking.
- Existing `/marketing/*` is the development Marketing Command Center until the new Hub is integrated and tested.

## Integration order
1. Capture current behavior and verify build/lint/tests on the new release branch.
2. Integrate `feature/ats-authorized-seats` with its verified RPC/database dependencies; keep vacancy metrics separate from current employee counts.
3. Integrate `feature/ats-candidate-outreach` as draft-only until Resend server endpoint, permission checks, suppression and audit are verified.
4. Port Marketing Hub from `main` without replacing ATS routing or dev credentials; review 14 migrations in order and provision workspace membership in staging.
5. Port employee referrals from `main`; apply only the needed migration in staging, test referral code propagation and eligibility with synthetic identities.
6. Reconcile Supabase projects, schemas, auth roles, private resume storage and migration history. No automatic name-only candidate/employee matches.
7. Run production build, complete automated suite, authorization tests, end-to-end public application, recruiter and employee referral flows on a preview.
8. Review security/dependency advisories, environment variables, and rollback plan before production approval.

## Known merge hotspots
`src/main.jsx`, `src/RecruitingDashboard.jsx`, `src/AdminDashboard.jsx`, `src/CareersPage.jsx`, `src/lib/supabaseClient.js`, `package.json`, `package-lock.json`.

## Stop conditions
- Any change that routes `/ats` to the legacy dashboard.
- Any production database write or live referral/payroll/email side effect during staging.
- Missing database RPCs or migration drift.
- Incorrect employee identity matching or historical hires counted as current openings.
- Unverified privileged API access or candidate resume exposure.

## Verification status
Source/branch audit performed; consolidated build and E2E tests not yet run. This document is a checklist, not a test pass.
