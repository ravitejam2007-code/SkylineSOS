import { Router } from "npm:express@4.18.2";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({
    data: {
      ok: true,
      version: "v1",
      time: new Date().toISOString()
    }
  });
});
