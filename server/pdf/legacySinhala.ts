export interface EncodingResult {
  encoding: "unicode_sinhala" | "legacy_fm_abhaya" | "legacy_bamini" | "legacy_unknown" | "unknown" | "native_english";
  confidence: number;
  reason: string;
}

export interface NormalizationResult {
  rawText: string;
  normalizedText: string;
  textEncoding: string;
  conversionApplied: boolean;
  conversionConfidence: number;
  needsLegacyConversion: boolean;
  warnings: string[];
}

const LEGACY_SIGNAL = /(?:m%|Y%|;dlaIK|ms<s|fuu|j(?:3⁄4|¾)Okh|ñ|ú|õ|ÿ|§|¾|f[;,lmkodYI])/u;

export function detectSinhalaTextEncoding(text: string): EncodingResult {
  if (!text) return { encoding: "unknown", confidence: 0, reason: "Empty text" };
  const unicodeCount = (text.match(/[\u0D80-\u0DFF]/gu) || []).length;
  const visibleCount = Math.max(1, text.replace(/\s/gu, "").length);
  const unicodeRatio = unicodeCount / visibleCount;
  if (unicodeCount > 20 && unicodeRatio > 0.18) {
    return { encoding: "unicode_sinhala", confidence: 0.98, reason: "Unicode Sinhala text detected." };
  }

  const legacyMatches = text.match(/(?:m%|Y%|;dlaIK|ms<s|fuu|j(?:3⁄4|¾)Okh|ñ|ú|õ|ÿ|§|¾|f[;,lmkodYI])/gu) || [];
  const mojibakeFractions = text.match(/3\s*⁄\s*4/gu) || [];
  if (legacyMatches.length >= 2 || mojibakeFractions.length > 0 || LEGACY_SIGNAL.test(text)) {
    return {
      encoding: "legacy_fm_abhaya",
      confidence: Math.min(0.97, 0.62 + legacyMatches.length * 0.035 + mojibakeFractions.length * 0.08),
      reason: "FM-Abhaya legacy glyph sequences detected.",
    };
  }

  const englishWords = text.match(/\b[A-Za-z]{3,}\b/gu) || [];
  if (unicodeCount === 0 && englishWords.length >= 3 && !/[;%¾ñúõÿ§]/u.test(text)) {
    return { encoding: "native_english", confidence: 0.9, reason: "Native English text detected." };
  }
  return { encoding: "unknown", confidence: 0.3, reason: "Encoding could not be verified." };
}

const EXACT_WORDS: Array<[RegExp, string]> = [
  [/Ydlhl/gu, "ශාකයක"],
  [/j(?:3\s*⁄\s*4|¾)Okh/gu, "වර්ධනය"],
  [/m%d:ñl/gu, "ප්‍රාථමික"],
  [/oaú;Sl/gu, "ද්විතීක"],
  [/f,i/gu, "ලෙස"],
  [/m%Odk/gu, "ප්‍රධාන"],
  [/wdldr/gu, "ආකාර"],
  [/follg/gu, "දෙකට"],
  [/isÿ/gu, "සිදු"],
  [/fõ/gu, "වේ"],
  [/l=ula/gu, "කුමක්"],
  [/fudkjd/gu, "මොනවා"],
  [/i\|yka/gu, "සඳහන්"],
  [/lrkak/gu, "කරන්න"],
  [/fláfhka/gu, "කෙටියෙන්"],
  [/y÷kajkak/gu, "හඳුන්වන්න"],
  [/tkaihsu/gu, "එන්සයිම"],
  [/WIaK;aj/gu, "උෂ්ණත්ව"],
  [/l%shdldÍ;ajh/gu, "ක්‍රියාකාරීත්වය"],
  [/m%Yak/gu, "ප්‍රශ්න"],
  [/ms<s;=re/gu, "පිළිතුරු"],
  [/;dlaIK/gu, "තාක්ෂණ"],
  [/fuu/gu, "මෙම"],
  [/fyd/gu, "හෝ"],
  [/wxlh/gu, "අංකය"],
  [/Y%S/gu, "ශ්‍රී"],
];

const SINGLES: Record<string, string> = {
  w: "අ", b: "ඉ", B: "ඊ", W: "උ", R: "ඍ", t: "එ", T: "ඔ", "´": "ඕ",
  l: "ක", L: "ඛ", ".": "ග", ">": "ඝ", X: "ඞ", Õ: "ඟ", p: "ච", P: "ඡ", c: "ජ",
  "[": "ඤ", "{": "ඥ", g: "ට", G: "ඨ", v: "ඩ", V: "ඪ", K: "ණ", "~": "ඬ",
  ";": "ත", ":": "ථ", o: "ද", O: "ධ", k: "න", "|": "ඳ", m: "ප", M: "ඵ", n: "බ",
  N: "භ", u: "ම", U: "ඹ", h: "ය", r: "ර", ",": "ල", j: "ව", Y: "ශ", I: "ෂ", i: "ස",
  y: "හ", "<": "ළ", "*": "ෆ",
  e: "ැ", E: "ෑ", q: "ු", Q: "ූ", s: "ි", S: "ී", "!": "ෟ", d: "ා", a: "්", x: "ං", "#": "ඃ", D: "ෘ",
  H: "්‍ය", "%": "්‍ර", "¾": "ර්", "…": "ත්‍ව", "‡": "න්‍ද", "„": "ද්‍ව", "Š": "ද්‍ධ",
  "ú": "වි", "ñ": "මි", "õ": "ව්", "ÿ": "දු", "§": "දී", "È": "දි", "ß": "රි", "Í": "රී",
  "è": "ධ්", "ê": "ධි", "ë": "ධී", "ï": "ම්", "ù": "වී", "ø": "ද්‍ර", "‰": "ද්වි", "›": "ශ්‍රී",
  "¢": "ඳි", "£": "ඳී", "¨": "ලු", "ª": "ඳූ", "÷": "ඳු", "ƒ": "ඳැ", "Œ": "ණී", "‚": "ණි",
  "Ä": "ඛ්", "Å": "ඛි", "Æ": "ලූ", "Ç": "ඛී", "É": "ච්", "Ê": "ජ්", "Ù": "ඞ්", "Ü": "ට්",
  "Þ": "දා", "à": "ටී", "á": "ටි", "â": "ඩ්", "ä": "ඩි", "å": "ඬ්", "ç": "ඬි", "é": "ඬී",
  "ì": "බි", "í": "බ්", "î": "බී", "ð": "ජි", "ò": "ඹ්", "ó": "මී", "ô": "ඹි", "ö": "ඹී",
};

function repairExtractionArtifacts(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/3\s*⁄\s*4/gu, "¾")
    // PDF text extraction sometimes inserts spaces between a consonant and its
    // legacy vowel/virama modifier. Remove only those impossible boundaries.
    .replace(/([A-Za-z;:,.<>|\]\[¾ñúõÿ§])\s+(?=[aAsSdDeEqQxH%¾])/gu, "$1")
    .replace(/([aAH%])\s+(?=[A-Za-z;:,.<>|\]\[¾ñúõÿ§])/gu, "$1")
    .replace(/\s+([,.;:?@])/gu, "$1")
    .replace(/[ \t]{2,}/gu, " ")
    .trim();
}

function convertGenericLegacy(input: string): string {
  let text = repairExtractionArtifacts(input);
  for (const [pattern, replacement] of EXACT_WORDS) text = text.replace(pattern, replacement);
  text = text
    .replace(/wd/gu, "ආ")
    .replace(/we/gu, "ඇ")
    .replace(/wE/gu, "ඈ")
    .replace(/W!/gu, "ඌ")
    .replace(/RD/gu, "ඎ")
    .replace(/ta/gu, "ඒ")
    .replace(/ft/gu, "ඓ")
    .replace(/T!/gu, "ඖ")
    .replace(/CI/gu, "ක්‍ෂ")
    .replace(/Cj/gu, "ක්‍ව")
    .replace(/JO/gu, "න්‍ධ")
    .replace(/%s/gu, "්‍රි")
    .replace(/%S/gu, "්‍රී")
    .replace(/DD/gu, "ෲ");

  // Reorder pre-base vowel marks. The legacy 'f' is typed before the base
  // consonant, while Unicode stores the vowel sign after it.
  const baseCodes = "wWbBtTlL.>XÕpPc[gGvVK~;:oOk|mMnNuUh r,jYIiy<*".replace(/ /gu, "");
  const escaped = baseCodes.replace(/[\\\-\]\[]/gu, "\\$&");
  text = text.replace(new RegExp(`ff([${escaped}])`, "gu"), (_match, base) => `${SINGLES[base] || base}ෛ`);
  text = text.replace(new RegExp(`f([${escaped}])d`, "gu"), (_match, base) => `${SINGLES[base] || base}ෝ`);
  text = text.replace(new RegExp(`f([${escaped}])a`, "gu"), (_match, base) => `${SINGLES[base] || base}ේ`);
  text = text.replace(new RegExp(`f([${escaped}])`, "gu"), (_match, base) => `${SINGLES[base] || base}ෙ`);

  let output = "";
  for (const character of text) output += SINGLES[character] ?? character;
  return output
    .replace(/්ා/gu, "්")
    .replace(/ිි/gu, "ී")
    .replace(/ො/gu, "ො")
    .replace(/ෙෝ/gu, "ෝ")
    .replace(/\u200d{2,}/gu, "\u200d")
    .replace(/[ \t]{2,}/gu, " ")
    .normalize("NFC");
}

function conversionQuality(raw: string, converted: string): number {
  const visible = Math.max(1, converted.replace(/\s/gu, "").length);
  const sinhala = (converted.match(/[\u0D80-\u0DFF]/gu) || []).length;
  const remainingLegacy = (converted.match(/[A-Za-z%¾ñúõÿ§]/gu) || []).length;
  const tokens = converted.split(/\s+/gu).filter(Boolean);
  const mixedTokens = tokens.filter((token) => /[A-Za-z%¾ñúõÿ§]/u.test(token) && /[\u0D80-\u0DFF]/u.test(token)).length;
  const mixedTokenRatio = tokens.length > 0 ? mixedTokens / tokens.length : 1;
  const punctuationNoise = /(?:\?{2,}|!{3,}|[<>]{2,}|={3,})/u.test(converted) ? 0.4 : 0;
  const questionStructure = /(?:\(i+\)|\([a-z]\)|\d+[.)])/iu.test(raw) ? 0.04 : 0;
  const residualPenalty = remainingLegacy / visible > 0.08 ? 0.3 : 0;
  return Math.max(0, Math.min(1,
    (sinhala / visible) * 1.25
    - (remainingLegacy / visible) * 1.4
    - mixedTokenRatio * 0.55
    - punctuationNoise
    - residualPenalty
    + questionStructure,
  ));
}

export function normalizeSinhalaExtractedText(rawText: string): NormalizationResult {
  if (!rawText) {
    return { rawText: "", normalizedText: "", textEncoding: "unknown", conversionApplied: false, conversionConfidence: 0, needsLegacyConversion: false, warnings: [] };
  }
  const detected = detectSinhalaTextEncoding(rawText);
  if (detected.encoding === "unicode_sinhala" || detected.encoding === "native_english") {
    return { rawText, normalizedText: rawText.normalize("NFC"), textEncoding: detected.encoding, conversionApplied: false, conversionConfidence: 1, needsLegacyConversion: false, warnings: [] };
  }
  if (detected.encoding === "legacy_fm_abhaya" || detected.encoding === "legacy_unknown") {
    const converted = convertGenericLegacy(rawText);
    const quality = conversionQuality(rawText, converted);
    const trusted = quality >= 0.62;
    return {
      rawText,
      // Never put low-confidence gibberish into RAG. The original PDF remains
      // available to Gemini document vision/OCR for an evidence-safe fallback.
      normalizedText: trusted ? converted : "",
      textEncoding: "legacy_fm_abhaya",
      conversionApplied: true,
      conversionConfidence: quality,
      needsLegacyConversion: !trusted,
      warnings: trusted ? [] : ["Legacy Sinhala conversion was not reliable enough; PDF vision/OCR is required."],
    };
  }
  return { rawText, normalizedText: rawText, textEncoding: "unknown", conversionApplied: false, conversionConfidence: 0, needsLegacyConversion: true, warnings: ["Could not verify the PDF text encoding."] };
}
