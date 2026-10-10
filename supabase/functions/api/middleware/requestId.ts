import type { Request, Response, NextFunction } from "npm:express@4.18.2";

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("x-request-id");
  const id = incoming && incoming.length > 0 ? incoming : crypto.randomUUID();
  (req as any).requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
}
