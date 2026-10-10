import type { Request, Response, NextFunction } from "npm:express@4.18.2";
import { supabaseAdmin, supabaseAnon } from "../lib/db.ts";
import { ApiError } from "./errors.ts";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: "admin" | "treasurer" | "door" | "volunteer" | "member";
  fullName?: string;
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.header("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new ApiError(401, "UNAUTHENTICATED", "Missing or invalid authorization token"));
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return next(new ApiError(401, "UNAUTHENTICATED", "Bearer token is empty"));
  }

  try {
    const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
    if (error || !user) {
      return next(new ApiError(401, "UNAUTHENTICATED", "Invalid or expired token"));
    }

    // Retrieve role from user_roles table
    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError) {
      console.error("Failed to fetch user role:", roleError);
    }

    const { data: profileRow } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    const role = (roleRow?.role || "member") as AuthenticatedUser["role"];
    const fullName = profileRow?.full_name || user.user_metadata?.full_name;

    (req as any).user = {
      id: user.id,
      email: user.email || "",
      role,
      fullName
    };

    next();
  } catch (err: any) {
    next(new ApiError(401, "UNAUTHENTICATED", err.message || "Failed to authenticate token"));
  }
}
