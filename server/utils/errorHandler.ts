import { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";

export type PublicApiError = {
  ok: false;
  code: string;
  message: string;
  requestId: string;
  retryable?: boolean;
};

export function globalErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const requestId = crypto.randomUUID?.() || Math.random().toString(36).substring(2, 15);
  
  // Log the actual internal details server-side
  console.error(`[ERROR] RequestId: ${requestId} | Path: ${req.path} | Error:`, err);

  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "An internal server error occurred. Please try again later.";
  let retryable = false;

  if (err.code === "QUERY_TOKEN_NOT_ALLOWED") {
    status = 400;
    code = "QUERY_TOKEN_NOT_ALLOWED";
    message = err.message;
  } else if (err.code === "LIMIT_FILE_SIZE") {
    status = 413;
    code = "FILE_TOO_LARGE";
    message = "The uploaded file exceeds the maximum allowed size.";
  } else if (err.code === "LIMIT_FILE_COUNT") {
    status = 400;
    code = "TOO_MANY_FILES";
    message = "Too many files were uploaded. Only 1 file is allowed.";
  } else if (err.code === "LIMIT_FIELD_COUNT") {
    status = 400;
    code = "TOO_MANY_FIELDS";
    message = "The request contains too many fields.";
  } else if (err.type === "entity.too.large" || err.status === 413) {
    status = 413;
    code = "BODY_TOO_LARGE";
    message = "The request payload size exceeds the maximum limit.";
  } else if (err.status === 401 || err.message?.includes("Unauthorized") || err.message?.includes("LOGIN_REQUIRED")) {
    status = 401;
    code = "UNAUTHENTICATED";
    message = "Authentication is required to perform this action.";
  } else if (err.status === 403 || err.message?.includes("Forbidden") || err.message?.includes("Access denied")) {
    status = 403;
    code = "FORBIDDEN";
    message = "You do not have permission to perform this action.";
  } else if (err.code === "RATE_LIMITED" || err.status === 429) {
    status = 429;
    code = "RATE_LIMITED";
    message = err.message || "Too many requests. Please try again later.";
    retryable = true;
  } else if (err.code === "FEATURE_NOT_AVAILABLE") {
    status = 501;
    code = "FEATURE_NOT_AVAILABLE";
    message = err.message || "This feature is not available.";
  } else if (err.name === "ValidationError" || err.code === "VALIDATION_FAILED") {
    status = 400;
    code = "VALIDATION_FAILED";
    message = err.message || "Validation failed.";
  } else if (err.code === "DEPENDENCY_UNAVAILABLE") {
    status = 503;
    code = "DEPENDENCY_UNAVAILABLE";
    message = "A required dependency service is temporarily unavailable.";
  } else if (err.code === "QUOTA_EXCEEDED") {
    status = 429;
    code = "QUOTA_EXCEEDED";
    message = "API request quota has been exceeded.";
  } else if (err.code === "REQUEST_TIMEOUT" || err.status === 408) {
    status = 408;
    code = "REQUEST_TIMEOUT";
    message = "The request timed out.";
  } else {
    if (err.isPublic) {
      code = err.code || "BAD_REQUEST";
      message = err.message;
      status = err.status || 400;
    }
  }

  const responsePayload: PublicApiError = {
    ok: false,
    code,
    message,
    requestId,
    retryable
  };

  res.status(status).json(responsePayload);
}
