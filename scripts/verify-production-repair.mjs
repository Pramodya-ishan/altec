import { access, readFile, stat } from "node:fs/promises";

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
assert(topNav.includes('aria-label="Open navigation"'), "Mobile navigation button is missing its accessible label");
assert(topNav.includes('aria-label="New chat"') && !topNav.includes("/> New chat"), "New chat must be icon-only");
assert(chat.includes("Ask about a lesson, paper, question, or result."), "English welcome message is missing");
assert(chat.includes('aria-label="Jump to latest answer"') && !chat.includes("අලුත් පිළිතුර"), "Latest-answer button was not repaired");
assert(chat.includes('accept="application/pdf,image/png,image/jpeg,image/webp"'), "Assistant attachment input is not restricted");
assert(bubble.includes("Searching sources") && bubble.includes("Preparing answer") && bubble.includes("Copy answer"), "Assistant status chrome is not English");
assert(chartShell.includes("ResizeObserver") && chartShell.includes("IntersectionObserver"), "Chart shell is missing visibility-aware measurement");
assert(!chartShell.includes("ResponsiveContainer"), "ResponsiveChartShell must not depend on ResponsiveContainer");
assert(videoPlayer.includes("Preparing video…") && videoPlayer.includes("Retry") && !videoPlayer.includes("<header"), "Video player overlay repair is incomplete");
assert(upload.includes("validatePersonalAssistantFile") && upload.includes("25 * MB") && upload.includes("10 * MB"), "Personal attachment validation is incomplete");
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
assert(contentPermissions.includes("isStudentVisibleSource") && contentPermissions.includes("isSharedSourceScope(source.sourceScope)"), "Legacy shared administrator resources are not safely visible to students");
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
assert(directFormatter.includes("normalizeMcqOption") && directFormatter.includes('type: "source_evidence"') && directFormatter.includes('type: "comparison_bars"'), "Direct PDF answer UI formatter is incomplete");
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
assert(imageGenerator.includes('responseModalities: ["TEXT", "IMAGE"]') && imageGenerator.includes("generated_images/"), "Image generation/storage pipeline is incomplete");
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
