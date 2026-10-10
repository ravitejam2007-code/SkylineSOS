import { z } from "npm:zod@3.24.2";

const EnvSchema = z.object({
  SUPABASE_URL: z.string().url().default("http://127.0.0.1:54321"),
  SUPABASE_ANON_KEY: z.string().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(""),
  APP_ORIGIN: z.string().default("*"),
  RAZORPAY_KEY_ID: z.string().default(""),
  RAZORPAY_KEY_SECRET: z.string().default(""),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(""),
  RAZORPAY_MODE: z.enum(["test", "live"]).default("test"),
  CHECKOUT_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  MEMBER_CODE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info")
});

function parseDotenv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...rest] = trimmed.split("=");
      const val = rest.join("=").trim().replace(/^["']|["']$/g, "");
      if (key && val) {
        result[key.trim()] = val;
      }
    }
  }
  return result;
}

function tryReadEnvFile(filePath: string): string | null {
  try {
    if (typeof Deno !== "undefined" && typeof Deno.readTextFileSync === "function") {
      return Deno.readTextFileSync(filePath);
    }
  } catch {
    // Ignore file read error if file does not exist or permission denied
  }
  return null;
}

function loadEnv() {
  const raw: Record<string, string | undefined> = {};

  // 1. Load from local .env files if present on filesystem
  const candidateFiles = [
    ".env",
    "../.env",
    "../../.env",
    "../../../.env",
    "supabase/.env.local",
    "../supabase/.env.local"
  ];

  for (const file of candidateFiles) {
    const content = tryReadEnvFile(file);
    if (content) {
      const parsed = parseDotenv(content);
      for (const [k, v] of Object.entries(parsed)) {
        if (!raw[k]) {
          raw[k] = v;
        }
      }
    }
  }

  // 2. Read from system environment (Deno.env / process.env) which takes highest priority
  const keys = [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "APP_ORIGIN",
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
    "RAZORPAY_MODE",
    "CHECKOUT_TTL_MINUTES",
    "MEMBER_CODE_TTL_SECONDS",
    "LOG_LEVEL"
  ];

  for (const k of keys) {
    let envVal: string | undefined;
    if (typeof Deno !== "undefined" && Deno.env) {
      envVal = Deno.env.get(k);
    } else if (typeof process !== "undefined" && process.env) {
      envVal = process.env[k];
    }
    if (envVal !== undefined && envVal !== "") {
      raw[k] = envVal;
    }
  }

  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("Environment configuration invalid:", parsed.error.format());
    throw new Error("Invalid environment configuration");
  }

  return parsed.data;
}

export const env = loadEnv();
