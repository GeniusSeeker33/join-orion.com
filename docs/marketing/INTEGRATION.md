# Marketing Hub integration audit and rollout

Audited 2026-11-16. Source: `GeniusSeeker33/sales_simulator_orion` at
`952343d933820eaa0605e50108a256c425b2c435`. Target baseline:
`GeniusSeeker33/join-orion.com` at `d2a0a1d997c5eaf0aac2791a681feb7d6d4295bc`.

## Audit findings and implementation

The Hub is a governed campaign application, not a standalone page. It depends on
14 marketing migrations, public RPCs over a private `marketing` schema, two
server-side AI handlers, four server helper modules, and five browser libraries.
Both repositories already use React 19, React Router 7, Vite 8 and Supabase 2.
Only OpenAI (runtime), PGlite and Playwright (tests) were added; existing locked
dependencies were preserved.

| Area | Integration |
| --- | --- |
| Routing | Lazy-loaded `/marketing/:section?/:campaignId?`; links from Dealer Admin and Recruiting; return links to both dashboards. |
| Login | Reuses the site's Supabase session and existing-account email sign-in. No second learner client or simulator login. Signing out removes the mounted workspace. |
| Authorization | Preserves explicit `marketing.workspace_members` roles (`viewer`, `contributor`, `approver`, `admin`). Login and `public.admin_users` do not automatically grant marketing access. Provision the same existing users explicitly below. |
| Database | Copies only the marketing migrations, including the fresh-database compatibility repair. No learner/CRM tables or records are copied. |
| AI | `/api/marketing-agent-run` and `/api/marketing-orchestration` verify the bearer token against the destination Supabase project. Privileged RPCs check workspace membership; browser-supplied actor IDs cannot grant access. |
| Approval | Retains human-only approval, revision checks, immutable audit history, policy constraints, Guardian review and recovery workflows. |
| Styles | Marketing styles are scoped beneath `.marketing-hub`; no simulator global stylesheet or navigation is imported. |
| Existing features | Dealer applications, careers, recruiting, job feed and attribution fields retain their current behavior. |

The source Analytics page explicitly defers cross-channel ingestion/reporting.
The Hub generates drafts and records approvals; it does not send email, publish
social posts, or operate advertising accounts. Those integrations are not added
here. Existing source campaigns/assets/users are not migrated; the destination
starts with its own empty Orion workspace.

The other documents in this directory are **upstream design/history references**.
Use this document for destination credentials, authentication and rollout rather
than their simulator-specific deployment instructions.

## Deployment prerequisites

1. Use the same destination Supabase project as the existing site. Configure
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as already required by the site.
   Configure `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` in the server's
   environment only. No credential values are included in this change. The copied
   agents use `gpt-4.1-mini`; verify that the configured account can access it.
2. Apply the 14 `202609...marketing...sql` migrations **in filename order** to a
   staging destination first. The source timestamps are retained for provenance
   and regression tests. On an existing destination with later migrations already
   applied, normal `db push` may refuse these older pending migrations. Review
   `npx supabase db push --remote --include-all --dry-run` (CLI v3; use `--linked` on v2) before using the same
   command without `--dry-run`. Verify the linked project and pending list; never
   reset the hosted database. A pre-existing `marketing` schema requires a schema
   comparison first rather than blindly replaying the foundation migration.
3. Keep `marketing` out of the exposed API schemas. The existing `public` RPC API
   is sufficient. Tables retain RLS and public functions retain their explicit
   execution grants. Review Supabase database advisors after applying migrations.
4. Provision existing destination auth users with explicit workspace roles using
   trusted SQL. Use the user's **destination auth UUID**, not their `admin_users`
   row ID or source simulator UUID. For example, after replacing the placeholder:

   ```sql
   insert into marketing.workspace_members (workspace_id, user_id, role)
   values ('4f52494f-4e00-4000-8000-000000000001',
           'REPLACE_WITH_DESTINATION_AUTH_USER_UUID'::uuid, 'admin')
   on conflict (workspace_id, user_id) do update set role = excluded.role;
   ```

   Do not expose this operation to the browser. Remove membership to revoke Hub
   access. Deactivating an `admin_users` row alone does not revoke this independent
   workspace membership. Use `viewer` for read-only access and `contributor` for
   authors who must not approve.
5. Allow the destination's `/marketing` and `/marketing/**` sign-in redirect URLs
   in Supabase Auth, plus the specific staging origin when testing a preview.
6. Deploy the frontend and both API handlers together. `npm run dev` runs the UI;
   it does not execute Vercel serverless handlers. Use a Vercel preview or an
   appropriate local Vercel development environment for real AI requests.

## Verification

- `npm run build`: production bundle succeeds, with a separate lazy marketing chunk.
- `npm run test:marketing`: 112 passing assertions/subtests against PostgreSQL
  (PGlite), actual RPC migrations, API handlers and domain logic. Includes the full
  ordered marketing migration chain and cross-workspace/role denial checks.
- `npm run test:marketing-ui`: 14 passing browser scenarios exercise the real marketing
  components, destination router/login, Tailwind styles, migrations and API handlers with synthetic users and mocked model
  inference. Set `REVIEW_TEST_BROWSER=chrome` for installed Chrome; the inherited
  configuration defaults to installed Edge. The test fixture is never part of the
  production entry point.
- Scoped ESLint on new marketing components, libraries and API code passes.
- Repository-wide ESLint has pre-existing errors in the admin/public pages.
  No rules were disabled to conceal them.
- `npm audit` reports 14 existing dependency advisories (8 high, 5 moderate,
  1 low), also present before the integration. These need a separate dependency
  update and regression review; no newly added package is identified in that list.

Local tests use synthetic data and mocked AI, not live email or paid inference.
Hosted migrations, membership provisioning, credentials and deployment remain
rollout steps. Before production, verify a member and a nonmember, create a draft,
run Creator/Guardian with the configured model, approve as an approver, and check
that public applications and recruiting still work on the preview.

CLI rollout flags: https://supabase.com/docs/reference/cli/supabase-db-push
