import { z } from "npm:zod@3.24.2";

const EnvSchema = z.object({
  SUPABASE_URL: z.string().url().default("http://127.0.0.1:54321"),
  SUPABASE_ANON_KEY: z.string().default("mock-anon-key"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default("mock-service-role-key"),
  APP_ORIGIN: z.string().default("*"),
  RAZORPAY_KEY_ID: z.string().default("rzp_test_TXWbmmg3SRSwlV"),
  RAZORPAY_KEY_SECRET: z.string().default("mock_secret"),
  RAZORPAY_WEBHOOK_SECRET: z.string().default("mock_webhook_secret"),
  RAZORPAY_MODE: z.enum(["test", "live"]).default("test"),
  CHECKOUT_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  MEMBER_CODE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info")
});

function loadEnv() {
  const raw: Record<string, string | undefined> = {};
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
    // Works across Deno and Node environments
    if (typeof Deno !== "undefined") {
      raw[k] = Deno.env.get(k);
    } else if (typeof process !== "undefined" && process.env) {
      raw[k] = process.env[k];
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
