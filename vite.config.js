import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Codespaces uses Vite rather than Vercel's serverless runtime.
// Mount only the two existing marketing API handlers, with development-only credentials.
function marketingDevelopmentApi() {
  return {
    name: "marketing-development-api",
    apply: "serve",
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, "");
      const devUrl = env.VITE_MARKETING_DEV_SUPABASE_URL;
      const devKey = env.VITE_MARKETING_DEV_SUPABASE_PUBLISHABLE_KEY;
      const serviceKey = env.MARKETING_DEV_SUPABASE_SERVICE_ROLE_KEY;
      const openaiKey = env.OPENAI_API_KEY;
      const isExpectedDevelopmentProject = devUrl === "https://ofmqhrcmdrdrnvtnykyq.supabase.co";
      const configured = Boolean(isExpectedDevelopmentProject && devKey && serviceKey && openaiKey);
      if (configured) {
        // These values exist only in the local Node server process, never the Vite browser bundle.
        process.env.VITE_SUPABASE_URL = devUrl;
        process.env.VITE_SUPABASE_ANON_KEY = devKey;
        process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
        process.env.OPENAI_API_KEY = openaiKey;
      }
      const routes = {
        "/api/marketing-agent-run": () => import("./api/marketing-agent-run.js"),
        "/api/marketing-orchestration": () => import("./api/marketing-orchestration.js"),
      };
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || "").split("?")[0];
        if (!Object.hasOwn(routes, path)) return next();
        res.setHeader("Cache-Control", "no-store");
        const send = (status, body) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify(body));
        };
        if (req.method !== "POST") return send(405, { error: "Method not allowed" });
        if (!configured) return send(503, { error: "Development agents require the verified development Supabase URL, MARKETING_DEV_SUPABASE_SERVICE_ROLE_KEY, and OPENAI_API_KEY in .env.local. No agent run was started." });
        try {
          let raw = "";
          for await (const chunk of req) {
            raw += chunk.toString();
            if (raw.length > 100_000) return send(413, { error: "Request too large" });
          }
          let body;
          try { body = JSON.parse(raw); }
          catch { return send(400, { error: "Invalid JSON request" }); }
          const mod = await routes[path]();
          const response = {
            setHeader: (...args) => res.setHeader(...args),
            status(code) { res.statusCode = code; return this; },
            json(value) { send(res.statusCode || 200, value); return this; },
          };
          await mod.default({ method: req.method, headers: req.headers, body }, response);
        } catch (error) {
          server.config.logger.error("Marketing development API failed: " + error.message);
          if (!res.writableEnded) send(503, { error: "Development agent API unavailable. No confirmed result; check agent history before retrying." });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), marketingDevelopmentApi()],
});
