export function classifyMode(prompt: string, mode: string) {
  if (mode && mode !== "auto") return mode;
  const lower = prompt.toLowerCase();
  
  if (lower.includes("අද මොනවද") || lower.includes("today plan") || lower.includes("remaining hours") || lower.includes("දැන් මොනවද කරන්නෙ")) return "today_plan";
  if (lower.includes("plan") || lower.includes("schedule") || lower.includes("calendar") || lower.includes("finish syllabus") || lower.includes("days left")) return "study_plan";
  if (lower.includes("ඇයි") || lower.includes("කොහොමද") || lower.includes("explain") || lower.includes("formula") || lower.includes("concept")) return "tutor_explanation";
  if (lower.includes("notes") || lower.includes("short notes") || lower.includes("revision note")) return "notes_generation";
  if (lower.includes("quiz") || lower.includes("mcq") || lower.includes("test") || lower.includes("questions")) return "quiz_generation";
  if (lower.includes("past paper") || lower.includes("marking scheme") || lower.includes("pdf") || lower.includes("download") || lower.includes("link")) return "past_paper_search";
  if (lower.includes("frequency") || lower.includes("prediction") || lower.includes("repeated") || lower.includes("trend") || lower.includes("probability")) return "past_paper_analysis";
  if (lower.includes("z-score") || lower.includes("rank") || lower.includes("campus") || lower.includes("marks target")) return "zscore_prediction";
  if (lower.includes("diagram") || lower.includes("image") || lower.includes("visual") || lower.includes("draw") || lower.includes("circuit")) return "image_generation";

  return "general_chat";
}

export function requiresGoogleSearch(mode: string, prompt: string) {
  if (mode === "past_paper_search") return true;
  const lower = prompt.toLowerCase();
  const triggers = ["latest", "link", "pdf", "download", "past paper", "marking scheme", "syllabus", "web", "verify", "current info", "ප්‍රශ්න පත්‍ර", "ලින්ක්", "නවතම", "පිළිතුරු පත්‍රය"];
  return triggers.some(t => lower.includes(t));
}
