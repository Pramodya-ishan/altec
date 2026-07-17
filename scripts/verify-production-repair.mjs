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
assert(vercel?.functions?.["api/index.ts"]?.includeFiles === "vercel-runtime/**", "Vercel runtime assets are not fully included");
assert(envExample.includes("OCR_ENABLED=true") && envExample.includes("OCR_INPUT_BUCKET=al-ai-chat-ocr-input") && envExample.includes("OCR_OUTPUT_BUCKET=al-ai-chat-ocr-output"), "OCR production example is incomplete");

for (const path of [
  "vercel-runtime/server.mjs",
  "vercel-runtime/pdf.worker.mjs",
  "vercel-runtime/google-gax-protos",
]) {
  await access(path);
}
assert((await stat("vercel-runtime/pdf.worker.mjs")).size > 100_000, "PDF.js worker looks invalid");

console.log("Production repair static verification passed.");
