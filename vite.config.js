import process from "node:process";
import { screeningIsolationError, screeningLabIdentityError } from "./api/_lib/screening-environment.js";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(async ({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ["VITE_", "ATS_SCREENING_"]), ...process.env };
  const error = screeningIsolationError(env) ?? await screeningLabIdentityError(env);
  if (error) throw new Error(error);
  return { plugins: [react(), tailwindcss()] };
});
