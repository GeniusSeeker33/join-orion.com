# Screening acceptance in GitHub Codespaces

The production pilot remains on hold. This procedure uses only disposable projects and synthetic applicants. The maintained ATS schema replay is a separate owner approval gate.

## Why startup failed

Supabase CLI 2.101.0 initializes the PostgreSQL schemas for enabled services before starting runtime containers. `--exclude realtime` controls runtime startup. It leaves the separate Realtime initialization job enabled. That job connects to PostgreSQL across the Docker bridge by the database container name. The reported `ReadyForQuery` confirms the CLI reached PostgreSQL through its own connection. The Realtime connection timeout occurred on the separate container connection. The report does not establish whether that connection failed during DNS resolution or TCP connection. [Supabase CLI 2.101.0 initialization source](https://github.com/supabase/cli/blob/v2.101.0/apps/cli-go/internal/db/start/start.go)

The lab explicitly disables the unused Realtime service in each generated configuration. PostgreSQL, Auth, Storage, the application migrations, health checks and isolated Auth tests still run. The launcher starts Careers and ATS sequentially to avoid overlapping startup cleanup and Docker volume pruning. It verifies published ports are loopback-only and probes Postgres from another container on each private bridge using both the database container name and `db` alias. [Supabase CLI Docker cleanup source](https://github.com/supabase/cli/blob/v2.101.0/apps/cli-go/internal/utils/docker.go)

## Start the lab

Run this in the Codespace terminal using the feature branch and its checked-in lockfile.

```bash
node --version
npm --version
docker --host unix:///var/run/docker.sock info --format '{{.ServerVersion}}'
npm ci
npm run test:screening-acceptance
```

The launcher checks Docker, Node, the repository CLI and the fixed loopback ports. Both stacks may take several minutes, especially on first image pulls. Wait for the synthetic ATS URL and the disposable recruiter login. On failure, use the printed sanitized diagnostic path. It contains fixed startup and error labels. The runner removes the raw temporary CLI logs and synthetic keys on exit. Share only the sanitized report and the stage that failed. Check Docker availability, port conflicts, image space and bridge connectivity before retrying. Leave global Docker volumes alone.

## Open the browser privately

Use GitHub CLI from your own computer, authenticated to the account that owns the Codespace. Find its name with `gh codespace list`. Run the following on your computer in a separate terminal and leave the tunnel open.

```bash
gh codespace ssh -c YOUR_CODESPACE_NAME -- -N -o ExitOnForwardFailure=yes \
  -L 127.0.0.1:5587:127.0.0.1:5587 \
  -L 127.0.0.1:56321:127.0.0.1:56321 \
  -L 127.0.0.1:57321:127.0.0.1:57321
```

Open `http://127.0.0.1:5587/ats` on your computer. The browser also needs the two loopback API ports for Supabase Auth and private resume URLs. Keep every forward bound to `127.0.0.1`. Leave the Postgres and inference ports unforwarded. Keep any auto-detected Codespaces Ports entries private and use the SSH tunnel for this lab. Enter the disposable login printed in the Codespace terminal. Follow the [recruiter acceptance checklist](phase8-release-and-acceptance.md#recruiter-acceptance-on-a-local-computer). Stop the lab and tunnel with Ctrl+C after testing.

## Validation status

Verified on the managed Docker host outside GitHub Codespaces with Node 24.22.3, npm 11.19.1 and Docker 29.9.2. Both sequential starts, Docker DNS/TCP probes, the two Supabase loopback bindings, the full synthetic acceptance fixture and a separate Chromium run against the real local app passed. The repository build, targeted lint and 17 Screening tests passed. All 11 Chromium Screening scenarios passed across the suite and a focused rerun of the Production Assistant scenario. The Codespaces API returned Forbidden from this workspace. The owner still needs to run this procedure in the actual Codespace and verify its SSH forwarding.

## Phase 8.2 follow-up

The owner confirmed that Careers also stops during internal schema initialization with Realtime disabled. This phase of CLI 2.101.0 starts the enabled Storage migration before Auth, prior to applying project SQL. The two labels in the owner’s report identify the phase. They are insufficient to determine the failing component or distinguish a startup process failure from a bridge, credential, or SQL failure.

The next synthetic run captures private CLI debug output and queries recent Docker container events for its own disposable project. The retained report contains fixed labels, SQLSTATE codes, and recognized bootstrap component events and exit codes. A nonzero Storage or Auth exit identifies the corresponding one-shot job. A report without those events may indicate failure before the job was started or unavailable event history. Share the sanitized report alone. Reviewed-schema mode keeps CLI debug disabled.

Use the managed Docker workspace already shown to support the two isolated stacks for hands-on acceptance. Its shared desktop can use the loopback app when an authorized viewer is available. This keeps synthetic Auth, Storage, and application migrations in the acceptance run and avoids another Codespaces investigation before recruiters can proceed. An existing local Docker host is the equivalent fallback when a shared viewer is unavailable. Keep the current network isolation and loopback bindings in either environment.

If neither environment can be shared with recruiters, the next smallest option is a Docker-free, loopback-only demonstration based on the existing browser fixtures. It would be suitable for preliminary navigation, routing, and review feedback with clearly labeled synthetic state. It would leave session isolation, private storage, migrations, and actual schema compatibility for full integration acceptance. A Compose rewrite or changing the pinned CLI should wait until the report identifies a failing component that requires it.

Phase 8.2 was verified on managed Docker 29.9.2. Captured Docker events identified both successful one-shot initialization jobs and their exit codes. Both stacks, the recruiter browser check, 17 Screening tests and targeted lint passed. The original Codespaces failure still needs a report from the updated diagnostics to identify its cause.

## Phase 8.3 Docker-free recruiter demonstration

In your existing Codespace, switch to `feature/universal-screening-engine` and pull its latest commit. Run `npm ci` if dependencies are missing. Start the demo from the repository root.

```bash
npm run demo:screening
```

In Codespaces, open **Ports**, forward port **5191** if it did not appear automatically, and confirm **Port Visibility → Private**. Choose **Open in Browser** on that port and append `/ats` to the forwarded URL. Use the GitHub account authorized for the Codespace. Keep the terminal running while reviewing. The server binds to loopback and recognizes the Codespace's exact forwarded hostname when the Codespaces environment variables are available.

The yellow **DEMONSTRATION — SYNTHETIC DATA ONLY** banner identifies this session. The app opens with a simulated recruiter session. If you sign out, the demo email is prefilled and the password is `demo-only`. The demo stores changes in your browser for this forwarded origin, so keep using the same browser profile and URL. Assessment preview links show versions saved in that browser. To start over, clear site data for the demo origin.

1. In **Open Positions**, choose a requisition. Edit a question, preview it, save a draft, and publish a synthetic revision. Open its assessment link to inspect the published preview.
2. In **Applicant Screening**, explore all six requisitions. In **Warehouse Picker**, open **Synthetic Warehouse Picker Routing**, choose Picker or Packer, and confirm. Find the application in the chosen requisition.
3. Use **Sync visible applications** and **Generate visible evidence drafts**. Open an applicant and compare the preset evidence with the supplied synthetic resume. Save a decision, notes, and completion. Use the review filter to check the result.
4. Open **ATS interview calendar**, set a date and times, and schedule the synthetic interview. Leave the meeting URL blank. Refresh, reopen the applicant, and check the review, evidence, and calendar history.

The separate Vite entry runs the real ATS screens with browser-local synthetic adapters. It makes no database, email, production worker, or AI calls. The demo config blocks network connections and refuses production builds. The regular production build excludes the demo. This is preliminary interface acceptance. The Docker integration tests and maintained-schema replay remain separate gates.
