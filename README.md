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
3. **Vertex AI ADC Auth:** Controls authentication mode purely via `GEMINI_USE_VERTEX=true` and `GOOGLE_APPLICATION_CREDENTIALS_JSON` without relying on free-tier AI Studio keys, avoiding "Prepayment Credits Depleted" errors.
4. **Google Search Grounding:** Dynamic fallback to search the web for latest past papers, marking schemes, and syllabus PDFs.
5. **Reduced Firestore Quota Burn:** Writes are optimized.

## Setup Instructions

Ensure these environment variables are set in your `.env`:

```env
APP_DEPLOY_TARGET=aistudio_applet
GEMINI_USE_VERTEX=true
GOOGLE_CLOUD_PROJECT=al-ai-chat
GOOGLE_CLOUD_LOCATION=global
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type": "service_account", ...}

GEMINI_DEFAULT_MODEL=gemini-3.5-flash
GEMINI_FAST_MODEL=gemini-3.5-flash
GEMINI_PDF_QA_MODEL=gemini-3.5-flash
GEMINI_FINAL_MODEL=gemini-3.1-pro-preview

ENABLE_TTS=false
ENABLE_AUTO_OCR=false
ENABLE_IMAGE_GENERATION=false
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
