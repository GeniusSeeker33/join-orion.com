# Phase 10.1 operational integration and release readiness

**Decision: keep production on hold.** Feature code is frozen at `548b865994566d0f177875b20a3630fcb834ea93`. This report adds no feature or migration changes.

## Acceptance and evidence

| Evidence | Result |
| --- | --- |
| Owner’s hands-on synthetic demonstration | Confirmed position selection, assessment display, synchronization, weighted evaluations, recruiter review saving, interview scheduling, explicit pipeline advancement, editable rubrics, exclusive Picker/Packer routing and restored Returns navigation. |
| Phase 10.1 frozen-head rerun | 17 Screening tests, 10 referral tests, 13 Screening Chromium scenarios, four demo Chromium scenarios, targeted lint, and production build passed. The mocked browser run emitted an InterviewManager warning when a fixture returned a non-array manager-feedback-label payload. |
| Previous frozen-head runs | Phase 9.2 reported 17 Screening tests and 17 Chromium scenarios across suite and focused runs, targeted lint and build. The browser coverage included no-date review save, persistence, regeneration, Returns switching, synthetic legacy interview tracking and historical evaluation access. |
| Phase 10.1 disposable two-Supabase rehearsal | Passed on managed Docker with repository fixtures and the full frozen migration sequence, including the Phase 9 rubric overlay. The smoke test covered isolated Auth and role restrictions, six eligible destinations, Returns exclusion, referrals, private Storage, stubbed evidence and cache, repeat sync, recruiter re-login and fixture interview persistence. Weighted rubric validation and refresh leasing were exercised separately in the Screening tests. |
| Maintained schema and deployed legacy behavior | Prior read-only reviews established key metadata and some legacy semantics. The checksum-approved schema bundle, operationally representative integration checks and deployed Edge/RPC replay remain outstanding. |

Verify the actual manager-feedback-label response shape and labels in the maintained rehearsal. The Chromium assertions did not cover that console warning. The owner’s acceptance covers interface behavior with synthetic browser storage. It leaves operational authentication, data compatibility, race behavior and rollback to the isolated integration gates below.

## Compatibility and prerequisites

| Surface | Required contract and stop condition |
| --- | --- |
| Careers | Confirm `public.job_postings`, `public.candidate_applications`, screening answers and referral dependencies, versioning and routing triggers, existing Returns intake behavior, and private source resume bucket. Reconcile the migration ledger and exact object definitions before applying overlays. Stop on unknown existing versions or altered trigger ordering. |
| ATS baseline | Confirm `ats_dev.requisitions`, `candidates`, `memberships`, `requisition_candidates`, `interviews`, `candidate_resumes` and `resume_imports`. Check inserted columns and required defaults, immediate unique pair `(requisition_id,candidate_id)`, candidate identity constraints, operational outcome triggers, requisition status/stage types, and the native text-time interview and attendance RPCs. Check active recruiter-admin authorization, table RLS, Storage predicates, grants and execution privileges with the owner. |
| Universal overlay namespaces | Phase 8 did not find Careers mapping, route or queue tables and did find `ats_dev.resume_imports`. Recheck both `public` and `ats_dev` for ATS screening objects. The ATS overlays create in `public`. Stop on an unexpected table, RPC overload, grant or conflicting namespace. First-install scripts contain plain CREATE statements and require an explicit version reconciliation if partially installed. |
| Weighted evaluation | Install `ats-screening-rubrics.sql` after Phase 2. Its FK targets `ats_dev.requisitions`. It uses active recruiter membership, the Phase 2 Returns guard, advisory locking, and version uniqueness. The refresh RPC requires the base evidence table and lease columns. Verify browser roles cannot mutate rubric/draft state directly and service-role RPC execution works only through the approved authorization path. Test stale publication, exact 100-point validation, approved category types and preservation of verified reviews during regeneration. Confirm PostgREST accepts the lease timestamp sentinel and preserves the previous draft on failed refresh. |
| Restored legacy path | Privately verify the deployed `ats-returns-access` list, resume and update contract, `analyze-candidate-resume` and `ats_admin_resume_evaluation` overloads, their actual owners, grants and identity checks. The Phase 7 catalog helper does not fully describe that evaluation RPC or Edge entry points. Preserve the old application UUID and attachment ledgers, original questions, interviews and historical score data. The legacy scheduler remains the only Returns synchronization owner. |
| Existing ATS surfaces | Inventory the candidate directory, employment outcomes, workforce, offers and existing resume/interview relations and public RPC dependencies. Verify the relevant RLS and grants and check for side effects in triggers called by new candidate or assignment inserts. The default synthetic fixture alone cannot substantiate preservation of every maintained ATS relation. |

Use the [Phase 6 security matrix](phase6-operational-security.md), [Phase 7 legacy findings](phase7-rehearsal.md), [Phase 8 constraints](phase8-release-and-acceptance.md), and [Phase 9 weighted review design](phase9-weighted-review.md) as baselines. Verify all six operational Careers posting IDs and seven ATS destinations against the approved mapping manifest. Manual universal eligibility covers five postings and six destinations. Returns stays with legacy sync. Verify the proposed Warehouse Middle posting wording independently before any publication.

## Existing record protection and rehearsal cases

- The import path locks candidate identity checks and uses the source application UUID as case identity. An incompatible case requisition is rejected. Existing assignment insertion uses conflict-do-nothing. Ambiguous contacts go to recruiter review. In isolated replay, test same-UUID and simultaneous imports, alternate Picker/Packer retry, manual ATS intake racing a universal import, conflicting email/phone, and same candidate across multiple requisitions. Watch candidate-table lock duration and verify no operational trigger would overwrite a status or append an unintended side effect.
- Resume copying uses the new private bucket and a candidate/content digest path. Check interrupted copy/registration, duplicate upload, retry, existing object bytes and signed access. Test a candidate already holding a legacy resume and ledger entry. Universal deduplication covers its own case/bucket context, so cross-ledger protection depends on the Returns boundary. Reconcile any past overlap before release.
- Review persistence uses an optimistic revision and audit entry. Weighted draft leases do not update a verified review. Test stale review, two concurrent refresh attempts, failed refresh with prior draft retention, publishing a new rubric, reopen of a saved older version and stale author permissions. Confirm scheduling does not change assignments and explicit advancement affects only eligible New/Screening rows with no outcome or disposition. Test hiring, withdrawal, no-show closure, interview attendance and final disposition.
- Record synthetic snapshots before and after each rehearsal. Compare candidate identity and counts, existing assignments and stages, resume bytes/paths and attachment ledger, interview IDs and attendance, offers, workforce rows, employment outcomes, and old assessment/score records. Compare immutable questionnaire and rubric versions and audit events. Exercise protected UI/RPC routes for anonymous, inactive, non-recruiter and active recruiter sessions, including cross-project JWT rejection.
- In the separately approved synthetic legacy harness, replay list/private resume access, evaluation read/save, interview tracking, identity resolution and subsequent synchronization retry. Confirm Returns never acquires a universal-owned mapping or enters universal import, routing, queue claims, rubric publication or weighted draft generation. Preserve scheduler state and track counts read-only. Test both UI entry points and a switch back to a universal position.

## Read-only export and dependency order

1. The owner runs the [private export commands](phase7-rehearsal.md#private-schema-delivery) from an approved host. Configure libpq services `orion-ats-readonly` and `orion-careers-readonly` outside the checkout per [Phase 8 connection setup](phase8-release-and-acceptance.md#owner-export-and-rehearsal). Use verified TLS and an interactive password prompt or a private mode-0600 passfile. Confirm the endpoint identity, expected principal and `SHOW transaction_read_only` reports `on`. Production write credentials and service keys are unnecessary for this step.
2. Run the Careers and ATS catalog preflights and export the required ATS schema and private function/policy definitions only. Add the operational `ats_admin_resume_evaluation` definitions and the approved Edge contracts to the Phase 7 private review list. Use `pg_get_function_identity_arguments`, `pg_get_functiondef` and function ACLs for exact overloads. Resolve called helpers, FK targets, SQL types, indexes, trigger bodies and authorization dependencies. Inspect deployed Edge sources separately for writes, secrets and network calls. Keep raw extracts on the approved host. Exclude applicant or Auth rows, resumes, job command bodies, Storage objects, Vault data and credentials.
   Run this supplement within the same private export directory. The first query returns definitions and must stay on the approved host until reviewed.

   ```bash
   psql -XqAt -v ON_ERROR_STOP=1 'service=orion-ats-readonly' \
      > "$review_dir/ats-legacy-evaluation-private.txt" <<'SQL'
   begin read only;
   select p.oid::regprocedure, pg_get_functiondef(p.oid), p.proacl, pg_get_userbyid(p.proowner)
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.prokind='f' and p.proname='ats_admin_resume_evaluation'
   order by p.oid::regprocedure::text;
   rollback;
   SQL
   psql -XqAt -v ON_ERROR_STOP=1 'service=orion-ats-readonly' <<'SQL'
   begin read only;
   select to_regclass('public.ats_screening_cases'), to_regclass('ats_dev.ats_screening_cases'),
          to_regclass('public.ats_screening_evidence'), to_regclass('public.ats_screening_rubrics'),
          to_regprocedure('public.ats_screening_publish_rubric(uuid,uuid,integer,jsonb)'),
          to_regprocedure('public.ats_screening_refresh_evidence(uuid,text)');
   rollback;
   SQL
   ```

3. Review the definitions and assemble the approved dependency-ordered `$review_dir/ats-reviewed.sql` with mode 0600, outside Git. Record the SHA-256 after body review. Use an approved private transfer or replay on that host. No maintained bundle or authorized libpq connection was available in this workspace.
4. Use an existing compatible Docker host and check `npm run test:screening-local` against synthetic fixtures. Re-run using the owner-reviewed baseline:

   ```bash
   ORION_ATS_REVIEWED_SQL="$review_dir/ats-reviewed.sql" \
   ORION_ATS_REVIEWED_SHA256='<owner-approved SHA-256>' npm run test:screening-local
   ```

   The existing launcher checks the digest and loopback project identities. Its ATS order is platform/Auth/Storage, approved `ats_dev` baseline and reviewed native dependencies, `ats-screening-overlay.sql`, `ats-screening-phase2.sql`, `ats-screening-rubrics.sql`, then local-only adapters and synthetic seed. Its Careers order is platform/base fixtures and current referral baseline, then `20261124000000_screening_questionnaires.sql`, `20261124010000_screening_sync_queue.sql`, `20261124020000_screening_routing.sql`, and `20261124030000_screening_sync_ownership.sql`. Apply the Phase 8 non-destructive ownership behavior, preserve old leases in quarantine, and leave Returns legacy jobs unchanged.
5. The existing reviewed mode replaces only the ATS baseline. The Careers stack remains a repository-based fixture, and the local runner excludes Edge Runtime. Closing those gaps requires comparing the private Careers metadata to the fixture and a separately reviewed synthetic contract harness for the deployed Returns Edge functions and scheduler behavior. These steps require owner authorization and private sources. The launcher passing alone does not close either gap. Stop on an unrecognized schema object, unauthorized access, failed seed, unexpected write, missing dependency, unsafe network access or unreconciled contract difference.

## Release gates and rollback

1. Record maintained-schema and legacy contract results, recruiter acceptance of the frozen build, and sign-off for the synthetic regression matrix. Record verified IDs, permission deltas, scheduler ownership, restore points and the exact code and DDL versions. Freeze release changes for the approved change window and let any universal leases drain. Stop if there is a pre-existing universal Returns case or an unreconciled active lease.
2. Obtain separate written owner approvals for operational ATS overlays, Careers overlays, the manual API deployment, the intended mapping/route changes, questionnaire publication, and any lift of operational review/sync or weighted generation holds. The current API blocks operational manual sync, routing, review, rubric publication and weighted draft generation. It also blocks production questionnaire publication and worker activation. Keep those holds throughout verification.
3. Only after approval, the named database owner applies the reviewed ATS overlays in order and verifies database objects and permissions. Then apply the reviewed Careers migration sequence and verify queue ownership/quarantine and unchanged Returns status. In the approved release window separately verify the manual-only API, then activate only approved mappings and questionnaire versions. Keep the universal scheduled worker off and the existing Returns scheduler untouched. Stop on an unauthorized read or mutation, duplicate case/assignment, changed existing stage or attendance, missing audit event, mismatched posting/rubric, or unexpected scheduler activity.
4. On a stop condition, keep or reapply the API holds and use the recorded compatible app version. A rollback to an app or worker unaware of Returns ownership or quarantine must keep universal operations disabled. Retain overlay tables, version history, review audits, resume objects and quarantined queues for reconciliation. Restore prior questionnaire pointers only with separate approval and the recorded version history. Do not drop schema or copy operational data without explicit authorization. Keep legacy Returns available and have the owner reconcile any in-flight effect before further changes.

**Next owner action.** Provision approved read-only access on the authorized host, run the private export and review the Phase 9/9.2 additions, then approve the private bundle checksum and the synthetic legacy harness scope. Release approval follows successful replay and regression evidence. No new infrastructure is needed.
