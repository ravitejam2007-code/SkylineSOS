import type { Request, Response, NextFunction } from "npm:express@4.18.2";
import { supabaseAdmin } from "../lib/db.ts";
import { ApiError } from "./errors.ts";

export function rateLimit(keyPrefix: string, limit: number, windowSec: number = 60) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = (req as any).user?.id || req.ip || "anon";
    const key = `${keyPrefix}:${userId}`;

    try {
      const { data, error } = await supabaseAdmin.rpc("fn_rate_limit", {
        p_key: key,
        p_limit: limit,
        p_window_sec: windowSec
      });

      if (error) {
        // If RPC isn't available yet during early bootstrap, log and bypass gracefully
        console.warn(`[rateLimit] fn_rate_limit check failed or not installed: ${error.message}`);
        return next();
      }

      if (data === false) {
        res.setHeader("Retry-After", windowSec.toString());
        return next(
          new ApiError(429, "RATE_LIMITED", `Rate limit exceeded. Try again in ${windowSec} seconds.`)
        );
      }

      next();
    } catch (err: any) {
      console.warn(`[rateLimit] Exception running rate limiter: ${err.message}`);
      next();
    }
  };
}
