import express from "npm:express@4.18.2";
import cors from "npm:cors@2.8.5";
import { requestId } from "./middleware/requestId.ts";
import { errorHandler, notFound } from "./middleware/errors.ts";
import { razorpayWebhook } from "./routes/webhooks.ts";
import { router } from "./routes/index.ts";
import { env } from "./lib/env.ts";

const app = express();
app.disable("x-powered-by");

// 1. Request tracing
app.use(requestId);

// 2. CORS
app.use(
  cors({
    origin: env.APP_ORIGIN === "*" ? true : env.APP_ORIGIN,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "Idempotency-Key", "X-Request-Id"],
    maxAge: 600
  })
);

// 3. Webhook raw body parser MUST run BEFORE express.json()
app.post(
  "/api/v1/webhooks/razorpay",
  express.raw({ type: "*/*", limit: "100kb" }),
  razorpayWebhook
);

// 4. JSON body parser for all API endpoints
app.use(express.json({ limit: "100kb" }));

// 5. Mount API routes under /api/v1 (prefixed with function name "api")
app.use("/api/v1", router);

// 6. Error handling
app.use(notFound);
app.use(errorHandler);

// 7. Start listener on port 8000
const port = 8000;
app.listen(port, () => {
  console.log(`[SkylineSOS API] Listening on port ${port} (origin: ${env.APP_ORIGIN})`);
});
