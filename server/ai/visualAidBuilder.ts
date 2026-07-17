export type EducationalVisualBlock =
  | { type: "formula_card"; title: string; formula: string; variables: { symbol: string; meaning: string }[] }
  | { type: "reaction_diagram"; title: string; equation: string; caption?: string }
  | { type: "process_flow"; title: string; steps: string[]; caption?: string };

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
  if (display) return display.trim();

  const lines = answer.split(/\r?\n/).map(cleanInline).filter(Boolean);
  return lines.find((line) =>
    line.length <= 140
    && /[=≤≥]/u.test(line)
    && /[A-Za-zα-ωΑ-ΩσθπΔ]/u.test(line)
  ) || null;
}

function extractSteps(answer: string) {
  const candidates = answer.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(?:#{1,4}\s*)?(?:පියවර|Step)\s*\d+|^\d+[.)]\s+/i.test(line))
    .map((line) => cleanInline(line.replace(/^(?:පියවර|Step)\s*\d+\s*[:.-]?\s*/i, "")))
    .filter((line) => line.length >= 3 && line.length <= 120)
    .slice(0, 6);
  return candidates.length >= 2 ? candidates : [];
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

  const reaction = extractReaction(answer);
  if (reaction) {
    blocks.push({
      type: "reaction_diagram",
      title: "Reaction relationship",
      equation: reaction.replace(/->/g, "→"),
      caption: "The balanced relationship used in the explanation.",
    });
  }

  const formula = extractFormula(answer);
  if (formula && !reaction) {
    blocks.push({
      type: "formula_card",
      title: "Key formula",
      formula,
      variables: [],
    });
  }

  const steps = extractSteps(answer);
  if (steps.length >= 2 && blocks.length < 2) {
    blocks.push({
      type: "process_flow",
      title: "Solution flow",
      steps,
      caption: "Follow the steps from left to right.",
    });
  }

  return blocks.slice(0, 2);
}
