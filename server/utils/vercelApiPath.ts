import type { NextFunction, Request, Response } from "express";

/**
 * Vercel routes every nested /api/* request to the single /api function and
 * forwards the original suffix as __path. Express must see the public path so
 * existing routers such as /api/pdf continue to match normally.
 */
export function restoreVercelApiPath(url: string): string {
  const parsed = new URL(url || "/", "http://localhost");
  const forwardedPath = parsed.searchParams.get("__path");
  if (!forwardedPath || !/^\/api\/?$/.test(parsed.pathname)) return url;

  parsed.searchParams.delete("__path");
  const suffix = decodeURIComponent(forwardedPath).replace(/^\/+/, "");
  const remainingQuery = parsed.searchParams.toString();
  return `/api/${suffix}${remainingQuery ? `?${remainingQuery}` : ""}`;
}

export function restoreVercelApiPathMiddleware(req: Request, _res: Response, next: NextFunction) {
  const restored = restoreVercelApiPath(req.url);
  if (restored !== req.url) req.url = restored;
  next();
}
