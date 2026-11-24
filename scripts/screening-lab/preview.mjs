import { preview } from "vite";
import handler from "../../api/ats-screening.js";

export async function startAcceptancePreview(outDir) {
  return preview({
    configFile: false,
    build: { outDir },
    preview: { host: "127.0.0.1", port: 5587, strictPort: true },
    plugins: [{
      name: "screening-lab-api",
      configurePreviewServer(server) {
        server.middlewares.use("/api", async (req, res) => {
          res.setHeader("Content-Type", "application/json");
          res.status = code => { res.statusCode = code; return res; };
          res.json = value => res.end(JSON.stringify(value));
          if (req.url !== "/ats-screening") return res.status(404).json({ error: "Unavailable in this lab." });
          if (req.method === "POST") {
            try {
              let body = "";
              req.setEncoding("utf8");
              for await (const chunk of req) {
                body += chunk;
                if (body.length > 65536) {
                  res.status(413).json({ error: "Request too large." });
                  return;
                }
              }
              req.body = JSON.parse(body);
            } catch {
              return res.status(400).json({ error: "Invalid input." });
            }
          }
          await handler(req, res);
        });
      }
    }]
  });
}
