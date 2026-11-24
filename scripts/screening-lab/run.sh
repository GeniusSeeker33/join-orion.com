#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
umask 077
if [[ "$#" -gt 1 || ( "$#" -eq 1 && "$1" != "--acceptance" ) ]]; then
  echo "Usage: $0 [--acceptance]" >&2
  exit 2
fi
if [[ "$#" -eq 1 && -n "${ORION_ATS_REVIEWED_SQL:-}" ]]; then
  echo "Run acceptance with the synthetic fixture. Run the approved replay separately." >&2
  exit 2
fi
# Always use the local daemon and unaffiliated temporary Supabase projects.
unset DOCKER_CONTEXT DOCKER_HOST DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH SUPABASE_ACCESS_TOKEN
unset SUPABASE_CLI_BINARY_OVERRIDE SUPABASE_GO_BINARY
for command in node docker; do
  if ! command -v "$command" >/dev/null; then
    echo "Required command not found: $command" >&2
    exit 1
  fi
done
cli="$PWD/node_modules/.bin/supabase"
if [[ ! -x "$cli" ]]; then
  echo "Supabase CLI is missing. Run npm ci from this checkout." >&2
  exit 1
fi
docker=(docker --host unix:///var/run/docker.sock)
export DOCKER_HOST=unix:///var/run/docker.sock
echo "Checking the local Docker daemon and lab loopback ports"
if ! "${docker[@]}" info --format 'Docker server {{.ServerVersion}}' 2>/dev/null; then
  echo "Cannot reach the local Docker daemon at /var/run/docker.sock." >&2
  exit 1
fi
node scripts/screening-lab/startup-checks.mjs ports
root=$(mktemp -d "${TMPDIR:-/tmp}/orion-screening-lab.XXXXXX")
run=$(node -e 'process.stdout.write(require("crypto").randomBytes(16).toString("hex"))')
export XDG_CONFIG_HOME="$root/config" XDG_DATA_HOME="$root/data" SUPABASE_HOME="$root/supabase-home"
export SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io SUPABASE_TELEMETRY_DISABLED=1
mkdir -p "$XDG_CONFIG_HOME" "$XDG_DATA_HOME" "$SUPABASE_HOME"
stage="fixture preparation"

cleanup() {
  local status=$?
  if [[ "$status" -ne 0 && "$status" -ne 130 && "$status" -ne 143 ]]; then
    local diagnostic
    if diagnostic=$(mktemp "${TMPDIR:-/tmp}/orion-screening-diagnostic.XXXXXX"); then
      node scripts/screening-lab/startup-checks.mjs report "$root" "$stage" >"$diagnostic" || true
      cat "$diagnostic" >&2
      echo "Sanitized diagnostic: $diagnostic" >&2
    fi
  fi
  for realm in careers ats; do
    if [[ -e "$root/$realm.started" ]]; then
      "$cli" stop --workdir "$root/$realm" --no-backup --yes >"$root/$realm.stop.log" 2>&1 || true
      "${docker[@]}" network rm "orion_lab_${realm}_${run:0:12}" >/dev/null 2>&1 || true
    fi
  done
  rm -rf -- "$root"
}
trap cleanup EXIT
node scripts/screening-lab/prepare.mjs "$root" "$run"
start_stack() {
  local realm=$1 network db image container bindings started ended
  local -a cli_diagnostics=()
  stage="$realm Docker network setup"
  network="orion_lab_${realm}_${run:0:12}"
  echo "Creating the private $realm Docker bridge"
  "${docker[@]}" network create --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 "$network" >/dev/null
  touch "$root/$realm.started"
  export SUPABASE_AUTH_JWT_SECRET
  SUPABASE_AUTH_JWT_SECRET=$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')
  stage="$realm signing key generation"
  "$cli" gen signing-key --workdir "$root/$realm" --yes >"$root/$realm.keys.log" 2>&1
  stage="$realm Supabase initialization"
  echo "Initializing $realm PostgreSQL, Auth and Storage and applying local migrations. This may take several minutes."
  # Keep bootstrap stderr available for classification in synthetic mode only.
  if [[ -z "${ORION_ATS_REVIEWED_SQL:-}" ]]; then cli_diagnostics+=(--debug); fi
  started=$(node -p 'new Date().toISOString()')
  if "$cli" start "${cli_diagnostics[@]}" --workdir "$root/$realm" --network-id "$network" \
    --exclude edge-runtime,studio,postgres-meta,realtime,imgproxy,vector,logflare,mailpit >"$root/$realm.start.log" 2>&1; then
    :
  else
    ended=$(node -p 'new Date().toISOString()')
    # Recent Docker events survive removal of the one-shot migration containers.
    "${docker[@]}" events --since "$started" --until "$ended" --filter type=container \
      --filter "label=com.supabase.cli.project=orion_lab_${realm}_${run:0:12}" \
      --filter event=start --filter event=die --filter event=oom \
      --format '{{.Action}} {{index .Actor.Attributes "image"}} {{index .Actor.Attributes "exitCode"}}' \
      >"$root/$realm.events" 2>"$root/$realm.events.log" || true
    return 1
  fi
  stage="$realm network verification"
  "$cli" status --workdir "$root/$realm" --output json >"$root/$realm.status.json" 2>"$root/$realm.status.log"
  "${docker[@]}" network inspect "$network" -f '{{range .Containers}}{{println .Name}}{{end}}' >"$root/$realm.containers"
  while IFS= read -r container; do
    [[ -n "$container" ]] || continue
    bindings=$("${docker[@]}" inspect "$container" --format '{{range .NetworkSettings.Ports}}{{range .}}{{println .HostIp}}{{end}}{{end}}')
    if [[ -n "$bindings" && -n "$(printf '%s\n' "$bindings" | sed '/^127\.0\.0\.1$/d')" ]]; then
      echo "Unexpected non-loopback listener in $realm lab; stopping." >&2
      exit 1
    fi
  done <"$root/$realm.containers"
  db="supabase_db_orion_lab_${realm}_${run:0:12}"
  image=$("${docker[@]}" inspect "$db" --format '{{.Config.Image}}')
  # The initialization jobs use the container name. Runtime services can use the db alias.
  if ! "${docker[@]}" run --rm --network "$network" --entrypoint sh "$image" -ec \
    'pg_isready -h "$1" -p 5432 -U postgres -t 5 && pg_isready -h db -p 5432 -U postgres -t 5' sh "$db" \
    >"$root/$realm.dns.log" 2>&1; then
    echo "$realm PostgreSQL did not answer under its container name and db alias on the private bridge." >&2
    exit 1
  fi
  echo "$realm is ready. Docker bridge DNS, PostgreSQL TCP and loopback bindings verified."
}

# Supabase can prune Docker volumes while cleaning up a failed startup. Start one project at a time.
start_stack careers
start_stack ats
stage="ATS catalog verification"
"${docker[@]}" exec -i "supabase_db_orion_lab_ats_${run:0:12}" \
  psql -XqAt -v ON_ERROR_STOP=1 -U postgres -d postgres < docs/ats/ats-contract-metadata.sql > "$root/ats-contract.json"
if [[ -n "${ORION_ATS_REVIEWED_SQL:-}" ]]; then
  node scripts/screening-lab/contract.mjs "$root/ats-contract.json"
fi
# Scrub any inherited cloud URL, API key, or provider settings before running fixtures.
stage="synthetic browser and API fixture checks"
echo "Verifying separate Auth realms and the synthetic recruiter workflow"
env -i PATH="$PATH" node scripts/screening-lab/smoke.mjs "$root" "$run" "$@"
