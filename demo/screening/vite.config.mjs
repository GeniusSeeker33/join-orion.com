import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const path = value => fileURLToPath(new URL(value, import.meta.url));
const port = 5191;
const forwardedHost = [process.env.CODESPACE_NAME, process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN];
const [name, domain] = forwardedHost;
const allowedHosts = /^[a-z0-9-]+$/.test(name ?? "") && /^[a-z0-9.-]+$/.test(domain ?? "")
  ? [`${name}-${port}.${domain}`] : [];

export default defineConfig(({ command, isPreview }) => {
  if (command !== "serve" || isPreview) throw new Error("Screening demonstration runs only on the Vite dev server.");
  return {
    root: path("./"),
    envDir: false,
    publicDir: false,
    plugins: [react(), tailwindcss()],
    define: {
      "import.meta.env.VITE_ATS_SCREENING_LAB": JSON.stringify("true"),
      "import.meta.env.VITE_MARKETING_DEV_SUPABASE_URL": JSON.stringify("http://127.0.0.1:57321")
    },
    resolve: { alias: [
      { find: /.*\/(?:marketingDevClient|supabaseClient)(?:\.js)?$/, replacement: path("./store.js") },
      { find: /^\.\/client(?:\.js)?$/, replacement: path("./store.js") }
    ] },
    server: {
      host: "127.0.0.1", port, strictPort: true, allowedHosts, ws: false, cors: false,
      fs: { allow: [path("../../")] },
      headers: {
        "Content-Security-Policy": "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'"
      }
    }
  };
});
