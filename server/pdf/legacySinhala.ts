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

export function detectSinhalaTextEncoding(text: string): EncodingResult {
  if (!text) {
    return { encoding: "unknown", confidence: 0, reason: "Empty text" };
  }

  // 1. Count Unicode Sinhala characters
  const unicodeMatches = text.match(/[\u0D80-\u0DFF]/g);
  const unicodeCount = unicodeMatches ? unicodeMatches.length : 0;

  // 2. Count legacy Sinhala garbage patterns common in Sinhala legacy PDFs
  const legacyPatterns = [
    "LKavdxl", "cHd", "ñ", "ú", "Y%", "m%", "fuu", "fyd", "iS", "wxl", "m%Yak", "ms<s;=re", "fnda", ";dlaIK"
  ];

  let legacyHits = 0;
  legacyPatterns.forEach(pat => {
    const regex = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = text.match(regex);
    if (matches) {
      legacyHits += matches.length;
    }
  });

  const totalChars = text.length || 1;
  const unicodeRatio = unicodeCount / totalChars;

  if (unicodeCount > 50 && unicodeRatio > 0.1) {
    return {
      encoding: "unicode_sinhala",
      confidence: 0.95,
      reason: `Found ${unicodeCount} Unicode Sinhala characters (Ratio: ${(unicodeRatio * 100).toFixed(1)}%).`
    };
  }

  if (legacyHits > 5) {
    return {
      encoding: "legacy_fm_abhaya",
      confidence: Math.min(0.9, 0.4 + (legacyHits / 20)),
      reason: `Found ${legacyHits} common FM-Abhaya legacy font garbage patterns (Unicode count: ${unicodeCount}).`
    };
  }

  if (unicodeCount === 0 && text.match(/[A-Za-z]/)) {
    // Check for Bamini or other legacy patterns (common Tamil legacy font uses Bamini etc, but here let's focus on Sinhala)
    if (legacyHits > 2 || text.includes("LKavdxl") || text.includes("cHdñ;sh") || text.includes(";dlaIK")) {
      return {
        encoding: "legacy_fm_abhaya",
        confidence: 0.8,
        reason: "Specific SFT/ET legacy keywords detected."
      };
    }
    // Check if it's mostly english words
    const englishWords = text.match(/\b[A-Za-z]+\b/g);
    const hasEnglish = englishWords && englishWords.length > Math.max(1, totalChars / 20); // rough check

    if (hasEnglish) {
       return {
         encoding: "native_english",
         confidence: 0.9,
         reason: "Contains English alphabet letters with no legacy patterns."
       };
    }

    return {
      encoding: "unknown",
      confidence: 0.3,
      reason: "No Unicode Sinhala but contains some alphabet letters; not enough legacy patterns."
    };
  }

  return {
    encoding: "unknown",
    confidence: 0.3,
    reason: "No definitive Sinhala patterns detected."
  };
}

// A smart mapping dictionary for common words first to ensure extremely high quality, 
// then a char-by-char best effort mapping for SFT/ET/ICT technical vocabulary.
const WORD_REPLACEMENTS: [RegExp, string][] = [
  [/LKavdxl/g, "ඛණ්ඩාංක"],
  [/cHdñ;sh/g, "ජ්‍යාමිතිය"],
  [/;dlaIK/g, "තාක්‍ෂණ"],
  [/ms<s;=re/g, "පිළිතුරු"],
  [/m%Yak/g, "ප්‍රශ්න"],
  [/fuu/g, "මෙම"],
  [/fyd/g, "හෝ"],
  [/wxlh/g, "අංකය"],
  [/wxl/g, "අංක"],
  [/Y%/g, "ශ්‍රී"],
  [/m%/g, "ප්‍ර"],
  [/úNd/g, "විභා"],
  [/fnda/g, "බෝ"],
  [/iS/g, "සී"]
];

const CHAR_REPLACEMENTS: [string, string][] = [
  // Consonants & basic letters
  ["wxl", "අංක"],
  ["LKv", "ඛණ්ඩ"],
  ["w", "අ"], ["W", "ආ"], ["b", "ඉ"], ["B", "ඊ"], ["t", "එ"], ["ta", "ඒ"],
  ["l", "ක"], ["L", "ඛ"], ["g", "ග"], ["G", "ඝ"],
  ["p", "ච"], ["P", "ඡ"], ["c", "ජ"], ["C", "ඣ"],
  ["v", "ඩ"], ["V", "ඪ"], ["K", "ණ"],
  [";", "ත"], ["Q", "ථ"], ["o", "ද"], ["O", "ධ"], ["k", "න"],
  ["m", "ප"], ["M", "ඵ"], ["n", "බ"], ["N", "භ"], ["u", "ම"],
  ["h", "ය"], ["r", "ර"], ["j", "ව"], ["Y", "ශ"], ["I", "ෂ"], ["i", "ස"], ["y", "හ"], ["<", "ළ"],
  // Vowels
  ["d", "ා"], ["s", "ි"], ["S", "ී"], ["=", "ු"], ["W", "ූ"], ["D", "ෘ"], ["f", "ෙ"], ["F", "ේ"], ["x", "ං"], ["a", "්"]
];

export function normalizeSinhalaExtractedText(rawText: string): NormalizationResult {
  if (!rawText) {
    return {
      rawText: "",
      normalizedText: "",
      textEncoding: "unknown",
      conversionApplied: false,
      conversionConfidence: 0,
      needsLegacyConversion: false,
      warnings: []
    };
  }

  const { encoding, confidence } = detectSinhalaTextEncoding(rawText);

  if (encoding === "unicode_sinhala" || encoding === "native_english") {
    return {
      rawText,
      normalizedText: rawText,
      textEncoding: encoding,
      conversionApplied: false,
      conversionConfidence: 1.0,
      needsLegacyConversion: false,
      warnings: []
    };
  }

  if (encoding === "legacy_fm_abhaya" || encoding === "legacy_unknown") {
    let converted = rawText;

    // Apply word-level smart replacements first
    WORD_REPLACEMENTS.forEach(([regex, repl]) => {
      converted = converted.replace(regex, repl);
    });

    // Run a standard legacy transformation for the 'f' prefix vowel modifier (ෙ).
    // In legacy fonts, 'f' comes BEFORE the consonant (e.g., 'fl' -> 'කෙ').
    // In Unicode, 'ෙ' comes AFTER (e.g., 'කෙ').
    // Pattern: 'f' followed by any consonant letter, optionally with other characters.
    // We can swap 'f' with the character following it.
    // Consonant list: [a-zA-Z;<`\[\]ˆ]
    converted = converted.replace(/f([a-zA-Z;<`\[\]ˆ])(d)?/g, (match, consonant, ra_hida) => {
      // Find the mapped Unicode consonant
      let mappedCons = consonant;
      for (const [key, val] of CHAR_REPLACEMENTS) {
        if (key === consonant) {
          mappedCons = val;
          break;
        }
      }
      return mappedCons + (ra_hida ? "ෝ" : "ෙ");
    });

    // Also handle 'F' which is 'ේ'
    converted = converted.replace(/F([a-zA-Z;<`\[\]ˆ])/g, (match, consonant) => {
      let mappedCons = consonant;
      for (const [key, val] of CHAR_REPLACEMENTS) {
        if (key === consonant) {
          mappedCons = val;
          break;
        }
      }
      return mappedCons + "ේ";
    });

    // Replace other individual characters
    for (const [legacyChar, unicodeChar] of CHAR_REPLACEMENTS) {
      // We escape characters that are special in regex
      const escaped = legacyChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      converted = converted.replace(new RegExp(escaped, 'g'), unicodeChar);
    }

    // Secondary cleanup of common legacy conversion remnants
    converted = converted
      .replace(/්‍රි/g, "්‍රී")
      .replace(/්ා/g, "්")
      .replace(/ිි/g, "ී");

    // Check if we successfully converted into some Unicode Sinhala
    const postUnicodeMatches = converted.match(/[\u0D80-\u0DFF]/g);
    const postUnicodeCount = postUnicodeMatches ? postUnicodeMatches.length : 0;

    const conversionSuccess = postUnicodeCount > 20;

    return {
      rawText,
      normalizedText: converted,
      textEncoding: encoding,
      conversionApplied: true,
      conversionConfidence: conversionSuccess ? Math.max(0.7, confidence) : 0.4,
      needsLegacyConversion: !conversionSuccess,
      warnings: conversionSuccess ? [] : ["Legacy conversion confidence is low. Manual check recommended."]
    };
  }

  return {
    rawText,
    normalizedText: rawText,
    textEncoding: "unknown",
    conversionApplied: false,
    conversionConfidence: 0.0,
    needsLegacyConversion: true,
    warnings: ["Could not detect legacy font encoding type."]
  };
}
