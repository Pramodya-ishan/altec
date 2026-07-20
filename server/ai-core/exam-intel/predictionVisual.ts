function xml(value: unknown) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[character] || character));
}

function dataUrl(svg: string) {
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

function safeUnicodeLabel(value: unknown) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 34);
}

const font = `"Noto Sans Sinhala","Nirmala UI","Iskoola Pota","Segoe UI",Arial,sans-serif`;
const marker = `<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#111827"/></marker><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#64748b" stroke-width="1"/></pattern></defs>`;

function label(text: string, x: number, y: number, anchor = "middle", size = 20) {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family='${font}' font-size="${size}" fill="#111827">${xml(text)}</text>`;
}

export function buildPredictionFallbackVisual(question: any) {
  const spec = question?.visualSpec || {};
  const kind = String(spec.kind || spec.visualKind || "educational_diagram").toLowerCase();
  const labels: string[] = (Array.isArray(spec.labels) ? spec.labels : [])
    .map(safeUnicodeLabel)
    .filter(Boolean)
    .slice(0, 8);
  const safeLabels = labels.length ? labels : ["A", "B", "C"];
  let drawing = "";

  if (/force|body|mechanic|incline/.test(kind)) {
    drawing = `
      <path d="M105 405L690 405L690 190Z" fill="url(#hatch)" stroke="#111827" stroke-width="3"/>
      <g transform="translate(425 300) rotate(-20)"><rect x="-64" y="-45" width="128" height="90" fill="#fff" stroke="#111827" stroke-width="3"/></g>
      <line x1="425" y1="282" x2="425" y2="112" stroke="#111827" stroke-width="3" marker-end="url(#arrow)"/>${label(safeLabels[0] || "R", 442, 130, "start")}
      <line x1="425" y1="300" x2="425" y2="462" stroke="#111827" stroke-width="3" marker-end="url(#arrow)"/>${label(safeLabels[1] || "W", 443, 447, "start")}
      <line x1="468" y1="275" x2="626" y2="220" stroke="#111827" stroke-width="3" marker-end="url(#arrow)"/>${label(safeLabels[2] || "F", 615, 202)}
      <path d="M486 291A42 42 0 0 0 478 269" fill="none" stroke="#111827" stroke-width="2"/>${label("θ", 505, 269, "start", 18)}`;
  } else if (/graph/.test(kind)) {
    const xLabel = safeLabels[0] || "x";
    const yLabel = safeLabels[1] || "y";
    drawing = `
      <g stroke="#cbd5e1" stroke-width="1">${Array.from({ length: 12 }, (_, i) => `<line x1="${120 + i * 50}" y1="82" x2="${120 + i * 50}" y2="420"/>`).join("")}${Array.from({ length: 7 }, (_, i) => `<line x1="120" y1="${120 + i * 50}" x2="720" y2="${120 + i * 50}"/>`).join("")}</g>
      <line x1="120" y1="420" x2="745" y2="420" stroke="#111827" stroke-width="3" marker-end="url(#arrow)"/>
      <line x1="120" y1="420" x2="120" y2="70" stroke="#111827" stroke-width="3" marker-end="url(#arrow)"/>
      <path d="M130 398 C230 380 268 295 360 270 S535 162 710 122" fill="none" stroke="#111827" stroke-width="4"/>
      <circle cx="360" cy="270" r="6" fill="#111827"/>${label(xLabel, 746, 453, "end", 18)}${label(yLabel, 88, 82, "start", 18)}`;
  } else if (/circuit|logic/.test(kind)) {
    drawing = `
      <path d="M100 250H235M570 250H710M710 250V410H100V250" fill="none" stroke="#111827" stroke-width="4"/>
      <rect x="235" y="180" width="155" height="140" fill="#fff" stroke="#111827" stroke-width="3"/>
      <path d="M390 180Q535 180 570 250Q535 320 390 320Z" fill="#fff" stroke="#111827" stroke-width="3"/>
      <circle cx="100" cy="250" r="7" fill="#111827"/><circle cx="710" cy="250" r="7" fill="#111827"/>
      ${label(safeLabels[0] || "A", 168, 235)}${label(safeLabels[1] || "B", 315, 258)}${label(safeLabels[2] || "Y", 638, 235)}`;
  } else if (/flow|network|erd|data/.test(kind)) {
    const positions = [[145,150],[400,150],[655,150],[270,350],[530,350]];
    drawing = positions.map(([x,y], index) => `<rect x="${x-88}" y="${y-42}" width="176" height="84" rx="3" fill="#fff" stroke="#111827" stroke-width="2.5"/>${label(safeLabels[index % safeLabels.length], x, y+7, "middle", 18)}`).join("")
      + `<path d="M233 150H312M488 150H567M203 192L245 306M597 192L555 306M358 350H442" stroke="#111827" stroke-width="2.5" marker-end="url(#arrow)" fill="none"/>`;
  } else if (/engineering|drawing|construction|mechanism/.test(kind)) {
    drawing = `
      <path d="M170 350V160H360V225H625V350Z" fill="#fff" stroke="#111827" stroke-width="4"/>
      <circle cx="290" cy="255" r="58" fill="#fff" stroke="#111827" stroke-width="3"/>
      <line x1="170" y1="400" x2="625" y2="400" stroke="#111827" stroke-width="2"/>
      <path d="M170 382V418M625 382V418" stroke="#111827" stroke-width="2"/>
      ${label(safeLabels[0] || "L", 398, 438, "middle", 18)}
      <line x1="125" y1="160" x2="125" y2="350" stroke="#111827" stroke-width="2"/><path d="M108 160H142M108 350H142" stroke="#111827" stroke-width="2"/>${label(safeLabels[1] || "H", 93, 260, "middle", 18)}`;
  } else if (/table|measurement|vernier|micrometer/.test(kind)) {
    drawing = `
      <line x1="105" y1="210" x2="710" y2="210" stroke="#111827" stroke-width="4"/>
      ${Array.from({ length: 31 }, (_, i) => `<line x1="${120+i*18}" y1="${i%5===0?176:188}" x2="${120+i*18}" y2="224" stroke="#111827" stroke-width="${i%5===0?2:1}"/>`).join("")}
      <line x1="195" y1="280" x2="550" y2="280" stroke="#111827" stroke-width="3"/>
      ${Array.from({ length: 21 }, (_, i) => `<line x1="${205+i*16}" y1="280" x2="${205+i*16}" y2="${i%5===0?330:315}" stroke="#111827" stroke-width="${i%5===0?2:1}"/>`).join("")}
      ${label(safeLabels[0] || "ප්‍රධාන පරිමාණය", 410, 145, "middle", 20)}${label(safeLabels[1] || "වර්නියර් පරිමාණය", 380, 365, "middle", 20)}`;
  } else {
    drawing = `<circle cx="400" cy="245" r="90" fill="#fff" stroke="#111827" stroke-width="3"/>${safeLabels.slice(0,4).map((item,index) => { const angle = index * Math.PI/2; const x=400+Math.cos(angle)*220; const y=245+Math.sin(angle)*155; return `<line x1="${400+Math.cos(angle)*90}" y1="${245+Math.sin(angle)*90}" x2="${x}" y2="${y}" stroke="#111827" stroke-width="2.5" marker-end="url(#arrow)"/>${label(item, x, y-12, "middle", 18)}`; }).join("")}`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="500" viewBox="0 0 840 500" role="img" aria-label="${xml(spec.altText || `Question ${question?.questionNo || 1} diagram`)}"><rect width="840" height="500" fill="#fff"/>${marker}${drawing}</svg>`;
  return {
    url: dataUrl(svg),
    mimeType: "image/svg+xml",
    altText: String(spec.altText || `Question ${question?.questionNo || 1} diagram`),
    caption: String(spec.caption || "ප්‍රශ්නය සඳහා නිර්මාණය කළ විභාග ආකෘති රූපසටහන"),
    generatedBy: "deterministic_svg_fallback",
    storagePath: null,
  };
}

export function ensureVisualQuestionIntegrity(questions: any[], maximumImages: number) {
  let used = 0;
  return (questions || []).map((question) => {
    const spec = question?.visualSpec;
    const requested = question?.requiresImage === true || (question?.visualOpportunity === true && Boolean(spec?.kind));
    if (!requested || used >= maximumImages) return { ...question, requiresImage: false };
    used += 1;
    return {
      ...question,
      requiresImage: true,
      visualSpec: {
        kind: String(spec?.kind || "educational_diagram"),
        prompt: String(spec?.prompt || `Create an accurate exam diagram for question ${question.questionNo}.`).slice(0, 1800),
        altText: String(spec?.altText || `Diagram for question ${question.questionNo}`).slice(0, 300),
        caption: String(spec?.caption || "මෙම රූපය භාවිතයෙන් ප්‍රශ්නයට පිළිතුරු සපයන්න.").slice(0, 500),
        labels: Array.isArray(spec?.labels) ? spec.labels.map(safeUnicodeLabel).filter(Boolean).slice(0, 12) : [],
        mustShow: Array.isArray(spec?.mustShow) ? spec.mustShow.map(safeUnicodeLabel).filter(Boolean).slice(0, 12) : [],
      },
    };
  });
}
