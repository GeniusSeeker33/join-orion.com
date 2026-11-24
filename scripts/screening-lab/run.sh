#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
umask 077
# Always use the local daemon and unaffiliated temporary Supabase projects.
unset DOCKER_CONTEXT DOCKER_HOST SUPABASE_ACCESS_TOKEN
docker=(docker --host unix:///var/run/docker.sock)
export DOCKER_HOST=unix:///var/run/docker.sock
root=$(mktemp -d "${TMPDIR:-/tmp}/orion-screening-lab.XXXXXX")
run=$(node -e 'process.stdout.write(require("crypto").randomBytes(16).toString("hex"))')
export XDG_CONFIG_HOME="$root/config" XDG_DATA_HOME="$root/data" SUPABASE_HOME="$root/supabase-home"
export SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io SUPABASE_TELEMETRY_DISABLED=1
mkdir -p "$XDG_CONFIG_HOME" "$XDG_DATA_HOME" "$SUPABASE_HOME"
cli="$PWD/node_modules/.bin/supabase"

cleanup() {
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
start_stack() (
  realm=$1
  network="orion_lab_${realm}_${run:0:12}"
  "${docker[@]}" network create --opt com.docker.network.bridge.host_binding_ipv4=127.0.0.1 "$network" >/dev/null
  touch "$root/$realm.started"
  export SUPABASE_AUTH_JWT_SECRET
  SUPABASE_AUTH_JWT_SECRET=$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')
  "$cli" gen signing-key --workdir "$root/$realm" --yes >"$root/$realm.keys.log" 2>&1
  echo "Starting synthetic $realm Supabase"
  if ! "$cli" start --workdir "$root/$realm" --network-id "$network" \
     --exclude edge-runtime,studio,postgres-meta,imgproxy,realtime,vector,logflare,mailpit >"$root/$realm.start.log" 2>&1; then
    # Do not print CLI status or environment dumps, which can include keys.
    if [[ "$realm" = ats && -n "${ORION_ATS_REVIEWED_SQL:-}" ]]; then
      echo "Reviewed ATS replay failed. Inspect the approved SQL locally with the schema owner; the private CLI log is not printed." >&2
    else
      rg -i 'failed|error:|fatal|unhealthy' "$root/$realm.start.log" | tail -12 >&2 || true
    fi
    exit 1
  fi
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
)
start_stack careers &
careers_pid=$!
start_stack ats &
ats_pid=$!
failed=0
wait "$careers_pid" || failed=1
wait "$ats_pid" || failed=1
if [[ "$failed" -ne 0 ]]; then exit 1; fi
"${docker[@]}" exec -i "supabase_db_orion_lab_ats_${run:0:12}"   psql -XqAt -v ON_ERROR_STOP=1 -U postgres -d postgres   < docs/ats/ats-contract-metadata.sql > "$root/ats-contract.json"
if [[ -n "${ORION_ATS_REVIEWED_SQL:-}" ]]; then
  node scripts/screening-lab/contract.mjs "$root/ats-contract.json"
fi
# Scrub any inherited cloud URL, API key, or provider settings before running fixtures.
env -i PATH="$PATH" node scripts/screening-lab/smoke.mjs "$root" "$run"
