# 00-route-inventory.md

## Backend Route Inventory

This document maps the complete API surface area of the Clora X full-stack server as of Section 00.

| HTTP Method | Route | Source File | Auth Required? | Auth Mode | Destructive? | Paid AI Ops? | Security Status / Concerns |
|---|---|---|---|---|---|---|---|
| **GET** | `/api/health` | `server/ai/routes.ts` | No | Public | No | No | Production-ready |
| **GET** | `/api/ai/client-diagnostics` | `server/ai/routes.ts` | Yes | Bearer Token | No | No | Exposes system metadata |
| **GET** | `/api/ai/self-test` | `server/ai/routes.ts` | Yes | Hard-coded Email | No | Yes | Vulnerable to cost abuse |
| **POST** | `/api/ai/respond-stream` | `server/ai/routes.ts` | Yes | Bearer Token | No | Yes | Critical tutoring path |
| **POST** | `/api/ai/continue` | `server/ai/routes.ts` | Yes | Bearer Token | No | Yes | High concurrency usage |
| **POST** | `/api/ai/gemini-chat` | `server/ai/routes.ts` | Yes | Bearer Token | No | Yes | Paid operations |
| **POST** | `/api/ai/image/generate` | `server/ai/routes.ts` | Yes | Bearer Token | No | Yes | High-cost endpoint |
| **POST** | `/api/pdf/process-uploaded` | `server/pdf/routes.ts` | Yes | Bearer Token | No | Yes | Triggers parsing, RAG and OCR |
| **POST** | `/api/pdf/reprocess/:sourceId` | `server/pdf/routes.ts` | Yes | Email check | Yes | Yes | Unsecured administrative endpoint |
| **GET** | `/api/pdf/ocr-status/:sourceId` | `server/pdf/routes.ts` | Yes | Bearer Token | No | No | Exposes status logs |
| **GET** | `/api/pdf/ocr-text/:sourceId` | `server/pdf/routes.ts` | Yes | Bearer Token | No | No | Exposes parsed Unicode |
| **POST** | `/api/rag/ingest-uploaded` | `server/rag/routes.ts` | Yes | Bearer Token | No | Yes | Legacy RAG ingest endpoint |
| **POST** | `/api/rag/ingest-direct` | `server/rag/routes.ts` | Yes | Bearer Token | No | Yes | Admin ingest endpoint |
| **POST** | `/api/question-cache/:docId/resolve`| `server/ai/routes.ts` | Yes | Email check | Yes | No | Hard-coded email authorization |
| **POST** | `/api/question-cache/:docId/reject` | `server/ai/routes.ts` | Yes | Email check | Yes | No | Hard-coded email authorization |
| **GET** | `/api/verified-answers/:sourceId` | `server/ai/routes.ts` | Yes | Bearer Token | No | No | Exposes global answers |
| **GET** | `/api/data` | `server.ts` | Yes | Target Email | No | No | Critical risk (cross-user data leak) |
| **POST** | `/api/send-email` | `server.ts` | No | None | No | No | Dummy mock endpoint |
| **POST** | `/api/quiz` | `server.ts` | No | None | No | No | Dummy mock endpoint |
| **POST** | `/api/lesson-optimizer` | `server.ts` | No | None | No | No | Dummy mock endpoint |
| **GET** | `/api/past-papers/local/:id` | `server.ts` | No | None | No | No | Dummy mock endpoint |
| **GET** | `/api/quota` | `server.ts` | No | None | No | No | Dummy mock endpoint |

---

### Route Analysis

1.  **Administrative Vulnerabilities:** Routes such as re-indexing, cache decisioning, and reprocessing rely heavily on client-provided metadata and unsafe hard-coded email validations.
2.  **Mock Endpoints:** The mock routes in `server.ts` (`/api/quiz`, `/api/quota`, etc.) return mock JSON without authenticating the user or calling the underlying DB layer.
3.  **Authentication Bypass:** Token verification in `server/firebase/authMiddleware.ts` allows query-string token fallback (`?token=...`), which is highly vulnerable to leaking authentication details via referrer headers or web proxies.
