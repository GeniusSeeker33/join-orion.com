# Phase 6 operational compatibility and security

**Release decision — hold the pilot.** The owner-supplied operational permissions and verified role inventory provide a catalog baseline. The maintained ATS schema package and its privileged function bodies have yet to be replayed. See the [operational mapping inventory](screening-position-mapping.json) and [PR #16 inventory](https://github.com/GeniusSeeker33/join-orion.com/pull/16#issuecomment-7135519176).

## Security contract and collection

Run [the single metadata-only ATS query](ats-contract-metadata.sql) as an authorized read-only user and pass its JSON output to `node scripts/screening-lab/contract.mjs /private/path/ats-contract.json`. It collects table metadata, constraint and trigger identities, effective grants, policy names/roles/commands, RPC signatures and execution grants. It excludes function bodies, predicate expressions, trigger arguments, candidate rows, object rows, users, cron commands and secrets.

| ATS surface | Reported operational baseline |
| --- | --- |
| `candidate_resumes`, `requisition_candidates`, `requisitions` | RLS off. Anonymous and authenticated CRUD denied directly. |
| `candidates`, `interviews` | RLS on. Authenticated CRUD granted; anonymous CRUD denied. |
| `memberships` | RLS on. Authenticated SELECT only. |
| `ats_dev` schema | Anonymous USAGE denied. |
| `ats_admin_assign_requisition`, `ats_admin_create_interview`, `ats_admin_record_resume`, `ats_admin_resumes`, `ats_admin_save_manager_feedback`, `ats_is_recruiter_admin` | SECURITY DEFINER. Anonymous execute denied; authenticated execute granted. |
| `ats_service_sync_returns`, `ats_service_returns_resume_imported` | Anonymous and authenticated execute denied; service-role execute granted. |

Authenticated execute and table privileges require separate authorization verification. Inspect the actual membership and row-scope checks in each reviewed body and policy. The local interview function verifies `auth.uid()`, role, and active membership before insert. The universal import and review functions apply the same recruiter role/active check for human actors, and service-only grants protect direct review calls. The API rejects a missing recruiter identity before reading or writing cases. Those checks cover repository definitions and fixtures. The gate reports reviewed operational grant drift for owner review.

## Minimum private baseline bundle

Follow the [supervised export and checksum replay procedure](phase5-release-readiness.md#supervised-metadata-and-schema-only-handoff). Supply reviewed DDL, not data. Keep the bundle and any predicate or body review outside Git.

- **Relations and keys** — Full DDL for the six `ats_dev` tables in the query, including types, enums, required defaults, FK referenced relations, row identities and checks. The overlay refers to requisition and candidate IDs, candidate name/email/phone/source, membership user/role/active, and assignment requisition/candidate/stage. The UI additionally needs interview date/time, attendance, source event, and candidate resume path/name/upload time. Include a usable, immediate unique index for the exact assignment key `(requisition_id,candidate_id)`. Include the reviewed dependencies for manager/feedback records if the native interview view uses them.
- **Triggers and authorization** — Provide trigger definitions and invoked functions that may fill required columns, rewrite candidate identity, stage or interview metadata, or produce audit effects. Provide the effective ATS schema/table/RPC grants, RLS enablement, and reviewed policy predicates for candidates, interviews and memberships. Include the owner/execution context for definer functions, locked search paths, and all transitive authorization helpers. No operational role credentials are needed in the lab.
- **Storage** — Provide reviewed bucket configuration and policy predicates for Careers `resumes` and ATS `ats-dev-resumes`, including upload, read, signed-link and ownership/prefix checks plus any helper RPCs invoked by the policies. The overlay supplies the separate `ats-screening-resumes` bucket. Supply no Storage object rows or actual resume bytes.
- **Application RPCs** — Request the exact `public.ats_admin_create_interview(uuid,text,date,text,text,text,text)` definition plus dependencies to verify scheduling and time parsing. The reported older `public.ats_admin_save_interview_feedback(uuid,text,text,integer)` does not cover the current manager-feedback route. Export the overloads from the catalog for `ats_admin_directory`, `ats_admin_requisitions`, `ats_admin_assign_requisition`, `ats_admin_record_resume`, `ats_admin_resumes`, `ats_admin_update_attendance`, `ats_admin_hiring_managers`, `ats_admin_manager_feedback_labels`, `ats_admin_save_manager_feedback`, and `ats_is_recruiter_admin`. Match named arguments to current callers. The catalog provides precise identity arguments for functions whose types have not been supplied. Review each reachable definition before replay.
- **Legacy comparison** — Inspect the exact catalog-resolved overloads of `public.ats_service_sync_returns` and `public.ats_service_returns_resume_imported`, their transitive callees, and the Edge Function v9 call sites. The inventory did not publish their identity arguments, so resolve them with the query before requesting a private body. The first is needed for import/match/requisition/write semantics and the second for legacy attachment registration and retry ownership. Inspect any further DB write RPCs discovered in the v9 handler by exact identity, especially interview or attachment mutations. Do not export the scheduler command, secrets, or candidate rows, and keep the legacy RPC package out of the lab until its owner has approved a sanitized synthetic rehearsal.

## Legacy coexistence acceptance

| Check | Local evidence and required operational decision |
| --- | --- |
| Application UUID ownership | Repeat universal sync converges on one case, and the existing PGlite test rejects changing an imported application's requisition. Determine the legacy UUID ledger, conflict constraint and result when another engine already owns the UUID. |
| Candidate match and route | Universal matching checks normalized email/phone and flags ambiguity. Confirm v9 match precedence, inactive/conflicting profiles, recruiter overrides and how existing requisition assignments are reused. |
| Stage and handoff | Repeat imports retain advanced stages in the fixture. A universal review explicitly advances eligible stages only. Determine v9 update fields, conflict branches and whether an assignment update can overwrite later stages. |
| Resume import and retry | The synthetic test keeps a separately owned `ats-dev-resumes` object while repeating a universal `ats-screening-resumes` sync. Establish if `ats_service_returns_resume_imported` marks success before or after upload, what key is unique, and what happens on missing file, reused path, duplicate digest, or retry. Two private buckets can contain the same bytes. |
| Calendar and attendance | A fixture interview remains a single record on retry. Check v9 and its RPCs for writes to interviews, event IDs, attendance, notes and linked stages, then resolve the authoritative writer and update ordering. |
| Scheduler and overlap | The reported five-minute job remains the Returns owner. Review cursor and retry/checkpoint behavior privately and keep Returns outside the universal pilot until the owner signs off. No scheduler change is part of this work. |

The fixture tests preserve known outcomes and private object ownership. They cannot demonstrate safe simultaneous writes with unreplayed legacy functions.

## Release controls

The API rejects questionnaire publication in the production runtime or against either known operational project URL before any database call. This hold is separate from the active-recruiter check in local or isolated Preview. Preview continues to reject operational bindings and the universal worker remains disabled in production. Removing the publication hold to publish approved mappings and templates needs separate owner authorization.

## Recruiter acceptance

Use only disposable projects and synthetic submissions. Complete all steps for each destination in the matrix. This checklist prepares a future acceptance session, with no production publication or communications authorized.

| Public questionnaire | ATS destination to verify |
| --- | --- |
| Customer Service & Returns Specialist — Compliance Support | Returns. Exercise the dedicated link and confirm an older answer set remains intact after republishing. |
| Warehouse Middle (Hybrid Maintenance) | Warehouse Middle. Verify the tape-machine responsibility and obtain posting-owner approval for the wording. |
| Warehouse Picker/Packer | Submit two applications. Leave each unresolved first, then route one to Picker and one to Packer. Confirm each reaches exactly one requisition and the other queue cannot import it. |
| Production Assistant | Production Assistant |
| Cerakote Applicator | Cerakote Applicator |
| Sales Executive | Sales Executive. Submit with an eligible referral and verify exactly one attribution on retry. |

1. Confirm the draft is absent from the public route and only an active recruiter can publish. Submit and reopen the application, checking the full answer set and original questionnaire version.
2. Open Applicant Screening, confirm the requisition and status, and navigate to the linked candidate profile. Retry sync and verify one application, one candidate link and the same assignment stage.
3. Upload a synthetic PDF or DOCX. Check direct anonymous and non-recruiter access is denied, open the signed link as a recruiter, and verify source resume bytes. Request AI evidence from the local stub, read the underlying evidence, and save only the recruiter-verified observations and notes.
4. Set the follow-up decision, schedule an interview and open Candidate Profile to verify the calendar. Sign out and back in. Confirm notes, evidence and schedule persisted, and repeat sync leaves attendance and any advanced stage intact.
5. Repeat with anonymous, authenticated non-recruiter and inactive recruiter sessions against read, publish, resume and stage actions. Record the denial and verify no record changed. Keep automated worker scheduling disabled.

## Validation results

- Production build, targeted ESLint, and diff checks passed.
- Automated tests passed across Screening (15), Marketing (112), and Referrals (10).
- Chromium covered 29 scenarios. Screening passed all 11. Marketing passed 13 of 14 in the suite run and Referrals passed 3 of 4. The Marketing workflow and employee share-to-payroll scenarios passed on focused reruns after intermittent page transitions.
- The disposable two-Supabase lab passed with six questionnaires and seven synthetic applications. It verified separate Auth realms, unauthorized denials, routing, referral attribution, private resumes, stubbed evidence and caching, recruiter persistence, and repeat sync with an existing interview and a separate legacy attachment. The first run found that the anonymous marker read returned successfully. The passing rerun uses a marker with an explicit service-role check. This was a local fixture finding.
- The catalog gate and overlay remain pending rehearsal against the private, maintained ATS baseline. The deployed Returns code and its overlapping write paths remain pending owner review.
