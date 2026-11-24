# Universal Applicant Screening Engine

## Phase 1 implementation progress

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
| Warehouse Middle (Hybrid Maintenance) | Authoritative Hybrid Maintenance requirements supplied in the Phase 2 brief. Verify the staging listing has the same description, schedule and pay before publishing. |
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

## Phase 1 validation

- `npm run build` passed.
- `npm run test:screening` passed eight tests, including real PGlite migration and authorization checks, immutable questionnaire versions, referral claims, import retries, existing pipeline and employment preservation, evidence caching, PDF extraction, a synthetic HTTP bridge for private resume copying, and mocked inference with exact-quote checks. A separate synthetic DOCX extraction smoke check passed.
- `REVIEW_BROWSER_PATH=/usr/bin/chromium npm run test:screening-ui` passed four Chromium scenarios covering Careers, the Returns URL, secure ATS navigation, recruiter publishing, evidence review persistence and the existing candidate, interview, employment and leadership views.
- Existing Marketing and Referrals automated suites passed 112 and 10 tests respectively. The existing Marketing and Referrals browser suites passed 14 and four scenarios respectively.
- Repository-wide ESLint reports the same 36 errors and five warnings as the production baseline. Feature files passed targeted lint.
- Live Supabase Auth, Storage, deployed Vercel functions and OpenAI remain to be verified with staging credentials. No production migration, deployment or candidate communication was executed.

## Phase 2 staging preparation

Phase 2 replaces the provisional Warehouse Middle template with the supplied job requirements. It covers maintenance and warehouse experience, tape-machine and label scenarios, safety and handoffs, the Jeffersonville working schedule, the posted pay and repetitive lifting with reasonable accommodation. Sales now covers B2B prospecting, CRM, resilience, coaching and structured training. The other four templates include role-specific scenarios. Recruiters can edit every prompt before publishing. Existing Customer Returns labels match the original seven prompts, and versioned answers keep their submitted prompts.

### Verify the two projects and position IDs

Use isolated staging projects provisioned from the authorized Careers and ATS baselines. Confirm the projects by project ref against environment ownership or deployment metadata before applying SQL, copying files or enabling a scheduler. The production-based repository does not contain the full ATS base schema. Use the maintained schema-only ATS baseline and an authorized staging recruiter account.

Run [Careers preflight](careers-screening-preflight.sql) on Careers and [ATS preflight](ats-screening-preflight.sql) on ATS using read-only access. They return schema and posting/requisition metadata and aggregate counts. Compare the outputs with the [position mapping manifest](screening-position-mapping.json). The Warehouse Middle posting and requisition and the Customer Service requisition are existing-environment hints. Pick the single intended active Careers posting and open ATS requisition for each role. Keep missing or ambiguous IDs unresolved. Historical applications with missing posting IDs or a different historical posting ID need an audited mapping decision before import.

### Migration packages and order

| Target | Initial installation | Phase 2 upgrade |
| --- | --- | --- |
| Careers | Verify the Returns repost against the migration ledger and actual listing state. If absent and needed in staging, review and apply `20261123000000_customer_returns_specialist_repost.sql`. Apply `20261124000000_screening_questionnaires.sql` once. | Apply `20261124010000_screening_sync_queue.sql` after the questionnaire migration. |
| ATS | Install the maintained ATS baseline, then apply `ats-screening-overlay.sql` once. | Apply `ats-screening-phase2.sql` after the overlay. |

Check the Careers repost ledger and the actual posting rows independently. The repost contains activation changes and preserves posting IDs and historical applications. An existing matching row does not prove the migration ledger recorded it. Check duplicate active matches and ATS relationships before deciding how to reconcile a mismatch. These packages leave existing Sales referral triggers, claims and roles in place.

Both Phase 2 packages are transactional and were reapplied in the synthetic database tests. The original schema-creation migrations are one-time operations. If catalog objects exist with a missing ledger entry, compare column types, constraints, grants and function definitions against the file before reconciling; avoid rerunning the baseline blindly. Roll forward an incomplete baseline from a reviewed schema diff in staging. Run schema-presence checks, role checks and a sample versioned application before enabling the preview.

### Preview configuration and automatic sync

Use a Vercel Preview environment with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_MARKETING_DEV_SUPABASE_URL`, and `VITE_MARKETING_DEV_SUPABASE_PUBLISHABLE_KEY` pointing to the two verified staging projects. Scope `SUPABASE_SERVICE_ROLE_KEY` to Careers and `ATS_SCREENING_SERVICE_ROLE_KEY` to ATS. Set those keys and the staging `OPENAI_API_KEY` as server-only Preview bindings. Use synthetic records and stub the candidate-confirmation function in staging. The ATS session must have an active `recruiter_admin` membership. Confirm the source resume bucket and the ATS screening bucket are private. Confirm the signed ATS download expires after 60 seconds and unauthenticated audiences cannot access the underlying bucket.

The Careers queue records new applications and relevant source changes for published mappings, and backfills historical applications in bounded batches. A worker leases up to eight records per run, retries transient failures with backoff, and leaves manual resume failures and identity conflicts for recruiter action. Authenticated recruiters can still sync manually. Audit records with a null actor indicate the worker. Manual and scheduled imports share the same identity checks, requisition assignment safeguards, and resume hashes. Repeated submissions with the same candidate and resume bytes share an ATS screening object, including existing copies in the Phase 1 screening bucket. Each application retains its own assessment and review.

For an isolated staging trial, set `ATS_SCREENING_CRON_ENABLED=true` and a high-entropy server-only `CRON_SECRET` of at least 32 characters. Run an authorized preview-only scheduler every five minutes against `GET /api/ats-screening` with the secret in the Bearer header. Use a deployment protection bypass binding as needed for the Preview endpoint. Successful responses report only aggregate results. The feature ships with the worker disabled by default, rejects Vercel production requests, and registers no Vercel production schedule. Check the queue state and ATS audit after two runs before increasing scope. On a transient worker timeout, the lease expires and the item can retry. After five attempts, inspect the case and use recruiter Sync or Retry resume sync after correcting the cause. Successful manual recovery appears as synchronized on the case even if the worker previously recorded a failure.

### Legacy Returns compatibility and cutover

The Returns reference contains browser-triggered synchronization, exact-identity checks, ATS assignment, resume evidence review and a Teams follow-up action. The deployed five-minute scheduler and the Edge Function implementations referenced by that UI are unavailable in this checkout. Verify current jobs in PostgreSQL Cron, Vercel and any external scheduler. Compare their source and target project refs, mapping criteria, write scope and recent aggregate activity. The preflight SQL can identify likely PostgreSQL jobs without exposing command bodies.

The universal worker preserves existing pipeline stages and resumes in legacy ATS storage. It updates imported interview metadata independently of recruiter notes and brings assessment answers and private resume access into the matched candidate profile. A recruiter can retain an imported Teams time, or schedule new interviews in the existing ATS calendar. When saving a screening interview time, the recruiter can opt in to move the linked requisition from New or Screening to Interview. Later stages remain intact. Review the imported Teams event and actual ATS calendar before creating a second record. The universal worker does not create Teams meetings or send notifications. Existing copies in a separate legacy resume bucket require a storage reconciliation before cutover. Do not run both workers against the same mapping until this reconciliation and job ownership are confirmed.

### Recruiter acceptance and rollout

1. Verify the six UUID pairs and publish each editable template in staging. Submit a synthetic application for each position, including a Sales referral and the Returns alias. Republish one questionnaire and confirm the first submission retains its exact version and prompts.
2. Verify totals, submitted and pending assessments, waiting reviews, attached resumes, page-level review filters and candidate navigation. Run sync twice with a duplicate submission and create one ambiguous identity. Confirm case-level review and audit state, one candidate and one requisition assignment per matched identity, and preservation of employment and later pipeline stages.
3. Exercise PDF and DOCX extraction, legacy DOC and scanned PDF manual review, private download expiry, repeat evidence requests and batch actions. Validate cache hits against staging OpenAI usage and confirm a human can verify and save evidence and follow-up decisions. Sign out and back in to check persistence. Try public and non-recruiter access.
4. Exercise the existing ATS calendar and a recruiter-confirmed interview stage change including a later-stage candidate. Check Candidate Directory, employment lifecycle and leadership reports. Verify synthetic confirmation traffic stays in the staging stub.
5. Obtain recruiter acceptance and explicit rollout approval. Back up relevant database objects and record aggregate baseline counts. Install the reviewed database packages on their respective targets, apply only approved UUID mappings and deploy the reviewed application. Reconcile and pause overlapping legacy automation before separately approving production scheduler support. Keep the previous deployment available for rollback.
6. If rollback is needed, stop the preview scheduler or clear its enable flag first. Roll back the app deployment and keep all records, questionnaire versions, evidence, audit and private objects intact. Rolling back to the Phase 1 deployment keeps the earlier review RPC available. For rollback to an original unversioned Returns deployment, first rehearse against a staged backup. Record the current Returns posting and published version IDs. Coordinating the older deployment with clearing that specific mapping’s published pointer restores the legacy insert path while preserving the stored versions, responses and referral claims. Reverify the older Returns URL and version history. Restore the recorded pointer when returning to the versioned deployment. Keep the scheduler paused while the mapping is unpublished.

The missing items are two independently verified staging project refs and access, the Preview configuration and deployment access, an authorized staging recruiter account, an OpenAI test binding, all six verified mappings, and visibility into deployed legacy jobs and resume storage. Live data, legacy job events, deployed credentials and production acceptance remain unverified.

### Phase 2 verification results

- The production build and targeted ESLint passed. Repository-wide ESLint reported the baseline 36 errors and five warnings.
- All 130 automated tests passed across Screening (8), Marketing (112) and Referrals (10). Screening coverage used PGlite and synthetic HTTP fixtures for queue leasing and recovery, migration replay with retained data, anonymous and scheduler authorization, repeat imports, shared private resume objects, PDF and DOCX extraction, scanned-PDF and legacy DOC handling, audit attribution, exact-quote inference, cache leases and interview stage preservation.
- All 28 Chromium scenarios passed across Screening (10), Referrals (4) and Marketing (14). The existing Marketing workflow timed out during a screenshot in the combined run and passed in isolation. Screening includes synthetic submissions for all six roles, the Returns route, recruiter scheduling, re-login persistence and candidate profile navigation.
- The existing draft is PR #16. Branch pushes update its commits. Editing PR metadata requires an account with GitHub API access. Live integration and the existing Returns scheduler inventory remain staging acceptance checks.
