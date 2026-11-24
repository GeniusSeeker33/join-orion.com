# Phase 5 ATS compatibility and release readiness

**Recommendation: hold the manual-only production pilot.** The local fixture is aligned to the reported live interview signature and still exercises the Screening overlays using real Auth, PostgREST and Storage. The maintained ATS definitions and write behavior of the deployed Returns RPC remain unverified. The operational UUID inventory was completed in Phase 6. A fixture pass is evidence for the application contract, with a separate release gate for the operational baseline.

See the [Phase 8 release and acceptance gate](phase8-release-and-acceptance.md) for the latest operational preflight, owner schema export and pilot hold.

## Evidence and gaps

The [Phase 4 baseline comment](https://github.com/GeniusSeeker33/join-orion.com/pull/16#issuecomment-7135051198) confirms an interview RPC with `text` start and end times, several native ATS columns, and the deployed Returns stack. The local fixture previously took SQL `time` arguments and now accepts the confirmed text-time shape. A catalog check exercises the actual PostgREST-facing signature in the Docker lab. It checks the production replay for the native resumes, interview and feedback RPCs used by the workspace, required columns, and the usable unique assignment key needed by the import’s `ON CONFLICT` clause.

The accessible ATS development branches contain `docs/ats-development-schema-draft.sql`, which describes older `public.ats_*` tables. It is not the maintained `ats_dev` and `public.ats_admin_*` baseline. This workspace has no authorized operational SQL or Edge Function access. The public job feed returned HTTP 403. The subsequent read-only inventory and [mapping manifest](screening-position-mapping.json) confirm six distinct operational posting UUIDs and seven distinct requisition UUIDs. Staging IDs remain unverified, and fixture IDs are synthetic.

## Supervised metadata and schema-only handoff

1. From the owner’s authorized host and read-only database identity, run [ATS catalog metadata](ats-contract-metadata.sql), [Careers posting metadata](operational-careers-mapping.sql), and [ATS requisition metadata](operational-requisition-mapping.sql) against their respective projects. The catalog query returns one JSON object with columns and types, RLS flags, conflict keys, constraint and trigger names, function identities, and effective execute access. It omits function bodies, default expressions, trigger arguments, and all row data. Use the active posting and open requisition rows to confirm precisely six unique posting IDs and seven unique requisition IDs. Review multiple matches with the owner, including both open warehouse requisitions. Copy only verified UUIDs and public role titles into the operational portion of the manifest.
2. Save the ATS catalog result to a private local path and run the comparator. The example assumes a preconfigured, authorized PostgreSQL service entry named `orion-ats-readonly`. Keep connection credentials in the owner’s existing secret store.

   ```bash
   umask 077
   review_dir=$(mktemp -d "${TMPDIR:-/tmp}/orion-ats-review.XXXXXX")
   PGOPTIONS='-c default_transaction_read_only=on' \
     psql 'service=orion-ats-readonly' -XqAt -v ON_ERROR_STOP=1 \
     -f docs/ats/ats-contract-metadata.sql > "$review_dir/ats-contract.json"
   node scripts/screening-lab/contract.mjs "$review_dir/ats-contract.json"
   ```

   Compare nullability, defaults, grants and trigger effects during review. The inventory reports `ats_admin_save_interview_feedback(uuid,text,text,integer)`. The current UI calls `ats_admin_save_manager_feedback`, so confirm manager attribution through that actual call path. A matching signature does not prove authorization or write behavior. A listed anonymous execute grant needs explicit review of the in-function access check and a negative call in the lab.
3. On that same supervised host, put a schema-only ATS archive in a private directory outside the checkout. List its entries and confirm they contain DDL and grants rather than `TABLE DATA`, sequence values, or bootstrap users. The following scope excludes Auth, Storage, Cron, and Vault schemas. Do not use `supabase db pull` against the operational project for this handoff.

   ```bash
   PGOPTIONS='-c default_transaction_read_only=on' \
     pg_dump --schema-only --schema=ats_dev --no-owner --format=custom \
     --file="$review_dir/ats-dev.schema" 'service=orion-ats-readonly'
   pg_restore --list "$review_dir/ats-dev.schema" > "$review_dir/ats-dev.contents"
   pg_restore --schema-only --no-owner --file="$review_dir/ats-dev.sql" "$review_dir/ats-dev.schema"
   ```

   Privately inspect each function and trigger implementation, including the definitions already in the schema archive. Collect definitions for the reviewed public RPCs and their required public dependencies by exact schema and signature. The catalog output identifies the overloads. For example, run the following query on the owner’s host with output redirected to a private file to review a single known definition.

   ```sql
   begin read only;
   select pg_get_functiondef(
     'public.ats_admin_create_interview(uuid,text,date,text,text,text,text)'::regprocedure
   );
   rollback;
   ```

   Review ownership, fixed `search_path`, authorization, grants, and trigger effects. Check function text and DDL for embedded JWTs, passwords, API keys, Authorization headers, connection URLs, unapproved outbound calls, cron/Edge invocations, or stored-person data. Review every body. A text scan alone cannot certify the bundle. Exclude the legacy sync RPC from the rehearsal unless its reviewed definition is explicitly needed for a compatibility test against isolated services. Do not export Cron commands, Vault data, Storage object rows, or Auth users.
4. Assemble the approved dependency-ordered ATS DDL and explicit reviewed ACLs into one private plain SQL file. Strip psql meta commands such as dump restrict markers from the assembled file. Keep production roles and auth credentials out of the fixture. Record the approved SHA-256 after review. Transfer only the approved schema bundle in the owner’s authorized private channel, and keep it outside Git.

   ```bash
   chmod 600 "$review_dir/ats-reviewed.sql"
   ORION_ATS_REVIEWED_SQL="$review_dir/ats-reviewed.sql" \
   ORION_ATS_REVIEWED_SHA256='<approved SHA-256>' npm run test:screening-local
   ```

   The runner requires an absolute private path outside the checkout and checks the exact approved bytes. It imports only into its disposable ATS instance before the two ATS Screening overlays. It verifies the imported catalog, uses synthetic fixture seed/observation adapters, and exercises the maintained public functions without replacing them. If synthetic inserts expose undocumented required columns, roles, or constraints, stop and adjust the local adapters with the owner. Preserve the baseline definitions. The hash pins the reviewed bytes and does not certify SQL safety. Separately exercise the native resume RPCs against reviewed local Storage policies and the manager feedback path before accepting those surfaces. Keep temporary logs private. Successful default fixture mode does not satisfy this reviewed-bundle gate.
5. Compare the Careers preflight catalog to the lab’s repository migrations, especially referral triggers, upload policies, the current Returns posting and migration ledger. Resolve any differences using separately reviewed schema-only definitions before the release rehearsal. Both projects use synthetic IDs, test accounts, and sample resumes. OpenAI is a loopback fixture and the universal worker stays disabled in this lab.

## Returns coexistence and ownership

| Concern | Deployed Returns evidence | Universal engine and release gate |
| --- | --- | --- |
| Scope and cadence | The inventory reports active PostgreSQL job 1, `returns-assessment-sync`, every five minutes and Edge Function `sync-returns-assessments` version 9. The source query uses exact title and non-null answers, paginated by 100, and invokes `ats_service_sync_returns`. | Published Careers posting and version UUIDs, a scoped queue lease, a single recorded destination for split postings, and approval per mapping. Production scheduling remains disabled. |
| Import identities | The function checks existing imports by source application UUID and resolves candidate identity. The RPC’s matching precedence, ambiguous-match behavior, and import uniqueness are still unverified. | ATS cases are keyed by source application UUID. Candidate lookup considers normalized email and telephone candidates, then requires a verified match or recruiter resolution on conflicts. Assignment retries preserve existing stages. The two engines have no verified shared ownership ledger. |
| Private resumes | The function copies PDF, DOC and DOCX from Careers `resumes` into ATS `ats-dev-resumes`. Its stored paths, missing-file handling and list deduplication still need owner review. | Content-hash deduplication applies within the separate ATS `ats-screening-resumes` bucket. A successful universal sync can still duplicate bytes held by the legacy bucket. Reconcile ownership and integrity by source application, candidate and file digest before a handoff. |
| Interviews and stages | Earlier Returns UI references show guarded Teams follow-up and a stage transition. The deployed Edge Function and RPC write set for interviews, assignment stages and retries is unverified. | Import retains existing stages and source interview metadata. A recruiter-confirmed interview stage change only advances New or Screening. Compare original event IDs, attendance, schedule and stage state before authorizing Returns imports. |

Have the owner inspect the deployed v9 source, `ats_service_sync_returns`, and the scheduler’s effective invocation and checkpoints privately. Return a redacted description of table/field writes, transaction and uniqueness boundaries, resume outcomes, and any interview reconciliation. Share only the scheduler identity, cadence, status, and sanitized outcomes. Leave job 1 active. Exclude Returns from the initial manual pilot as well as from the universal worker until ownership has been reconciled. No broad backfill or retry of Returns data is part of the pilot.

## Approval and rollback gates

A pilot can be reconsidered after the reviewed baseline passes in both disposable stacks, the owner approves linkage of the verified six/seven IDs, and the owner approves a narrow non-Returns scope. The exact operational changes needing approval are:

- Applying the ATS Screening overlay and phase 2 SQL package, including new case/evidence/audit objects, RPC grants, and the private `ats-screening-resumes` bucket and access policy.
- Applying Careers questionnaire, queue, and routing migrations in order, including applicant triggers and service-write grants. Evaluate the existing Returns repost and migration ledger separately before proposing any optional repost change. Obtain posting-owner approval for the Warehouse Middle wording amendment.
- Publishing the verified posting-to-requisition mappings, questionnaires and pilot recruiter access. Routing a split application, syncing it, copying a resume, and advancing a stage are record writes within the approved pilot.
- Merging the draft PR, changing production Vercel bindings if needed, deploying the release, and issuing any production smoke-test submission or communication. Automatic sync should remain disabled in production.

Before pilot release, record authorized backup and restore points for both databases, affected table/grant baselines, active questionnaire versions and route ownership. For rollback, pause new universal imports and questionnaire publication, then follow the Phase 3 compatible API rollback path. Retain existing candidate links, confirmed routes, versioned answers, audit records, and private objects. Reverting to an older API that cannot respect split routing requires the imports to stay paused until a compatible release is ready. Keep the active Returns cron separate. Schedule or role changes for legacy jobs require separate owner approval.

## Verification for this branch

- Production build and targeted lint passed. Repository-wide lint retained the existing 36 errors and five warnings.
- All 135 automated tests passed across Screening and contract tooling (13), Marketing (112), and Referrals (10). Tests verify catalog omissions, signature drift and callable overload detection, assignment uniqueness analysis, private path and checksum handling, and the existing Screening behavior.
- All 29 Chromium scenarios passed across Screening (11), Marketing (14), and Referrals (4). One Marketing navigation timeout and one Referrals navigation interruption passed on focused reruns.
- The two-Supabase synthetic lab passed with the updated interview RPC shape and metadata query. It exercised Auth separation, RLS, six questionnaires and seven routed applicants, referral attribution, duplicate synchronization, a private signed resume, cached local inference, recruiter re-login, and synthetic interview and stage persistence. The approved maintained-baseline replay and legacy v9 write-contract review are outstanding.
