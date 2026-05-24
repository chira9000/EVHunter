import { z } from "zod";

const optionalUrl = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v : undefined))
  .pipe(z.union([z.string().url(), z.undefined()]));

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().optional(),
  NEXTAUTH_URL: optionalUrl,
  NEXTAUTH_SECRET: z.string().min(1).default("development-secret-change-me"),
  ODDS_API_KEY: z.string().optional(),
  ODDS_API_BASE_URL: optionalUrl,
  SPORTS_STATS_API_KEY: z.string().optional(),
  SPORTS_STATS_API_BASE_URL: optionalUrl,
  USE_MOCK_DATA: z.coerce.boolean().default(true),
  CRON_SECRET: z.string().optional(),
  DISCORD_WEBHOOK_URL: optionalUrl,
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten());
    throw new Error("Invalid environment configuration");
  }
  return parsed.data;
}

export const env = parseEnv();

export const isMockMode = () =>
  env.USE_MOCK_DATA || !env.ODDS_API_KEY || env.NODE_ENV === "test";
