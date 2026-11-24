# Universal Applicant Screening Engine

## Implementation progress

| Phase | Status | Delivery |
| --- | --- | --- |
| Inspect and integrate Returns | Implemented | The feature starts from the ATS production baseline. Careers and the existing `/returns-assessment` URL share the versioned application flow. Existing Returns answers keep their original labels when reviewed. The Returns URL requires a resume. |
| Versioned questionnaires | Implemented | Open Positions links a Careers posting UUID to a requisition UUID. Recruiters can write, preview, save and publish a draft. Public links use the posting UUID. Existing submissions retain the version that was answered. |
| Synchronization and recruiter review | Implemented | Screening Center lists the selected requisition's applications, synchronizes visible applications on demand and surfaces identity conflicts. Existing pipeline stages and employment records are preserved. Notes, verified evidence, completion and recruiter follow-up decisions are persistent. Existing ATS interview scheduling and attendance are available in the workspace. |
| Resume evidence and access control | Implemented | Sync copies candidate-scoped resume files into a private ATS bucket. An authenticated recruiter administrator can request a short-lived audited download or generate a draft. Drafts are cached by resume digest, questionnaire and evidence processor version. PDF and DOCX support text extraction. Older DOC and scanned PDFs require manual review. |
| Isolated validation | Completed | Build, SQL, API and browser coverage were run with synthetic applicants. See Validation below. |
| Staging rollout | Blocked on staging access | Staging project bindings and authoritative posting and requisition IDs are needed to publish the six questionnaires and verify cross-project behavior against deployed services. |

## Role templates and sources

Select the matching posting and requisition by ID in Open Positions, open the job-description preview, and load the appropriate template. Review it against the posting before publishing. In particular, verify the displayed schedule, pay and physical demands. All six include availability, compensation expectations, reliable attendance and an essential-functions question framed around reasonable accommodation.

| Role | Description used |
| --- | --- |
| Customer Service & Returns Specialist — Compliance Support | `20261123000000_customer_returns_specialist_repost.sql` from the Customer Returns reference, with returns ownership, shipping labels, de-escalation, record accuracy and a written response. |
| Warehouse Middle (Hybrid Maintenance) | Provisional prompts tied to the selected posting. The exact description was absent from the inspected branches, and the public job feed was blocked by the environment proxy. Verify this template against the active posting before publishing it. |
| Warehouse Picker/Packer | `20260609000000_jobs_swap_marketing_for_picker_packer.sql`. Confirm the intended posting is active, since a later migration hides it. |
| Production Assistant | `20260522070000_add_custom_shop_jobs.sql`. |
| Cerakote Applicator | The Custom Paint listing in `20260522070000_add_custom_shop_jobs.sql`. |
| Sales Executive | `20260522020000_seed_real_jobs.sql` and the compensation update in `20260615020000_update_sales_exec_guarantee.sql`. |

## Staging installation

1. Use two isolated staging Supabase projects and a preview deployment. The Careers project should have the existing Careers and employee referral schema. The ATS project should have the current `ats_dev` schema and working `ats_admin_*` RPCs. That base schema is maintained outside this branch. Verify `ats_dev.memberships`, `ats_dev.candidates` (including `application_source`), `ats_dev.requisitions` and the unique requisition/candidate constraint on `ats_dev.requisition_candidates`.
2. Review the public Careers migrations `20261123000000_customer_returns_specialist_repost.sql` and `20261124000000_screening_questionnaires.sql`. Compare existing Returns posting IDs, activity status and historical answers before applying them in that order. The repost is the reference branch's posting data change. The questionnaire migration preserves existing answers and creates the versioned intake contract.
3. Apply `docs/ats/ats-screening-overlay.sql` to the **ATS** staging project. Verify the new bucket is private and browser roles cannot access screening tables directly. Confirm the existing recruiter login has an active `recruiter_admin` membership. Existing Careers and ATS sessions continue to use their respective projects.
4. Configure the preview deployment using `.env.example`. `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` identify Careers. `VITE_MARKETING_DEV_SUPABASE_URL` and `VITE_MARKETING_DEV_SUPABASE_PUBLISHABLE_KEY` identify the existing ATS session project. The server-only `SUPABASE_SERVICE_ROLE_KEY` and `ATS_SCREENING_SERVICE_ROLE_KEY` must belong to those projects respectively. `OPENAI_API_KEY` enables evidence generation. Keep all service credentials in server-side environment settings.
5. In ATS Open Positions, use one posting per requisition. Save a draft, preview it and publish when both the requisition and the posting are open. Confirm `/assessment/<job-posting-uuid>` works and the Returns alias resolves to the intended Returns posting. In the public application, verify that a newly published version requires reloading a stale form and that a prior submission still displays its original answers. Use a staging confirmation stub and synthetic contact details.
6. In Applicant Screening, select the requisition and sync a test application twice. Verify the applicant, answers, private resume, audit events and existing ATS stage. Test ambiguous identity review, batch evidence generation and recruiter save across a fresh login. Verify a second generation for the same file and questionnaire returns the cached draft. The calendar uses the existing ATS workflow, and screening follow-up metadata stays attached to the individual screening case.

Synchronization uses the source application's posting ID. Historical rows with missing posting IDs or nonstandard resume paths need recruiter reconciliation before import. The audit history distinguishes new links, identity reviews, resume synchronization, resume access and saved reviews. Each new attachment download link is valid for 60 seconds. Resume evidence shows source quotes when available and leaves decisions to the recruiter.

For rollback, revert the preview application deployment. Retain the questionnaire, case and audit tables to preserve submitted records. Review separately before reversing a posting activation or changing database access.

## Validation

- `npm run build` passed.
- `npm run test:screening` passed eight tests, including real PGlite migration and authorization checks, immutable questionnaire versions, referral claims, import retries, existing pipeline and employment preservation, evidence caching, PDF extraction, a synthetic HTTP bridge for private resume copying, and mocked inference with exact-quote checks. A separate synthetic DOCX extraction smoke check passed.
- `REVIEW_BROWSER_PATH=/usr/bin/chromium npm run test:screening-ui` passed four Chromium scenarios covering Careers, the Returns URL, secure ATS navigation, recruiter publishing, evidence review persistence and the existing candidate, interview, employment and leadership views.
- Existing Marketing and Referrals automated suites passed 112 and 10 tests respectively. The existing Marketing and Referrals browser suites passed 14 and four scenarios respectively.
- Repository-wide ESLint reports the same 36 errors and five warnings as the production baseline. Feature files passed targeted lint.
- Live Supabase Auth, Storage, deployed Vercel functions and OpenAI remain to be verified with staging credentials. No production migration, deployment or candidate communication was executed.
