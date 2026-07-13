# Security Architecture Reference

This document outlines the production security architecture and foundations implemented during the Section 01 Remediation Phase.

## 1. Centralized Environment & Bootstrapping Validation
All environment variables are parsed and validated on startup by `server/utils/env.ts` using custom schema validations. 

- **Critical Safeguard**: If `DEV_BYPASS_AUTH` or `ENABLE_MOCK_ROUTES` are enabled when `NODE_ENV === "production"`, the application will throw a critical error and fail to boot.
- **Port Ingress & CORS Rules**: Integrates dynamic configuration of ports and strict allow-list origins (e.g. `env.ALLOWED_ORIGINS`).

## 2. Dynamic, Secure CORS & HTTP Security Headers
- **Validated Origin Checks**: Requests are filtered against verified origins from `env.ts`. Arbitrary origin reflection is completely banned.
- **HTTP Security Headers**: Implements complete defense-in-depth protection:
  - **Content-Security-Policy**: Enforces self-source restriction, trusted external CDNs (Firebase, Google APIs), blocks unsafe inline scripts/evals (where possible), and restricts frame ancestors to `ai.studio` and `google.com` inside iframe contexts.
  - **HSTS (Strict-Transport-Security)**: Enforced in production to compel browser communication over TLS.
  - **X-Content-Type-Options**: `nosniff` prevents MIME-type sniffing exploits.
  - **X-Frame-Options**: `SAMEORIGIN` protects against clickjacking.
  - **Referrer-Policy**: `strict-origin-when-cross-origin` keeps referrers private.
  - **Permissions-Policy**: Disables camera, mic, and geolocation except when explicitly verified and authorized.
  - **Cache-Control**: `no-store, no-cache, must-revalidate` is forced for all `/api/` endpoints to prevent leakage of PII.

## 3. Strict Layered Rate Limiting Policies
Implemented in `server/utils/rateLimiter.ts` using in-memory token-bucket style sliding window limits:
- **Global API Rate Limit**: Applied broadly on all `/api/` routes (e.g., 100 requests per 1 minute per IP).
- **AI & Resource Heavy Rate Limit**: Applied specifically on high-cost CPU/Memory endpoints: `/api/ai/*`, `/api/pdf/*`, `/api/rag/*` (e.g., 15 requests per 1 minute).
- **Admin & Model-Test Limit**: Highly restrictive rate limits for admin operations (e.g., 5 requests per 1 minute).
- **Intelligent Grace/Bypass**: Safe system bypass/grace limits for verified server-to-server calls.

## 4. Redacted Logging & Unified Safe Error Handling
- **Structured Redacting Logger**: `server/utils/logger.ts` is configured to intercept and redact any string patterns matching typical PII/Secrets (Bearer tokens, credentials, private emails, etc.) before writing to standard out/error.
- **Unified Public Error Response**: `server/utils/errorHandler.ts` formats all backend failures into unified JSON responses with stable, redacted safe error codes (e.g., `INTERNAL_SERVER_ERROR`, `FORBIDDEN`, etc.) and prevents any stack trace leakages to client users.

## 5. Token-Based Authentication & Role-Based Authorization
- **Bearer Token Requirement**: All authenticated calls must pass `Authorization: Bearer <ID Token>`. Under no circumstances are query string tokens allowed.
- **Decoupled Admin Checks**: No hardcoded admin emails are checked on backend routes. Admin checks are dynamically resolved via:
  1. Firestore collection `user_roles` lookup during authorization token verification.
  2. Role claims check (`admin` token claim) on the authenticated user.
