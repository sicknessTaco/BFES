import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { apiRouter } from "./api/routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.resolve(__dirname, "../../frontend");

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/api", apiRouter);

  app.get("/demo/:demoId", (req, res) => {
    return res.sendFile(path.join(frontendPath, "demo_download.html"));
  });
  app.get("/noticias/:slug", (req, res) => {
    return res.sendFile(path.join(frontendPath, "noticia.html"));
  });

  app.use(express.static(frontendPath));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).json({ error: "API route not found" });
    return res.sendFile(path.join(frontendPath, "index.html"));
  });

  return app;
}
