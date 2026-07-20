export type ForecastSubject = "SFT" | "ET" | "ICT";

function normalize(value: unknown) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[_–—]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const EXPLICIT_SUBJECTS: Array<[ForecastSubject, RegExp]> = [
  ["ICT", /(?:^|\s)(?:ict|information\s*(?:and|&)\s*communication\s*technology)(?:\s|$)|තොරතුරු\s*(?:හා|සහ)\s*සන්නිවේදන\s*තාක්ෂණ/iu],
  ["SFT", /(?:^|\s)(?:sft|science\s*for\s*technology)(?:\s|$)|තාක්ෂණවේදය\s*සඳහා\s*විද්‍යාව/iu],
  ["ET", /(?:^|\s)(?:et|engineering\s*technology)(?:\s|$)|ඉංජිනේරු\s*තාක්ෂණවේදය/iu],
];

const ET_LESSONS: Array<[string, RegExp]> = [
  ["විදුලි යන්ත්‍ර / Electrical Machines", /electric(?:al)?\s*machines?|motor|generator|transformer|විදුලි\s*යන්ත්‍ර|ට්‍රාන්ස්ෆෝමර|මෝටර/iu],
  ["ඉලෙක්ට්‍රොනික තාක්ෂණවේදය / Electronic Technology", /\belectronic(?:s)?\b|electronic\s*technology|ඉලෙක්ට්‍රොනික/iu],
  ["විදුලි තාක්ෂණවේදය / Electrical Technology", /\belectrical\b|electrical\s*technology|power\s*wiring|house\s*wiring|විදුලි\s*තාක්ෂණ|විදුලි\s*පරිපථ|විදුලි\s*ස්ථාපන/iu],
  ["සිවිල් තාක්ෂණවේදය / Civil Technology", /\bcivil\b|construction|building\s*construction|සිවිල්|ගොඩනැගිලි\s*ඉදිකිරීම්/iu],
  ["නිෂ්පාදන තාක්ෂණවේදය / Production Technology", /\bproduction\b|manufactur(?:e|ing)|machining|lathe|welding|නිෂ්පාදන|යන්ත්‍රෝපකරණ|වෑල්ඩින්/iu],
  ["මෝටර් රථ තාක්ෂණවේදය / Automobile Technology", /automobile|automotive|vehicle|engine|මෝටර්\s*රථ|ඔටෝමොබයිල්/iu],
  ["ඉංජිනේරු ඇඳීම / Engineering Drawing", /engineering\s*drawing|technical\s*drawing|orthographic|isometric|drawing|ඉංජිනේරු\s*ඇඳීම|තාක්ෂණික\s*ඇඳීම/iu],
  ["බිම් මැනුම් / Surveying", /surveying|leveling|levelling|theodolite|බිම්\s*මැනුම්|මට්ටම්\s*මැනීම/iu],
  ["තරල යන්ත්‍ර / Fluid Machinery", /fluid\s*machin|pump|turbine|compressor|තරල\s*යන්ත්‍ර|පොම්ප/iu],
  ["ප්‍රමිති හා පිරිවිතර / Standards and Specifications", /standards?|specifications?|ප්‍රමිති|පිරිවිතර/iu],
];

const ICT_LESSONS: Array<[string, RegExp]> = [
  ["Python", /\bpython\b|පයිතන්/iu],
  ["Database", /database|sql|entity\s*relationship|\berd\b|දත්ත\s*සමුදා/iu],
  ["Networking", /network(?:ing)?|tcp\/?ip|subnet|router|ජාල|රවුටර/iu],
  ["Logic Gates", /logic\s*gates?|boolean|karnaugh|k\s*map|තාර්කික\s*ද්වාර/iu],
  ["Web Technology", /html|css|javascript|web\s*(?:technology|development)|වෙබ්/iu],
  ["Operating Systems", /operating\s*system|\bos\b|process\s*scheduling|මෙහෙයුම්\s*පද්ධති/iu],
  ["Information Systems", /information\s*system|sdlc|data\s*flow|\bdfd\b|තොරතුරු\s*පද්ධති/iu],
];

const SFT_LESSONS: Array<[string, RegExp]> = [
  ["විද්‍යුතය / Electricity", /\belectricity\b|current|voltage|resistance|විද්‍යුතය|විද්‍යුත්\s*ධාරාව/iu],
  ["බලය / Force", /\bforce\b|friction|normal\s*reaction|බලය|ඝර්ෂණ/iu],
  ["චලිතය / Motion", /motion|velocity|acceleration|චලිතය|වේගය|ත්වරණය/iu],
  ["තරල / Fluids", /\bfluids?\b|pressure|buoyancy|තරල|ද්‍රව\s*පීඩනය/iu],
  ["තාපය / Heat", /\bheat\b|temperature|calorimetry|තාපය|උෂ්ණත්ව/iu],
  ["සංඛ්‍යානය / Statistics", /statistics|mean|median|frequency\s*distribution|සංඛ්‍යානය|මධ්‍යන්‍ය/iu],
  ["මිනුම් උපකරණ / Measuring Instruments", /measuring\s*instrument|vernier|micrometer|මිනුම්\s*උපකරණ|වර්නියර්|මයික්‍රොමීටර/iu],
  ["රසායනික කර්මාන්ත / Chemical Industry", /chemical\s*industry|රසායනික\s*කර්මාන්ත/iu],
];

function matchLesson(text: string, lessons: Array<[string, RegExp]>) {
  return lessons.find(([, pattern]) => pattern.test(text))?.[0] || null;
}

export function inferForecastSubject(value: unknown, fallback?: unknown): ForecastSubject {
  const text = normalize(value);
  for (const [subject, pattern] of EXPLICIT_SUBJECTS) if (pattern.test(text)) return subject;

  // Lesson-specific words are more reliable than the currently selected UI tab.
  if (matchLesson(text, ET_LESSONS)) return "ET";
  if (matchLesson(text, ICT_LESSONS)) return "ICT";
  if (matchLesson(text, SFT_LESSONS)) return "SFT";

  const normalizedFallback = String(fallback || "").trim().toUpperCase();
  if (normalizedFallback === "ET" || normalizedFallback === "ICT" || normalizedFallback === "SFT") return normalizedFallback;
  return "SFT";
}

export function inferForecastLesson(value: unknown, subjectValue?: unknown): string | null {
  const text = normalize(value);
  const subject = inferForecastSubject(text, subjectValue);
  if (subject === "ET") return matchLesson(text, ET_LESSONS);
  if (subject === "ICT") return matchLesson(text, ICT_LESSONS);
  return matchLesson(text, SFT_LESSONS);
}
