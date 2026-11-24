import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const fixture = fileURLToPath(new URL("./fixture-client.js", import.meta.url));
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: [{ find: /.*\/(?:supabaseClient|marketingDevClient)(?:\.js)?$/, replacement: fixture }] },
  server: { host: "127.0.0.1", port: 5183, strictPort: true }
});
