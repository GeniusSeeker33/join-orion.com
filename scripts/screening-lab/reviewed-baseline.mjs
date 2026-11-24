import { createHash } from "node:crypto";
import { realpath, stat, readFile } from "node:fs/promises";
import { isAbsolute, relative, sep } from "node:path";

export async function readReviewedBaseline(env = process.env, checkout = process.cwd()) {
  const path = env.ORION_ATS_REVIEWED_SQL;
  const sha = env.ORION_ATS_REVIEWED_SHA256;
  if (!path && !sha) return null;
  if (!path || !isAbsolute(path) || !/^[a-f0-9]{64}$/.test(sha ?? "")) {
    throw new Error("Supply an absolute private reviewed SQL path and its approved SHA-256 together.");
  }
  const resolved = await realpath(path);
  const fromCheckout = relative(await realpath(checkout), resolved);
  if (!isAbsolute(fromCheckout) && fromCheckout !== ".." && !fromCheckout.startsWith(".." + sep)) {
    throw new Error("Keep the reviewed baseline outside the repository.");
  }
  const info = await stat(resolved);
  if (!info.isFile() || (info.mode & 0o077) !== 0 || info.size < 1 || info.size > 16 * 1024 * 1024) {
    throw new Error("Use a private regular SQL file (mode 0600, up to 16 MiB).");
  }
  const bytes = await readFile(resolved);
  if (createHash("sha256").update(bytes).digest("hex") !== sha) {
    throw new Error("The file does not match the approved schema-only SHA-256.");
  }
  const sql = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (/^\s*\\/m.test(sql) || sql.includes("\0")) {
    throw new Error("Supply plain SQL without psql commands or binary data.");
  }
  return sql;
}
