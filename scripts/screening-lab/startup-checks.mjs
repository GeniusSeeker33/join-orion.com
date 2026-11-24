import { createServer } from "node:net";
import { readdirSync, readFileSync } from "node:fs";
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
  [/connection refused|no route to host|no response|i\/o timeout|context deadline exceeded/i, "Docker service connection failure reported"],
  [/prune.*already running|a prune operation is already running/i, "Docker reported another active prune"],
  [/no space left|disk quota exceeded/i, "Docker storage exhausted"],
  [/port is already allocated|address already in use/i, "A required port is already in use"],
  [/unhealthy|health check failed/i, "A service failed its health check"],
  [/failed to pull|toomanyrequests|manifest unknown/i, "Docker image retrieval failed"]
];

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
      if (matched.length) console.log(file + ": " + matched.join("; "));
    }
  }
  console.log("Only fixed diagnostic labels are retained. Credentials, SQL, and unfiltered logs are excluded.");
}
