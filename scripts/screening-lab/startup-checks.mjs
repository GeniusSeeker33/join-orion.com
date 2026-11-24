import { createServer } from "node:net";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const signals = [
  [/Starting database/i, "PostgreSQL startup reached"],
  [/ReadyForQuery/i, "CLI reached PostgreSQL ReadyForQuery"],
  [/Initialising schema/i, "Supabase internal schema initialization reached"],
  [/Seeding globals/i, "Project roles and migration phase reached"],
  [/Starting containers/i, "Runtime service startup reached"],
  [/Waiting for health checks/i, "Runtime health checks reached"],
  [/(?:Realtime\.Repo|Elixir\.Realtime).*DBConnection|DBConnection\.ConnectionError/i, "Realtime/PostgreSQL connection failure"],
  [/no such host|ENOTFOUND|NXDOMAIN|EAI_AGAIN|temporary failure in name resolution/i, "DNS resolution failure reported"],
  [/migrate-call\.js|DB_MIGRATIONS_FREEZE_AT/i, "Storage migration identified in CLI output"],
  [/gotrue(?:["', ]+|\s+)migrate|auth migration/i, "Auth migration identified in CLI output"],
  [/password authentication failed|invalid password|28P01/i, "PostgreSQL credentials rejected"],
  [/connection reset|unexpected EOF|server closed the connection/i, "Migration connection closed unexpectedly"],
  [/exit (?:code )?137|OOMKilled|out of memory/i, "Container killed or memory exhaustion reported"],
  [/connection refused|no route to host|no response|i\/o timeout|context deadline exceeded/i, "Docker service connection failure reported"],
  [/prune.*already running|a prune operation is already running/i, "Docker reported another active prune"],
  [/no space left|disk quota exceeded/i, "Docker storage exhausted"],
  [/port is already allocated|address already in use/i, "A required port is already in use"],
  [/unhealthy|health check failed/i, "A service failed its health check"],
  [/failed to pull|toomanyrequests|manifest unknown/i, "Docker image retrieval failed"]
];

function migrationEvents(path) {
  if (!existsSync(path)) return [];
  const components = {
    postgres: "PostgreSQL",
    "storage-api": "Storage",
    gotrue: "Auth",
    realtime: "Realtime"
  };
  return readFileSync(path, "utf8").split("\n").flatMap(line => {
    const event = /^(start|die|oom) (?:[\w.-]+(?::[0-9]+)?\/)*supabase\/(postgres|storage-api|gotrue|realtime)(?::[\w.-]+)?(?:@sha256:[a-f0-9]{64})?(?: ([0-9]{1,3}))? *$/.exec(line);
    if (!event) return [];
    const [, action, component, exitCode] = event;
    return [components[component] + " container " + action + (exitCode ? " (exit " + exitCode + ")" : "")];
  });
}

const [mode, input, stage] = process.argv.slice(2);
if (mode === "ports") {
  for (const port of [5587, 5588, 56320, 56321, 56322, 57320, 57321, 57322]) {
    try {
      const server = createServer();
      await new Promise((resolve, reject) =>
        server.once("error", reject).listen({ host: "127.0.0.1", port, exclusive: true }, resolve));
      await new Promise(resolve => server.close(resolve));
    } catch {
      console.error(`Cannot reserve lab loopback port ${port}. Stop the process using it before retrying.`);
      process.exitCode = 1;
      break;
    }
  }
} else if (mode === "report") {
  // Never include raw Docker, CLI or reviewed SQL text in a diagnostic.
  console.log("Screening lab failed during " + stage);
  for (const realm of ["careers", "ats"]) {
    const logs = readdirSync(input).filter(name => name.startsWith(realm + ".") && name.endsWith(".log"));
    for (const file of logs.sort()) {
      const raw = readFileSync(join(input, file), "utf8");
      const matched = signals.filter(([pattern]) => pattern.test(raw)).map(([, label]) => label);
      const sqlstates = [...new Set([...raw.matchAll(/\bSQLSTATE[ :=]+([0-9A-Z]{5})\b/g)].map(match => match[1]))];
      if (sqlstates.length) matched.push("SQLSTATE " + sqlstates.slice(0, 8).join(", "));
      if (matched.length) console.log(file + ": " + matched.join("; "));
    }
    const events = migrationEvents(join(input, realm + ".events"));
    if (events.length) console.log(realm + " Docker events: " + events.slice(-18).join("; "));
    else if (existsSync(join(input, realm + ".events"))) console.log(realm + " Docker events: no recognized bootstrap events captured");
  }
  console.log("Only fixed diagnostic labels are retained. Credentials, SQL, and unfiltered logs are excluded.");
}
