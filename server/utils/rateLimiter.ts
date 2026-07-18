import type { NextFunction, Request, Response } from "express";

/**
 * Application-level request caps are intentionally disabled.
 *
 * Authentication, authorization, request-size validation, upload validation,
 * provider backpressure, and provider quota errors still apply. This middleware
 * remains as a compatibility export for older route modules, but it never
 * rejects a request or emits a 429 response.
 */
export function unlimitedRequestMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  res.setHeader("X-Application-Rate-Limit", "disabled");
  next();
}

export const globalLimiter = unlimitedRequestMiddleware;
export const aiLimiter = unlimitedRequestMiddleware;
export const adminLimiter = unlimitedRequestMiddleware;
