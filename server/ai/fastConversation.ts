export type FastConversationIntent =
  | "assistant_creator"
  | "assistant_identity"
  | "assistant_capabilities"
  | "wellbeing"
  | "acknowledgement"
  | "thanks";

export interface FastConversationResult {
  intent: FastConversationIntent;
  answer: string;
}

function normalizeConversationText(value: unknown): string {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[?!.,'"`~()[\]{}:;_-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function isShortConversation(value: string): boolean {
  return value.length > 0 && value.length <= 140 && value.split(/\s+/u).length <= 18;
}

/**
 * Handles only unambiguous, low-risk conversational requests. Educational,
 * source, paper, image, and calculation prompts deliberately fall through to
 * the full AI workflow.
 */
export function classifyFastConversationIntent(value: unknown): FastConversationIntent | null {
  const text = normalizeConversationText(value);
  if (!isShortConversation(text)) return null;

  const asksCreator = /\bwho\s+(?:made|created|built|developed)\s+(?:you|this\s+(?:app|assistant))\b/u.test(text)
    || /(?:ඔයාව|මේ\s*(?:ඇප්|assistant)|ඔබව).*(?:කවුද|කව්ද).*(?:හැදුවේ|නිර්මාණය|හදලා)/u.test(text)
    || /(?:කවුද|කව්ද).*(?:ඔයාව|මේ\s*(?:ඇප්|assistant)|ඔබව).*(?:හැදුවේ|නිර්මාණය|හදලා)/u.test(text)
    || /\b(?:i|ai|oya|oyawa|oywa|pyaw)\b.*\b(?:kawda|kauda|kwd)\b.*\b(?:haduwe|hduwe|hadala|created)\b/u.test(text)
    || /\b(?:kawda|kauda|kwd)\b.*\b(?:oya|oyawa|oywa|pyaw|you|ai)\b.*\b(?:haduwe|hduwe|hadala|created)\b/u.test(text);
  if (asksCreator) return "assistant_creator";

  if (/^(?:who|what)\s+are\s+you$/u.test(text)
    || /^(?:ඔයා|ඔබ)\s*(?:කවුද|මොකක්ද)$/u.test(text)
    || /^(?:ඔයාගේ|ඔබගේ)\s+නම\s+මොකක්ද$/u.test(text)
    || /^(?:oya|oyaa|oba)\s*(?:kawda|kauda|kwd)$/u.test(text)) {
    return "assistant_identity";
  }

  if (/^what\s+can\s+you\s+do$/u.test(text)
    || /^(?:ඔයාට|ඔබට)\s*(?:මොනවද|මොනවාද)\s*(?:කරන්න\s*)?පුළුවන්$/u.test(text)
    || /^(?:oya|oyata|obata).*(?:monawada|mokakda).*(?:puluwan|plwn)$/u.test(text)) {
    return "assistant_capabilities";
  }

  if (/^how\s+are\s+you$/u.test(text)
    || /^(?:ඔයාට|ඔබට)\s+කොහොමද$/u.test(text)
    || /^(?:oya|oyata|obata)\s+(?:kohomada|komada)$/u.test(text)) return "wellbeing";

  if (/^(?:ok|okay|හරි|hari|ela|එල)$/u.test(text)) return "acknowledgement";
  if (/^(?:thanks|thank\s+you|thx|tnx|ස්තුතියි|බොහොම\s+ස්තුතියි)$/u.test(text)) return "thanks";
  return null;
}

export function buildFastConversationAnswer(intent: FastConversationIntent): string {
  const configuredCreator = String(process.env.APP_CREATOR_NAME || "Pramodya Ishan").trim();
  switch (intent) {
    case "assistant_creator":
      return `මාව නිර්මාණය කළේ ${configuredCreator}. මම ශ්‍රී ලංකා A/L Technology සිසුන්ට SFT, ET සහ ICT ඉගෙනීමට උදව් කරන AI study assistant එකක්.`;
    case "assistant_identity":
      return "මම SFT, ET සහ ICT සඳහා සිංහලෙන් උදව් කරන A/L Technology AI study assistant එකක්.";
    case "assistant_capabilities":
      return "මට පාඩම් පැහැදිලි කරන්න, ගණන් පියවරෙන් පියවර විසඳන්න, තෝරාගත් PDF එකේ exact ප්‍රශ්න කියවන්න, රූප/සටහන් සමඟ පැහැදිලි කරන්න, සහ ඔයාගේ දුර්වල කොටස් අනුව පුහුණු ප්‍රශ්න හදන්න පුළුවන්.";
    case "wellbeing":
      return "මම හොඳින්—ඔයාට ඉගෙනගන්න උදව් කරන්න සූදානම්.";
    case "acknowledgement":
      return "හරි. ඊළඟට කරන්න ඕන දේ කියන්න.";
    case "thanks":
      return "හරි, සතුටුයි! ඊළඟ ප්‍රශ්නයත් එවන්න.";
  }
}

export function resolveFastConversation(value: unknown): FastConversationResult | null {
  const intent = classifyFastConversationIntent(value);
  return intent ? { intent, answer: buildFastConversationAnswer(intent) } : null;
}
