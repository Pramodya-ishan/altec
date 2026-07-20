import { access, readFile, readdir, stat } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const sidebar = await read("src/components/layout/Sidebar.tsx");
const topNav = await read("src/components/layout/TopNav.tsx");
const chat = await read("src/components/views/CloraXView.tsx");
const bubble = await read("src/components/ui/clora/CloraMessageBubble.tsx");
const chartShell = await read("src/components/ui/ResponsiveChartShell.tsx");
const videoPlayer = await read("src/components/video/SecureVideoPlayer.tsx");
const upload = await read("src/lib/clientStorageUpload.ts");
const uploadValidation = await read("src/lib/uploadValidation.ts");
const vercel = JSON.parse(await read("vercel.json"));
const envExample = await read(".env.example");
const npmrc = await read(".npmrc");
const packageLock = await read("package-lock.json");
const packageJson = JSON.parse(await read("package.json"));

for (const label of ["Paper", "Marks", "Papers", "Z-score", "Assistant"]) {
  assert(sidebar.includes(`mobileLabel: "${label}"`), `Missing mobile label: ${label}`);
}
assert(sidebar.includes("h-[calc(60px+env(safe-area-inset-bottom))]"), "Mobile navigation height is not safe-area aware");
assert(!sidebar.includes("Study assistant") && !sidebar.includes("Z-score analytics"), "Legacy navigation labels remain");
assert(!topNav.includes('aria-label="Open navigation"') && sidebar.includes('lg:flex') && sidebar.includes('hidden h-[100dvh]'), "Mobile sidebar or hamburger must be removed");
assert(topNav.includes('aria-label="New chat"') && !topNav.includes("/> New chat"), "New chat must be icon-only");
assert(chat.includes("Ask about a lesson, paper, question, or result."), "English welcome message is missing");
assert(chat.includes('aria-label="Jump to latest answer"') && !chat.includes("අලුත් පිළිතුර"), "Latest-answer button was not repaired");
assert(chat.includes('accept="') && chat.includes('application/pdf') && chat.includes('application/zip') && chat.includes('.zip') && chat.includes('image/png'), "Assistant attachment input must support validated PDFs, images, and project ZIP files");
assert(bubble.includes("Thinking") && bubble.includes("Copy answer") && bubble.includes("Reply"), "Assistant thinking/message actions are incomplete");
assert(chartShell.includes("ResizeObserver") && chartShell.includes("IntersectionObserver"), "Chart shell is missing visibility-aware measurement");
assert(!chartShell.includes("ResponsiveContainer"), "ResponsiveChartShell must not depend on ResponsiveContainer");
assert(videoPlayer.includes("Preparing video…") && videoPlayer.includes("Retry") && !videoPlayer.includes("<header"), "Video player overlay repair is incomplete");
assert(
  upload.includes("validatePersonalAssistantFile")
    && upload.includes("validateFileSignature")
    && uploadValidation.includes("25 * MB")
    && uploadValidation.includes("10 * MB")
    && uploadValidation.includes("Only PDF, PNG, JPEG, and WebP files are allowed."),
  "Personal attachment validation is incomplete",
);
assert(vercel?.functions?.["api/index.ts"]?.includeFiles === "vercel-runtime/**", "Vercel root API runtime assets are not fully included");
assert(vercel.installCommand.includes("registry.npmjs.org"), "Vercel install command must force the public npm registry");
assert(npmrc.includes("registry=https://registry.npmjs.org/"), ".npmrc does not force the public npm registry");
assert(!packageLock.includes("packages.applied-caas-gateway1.internal.api.openai.org"), "package-lock.json contains a private internal registry URL");
assert(Object.keys(vercel.functions || {}).length === 1, "Vercel must use one Express API function");
assert((vercel.rewrites || []).some((rewrite) => rewrite.source === "/api/:path*" && rewrite.destination === "/api?__path=:path*"), "Nested API paths are not forwarded with their original suffix");
assert(!(vercel.rewrites || []).some((rewrite) => rewrite.destination === "/api/index"), "Legacy /api/index rewrite remains");
const appContext = await read("src/context/AppContext.tsx");
const apiPath = await read("server/utils/vercelApiPath.ts");
const responseHygiene = await read("server/ai/responseHygiene.ts");
const contentPermissions = await read("server/utils/contentPermissions.ts");
const knowledgeRouter = await read("server/knowledge/knowledgeRouter.ts");
const respondStream = await read("server/ai/respondStream.ts");
assert(appContext.includes("signInWithPopup") && appContext.includes("signInWithRedirect") && appContext.includes("shouldUseRedirectAuth"), "Google auth must use popup-first with an explicitly configured mobile redirect fallback");
assert(apiPath.includes("restoreVercelApiPath") && apiPath.includes("__path"), "Express path restoration middleware is missing");
assert(responseHygiene.includes("turn_off_indicator_lights_on_the_router"), "Known internal directive leak filter is missing");
assert(
  contentPermissions.includes("isStudentVisibleSource")
    && contentPermissions.includes("source.published !== true")
    && contentPermissions.includes("sourceScope alone is never treated as publication consent"),
  "Published-resource visibility checks are incomplete",
);
assert(knowledgeRouter.includes("asksWhichPdfCanAnswer") && knowledgeRouter.includes("inventoryMode: asksWhichPdfCanAnswer ? \"answerable\" : \"all\""), "Singlish answerable-PDF inventory routing is missing");
assert(respondStream.includes("Ready for secure direct PDF scan") && respondStream.includes("answerableSources"), "Saved PDFs without chunks are not handed to Direct PDF QA");
assert(envExample.includes("ENABLE_IMAGE_GENERATION=true") && envExample.includes("DISABLE_IMAGE_GENERATION=false"), "Image generation production defaults are incomplete");
assert(packageJson.dependencies?.["@napi-rs/canvas"], "Native PDF crop renderer dependency is missing");
assert(envExample.includes("OCR_ENABLED=true") && envExample.includes("OCR_INPUT_BUCKET=al-ai-chat-ocr-input") && envExample.includes("OCR_OUTPUT_BUCKET=al-ai-chat-ocr-output"), "OCR production example is incomplete");

const sourceActions = await read("src/lib/sourceActions.ts");
const ragRoutes = await read("server/rag/routes.ts");
const directFormatter = await read("src/lib/ai/directPdfAnswerFormatter.ts");
const visualRenderer = await read("src/components/ui/VisualBlockRenderer.tsx");
const visualBuilder = await read("server/ai/visualAidBuilder.ts");
assert(sourceActions.includes("getProtectedPdfRoute") && sourceActions.indexOf("getProtectedPdfRoute(source)") < sourceActions.lastIndexOf("getDownloadURL(ref(storage"), "Shared PDF opening must prefer the protected API over Firebase client Storage permissions");
assert(ragRoutes.includes('req.query.format === "json"') && ragRoutes.includes("responseDisposition") && ragRoutes.includes('origin === "past_papers"'), "Protected PDF signed URL/download route is incomplete");
assert(directFormatter.includes("normalizeMcqOption") && !directFormatter.includes('type: "source_evidence"') && directFormatter.includes('type: "comparison_bars"'), "Direct PDF answer UI formatter or evidence-card removal is incomplete");
assert(!directFormatter.includes("The question was found in the PDF, but a confirmed answer was not available."), "Legacy no-answer template remains");
assert(!directFormatter.includes('> **${finalAnswerText}**'), "Direct answer still uses a blockquote card");
assert(visualRenderer.includes('case "source_evidence"') && visualRenderer.includes('case "reaction_diagram"') && visualRenderer.includes('case "comparison_bars"'), "Educational visual renderer is incomplete");
assert(visualBuilder.includes("deriveEducationalVisualBlocks") && respondStream.includes('emitSse(res, "visual_blocks"'), "General answer visual-aid pipeline is incomplete");
const imageIntent = await read("server/ai/imageIntent.ts");
const imageGenerator = await read("server/image/generate.ts");
const pdfPreview = await read("server/pdf/questionPreview.ts");
const pdfRoutes = await read("server/pdf/routes.ts");
const pdfSolver = await read("server/ai-core/pdf/solveExtractedQuestion.ts");
assert(imageIntent.includes("isImageGenerationIntent") && respondStream.includes("isImageGenerationIntent"), "Natural-language image generation routing is missing");
assert(imageGenerator.includes('responseModalities: ["IMAGE", "TEXT"]') && imageGenerator.includes("generated_images/"), "Image generation/storage pipeline is incomplete");
assert(pdfPreview.includes("pdf_question_previews/") && pdfPreview.includes("@napi-rs/canvas"), "PDF visual crop pipeline is incomplete");
assert(pdfRoutes.includes('pdfRoutes.post("/question-preview"') && pdfRoutes.includes("createPdfQuestionPreview"), "Secure PDF preview endpoint is missing");
assert(pdfSolver.includes("getSubjectSyllabusGroundingPdf") && pdfSolver.includes("retrieveRelevantKnowledge") && pdfSolver.includes("AI-solved"), "Syllabus-grounded PDF solver is incomplete");
assert(!visualRenderer.includes("rounded-2xl border border-emerald"), "Source evidence still uses the oversized green card");

for (const path of [
  "vercel-runtime/server.mjs",
  "vercel-runtime/pdf.worker.mjs",
  "vercel-runtime/google-gax-protos",
  "vercel-runtime/node_modules/@napi-rs/canvas",
  "vercel-runtime/node_modules/@napi-rs/canvas-linux-x64-gnu",
]) {
  await access(path);
}
assert((await stat("vercel-runtime/pdf.worker.mjs")).size > 100_000, "PDF.js worker looks invalid");



const hero = await read("src/components/ui/clora/CloraHero.tsx");
const composer = await read("src/components/ui/clora/CloraComposer.tsx");
const memoryExtractor = await read("server/ai/memoryExtractor.ts");
const userContext = await read("server/firebase/userContext.ts");
const notesModal = await read("src/components/modals/NotesModal.tsx");
const admissionView = await read("src/components/views/AdmissionPredictorView.tsx");
assert(!hero.includes("Study with A/L subjects") && !hero.includes("2023 SFT") && hero.includes("What would you like to learn?"), "Legacy Assistant hero/prompts remain");
assert(chat.includes("activeSubject: undefined") && chat.includes("replyingTo") && chat.includes("revealBufferedAnswer"), "All-subject context, message replies, or buffered typing is missing");
assert(composer.includes("clora:composer-focus") && sidebar.includes("clora:composer-focus"), "Mobile bottom navigation does not react to the Assistant keyboard/composer");
assert(memoryExtractor.includes('"weak_points"') && memoryExtractor.includes('"mistake_notebook"') && memoryExtractor.includes('"learning_signal_aggregates"'), "Separate learning memory collections are missing");
assert(userContext.includes("weak_points") && userContext.includes("loadMistakeRecords") && userContext.includes("learning_signal_aggregates"), "Saved learning signals are not loaded into AI context");
assert(notesModal.includes("lesson-resources:changed") && notesModal.includes("lessonTitle"), "Lesson resources do not refresh or use stable lesson matching");
assert(admissionView.includes("max-w-[170px]") && admissionView.includes("allowEscapeViewBox"), "Z-score tooltip still obscures the chart");

const pastPapersView = await read("src/components/views/PastPapersView.tsx");
const lessonResourceRoutes = await read("server/lessonResources/routes.ts");
const lessonResourceService = await read("server/lessonResources/service.ts");
const syllabusRoutes = await read("server/syllabus/routes.ts");
assert(pastPapersView.includes("canManagePastPapers") && pastPapersView.includes("canManagePastPapers && auth.currentUser"), "Past-paper upload control is not server-capability gated");
assert(pastPapersView.includes("const isDeleteAllowed = (_paper: any) => canManagePastPapers"), "Past-paper delete control still allows ordinary users");
assert(pastPapersView.includes("handlePriorityChange") && pastPapersView.includes("Display priority"), "Admin past-paper priority control is missing");
assert(ragRoutes.includes('ragRoutes.patch("/past-papers/:id"') && ragRoutes.includes("canManagePastPapers: manager"), "Past-paper priority/capability API is missing");
assert(lessonResourceRoutes.includes("displayPriority") && lessonResourceRoutes.includes("priorityDelta"), "Lesson-resource priority ordering is missing");
assert(lessonResourceService.includes("existing.createdAt") && lessonResourceService.includes("displayPriority"), "Lesson-resource upload time/priority preservation is missing");
assert(syllabusRoutes.includes("await requireSyllabusOwner(req)") && syllabusRoutes.includes("Shared syllabus deletion is content-manager only"), "Syllabus deletion is not restricted to content managers");

console.log("Production repair static verification passed.");


// V10 strict PDF source lock, authoritative syllabus, display, and resource checks.
const syllabusGrounding = await readFile("server/pdf/syllabusGrounding.ts", "utf8");
const directFormatterV10 = await readFile("src/lib/ai/directPdfAnswerFormatter.ts", "utf8");
const lessonRoutesV10 = await readFile("server/lessonResources/routes.ts", "utf8");
const predictionV10 = await readFile("server/ai-core/exam-intel/predictedPaper.ts", "utf8");
const syllabusCorpusV26 = await readFile("server/ai-core/exam-intel/syllabusCorpus.ts", "utf8");
const cloraHeroV10 = await readFile("src/components/ui/clora/CloraHero.tsx", "utf8");
assert(syllabusGrounding.includes("DEFAULT_SFT_SYLLABUS_STORAGE_PATH") && syllabusGrounding.includes("bundled_sft_syllabus"), "V10 authoritative SFT syllabus fallback is missing");
assert(!directFormatterV10.includes('type: "source_evidence"'), "V10 still adds the visible Verified PDF evidence container");
assert(lessonRoutesV10.includes('collection("rag_sources")') && lessonRoutesV10.includes("isStudentVisibleSource") && lessonRoutesV10.includes("subjectVariants"), "V10 lesson resource legacy merge or historical subject normalization is missing");
assert(
  predictionV10.includes("exam_question_index")
    && predictionV10.includes("loadSubjectSyllabusCorpus")
    && syllabusCorpusV26.includes("getSubjectSyllabusGroundingPdf"),
  "Prediction engine is not grounded in indexed papers and the authoritative syllabus corpus",
);
assert(cloraHeroV10.includes("Made by Pramodya Ishan") && !cloraHeroV10.includes("Clora X"), "V18 creator attribution or removed product label is incorrect");

const sourceSelectionV10 = await readFile("server/ai/sourceSelection.ts", "utf8");
const conversationStateV10 = await readFile("server/knowledge/conversationState.ts", "utf8");
const indexedSelectionV10 = await readFile("server/ai-core/pdf/indexedQuestionSelection.ts", "utf8");
const evidenceRetrievalV10 = await readFile("server/knowledge/evidenceRetrieval.ts", "utf8");
const sftReferencesV10 = await readFile("server/pdf/sftReferenceGrounding.ts", "utf8");
const clientSinhalaV10 = await readFile("src/utils/normalizeMathMarkdown.ts", "utf8");
const evidenceCacheV10 = await readFile("server/ai-core/evidence/evidenceRetriever.ts", "utf8");
assert(sourceSelectionV10.includes("parseSourceChoiceIndex") && sourceSelectionV10.includes("scoreNamedSource") && sourceSelectionV10.includes("guess"), "V10 deterministic named/numbered PDF selection is missing");
assert(conversationStateV10.includes("selectedSourceTitle") && conversationStateV10.includes("pendingSourceChoices") && conversationStateV10.includes("awaitingSourceSelection"), "V10 selected PDF conversation lock is missing");
assert(indexedSelectionV10.includes("hasExactQuestionMarker") && indexedSelectionV10.includes("selectIndexedQuestionChunks"), "V10 exact question marker validation is missing");
assert(!evidenceRetrievalV10.includes("first matching subject/year source"), "V10 still contains an arbitrary source fallback");
assert(pdfRoutes.includes("selectIndexedQuestionChunks") && !pdfRoutes.includes("targetNo - 1"), "V24 PDF route can still use positional page fallback");
assert(sftReferencesV10.includes("SFT_PHYSICS_REFERENCE_STORAGE_PATH") && sftReferencesV10.includes("SFT_BIOLOGY_REFERENCE_STORAGE_PATH") && sftReferencesV10.includes("SFT_CHEMISTRY_REFERENCE_STORAGE_PATH"), "V10 authoritative SFT resource grounding is incomplete");
assert(pdfSolver.includes("inSyllabus") && pdfSolver.includes("syllabusBasis") && pdfSolver.includes("do not answer from general memory"), "V10 syllabus-scope enforcement is incomplete");
assert(clientSinhalaV10.includes("normalizeMathSegment") && !clientSinhalaV10.includes("replace(/[\u200C\u200D\uFEFF]/g"), "V10 client rendering still strips Sinhala joiners globally");
assert(evidenceCacheV10.includes("evidenceVersion") && evidenceCacheV10.includes("rejected") && evidenceCacheV10.includes("validationStatus"), "V10 stale/rejected answer-cache protection is missing");
const runtimeBuilderV11 = await readFile("scripts/build-vercel-runtime.mjs", "utf8");
assert(!runtimeBuilderV11.includes("authoritativeSourceDirectory") && !runtimeBuilderV11.includes("await cp(authoritativeSourceDirectory"), "V11 still duplicates authoritative PDFs into the Vercel runtime");

console.log("V10 authoritative SFT syllabus, Sinhala display, prediction, and lesson-resource checks passed.");


// V11 security, unlimited-capacity, privacy, and deployment checks.
const firestoreRulesV11 = await read("firestore.rules");
const storageRulesV11 = await read("storage.rules");
const rateLimiterV11 = await read("server/utils/rateLimiter.ts");
const appCheckV11 = await read("server/firebase/appCheckMiddleware.ts");
const serverEntryV11 = await read("server.ts");
const authRoutesV11 = await read("server/auth/routes.ts");
const safeRemotePdfV11 = await read("server/utils/safeRemotePdf.ts");
const uploadValidationV11 = await read("src/lib/uploadValidation.ts");
const appContextV11 = await read("src/context/AppContext.tsx");
const browserE2EV11 = await read("scripts/run-browser-e2e.mjs");
const tsconfigScriptsV11 = await read("tsconfig.scripts.json");
const obsoleteCleanupV13 = await read("scripts/remove-obsolete-files.mjs");
const tsconfigAppV14 = JSON.parse(await read("tsconfig.json"));

assert(
  firestoreRulesV11.includes("function isAdmin()")
    && firestoreRulesV11.includes("function canManageContent()")
    && firestoreRulesV11.includes("teachers/content editors never inherit user-data access"),
  "V11 admin and content-manager roles are not separated",
);
assert(firestoreRulesV11.includes("request.auth.uid == uid") && firestoreRulesV11.includes("match /users/{uid}"), "V11 private user records are not UID-owned");
assert(firestoreRulesV11.includes("match /{document=**}") && firestoreRulesV11.includes("allow read, write: if false"), "V11 Firestore catch-all deny is missing");
assert(
  storageRulesV11.includes("match /rag_uploads/{uid}/{sourceId}/{fileName}")
    && storageRulesV11.includes("match /users/{uid}/attachments/{allPaths=**}")
    && storageRulesV11.includes("request.auth.uid == uid"),
  "V11 personal Storage ownership rules are missing",
);
assert(
  storageRulesV11.includes("match /shared_resources/{resourceId}/{allPaths=**}")
    && storageRulesV11.includes("canManageContent()")
    && storageRulesV11.includes("allow read: if false"),
  "V11 shared-resource Storage authorization is missing",
);
assert(rateLimiterV11.includes("X-Application-Rate-Limit") && rateLimiterV11.includes("disabled") && !rateLimiterV11.includes("res.status(429)"), "V11 application request caps still emit 429");
assert(appCheckV11.includes("verifyToken") && appCheckV11.includes("X-Firebase-AppCheck"), "V11 Firebase App Check verification is missing");
assert(
  serverEntryV11.includes("requireFirebaseAppCheck")
    && (serverEntryV11.includes('app.use("/api", requireFirebaseAppCheck)') || serverEntryV11.includes("app.use('/api', requireFirebaseAppCheck)")),
  "V11 application-wide App Check middleware is not mounted",
);
assert(authRoutesV11.includes("createSessionCookie") && authRoutesV11.includes("httpOnly: true") && authRoutesV11.includes("sameSite"), "V11 secure HttpOnly Firebase session cookies are incomplete");
assert(
  safeRemotePdfV11.includes("dns.lookup")
    && safeRemotePdfV11.includes("isPrivateAddress")
    && safeRemotePdfV11.includes("PDF_PROXY_HOST_NOT_ALLOWED")
    && safeRemotePdfV11.includes("%PDF-"),
  "V11 remote PDF SSRF/signature protections are incomplete",
);
assert(
  uploadValidationV11.includes("[0x25, 0x50, 0x44, 0x46, 0x2d]")
    && uploadValidationV11.includes("[0x89, 0x50, 0x4e, 0x47")
    && uploadValidationV11.includes("[0x52, 0x49, 0x46, 0x46]")
    && uploadValidationV11.includes("[0x57, 0x45, 0x42, 0x50]"),
  "V11 client upload magic-byte validation is incomplete",
);
assert(!appContextV11.includes("localStorage") && !appContextV11.includes("sessionStorage"), "V11 still persists auth/session/user data in browser storage");
assert(!appContextV11.includes("youtubeCookies") && !appContextV11.includes("googleAccessToken"), "V11 still stores raw Google/YouTube credentials in application state");
assert(packageJson.scripts?.["test:e2e"] && packageJson.scripts?.["test:integration"], "V11 browser/integration test commands are missing");
assert(
  browserE2EV11.includes("document.documentElement.scrollWidth")
    && browserE2EV11.includes("Firebase popup polling warning detected")
    && browserE2EV11.includes("Recharts negative-dimension warning detected"),
  "V11 mobile overflow/auth warning browser checks are incomplete",
);
assert(tsconfigScriptsV11.includes('"scripts/**/*.ts"'), "V11 operational scripts are excluded from typechecking");
assert(
  obsoleteCleanupV13.includes("server/app.ts")
    && obsoleteCleanupV13.includes("server/dev.ts")
    && obsoleteCleanupV13.includes("server/data/userRepository.ts")
    && obsoleteCleanupV13.includes("data_users"),
  "V14 obsolete legacy-path cleanup is incomplete",
);
assert(packageJson.scripts?.["pretypecheck"]?.includes("cleanup:obsolete") && packageJson.scripts?.["prebuild:vercel"]?.includes("cleanup:obsolete"), "V14 cleanup is not wired before typecheck/Vercel build");
assert(
  ["server/app.ts", "server/dev.ts", "server/data/userRepository.ts", "data_users"].every((path) => tsconfigAppV14.exclude?.includes(path)),
  "V14 TypeScript defense-in-depth exclusions for obsolete legacy paths are incomplete",
);

const productionFilesV11 = (await readdir("src", { recursive: true }))
  .filter((entry) => /\.(ts|tsx|js|jsx)$/.test(String(entry)))
  .map((entry) => `src/${entry}`);
for (const path of productionFilesV11) {
  const content = await read(path);
  assert(!content.includes("localStorage") && !content.includes("sessionStorage"), `V11 browser persistence remains in ${path}`);
  assert(!/fetch\(\s*[`'"]\/api\//.test(content), `V11 protected API call bypasses apiFetch in ${path}`);
}

let legacyServerAppMissing = false;
try {
  await access("server/app.ts");
} catch {
  legacyServerAppMissing = true;
}
assert(legacyServerAppMissing, "V11 insecure legacy server/app.ts still exists");

let legacyServerDevMissing = false;
try {
  await access("server/dev.ts");
} catch {
  legacyServerDevMissing = true;
}
assert(legacyServerDevMissing, "V14 obsolete server/dev.ts still exists");

let legacyUserRepositoryMissing = false;
try {
  await access("server/data/userRepository.ts");
} catch {
  legacyUserRepositoryMissing = true;
}
assert(legacyUserRepositoryMissing, "V11 legacy local/email-keyed user repository still exists");
let bundledUserSeedMissing = false;
try {
  await access("data_users");
} catch {
  bundledUserSeedMissing = true;
}
assert(bundledUserSeedMissing, "V11 still packages private pre-existing user data");
const userContextV11 = await read("server/firebase/userContext.ts");
assert(!userContextV11.includes("syncUserFromFirestore") && !userContextV11.includes("local_db_fallback"), "V11 user AI context still reads legacy local/email backup files");

const runtimeEntriesV11 = await readdir("vercel-runtime", { recursive: true });
assert(!runtimeEntriesV11.some((entry) => String(entry).toLowerCase().endsWith(".pdf")), "V11 accidentally embeds authoritative PDFs in the Vercel function bundle");


const progressStoreV15 = await read("server/firebase/progressStore.ts");
const progressDataV15 = await read("src/shared/progressData.ts");
const zscoreV15 = await read("src/shared/zscore.ts");
const admissionV15 = await read("src/components/views/AdmissionPredictorView.tsx");
assert(
  progressStoreV15.includes("progress_sections")
    && progressStoreV15.includes("sectioned: true")
    && progressStoreV15.includes("1 MiB failures"),
  "V15 progress data is still stored as one oversized Firestore document",
);
assert(
  !appContextV11.includes("Progress data could not be loaded.")
    && !appContextV11.includes("Progress is waiting to sync. It will retry when the connection returns.")
    && appContextV11.includes("scheduleSaveFlush")
    && appContextV11.includes("loadOwnDataRef"),
  "V15 progress loading/synchronization still emits false failure notices or lacks background retry",
);
assert(
  progressDataV15.includes("normalizeZScoreHistory")
    && zscoreV15.includes("upsertDailyPredictorHistory")
    && zscoreV15.includes("slice(-1000)"),
  "V15 Z-score history normalization/preservation is incomplete",
);
assert(
  admissionV15.includes("hasHydratedUserData")
    && admissionV15.includes("upsertDailyPredictorHistory")
    && !admissionV15.includes("const fingerprint = `predictor:${day}"),
  "V15 Admission Predictor can still create repeated history writes before hydration",
);

console.log("V15 security, progress synchronization, Z-score history, and deployment checks passed.");

const apiClientV16 = await read("src/lib/api.ts");
const authMiddlewareV16 = await read("server/firebase/authMiddleware.ts");
assert(
  apiClientV16.includes("authRecoveryPromise")
    && apiClientV16.includes("getAuthToken(true)")
    && apiClientV16.includes("credentials: options.credentials || 'include'"),
  "V16 client auth recovery or cookie transport is incomplete",
);
assert(
  authMiddlewareV16.includes("verifyIdToken(token, false)")
    && authMiddlewareV16.includes("verifySessionCookie(sessionCookie, false)")
    && !authMiddlewareV16.includes("verifyIdToken(token, true)"),
  "V16 normal API auth still depends on privileged revocation checks",
);
assert(
  authRoutesV11.includes("verifyIdToken(idToken, false)")
    && authRoutesV11.includes("Cookie creation skipped; bearer authentication remains active")
    && authRoutesV11.includes("sessionCreated")
    && authRoutesV11.includes("profileSynced"),
  "V16 session bootstrap can still fail a valid Firebase login",
);
assert(
  appContextV11.includes("sessionBootstrap")
    && appContextV11.includes("lastSuccessfulLoadAtRef")
    && appContextV11.includes("status === 401 || status === 403"),
  "V16 authenticated bootstrap or 401 storm protection is incomplete",
);

console.log("V16 Firebase session, bearer recovery, and 401-storm checks passed.");


// V17 chat controls, project upload, PDF maintenance, KaTeX, and Direct PDF availability checks.
const cloraV17 = await read("src/components/views/CloraXView.tsx");
const composerV17 = await read("src/components/ui/clora/CloraComposer.tsx");
const projectUploadV17 = await read("src/lib/projectFileUpload.ts");
const pdfSourcesV17 = await read("src/pages/PdfSourcesPage.tsx");
const ragRoutesV17 = await read("server/rag/routes.ts");
const pdfRoutesV17 = await read("server/pdf/routes.ts");
const directPdfV17 = await read("server/ai-core/pdf/directPdfQa.ts");
const katexSafetyV17 = await read("src/lib/markdown/katexSafety.ts");
const mathRendererV17 = await read("src/components/chat/MathMarkdown.tsx");
const inventoryV17 = await read("server/sources/sourceInventoryService.ts");
const aiRoutesV17 = await read("server/ai/routes.ts");

assert(topNav.includes("Clear chat") && cloraV17.includes("/api/ai/chat-history/clear") && cloraV17.includes("bufferedAnswerRef.current.clear()"), "V18 clear-chat action or stream cleanup is incomplete");
assert(aiRoutesV17.includes('chat-history/clear') && aiRoutesV17.includes('collection("chat_context")') && aiRoutesV17.includes('collection("state")'), "V17 server chat-history cleanup is incomplete");
assert(composerV17.includes("Upload project files") && projectUploadV17.includes("readProjectArchive") && projectUploadV17.includes("node_modules") && projectUploadV17.includes("safeArchivePath") && projectUploadV17.includes('part === ".."'), "V17 project ZIP upload protection is incomplete");
assert(pdfSourcesV17.includes("Repair all") && pdfSourcesV17.includes("Re-index all") && pdfSourcesV17.includes("OCR required") && pdfSourcesV17.includes("OCR all"), "V17 bulk PDF maintenance controls are incomplete");
assert(ragRoutesV17.includes("processUploadedPdf") && ragRoutesV17.includes('forceOcr: mode === "ocr"'), "V17 re-index/OCR actions do not use the production PDF pipeline");
assert(inventoryV17.includes('key.endsWith(":admin")'), "V17 PDF inventory cache does not invalidate administrator views");
assert(katexSafetyV17.includes("sanitizeKatexMathBoundaries") && katexSafetyV17.includes("INVISIBLE_MATH_CONTROLS") && mathRendererV17.includes('strict: false'), "V17 Sinhala/KaTeX boundary protection is incomplete");
assert(directPdfV17.includes("createDirectPdfInputPart") && directPdfV17.includes("fileData") && directPdfV17.includes("pdfUri"), "V17 stored Direct PDF requests do not use GCS fileData");
const directRouteStartV17 = pdfRoutesV17.indexOf('pdfRoutes.post("/direct-qa-file"');
const directRouteEndV17 = pdfRoutesV17.indexOf('pdfRoutes.post("/question-preview"', directRouteStartV17);
const directRouteV17 = pdfRoutesV17.slice(directRouteStartV17, directRouteEndV17);
assert(directRouteStartV17 >= 0 && directRouteEndV17 > directRouteStartV17 && !directRouteV17.includes("res.status(503)"), "V17 Direct PDF endpoint can still surface expected provider unavailability as HTTP 503");
console.log("V17 chat, project upload, PDF maintenance, KaTeX, and Direct PDF checks passed.");


// V18 Error Log persistence, chat history controls, legacy Sinhala, strict syllabus,
// essay completeness, and Z-score context checks.
const mistakeStoreV18 = await read("server/firebase/mistakeStore.ts");
const zScoreContextV18 = await read("server/firebase/zScoreContext.ts");
const legacySinhalaV18 = await read("server/pdf/legacySinhala.ts");
const processingPipelineV18 = await read("server/pdf/processingPipeline.ts");
const essaySolverV18 = await read("server/ai-core/pdf/solveExtractedQuestion.ts");
const directPdfQaV18 = await read("server/ai-core/pdf/directPdfQa.ts");
const indexedDirectPdfQaV18 = await read("server/ai-core/pdf/indexedDirectPdfQa.ts");
const directFormatterV18 = await read("src/lib/ai/directPdfAnswerFormatter.ts");
const predictedPaperV18 = await read("server/ai-core/exam-intel/predictedPaper.ts");

assert(
  mistakeStoreV18.includes('collection("mistake_notebook").limit')
    && mistakeStoreV18.includes('"legacy_email"')
    && mistakeStoreV18.includes("updatedAt")
    && mistakeStoreV18.includes("lastAttemptAt")
    && !mistakeStoreV18.includes('orderBy("updatedAt")'),
  "V18 Error Log does not merge current and legacy records safely",
);
assert(
  respondStream.includes("DETERMINISTIC SAVED ERROR LOG INTENT")
    && respondStream.includes("mistake_log_loaded")
    && respondStream.includes("record **${records.length}ක්**"),
  "V18 Error Log answer can still falsely report an empty notebook",
);
assert(
  topNav.includes("clora:new-chat")
    && topNav.includes("clora:clear-chat")
    && topNav.includes("clora:history")
    && chat.includes("showChatHistory")
    && chat.includes("/api/ai/chat-history"),
  "V18 New chat, Clear chat, and Chat history controls are incomplete",
);
assert(!hero.includes("Clora X") && !chat.includes("Clora X") && !predictedPaperV18.includes("Clora X"), "V18 still exposes the removed Clora X label");
assert(
  legacySinhalaV18.includes("conversionQuality")
    && legacySinhalaV18.includes('normalizedText: trusted ? converted : ""')
    && processingPipelineV18.includes("legacy_text_untrusted")
    && processingPipelineV18.includes("untrustedLegacyPages.length === 0")
    && processingPipelineV18.includes("Falling back to OCR/document vision"),
  "V18 low-confidence legacy Sinhala can still enter RAG without OCR/document vision",
);
assert(
  essaySolverV18.includes("strictLesson: true")
    && essaySolverV18.includes("matching Lesson Resources first")
    && essaySolverV18.includes("කෝක් කැම්බියම")
    && essaySolverV18.includes("expectedSubparts")
    && essaySolverV18.includes("missingSubparts")
    && essaySolverV18.includes("maxOutputTokens: 8_192"),
  "V18 strict lesson/syllabus grounding or complete essay retry is incomplete",
);
assert(
  directPdfQaV18.includes("result.completed")
    && indexedDirectPdfQaV18.includes("solvedAnswer?.complete !== false")
    && directFormatterV18.includes("පිළිතුර සම්පූර්ණ නොවීය"),
  "V18 incomplete Direct PDF answers are not propagated to the UI",
);
assert(
  zScoreContextV18.includes("mergeZScoreHistory")
    && zScoreContextV18.includes("pickLatestZScoreEntry")
    && userContext.includes("preferredLatest"),
  "V18 Z-score history merge or preferred saved-paper estimate is incomplete",
);
console.log("V18 Error Log, chat history, legacy Sinhala, syllabus grounding, essay completeness, and Z-score checks passed.");


// V21 planner/reviewer, fail-closed Direct PDF, durable OCR jobs, preview
// degradation, adaptive Error Log, and observability checks.
const answerPlannerV21 = await read("server/ai/answerPlanner.ts");
const answerQualityV21 = await read("server/ai/answerQuality.ts");
const streamClientV21 = await read("src/hooks/useAIWorkflowStream.ts");
const pdfJobV21 = await read("server/pdf/jobManager.ts");
const ocrEnsembleV21 = await read("server/pdf/ocrEnsemble.ts");
const paperOutlineV21 = await read("server/pdf/paperOutline.ts");
const telemetryV21 = await read("server/observability/aiTelemetry.ts");
const studentRoutesV21 = await read("server/routes/studentRoutes.ts");
const serverEntryV21 = await read("server.ts");
assert(answerPlannerV21.includes("createAnswerPlan") && answerPlannerV21.includes("calculationChecks") && answerPlannerV21.includes("evidenceNeeds"), "V21 auditable answer planner is incomplete");
assert(
  answerQualityV21.includes("reviewAnswerQuality")
    && answerQualityV21.includes("createQualityRepairedAnswer")
    && respondStream.includes('emitSse(res, "answer_replace"')
    && respondStream.includes('emitSse(res, "quality_report"'),
  "V21 independent answer review/repair stream is incomplete",
);
assert(
  directPdfQaV18.includes("assessDirectPdfResultCompleteness")
    && streamClientV21.includes('completed: answerCompleted')
    && streamClientV21.includes('finishReason: answerCompleted ? "direct_pdf_qa_complete" : "direct_pdf_qa_incomplete"')
    && !streamClientV21.includes('completed: true, finishReason: "direct_pdf_qa_failed"'),
  "V21 Direct PDF completion still succeeds closed or reports failures as complete",
);
assert(
  pdfPreview.includes("createPdfQuestionPreviewFallback")
    && pdfPreview.includes("previewUnavailable")
    && pdfRoutesV17.includes("return res.status(200).json"),
  "V21 PDF preview degradation can still become an internal-server error",
);
assert(
  pdfJobV21.includes("pdf_processing_jobs")
    && pdfRoutesV17.includes('pdfRoutes.get("/jobs/:sourceId"')
    && pdfRoutesV17.includes('pdfRoutes.post("/jobs/:sourceId/retry"')
    && streamClientV21.includes("pollOcrUntilReady"),
  "V21 durable PDF jobs or automatic OCR polling/retry is incomplete",
);
assert(
  ocrEnsembleV21.includes("selectOcrEnsemble")
    && ocrEnsembleV21.includes("LOW_OCR_CONFIDENCE")
    && ocrEnsembleV21.includes("OCR_PROVIDER_DISAGREEMENT"),
  "V21 page-level OCR ensemble is incomplete",
);
assert(
  paperOutlineV21.includes("requiredSkills")
    && paperOutlineV21.includes("formulae")
    && paperOutlineV21.includes("confidence")
    && paperOutlineV21.includes("requiresVisual"),
  "V21 full-paper lesson/point map is missing enriched question metadata",
);
assert(
  mistakeStoreV18.includes("buildMistakeReviewUpdate")
    && studentRoutesV21.includes('router.get("/mistakes/review-queue"')
    && studentRoutesV21.includes('router.patch("/mistakes/:mistakeId/review"'),
  "V21 adaptive Error Log scheduling is incomplete",
);
assert(
  telemetryV21.includes("qualityPassRate")
    && telemetryV21.includes("previewFallbackCount")
    && aiRoutesV17.includes('aiRoutes.get("/quality-metrics"'),
  "V21 answer/PDF observability is incomplete",
);
assert(
  serverEntryV21.includes('app.use("/api/learning"')
    && serverEntryV21.includes('app.use("/api/platform"'),
  "V21 learning/platform feature routes are not mounted",
);
assert(
  envExample.includes("AI_PLANNER_ENABLED=true")
    && envExample.includes("AI_QUALITY_REVIEW_ENABLED=true")
    && envExample.includes("AI_AUTO_CONTINUATION_PASSES=3")
    && envExample.includes("ENABLE_AUTO_OCR=true"),
  "V21 production AI/OCR switches are incomplete",
);
console.log("V21 planner, answer verification, Direct PDF, OCR jobs, adaptive learning, and observability checks passed.");


// V22 source-context isolation, forecast routing, and real visual-explanation checks.
const sourceSelectionV22 = await read("server/ai/sourceSelection.ts");
const serverImageIntentV22 = await read("server/ai/imageIntent.ts");
const clientImageIntentV22 = await read("src/lib/ai/imageIntent.ts");
const cloraV22 = await read("src/components/views/CloraXView.tsx");
assert(
  sourceSelectionV22.includes("isPaperForecastPrompt")
    && sourceSelectionV22.includes("isExplicitNamedSourceRequest")
    && sourceSelectionV22.includes("shouldUseLockedSourceForTurn")
    && respondStream.includes("evidenceConversationState")
    && respondStream.includes("sourceContextApplies"),
  "V22 selected-PDF isolation or explicit named-source routing is incomplete",
);
assert(
  knowledgeRouter.includes("isPaperForecastPrompt(prompt)")
    && respondStream.includes("paperForecastPrompt")
    && respondStream.includes("isExplicitNamedSourceRequest(prompt)"),
  "V22 future-paper analysis can still be hijacked by an official/named PDF route",
);
assert(
  serverImageIntentV22.includes("isVisualExplanationIntent")
    && clientImageIntentV22.includes("isClientVisualExplanationIntent")
    && cloraV22.includes("IMAGE_URL_MISSING")
    && cloraV22.includes("generatedImage: {")
    && answerQualityV21.includes("never imitate one with ASCII art"),
  "V22 visual-explanation generation or missing-preview handling is incomplete",
);
console.log("V22 source isolation, forecast routing, and real-image explanation checks passed.");
