import type { Request, Response, NextFunction } from "npm:express@4.18.2";
import { ApiError } from "./errors.ts";
import type { AuthenticatedUser } from "./auth.ts";

export function requireRole(...allowedRoles: AuthenticatedUser["role"][]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = (req as any).user as AuthenticatedUser | undefined;

    if (!user) {
      return next(new ApiError(401, "UNAUTHENTICATED", "Authentication required"));
    }

    if (!allowedRoles.includes(user.role)) {
      return next(
        new ApiError(
          403,
          "FORBIDDEN",
          `Role '${user.role}' is not authorized to access this resource`
        )
      );
    }

    next();
  };
}
