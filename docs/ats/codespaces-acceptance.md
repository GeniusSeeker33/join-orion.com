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
