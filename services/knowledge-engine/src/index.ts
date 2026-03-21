import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { getConfig } from "./config.js";
import { initDriver, setupSchema, closeDriver } from "./neo4j.js";
import { logger } from "./logger.js";
import healthRouter from "./routes/health.js";
import ingestRouter from "./routes/ingest.js";
import queryRouter from "./routes/query.js";

async function main() {
  const config = getConfig();

  initDriver(config);
  await setupSchema(config.EMBEDDING_DIMENSIONS);

  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "5mb" }));

  app.use(healthRouter);
  app.use(ingestRouter);
  app.use(queryRouter);

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (err && typeof err === "object" && "name" in err && err.name === "ZodError") {
        const zodErr = err as unknown as { issues: unknown[] };
        res.status(400).json({ error: "Validation error", details: zodErr.issues });
        return;
      }
      logger.error({ err }, "Unhandled error");
      res.status(500).json({ error: "Internal server error" });
    },
  );

  const server = app.listen(config.PORT, () => {
    logger.info(`Knowledge Engine listening on port ${config.PORT}`);
  });

  const shutdown = async () => {
    logger.info("Shutting down...");
    server.close();
    await closeDriver();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
