# 00-repository-baseline.md

## Repository Architecture Map

This document maps the complete architectural footprint of Clora X as discovered during the Section 00 audit.

---

### 1. Frontend Architecture

Clora X is built as a single-page React 18+ application bundled with Vite.

*   **Entry Points:**
    *   `/index.html` - Main HTML canvas.
    *   `/src/main.tsx` - App bootstrapped with service workers and styling.
    *   `/src/App.tsx` - Main layout routing and core layout wrapper.
*   **Routing Structure:**
    *   Dynamic routes are resolved via React Router/conditional layout.
    *   **Authenticated Routes:** Only accessible when a valid user token is resolved from `AppContext.tsx`.
    *   **Student Views:**
        *   `CloraXView.tsx` - Primary AI tutor discussion and chat stream.
        *   `PastPapersView.tsx` - Search and access student past papers.
        *   `SyllabusLibraryView.tsx` - Access of structured syllabus trees.
        *   `AdmissionPredictorView.tsx` - Enter grades to predict university cutoffs.
        *   `ProfileView.tsx` - Basic profile card.
    *   **Admin/Ops Views (Routes needing protection):**
        *   `AdminDashboardView.tsx` - Performance/trace telemetry dashboard.
        *   `PdfIntelAdmin.tsx` - Admin PDF management portal.
        *   `QuestionCachePage.tsx` - Review generated answer cache states.
*   **State Management:**
    *   `src/context/AppContext.tsx` - Massive state container wrapping user credentials, notification banners, active workspace subject, and global parameters.
*   **CSS / Styles:**
    *   `src/index.css` - Tailored layout variables importing `@import "tailwindcss";`.
    *   `src/styles/clora-design.css` - Additional custom styled components.

---

### 2. Backend Architecture

A full-stack Node.js server powered by Express and TypeScript, compiled with esbuild into a single file (`dist/server.cjs`) for standalone execution in production.

*   **Entry Point:** `/server.ts`
*   **Routing Modules:**
    *   `server/ai/routes.ts` - All AI tutoring endpoints (`/api/ai/*`).
    *   `server/rag/routes.ts` - Raw RAG management and ingest routes (`/api/rag/*`).
    *   `server/pdf/routes.ts` - OCR pipelines and PDF extraction endpoints (`/api/pdf/*`).
    *   `server/syllabus/routes.ts` - Syllabus definition retrieval endpoints (`/api/syllabus/*`).
    *   `server/routes/reportRoutes.ts`, `server/routes/studentRoutes.ts`, `server/routes/examIntelRoutes.ts` - Feature-specific analytical endpoints.
*   **Middlewares:**
    *   `server/firebase/authMiddleware.ts` - Intercepts requests, parses bearer token or query string (security vulnerability to remove), and verifies claims via Firebase Admin SDK.

---

### 3. Firebase Architecture

*   **Client Core:** `src/lib/firebase.ts` handles client Auth, Firestore instance config, and client-side upload methods.
*   **Server Core:** `server/firebase/admin.ts` provides a certified single point of contact for administrative Firebase SDK access.

---

### 4. AI and RAG Architecture

*   **Core Stream Handler:** `server/ai/respondStream.ts` manages streaming answers using `@google/genai` library.
*   **RAG Engine:** `server/rag/retrieve.ts` and `server/knowledge/retrieve.ts` handle keyword-based and vector lookup in chunks and cache.

---

### 5. Document Processing & OCR Architecture

*   **OCR Integration:** `server/ocr/cloudVisionOcr.ts` connects to Google Cloud Vision API to run OCR on image or non-text PDF pages.
*   **Sinhala Normalization:** `server/ai-core/ocr/legacySinhalaFontConverter.ts` translates legacy Sinhala fonts (e.g. FM-Abhaya) into standard Unicode.
