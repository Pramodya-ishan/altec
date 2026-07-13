import { Request, Response, NextFunction } from "express";

type LimiterStoreRecord = {
  count: number;
  resetTime: number;
};

// In-memory store. Note: in production, this should migrate to Redis/Firestore
// for multi-instance consistency. We document this in the rate-limits log.
const store = new Map<string, LimiterStoreRecord>();

export interface RateLimitOptions {
  windowMs: number;
  keyPrefix: string;
  // Dynamic limits based on user role
  limitByRole?: {
    anonymous: number;
    student: number;
    admin: number;
  };
  // Fallback fixed limit if limitByRole is not specified
  defaultMax: number;
}

export function buildRateLimiter(options: RateLimitOptions) {
  return (req: any, res: Response, next: NextFunction) => {
    const now = Date.now();
    
    // Resolve identity
    const user = req.user;
    const isAuth = !!user;
    const isAnonymous = user?.isAnonymous === true;
    const roles = user?.roles || [];
    const isAdmin = user?.admin === true || roles.includes("admin") || roles.includes("ops");
    
    // Determine max hits allowed for this request
    let max = options.defaultMax;
    if (options.limitByRole) {
      if (!isAuth || isAnonymous) {
        max = options.limitByRole.anonymous;
      } else if (isAdmin) {
        max = options.limitByRole.admin;
      } else {
        max = options.limitByRole.student;
      }
    }

    // Resolve rate limiting key (UID if authenticated, Client IP if anonymous/unauth)
    let key = "";
    if (isAuth && user.uid) {
      key = `uid:${options.keyPrefix}:${user.uid}`;
    } else {
      const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || req.ip || "unknown-ip";
      const clientIp = Array.isArray(ip) 
        ? ip[0] 
        : (typeof ip === "string" ? ip.split(",")[0].trim() : "unknown-ip");
      key = `ip:${options.keyPrefix}:${clientIp}`;
    }

    const record = store.get(key);

    if (!record || record.resetTime <= now) {
      store.set(key, {
        count: 1,
        resetTime: now + options.windowMs
      });
      res.setHeader("X-RateLimit-Limit", max);
      res.setHeader("X-RateLimit-Remaining", max - 1);
      res.setHeader("X-RateLimit-Reset", Math.ceil((now + options.windowMs) / 1000));
      return next();
    }

    if (record.count >= max) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader("Retry-After", retryAfterSeconds);
      res.setHeader("X-RateLimit-Limit", max);
      res.setHeader("X-RateLimit-Remaining", 0);
      res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetTime / 1000));
      return res.status(429).json({
        ok: false,
        code: "RATE_LIMITED",
        retryAfterSeconds,
        message: `Too many requests. Please retry after ${retryAfterSeconds} seconds.`
      });
    }

    record.count++;
    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", max - record.count);
    res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetTime / 1000));
    next();
  };
}

// Global generic API rate limit (100 requests / minute)
export const globalLimiter = buildRateLimiter({
  windowMs: 60 * 1000,
  keyPrefix: "global",
  defaultMax: 100,
  limitByRole: {
    anonymous: 40,
    student: 120,
    admin: 300
  }
});

// Paid & AI Heavy Limit (30 requests / minute for students, 5 for anonymous, 100 for admin)
export const aiLimiter = buildRateLimiter({
  windowMs: 60 * 1000,
  keyPrefix: "ai",
  defaultMax: 20,
  limitByRole: {
    anonymous: 5,
    student: 30,
    admin: 100
  }
});

// Admin-specific operations rate limit
export const adminLimiter = buildRateLimiter({
  windowMs: 60 * 1000,
  keyPrefix: "admin",
  defaultMax: 10,
  limitByRole: {
    anonymous: 1,
    student: 2,
    admin: 60
  }
});
