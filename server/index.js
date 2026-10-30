import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import agentsRouter from "./routes/agents.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
app.set("trust proxy", 1);
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  },
}));
app.use(express.json({ limit: "1mb" }));
app.use("/api", agentsRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use((error, _req, res, _next) => {
  const statusCode = error.statusCode || error.status || 500;
  res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
    error: error.message || "Internal server error",
  });
});

app.listen(port, () => {
  console.log(`VoiceCraft server listening on port ${port}`);
});
