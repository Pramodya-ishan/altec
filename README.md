# Clora X - Sinhala A/L Technology AI Tutor

A specialized, personalized AI tutor for Sri Lankan G.C.E. A/L Technology stream (SFT, ET, ICT).

## Architecture

- **Frontend:** React, Tailwind CSS, Vite, PWA
- **Backend:** Node.js (Express), Firebase Admin, Vertex AI SDK
- **Database:** Cloud Firestore for user progress and knowledge chunk metadata
- **AI Brain:** `gemini-3.5-flash` for daily plans/tutoring, `gemini-3-pro` for deep analysis
- **Image Generation:** Nano Banana models (`gemini-3.1-flash-image`)

## Core Features

1. **Sinhala-First RAG Pipeline:** Retrieves from syllabus, past papers, and NotebookLM mirrors to construct highly accurate, personalized answers.
2. **Contextual Memory:** Uses actual logged-in Firebase user profiles, recent marks, and identified weak lessons to drive the tutoring strategy.
3. **Vertex AI ADC Auth:** Uses Service Account JSON (`GOOGLE_APPLICATION_CREDENTIALS_JSON`) directly without relying on free-tier AI Studio keys, avoiding "Prepayment Credits Depleted" errors.
4. **Google Search Grounding:** Dynamic fallback to search the web for latest past papers, marking schemes, and syllabus PDFs.
5. **Reduced Firestore Quota Burn:** Writes are optimized.

## Setup Instructions

Ensure these environment variables are set in your `.env`:

```env
GOOGLE_CLOUD_PROJECT=al-ai-chat
GOOGLE_CLOUD_LOCATION=global
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type": "service_account", ...}
GEMINI_DEFAULT_MODEL=gemini-3.5-flash
ENABLE_GOOGLE_SEARCH_GROUNDING=true
ENABLE_FIRESTORE_CLIENT_WRITES=false
ENABLE_SERVER_FIRESTORE_BACKUP=false
AL_EXAM_START_DATE=2026-08-11
APP_TIME_ZONE=Asia/Colombo
```

## Running the App

```bash
npm install
npm run dev
```

For production builds:
```bash
npm run build
npm run start
```
