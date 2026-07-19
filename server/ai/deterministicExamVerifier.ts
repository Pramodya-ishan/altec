import { extractRequestedSubparts } from "./answerCompleteness";

export interface DeterministicExamVerification {
  passed: boolean;
  markAllocation: number | null;
  expectedUnits: string[];
  arithmeticChecks: Array<{ expression: string; valid: boolean; left: number; right: number }>;
  missingRequirements: string[];
  numericalIssues: string[];
  factualRisks: string[];
  strengths: string[];
}

const UNIT_RULES: Array<{ pattern: RegExp; units: string[] }> = [
  { pattern: /(?:force|weight|friction|reaction|tension|බලය|බර|ඝර්ෂණ|ප්‍රතික්‍රියා)/iu, units: ["N"] },
  { pattern: /(?:mass|ස්කන්ධ)/iu, units: ["kg", "g"] },
  { pattern: /(?:pressure|stress|පීඩනය|ප්‍රතීබල)/iu, units: ["Pa", "N m^-2"] },
  { pattern: /(?:energy|work|heat|ශක්තිය|කාර්යය|තාපය)/iu, units: ["J"] },
  { pattern: /(?:power|ක්ෂමතාව|බලශක්ති)/iu, units: ["W"] },
  { pattern: /(?:velocity|speed|වේගය)/iu, units: ["m s^-1"] },
  { pattern: /(?:acceleration|ත්වරණ)/iu, units: ["m s^-2"] },
  { pattern: /(?:density|ඝනත්ව)/iu, units: ["kg m^-3"] },
  { pattern: /(?:coefficient|සංගුණක)/iu, units: ["dimensionless"] },
];

function normalizeMath(value: string) {
  return value
    .replace(/\\(?:left|right|mathrm|text)\b/gu, "")
    .replace(/[{}$]/gu, "")
    .replace(/\\times|×/gu, "*")
    .replace(/\\div|÷/gu, "/")
    .replace(/\\(sin|cos|tan|sqrt)\b/giu, "$1")
    .replace(/\\[,;:!]/gu, " ")
    .replace(/√/gu, "sqrt")
    .replace(/\^?\\circ|°/gu, "")
    .replace(/[−–—]/gu, "-")
    .replace(/\^\s*([+-]?\d+)/gu, "^$1")
    .replace(/,/gu, "")
    .trim();
}

class ArithmeticParser {
  private index = 0;
  constructor(private readonly input: string) {}

  parse() {
    const result = this.expression();
    this.space();
    if (this.index !== this.input.length || !Number.isFinite(result)) throw new Error("Invalid arithmetic expression");
    return result;
  }

  private space() { while (/\s/u.test(this.input[this.index] || "")) this.index += 1; }
  private expression(): number {
    let value = this.term();
    for (;;) {
      this.space();
      const operator = this.input[this.index];
      if (operator !== "+" && operator !== "-") return value;
      this.index += 1;
      const right = this.term();
      value = operator === "+" ? value + right : value - right;
    }
  }
  private term(): number {
    let value = this.power();
    for (;;) {
      this.space();
      const operator = this.input[this.index];
      const implicitMultiply = operator === "(" || /[a-zπ]/iu.test(operator || "");
      if (operator !== "*" && operator !== "/" && !implicitMultiply) return value;
      if (!implicitMultiply) this.index += 1;
      const right = this.power();
      if (operator === "/" && Math.abs(right) < Number.EPSILON) throw new Error("Division by zero");
      value = operator === "/" ? value / right : value * right;
    }
  }
  private power(): number {
    let value = this.unary();
    this.space();
    if (this.input[this.index] === "^") {
      this.index += 1;
      value **= this.power();
    }
    return value;
  }
  private unary(): number {
    this.space();
    const operator = this.input[this.index];
    if (operator === "+" || operator === "-") {
      this.index += 1;
      const value = this.unary();
      return operator === "-" ? -value : value;
    }
    return this.primary();
  }
  private primary(): number {
    this.space();
    if (this.input[this.index] === "(") {
      this.index += 1;
      const value = this.expression();
      this.space();
      if (this.input[this.index] !== ")") throw new Error("Unclosed parenthesis");
      this.index += 1;
      return value;
    }
    const identifier = this.input.slice(this.index).match(/^(?:sin|cos|tan|sqrt|pi|π)/iu)?.[0]?.toLowerCase();
    if (identifier) {
      this.index += identifier.length;
      if (identifier === "pi" || identifier === "π") return Math.PI;
      this.space();
      let argument: number;
      if (this.input[this.index] === "(") {
        this.index += 1;
        argument = this.expression();
        this.space();
        if (this.input[this.index] !== ")") throw new Error("Unclosed function parenthesis");
        this.index += 1;
      } else {
        argument = this.unary();
      }
      if (identifier === "sqrt") {
        if (argument < 0) throw new Error("Square root of a negative value");
        return Math.sqrt(argument);
      }
      const radians = argument * Math.PI / 180;
      return identifier === "sin" ? Math.sin(radians) : identifier === "cos" ? Math.cos(radians) : Math.tan(radians);
    }
    const match = this.input.slice(this.index).match(/^(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?/iu);
    if (!match) throw new Error("Number expected");
    this.index += match[0].length;
    return Number(match[0]);
  }
}

export function evaluateArithmeticExpression(value: unknown): number {
  const expression = normalizeMath(String(value || ""));
  if (!expression || expression.length > 240 || /[^0-9eE+\-*/^().\sa-zπ]/iu.test(expression)) {
    throw new Error("Only bounded numeric/scientific arithmetic is supported.");
  }
  return new ArithmeticParser(expression).parse();
}

export function extractMarkAllocation(value: unknown): number | null {
  const text = String(value || "");
  const matches = [
    ...text.matchAll(/(?:marks?|ලකුණු)\s*[:=()\[\]-]*\s*(\d{1,3})/giu),
    ...text.matchAll(/\((\d{1,3})\s*(?:marks?|ලකුණු)\)/giu),
  ].map((match) => Number(match[1])).filter((number) => number > 0 && number <= 100);
  return matches.length > 0 ? Math.max(...matches) : null;
}

export function inferExpectedUnits(value: unknown): string[] {
  const text = String(value || "");
  return Array.from(new Set(UNIT_RULES.filter((rule) => rule.pattern.test(text)).flatMap((rule) => rule.units)));
}

export function verifyArithmeticStatements(answer: unknown) {
  const result: DeterministicExamVerification["arithmeticChecks"] = [];
  for (const line of String(answer || "").split(/\r?\n/u)) {
    const clean = normalizeMath(line).replace(/\s+(?:N|kg|Pa|J|W|V|A|m|s|mol|%|°C)\b.*$/iu, "").trim();
    const match = clean.match(/(?:^|:)\s*([+\-]?(?:\d|\().{0,100}?)\s*=\s*([+\-]?(?:\d|\().{0,100}?)(?:\s|$)/u);
    if (!match) continue;
    try {
      const left = evaluateArithmeticExpression(match[1]);
      const right = evaluateArithmeticExpression(match[2]);
      const tolerance = Math.max(1e-8, Math.abs(right) * 0.005);
      result.push({ expression: `${match[1]} = ${match[2]}`, valid: Math.abs(left - right) <= tolerance, left, right });
    } catch {
      // Formulae containing variables are intentionally ignored.
    }
    if (result.length >= 20) break;
  }
  return result;
}

function hasUnit(answer: string, unit: string) {
  if (unit === "dimensionless") return /(?:dimensionless|no\s*unit|ඒකක\s*රහිත|ඒකකයක්\s*නැත)/iu.test(answer) || /\b(?:μ|mu|coefficient|සංගුණක)\b.{0,50}\b\d+(?:\.\d+)?\b/iu.test(answer);
  const compact = answer.replace(/\\mathrm/gu, "").replace(/[{}$]/gu, " ").replace(/\s+/gu, " ");
  if (unit === "N m^-2") return /N\s*m\s*(?:\^?-?2|⁻²)|Pa/u.test(compact);
  if (unit === "m s^-1") return /m\s*(?:\/|\s)s\s*(?:\^?-?1|⁻¹)?/u.test(compact);
  if (unit === "m s^-2") return /m\s*(?:\/|\s)s\s*(?:\^?-?2|⁻²|²)/u.test(compact);
  if (unit === "kg m^-3") return /kg\s*m\s*(?:\^?-?3|⁻³)/u.test(compact);
  return new RegExp(`\\b${unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "u").test(compact);
}

export function verifyExamAnswer(params: {
  prompt: unknown;
  answer: unknown;
  evidenceRequired?: boolean;
  sources?: any[];
}): DeterministicExamVerification {
  const prompt = String(params.prompt || "");
  const answer = String(params.answer || "").trim();
  const markAllocation = extractMarkAllocation(prompt);
  const expectedUnits = inferExpectedUnits(prompt);
  const arithmeticChecks = verifyArithmeticStatements(answer);
  const missingRequirements: string[] = [];
  const numericalIssues: string[] = [];
  const factualRisks: string[] = [];
  const strengths: string[] = [];

  const requestedSubparts = extractRequestedSubparts(prompt);
  const missingSubparts = requestedSubparts.filter((part) => {
    const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return !new RegExp(`(?:^|\\n)\\s*(?:#{1,6}\\s*)?(?:\\*\\*)?(?:\\(${escaped}\\)|${escaped}[.):])`, "iu").test(answer);
  });
  if (missingSubparts.length > 0) missingRequirements.push(`Missing labelled parts: ${missingSubparts.join(", ")}`);

  if (markAllocation && markAllocation >= 4) {
    const meaningfulWords = answer.match(/[\p{L}\p{N}]+/gu)?.length || 0;
    const structuredPoints = answer.split(/\r?\n/u).filter((line) => /^\s*(?:[-*+]\s+|\d+[.)]\s+|\([ivxlcdm]+\)|\([a-z]\))/iu.test(line)).length;
    if (meaningfulWords < markAllocation * 6 && structuredPoints < Math.ceil(markAllocation / 2)) {
      missingRequirements.push(`Answer depth is too low for the visible ${markAllocation}-mark allocation.`);
    }
  }

  const calculationPrompt = /(?:calculate|compute|find|ගණනය|සොයන්න|කොපමණද)/iu.test(prompt);
  if (calculationPrompt && expectedUnits.length > 0 && !expectedUnits.some((unit) => hasUnit(answer, unit))) {
    numericalIssues.push(`Expected final unit not detected (${expectedUnits.join(" or ")}).`);
  }
  for (const check of arithmeticChecks.filter((item) => !item.valid)) {
    numericalIssues.push(`Arithmetic equality is inconsistent: ${check.expression}.`);
  }

  const sources = Array.isArray(params.sources) ? params.sources : [];
  const verifiedSources = sources.filter((source) => source?.verified !== false && (source?.sourceId || source?.id || source?.url));
  if (params.evidenceRequired && verifiedSources.length === 0) factualRisks.push("Evidence-required answer has no verified source identity.");
  if (/(?:official answer|official marking|නිල පිළිතුර|නිල ලකුණු)/iu.test(answer)
    && !verifiedSources.some((source) => /marking|scheme|official/iu.test(`${source?.resourceType || ""} ${source?.sourceScope || ""} ${source?.badge || ""} ${source?.title || ""}`))) {
    factualRisks.push("The answer uses an Official label without verified official/marking-scheme evidence.");
  }
  if (arithmeticChecks.length > 0 && arithmeticChecks.every((item) => item.valid)) strengths.push("Detected arithmetic equalities are numerically consistent.");
  if (markAllocation && missingRequirements.length === 0) strengths.push(`Answer depth is consistent with the visible ${markAllocation}-mark allocation.`);

  return {
    passed: missingRequirements.length + numericalIssues.length + factualRisks.length === 0,
    markAllocation,
    expectedUnits,
    arithmeticChecks,
    missingRequirements,
    numericalIssues,
    factualRisks,
    strengths,
  };
}
