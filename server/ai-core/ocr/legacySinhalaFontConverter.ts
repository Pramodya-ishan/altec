export interface LegacyFontDetectionResult {
  legacyFontDetected: boolean;
  detectedFont?: string;
  confidence: number;
  needsManualReview: boolean;
  convertedText?: string;
}

/**
 * Placeholder for legacy Sinhala font converter.
 * Currently detects common patterns but does not perform full conversion.
 */
export function detectLegacySinhalaFont(text: string): LegacyFontDetectionResult {
  if (!text) {
    return { legacyFontDetected: false, confidence: 0, needsManualReview: false };
  }

  // Common legacy font characters/patterns (FM-Abhaya, etc. often use non-unicode positions)
  // This is a simplified heuristic
  const legacyPatterns = [
    /[\u0080-\u00FF]/, // Many legacy fonts use Latin-1 range
    /[A-Z][a-z]{5,}[A-Z]/, // Some legacy font encoders leave weird strings
    /\b[a-z]{1,2}[0-9]{1,2}\b/, // Common in some font encodings
  ];

  let legacyFontDetected = false;
  for (const pattern of legacyPatterns) {
    if (pattern.test(text)) {
      legacyFontDetected = true;
      break;
    }
  }

  return {
    legacyFontDetected,
    detectedFont: legacyFontDetected ? "Unknown Legacy Font" : undefined,
    confidence: legacyFontDetected ? 0.7 : 0,
    needsManualReview: legacyFontDetected,
  };
}

export function convertLegacyToUnicode(text: string, fontName?: string): string {
  // Placeholder for actual conversion logic (FM-Abhaya -> Unicode etc.)
  // For now, return as is or with a warning
  return text;
}
