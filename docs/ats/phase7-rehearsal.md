# Phase 7 operational rehearsal and Returns ownership

**Release decision — hold the manual-only pilot.** The owner’s read-only review confirmed the deployed behaviors below. The reviewed schema-only bundle and an actual replay are still required. [PR #16 read-only review](https://github.com/GeniusSeeker33/join-orion.com/pull/16#issuecomment-7136961522)

| Surface | Verified operational behavior | Proposed release behavior |
| --- | --- | --- |
| Returns import | Matches normalized email or phone and verifies name. Ambiguous identities are flagged. A new candidate gets a Returns-prefixed import key. The RPC inserts only a missing assignment and chooses its initial screening or interview stage based on the source. It preserves existing stages and creates no interviews. | Leave Returns exclusively with the legacy scheduler and interface. For other roles, universal automatic matching requires corroborating email and name and checks for conflicting phone evidence. Phone-only and ambiguous matches stay with the recruiter. |
| Returns attachment | Resolution requires exact normalized name and email and a Returns assignment. Registration checks that the object exists under the candidate prefix. The ledger uses the source application UUID. The Edge handler uploads first, tolerates an existing destination object, and retries unregistered attachments. | Universal uses its own private content-addressed bucket and case ledger. Returns never enters that workflow. Keep the legacy ledger, bucket and scheduler in place. Review simultaneous runs and pagination separately. |
| Native interview | Requires an active recruiter admin and an existing candidate. Validates HH:MM and end-after-start. Inserts a manual interview with unverified attendance and leaves the assignment stage alone. | Screening sync leaves native calendar rows and attendance alone. Explicit Screening review can advance only New/Screening assignments without a recorded outcome or disposition. The operational closure trigger keeps authority over final outcomes and no-show closures. |
| Resume storage | Careers `resumes` and ATS `ats-dev-resumes` are private, capped at 10 MiB, and accept PDF, DOC and DOCX. Careers permits public upload and active admin reads. ATS permits active recruiter-admin reads and inserts. | Keep both policies intact. The API checks active recruiter membership and issues short-lived links for universal resumes only. |

## Ownership and acceptance

- Use the existing Returns workflow to submit and review a synthetic Returns application in rehearsal. Confirm the public questionnaire route still works. Confirm universal listing, routing, manual sync, queue claims and direct ATS import refuse to process that application. Confirm the legacy attachment is unchanged.
- Use the [Phase 6 checklist](phase6-operational-security.md#recruiter-acceptance) for the other five positions and all six eligible requisitions. Route separate synthetic applicants to Picker and Packer. Capture the referral, save recruiter-verified evidence and notes, open the candidate profile, and verify that a repeat sync leaves the native interview and attendance intact. Exercise final outcomes and no-show closure during the rehearsal.
- Apply the Careers ownership migration after routing in the disposable Careers project. Apply the updated ATS Phase 2 overlay after the ATS base overlay in the disposable ATS project. Existing Returns questionnaire links, records and published versions remain intact. The Careers migration deletes historical universal queue rows for legacy-owned postings on the target where it is applied. Inventory any pre-existing universal Returns cases and pending leases before approving operational installation. Preserve those cases for reconciliation, and never run the previous universal worker while applying or rolling back the ownership migration.
- Obtain written owner approval separately for operational DDL, the API release, approved mappings, questionnaire publication, and lifting the API hold on operational sync, routing, and review. Keep the universal scheduler disabled. A future Returns transfer requires a distinct approval and a reviewed UUID and resume-ledger handoff, checkpoint reconciliation, duplicate checks, and rollback rehearsal.

## Private schema delivery

Run from a checkout on the authorized owner host. Configure libpq services `orion-ats-readonly` and `orion-careers-readonly` using the owner’s existing private authentication. The shell uses read-only transactions and a schema-only dump. Leave the outputs and all inspected definitions outside Git.

```bash
umask 077
review_dir="$(mktemp -d "${TMPDIR:-/tmp}/orion-ats-phase7.XXXXXX")"
export PGOPTIONS='-c default_transaction_read_only=on'
psql -XqAt -v ON_ERROR_STOP=1 'service=orion-ats-readonly' \
  -f docs/ats/ats-contract-metadata.sql > "$review_dir/ats-catalog.json"
pg_dump --schema-only --no-owner --schema=ats_dev --format=custom \
  --file="$review_dir/ats-dev.schema" 'service=orion-ats-readonly'
pg_restore --list "$review_dir/ats-dev.schema" > "$review_dir/ats-dev.contents"
pg_restore --schema-only --no-owner --file="$review_dir/ats-dev.sql" "$review_dir/ats-dev.schema"
psql -XqAt -v ON_ERROR_STOP=1 'service=orion-ats-readonly' \
  -f docs/ats/phase7-private-rpc-review.sql > "$review_dir/ats-rpc-review.txt"
for realm in ats careers; do
  psql -XqAt -v ON_ERROR_STOP=1 "service=orion-$realm-readonly" \
    -c "select jsonb_agg(to_jsonb(p)) from pg_policies p
        where schemaname='storage' and tablename='objects'" \
    > "$review_dir/$realm-storage-policy-review.json"
done
printf '%s\n' "$review_dir"
```

The schema dump includes ATS tables, defaults, indexes, foreign keys, triggers, grants and policies in `ats_dev`. Start with requisitions, candidates, interviews, candidate resumes, memberships and requisition assignments. Keep the actual recruiting-outcomes trigger and every reachable helper in the approved dependency set. Privately inspect the two legacy Returns service RPCs and the deployed v9 call sites to identify the exact import-key column/unique constraint, source application ledger and attachment ledger. Their schema placement was absent from the PR comment. If a required ledger or foreign-key dependency lives outside `ats_dev`, capture it with `pg_dump --schema-only --no-owner --table='schema.exact_relation' 'service=orion-ats-readonly'` and include its reviewed types, defaults, supporting indexes and triggers. Export no row data.

Review RPC bodies and transitive dependencies, Storage predicates and helpers, and exact EXECUTE grants from the catalog. Keep unrelated functions and policies out of the assembled bundle. Preserve bucket privacy, the reported MIME list and 10 MiB limit via explicit reviewed local bucket configuration. Apply no operational commands, network integrations, secrets, credentials, Vault, Cron, Auth rows or Storage objects to the lab. Review the raw files in place. Assemble just the approved, dependency-ordered DDL and ACLs as `$review_dir/ats-reviewed.sql`. The approved file requires mode 0600 and a checksum approved after body review.

```bash
chmod 600 "$review_dir/ats-reviewed.sql"
sha256sum "$review_dir/ats-reviewed.sql"
ORION_ATS_REVIEWED_SQL="$review_dir/ats-reviewed.sql" \
ORION_ATS_REVIEWED_SHA256='<owner-approved SHA-256>' npm run test:screening-local
```

The lab starts fresh loopback instances and checks both project markers before any fixture operation. Keep the default fixture run distinct from the reviewed baseline run. Exercise the reviewed legacy RPCs through a synthetic harness once their dependencies and side effects have been approved. Verify same-UUID retries, multiple candidate matches, upload-before-registration, existing objects, concurrent imports, preserved interviews with attendance, and closed assignments before authorizing a pilot.

## Validation

- Production build, targeted ESLint, and all 137 automated tests passed.
- All 29 Chromium scenarios passed across suite runs and focused reruns. Two Screening scenarios and one Marketing scenario needed reruns after intermittent navigation or interaction failures.
- The disposable two-Supabase fixture passed. It excluded Returns from universal processing, exercised all six eligible destinations, converged concurrent retries after failed attachment registration, verified private resume access, and preserved native interview attendance. Earlier attempts exposed fixture setup issues with submission immutability and DOCX MIME typing.
- The private maintained-schema replay remains pending. Testing with synthetic fixtures exercises the implemented ownership boundary, with the deployed legacy import and attachment ledgers reserved for the reviewed replay.
