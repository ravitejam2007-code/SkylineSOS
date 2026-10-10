import type { Request, Response, NextFunction } from "npm:express@4.18.2";
import type { ZodSchema } from "npm:zod@3.24.2";
import { ApiError } from "./errors.ts";

export function validate(
  schema: ZodSchema,
  source: "body" | "query" | "params" = "body"
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const dataToValidate = req[source];
    const result = schema.safeParse(dataToValidate);

    if (!result.success) {
      const issues = result.error.issues.map((iss) => ({
        path: iss.path.join("."),
        message: iss.message
      }));

      return next(
        new ApiError(422, "VALIDATION_FAILED", "Request validation failed", { issues })
      );
    }

    req[source] = result.data;
    next();
  };
}
