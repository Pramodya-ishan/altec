export type EducationalVisualBlock =
  | { type: "formula_card"; title: string; formula: string; variables: { symbol: string; meaning: string }[] }
  | { type: "reaction_diagram"; title: string; equation: string; caption?: string }
  | { type: "process_flow"; title: string; steps: string[]; caption?: string }
  | {
      type: "mechanics_diagram";
      title: string;
      scenes: Array<{
        title: string;
        massKg: number;
        appliedForceN: number;
        angleDeg: number;
        surface: "smooth" | "rough";
        frictionN?: number;
      }>;
      caption?: string;
    };

function cleanInline(value: string) {
  return value
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractReaction(answer: string) {
  const lines = answer.split(/\r?\n/).map(cleanInline).filter(Boolean);
  return lines.find((line) =>
    line.length <= 180
    && /(?:→|->|⇌|↔)/u.test(line)
    && /[A-Za-z0-9₂₃₄₅₆₇₈₉⁺⁻]/u.test(line)
  ) || null;
}

function extractFormula(answer: string) {
  const display = answer.match(/\$\$\s*([\s\S]{3,180}?)\s*\$\$/)?.[1]
    || answer.match(/(?:^|\n)\$\s*([^\n$]{3,180}?)\s*\$(?:\n|$)/)?.[1];
  if (display && !/[?？]/u.test(display)) return display.trim();

  const lines = answer.split(/\r?\n/).map(cleanInline).filter(Boolean);
  return lines.find((line) =>
    line.length <= 140
    && /[=≤≥]/u.test(line)
    && /[A-Za-zα-ωΑ-ΩσθπΔ]/u.test(line)
    && !/[?？]/u.test(line)
    && !/(?:කොපමණ|ගණනය\s*කරන්න|find|calculate|what\s+is)/iu.test(line)
  ) || null;
}

function extractSteps(answer: string) {
  const candidates = answer.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(?:#{1,4}\s*)?(?:පියවර|Step)\s*\d+/i.test(line))
    .map((line) => cleanInline(line.replace(/^(?:පියවර|Step)\s*\d+\s*[:.-]?\s*/i, "")))
    .filter((line) => line.length >= 3 && line.length <= 120)
    .slice(0, 6);
  return candidates.length >= 2 ? candidates : [];
}

function numberFrom(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  const value = match ? Number(match[1]) : Number.NaN;
  return Number.isFinite(value) ? value : null;
}

function buildMechanicsDiagram(prompt: string): EducationalVisualBlock | null {
  const normalized = String(prompt || "").normalize("NFKC");
  if (!/(?:බලය|ඝර්ෂණ|අභිලම්භ|සමතුලිත|force|friction|normal\s+reaction|mechanics)/iu.test(normalized)) return null;

  const secondMarker = normalized.search(/(?:ප්‍රශ්නය|question)\s*0?2\b/iu);
  const segments = secondMarker > 0
    ? [normalized.slice(0, secondMarker), normalized.slice(secondMarker)]
    : [normalized];
  const scenes = segments.map((segment, index) => {
    const massKg = numberFrom(segment, /(\d+(?:\.\d+)?)\s*(?:\\,\s*)?(?:kg|\\mathrm\{kg\}|කි\.?ග්‍රෑ)/iu);
    const appliedForceN = numberFrom(segment, /(\d+(?:\.\d+)?)\s*(?:\\,\s*)?(?:N|\\mathrm\{N\}|නිව්ටන්)/iu);
    if (massKg === null || appliedForceN === null) return null;
    const angleDeg = numberFrom(segment, /(\d+(?:\.\d+)?)\s*(?:°|degrees?|\^\{?\\circ\}?|\\circ)/iu) || 0;
    const rough = /(?:රළු|rough|ඝර්ෂණ)/iu.test(segment);
    return {
      title: `ප්‍රශ්නය ${index + 1}`,
      massKg,
      appliedForceN,
      angleDeg,
      surface: rough ? "rough" as const : "smooth" as const,
      frictionN: rough ? appliedForceN : undefined,
    };
  }).filter(Boolean) as Array<{
    title: string;
    massKg: number;
    appliedForceN: number;
    angleDeg: number;
    surface: "smooth" | "rough";
    frictionN?: number;
  }>;
  if (scenes.length === 0) return null;
  return {
    type: "mechanics_diagram",
    title: "නිදහස් බල රූපසටහන",
    scenes: scenes.slice(0, 2),
    caption: "ඊතලයේ දිග පරිමාණයට නොවේ. ගණනයට පෙර බලවල දිශා හඳුනාගන්න.",
  };
}

export function deriveEducationalVisualBlocks(params: {
  prompt: string;
  answer: string;
  mode: string;
}): EducationalVisualBlock[] {
  const { prompt, answer, mode } = params;
  const blocks: EducationalVisualBlock[] = [];
  const visualRequested = /diagram|graph|chart|visual|draw|image|රූප|ප්‍රස්තාර|වගුව|waguwa/i.test(prompt);
  const explanationMode = ["tutor_explanation", "notes_generation", "paper_question_qa", "normal_chat"].includes(mode);
  if (!visualRequested && !explanationMode) return blocks;
  const sinhalaFirst = /[\u0D80-\u0DFF]/u.test(`${prompt}\n${answer}`);

  const mechanics = buildMechanicsDiagram(prompt);
  if (mechanics) blocks.push(mechanics);

  const reaction = extractReaction(answer);
  if (reaction) {
    blocks.push({
      type: "reaction_diagram",
      title: sinhalaFirst ? "ප්‍රතික්‍රියා සම්බන්ධතාව" : "Reaction relationship",
      equation: reaction.replace(/->/g, "→"),
      caption: sinhalaFirst ? "විසඳුමට භාවිත කළ තුලිත සම්බන්ධතාව." : "The balanced relationship used in the explanation.",
    });
  }

  const formula = extractFormula(answer);
  if (formula && !reaction && blocks.length < 2) {
    blocks.push({
      type: "formula_card",
      title: sinhalaFirst ? "ප්‍රධාන සූත්‍රය" : "Key formula",
      formula,
      variables: [],
    });
  }

  const steps = extractSteps(answer);
  if (steps.length >= 2 && blocks.length < 2) {
    blocks.push({
      type: "process_flow",
      title: sinhalaFirst ? "විසඳුම් පියවර" : "Solution flow",
      steps,
      caption: sinhalaFirst ? "පියවර අනුපිළිවෙළින් අනුගමනය කරන්න." : "Follow the steps in order.",
    });
  }

  return blocks.slice(0, 2);
}
