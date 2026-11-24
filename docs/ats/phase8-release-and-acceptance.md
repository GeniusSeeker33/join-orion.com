# Phase 8 acceptance and release gate

**The manual-only production pilot remains on hold.** The Phase 8 operational read-only check found no Careers `public.screening_positions`, `public.screening_sync_queue`, or `public.screening_application_routes`, and no ATS `ats_dev.ats_screening_cases`. ATS `ats_dev.resume_imports` exists. The proposed ATS overlay uses `public.ats_screening_cases`, so verify that namespace separately before any install. [Operational preflight](https://github.com/GeniusSeeker33/join-orion.com/pull/16#issuecomment-7137861017)

## Owner export and rehearsal

1. Use an authorized local computer or GitHub Codespaces with access to the two projects’ approved read-only Postgres endpoints. From the repository root, verify the branch, check tooling and confirm both sessions. Use PostgreSQL 17 client tools, or a newer client supported by the server. For the replay itself, check Node, npm and local Docker.

   ```bash
   git status -sb
   for tool in psql pg_dump pg_restore node npm docker; do command -v "$tool" || break; done
   psql --version
   pg_dump --version
   docker --host=unix:///var/run/docker.sock info --format '{{.ServerVersion}}'
   ```

2. Configure libpq services named `orion-ats-readonly` and `orion-careers-readonly` in a private `~/.pg_service.conf` using the authorized endpoint, database and read-only user for each project. Use the Supabase-provided TLS trust settings with `sslmode=verify-full`. Use the interactive password prompt, or an approved private passfile with mode 0600 configured outside the checkout. Keep passwords, connection secrets and service-role keys out of shell arguments, shell history, GitHub and chat. No Supabase service-role key is required.

   ```bash
   export PGOPTIONS='-c default_transaction_read_only=on'
   for realm in ats careers; do
     psql -X -v ON_ERROR_STOP=1 "service=orion-$realm-readonly" \
       -c "select current_setting('server_version'), current_setting('transaction_read_only')" || break
   done
   ```

   If either connection fails or returns a transaction mode other than `on`, stop the export. Run this check from the approved network or ask the database owner to provision the read-only accounts and endpoint access. Do not grant write permissions to get around a connection failure.

3. Run the exact extraction commands in the [private export procedure](phase7-rehearsal.md#private-schema-delivery). Its `mktemp` directory is private and outside Git. The ATS schema archive includes `ats_dev.resume_imports`, including its defaults, constraints, indexes, policies, grants and trigger definitions. The separate RPC review output includes public function bodies, owners and explicit ACLs. Include `ats_dev` trigger functions, the reviewed recruiting-outcomes trigger, both legacy Returns RPCs and their checked dependencies in the review. Use the catalog-only gate to identify required overloads. Review and include only the resume bucket policies and their required helpers. Keep Storage objects, applicant and Auth rows, Vault, scheduler commands, credentials and external integration calls out of the bundle. Keep raw extracts on the authorized host.
4. Assemble the reviewed dependency-ordered SQL at `$review_dir/ats-reviewed.sql`. Set mode 0600. Review all function bodies for embedded secrets and side effects, and record the approved checksum only after review. Transfer the approved bytes through a private channel or replay on the owner host. Run the exact checksum-pinned command in the [private export procedure](phase7-rehearsal.md#private-schema-delivery). Stop on a hash mismatch, a catalog difference or a failed fixture seed. Never treat a synthetic run as a maintained-schema replay.
5. Verify actual identity matching and concurrent duplicate protection, assignment preservation, valid and invalid interview timing, attendance, final outcomes and no-show closure, recruiter denial cases, private resume retry and registration against `ats_dev.resume_imports`, exclusive legacy Returns ownership, and repeat sync. Verify referral attribution with synthetic applicants on the isolated Careers stack. Any legacy function or trigger with an unreviewed side effect stays out of the replay and remains a release blocker.

## Recruiter acceptance on a local computer

Run `npm ci` if dependencies are absent, then `npm run test:screening-acceptance`. Wait for the printed URLs and disposable recruiter login. Keep the terminal open. Use [ATS](http://127.0.0.1:5587/ats), [Careers](http://127.0.0.1:5587/careers) and the [Returns intake](http://127.0.0.1:5587/returns-assessment) in a browser on that computer. For Codespaces startup and private browser access, follow the [Codespaces acceptance procedure](codespaces-acceptance.md). Keep both Supabase endpoints and the app on loopback. Ctrl+C stops the lab and deletes its disposable data. This mode uses fixture schemas and serves no operational credentials. Native ATS features outside the Screening acceptance scope can require additional operational RPCs.

- Open Applicant Screening in ATS. Use the seeded synthetic candidates for Warehouse Middle, Production Assistant, Cerakote Applicator, Sales Executive, Warehouse Picker and Warehouse Packer. Submit an additional synthetic Careers application as needed using a unique `example.test` email and a synthetic phone number. Use separate applicants for the two combined-posting destinations, confirm only one requisition per application, and verify the other queue cannot claim it.
- Use the seeded Packer resume or upload the repository's synthetic DOCX. Check signed access, verify the stubbed evidence against the original text, save review notes, and confirm they persist after reload. Navigate to the linked candidate. Check the manual calendar interview and attendance, then repeat synchronization. Verify the Sales referral code `ORION-SYNTHETICLAB` attributes only one referral.
- Use the separate Returns intake link to submit a synthetic assessment and check the confirmation. Confirm its requisition remains outside Applicant Screening's universal import, review and queue. The browser regression exercises the intake route. The scheduled legacy Edge runtime and its reviewed ledger belong to the separate maintained-schema rehearsal.

## Future release order and rollback

1. Obtain reviewed-schema replay sign-off and recruiter acceptance. Obtain separately recorded owner approvals for database changes, the manual-only API release, the five-posting/six-requisition mapping, questionnaire publication and removal of the operational API hold. Keep all those actions blocked until approval.
2. Before changing either project, schedule an approved change window and record rollback versions and restore points. Confirm the universal worker is disabled, and allow outstanding universal invocations to finish before migrations. If any prior universal queue, lease or ATS cases are found, stop for reconciliation. Keep the Returns scheduler unchanged.
3. Recheck the catalog using read-only sessions. On Careers check `select to_regclass('public.screening_positions'), to_regclass('public.screening_sync_queue'), to_regclass('public.screening_application_routes');`. On ATS check `select to_regclass('public.ats_screening_cases'), to_regclass('ats_dev.ats_screening_cases'), to_regclass('ats_dev.resume_imports');`. Run both repository project preflights and the ATS catalog gate. Stop on unexpected relations, grants, owners or baseline differences.
4. Once approved, apply the ATS base overlay and updated Phase 2 overlay to the ATS project first. Apply the Careers migrations in this order on Careers after the ATS overlay verifies successfully.

   - `20261124000000_screening_questionnaires.sql`
   - `20261124010000_screening_sync_queue.sql`
   - `20261124020000_screening_routing.sql`
   - `20261124030000_screening_sync_ownership.sql`

   Keep publication, universal sync and routing blocked through verification. Check mapping ownership and eligibility with `select sync_owner, automation_enabled, count(*) from public.screening_positions group by 1,2;`. Check retained queue history and leases with `select (legacy_quarantined_at is not null) as quarantined, state, count(*), count(lease_id) as retained_lease_tokens from public.screening_sync_queue group by 1,2;`. A retained token in quarantine cannot complete a claim. Stop on any newly queued Returns record, active universal lease, unexpected stage change, missing audit history or an unauthorized resume read.
5. Only after independent approval, deploy the reviewed manual-only API and link the approved mappings. Remove the publication hold only for the approved change, publish the approved versions, and open manual operations for the five verified postings. Keep the universal scheduler disabled. Any queue cleanup or Returns transition requires separate approval.
6. On a stop condition, reapply the API hold, keep the universal worker disabled, and roll back to the previous compatible application deployment. Retain the overlays, questionnaire versions, quarantined queue and audit history, private objects and confirmed routing while reconciling. Do not restore an old universal worker that could ignore quarantine. Escalate any recorded in-flight effect for owner review before reverting database objects or changing publication pointers. Keep legacy Returns serving throughout.

## Validation

- The build, 16 Screening tests, 10 referral tests, 11 Chromium Screening scenarios and targeted lab/test lint passed. Lint on the existing ATS workspace still reports the two pre-existing hook errors and one warning seen at the starting commit.
- The interactive two-Supabase fixture passed its database smoke checks. Chromium signed in to the loopback preview, opened all six eligible requisitions, read the saved review, confirmed universal Returns exclusion and opened the separate Returns intake.
- The actual maintained-schema replay remains pending an authorized private export and approved checksum.
