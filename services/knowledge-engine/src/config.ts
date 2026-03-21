import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NEO4J_URI: z.string().default("bolt://localhost:7687"),
  NEO4J_USER: z.string().default("neo4j"),
  NEO4J_PASSWORD: z.string(),
  OPENAI_API_KEY: z.string(),
  EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  EXTRACTION_MODEL: z.string().default("gpt-4o-mini"),
  EMBEDDING_DIMENSIONS: z.coerce.number().default(1536),
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error"])
    .default("info"),
  MAX_BATCH_SIZE: z.coerce.number().default(10),
  VECTOR_SEARCH_TOP_K: z.coerce.number().default(10),
});

export type Config = z.infer<typeof envSchema>;

let _config: Config | null = null;

export function getConfig(): Config {
  if (!_config) {
    _config = envSchema.parse(process.env);
  }
  return _config;
}
