import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { logger } from "./logger";

export interface RequestWithContext extends Request {
  requestId?: string;
  requestStartedAt?: number;
}

export function requestContextMiddleware(req: RequestWithContext, res: Response, next: NextFunction) {
  const incoming = String(req.headers["x-request-id"] || "").trim();
  const requestId = /^[A-Za-z0-9._:-]{8,120}$/.test(incoming) ? incoming : crypto.randomUUID();
  const startedAt = Date.now();
  req.requestId = requestId;
  req.requestStartedAt = startedAt;
  res.setHeader("X-Request-ID", requestId);

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    if (res.statusCode >= 400 || process.env.DEBUG_API === "true") {
      logger.info("request_completed", {
        requestId,
        method: req.method,
        path: req.originalUrl.split("?")[0],
        status: res.statusCode,
        durationMs,
      });
    }
  });

  next();
}
