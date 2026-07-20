function xml(value: unknown) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[character] || character));
}

function dataUrl(svg: string) {
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

export function buildPredictionFallbackVisual(question: any) {
  const spec = question?.visualSpec || {};
  const kind = String(spec.kind || spec.visualKind || "educational_diagram").toLowerCase();
  const labels: string[] = (Array.isArray(spec.labels) ? spec.labels : []).map((item: any) => String(item || "").replace(/[^A-Za-z0-9°θμΩ+\-=/(). ]/g, "").slice(0, 24)).filter(Boolean).slice(0, 8);
  const safeLabels: string[] = labels.length ? labels : ["A", "B", "C"];
  const title = `Q${Number(question?.questionNo || 1)} ${String(spec.kind || "Exam diagram").replace(/_/g, " ")}`;
  const common = `<defs><marker id="a" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#2563eb"/></marker></defs><rect width="800" height="480" rx="24" fill="#f8fafc"/><text x="40" y="50" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="#0f172a">${xml(title)}</text>`;
  let drawing = "";

  if (/force|body|mechanic|incline/.test(kind)) {
    drawing = `<path d="M100 390L680 390L680 170Z" fill="#e2e8f0" stroke="#475569" stroke-width="4"/><g transform="translate(410 285) rotate(-20)"><rect x="-60" y="-45" width="120" height="90" rx="6" fill="#fff" stroke="#0f172a" stroke-width="4"/></g><line x1="410" y1="270" x2="410" y2="100" stroke="#2563eb" stroke-width="5" marker-end="url(#a)"/><text x="424" y="125" font-family="Arial" font-size="20" fill="#2563eb">R</text><line x1="410" y1="285" x2="410" y2="445" stroke="#dc2626" stroke-width="5" marker-end="url(#a)"/><text x="425" y="430" font-family="Arial" font-size="20" fill="#dc2626">W</text><line x1="450" y1="260" x2="610" y2="205" stroke="#059669" stroke-width="5" marker-end="url(#a)"/><text x="565" y="185" font-family="Arial" font-size="20" fill="#059669">F</text>`;
  } else if (/graph/.test(kind)) {
    drawing = `<line x1="110" y1="410" x2="730" y2="410" stroke="#0f172a" stroke-width="4" marker-end="url(#a)"/><line x1="110" y1="410" x2="110" y2="90" stroke="#0f172a" stroke-width="4" marker-end="url(#a)"/><path d="M120 390 C230 370 260 270 360 245 S520 150 700 120" fill="none" stroke="#7c3aed" stroke-width="6"/><circle cx="360" cy="245" r="8" fill="#7c3aed"/><text x="720" y="440" font-family="Arial" font-size="20">x</text><text x="75" y="95" font-family="Arial" font-size="20">y</text>`;
  } else if (/circuit|logic/.test(kind)) {
    drawing = `<path d="M120 240H230M570 240H690M690 240V390H120V240" fill="none" stroke="#0f172a" stroke-width="5"/><rect x="230" y="170" width="160" height="140" rx="16" fill="#dbeafe" stroke="#2563eb" stroke-width="4"/><path d="M390 170Q530 170 570 240Q530 310 390 310Z" fill="#ede9fe" stroke="#7c3aed" stroke-width="4"/><circle cx="120" cy="240" r="9" fill="#0f172a"/><circle cx="690" cy="240" r="9" fill="#0f172a"/>`;
  } else if (/flow|network|erd|data/.test(kind)) {
    const positions = [[140,150],[400,150],[660,150],[270,340],[530,340]];
    drawing = positions.map(([x,y], index) => `<rect x="${x-85}" y="${y-42}" width="170" height="84" rx="18" fill="${index % 2 ? "#ede9fe" : "#dbeafe"}" stroke="#475569" stroke-width="3"/><text x="${x}" y="${y+7}" text-anchor="middle" font-family="Arial" font-size="18" font-weight="700">${xml(safeLabels[index % safeLabels.length])}</text>`).join("") + `<path d="M225 150H315M485 150H575M200 192L245 298M600 192L555 298M355 340H445" stroke="#2563eb" stroke-width="4" marker-end="url(#a)" fill="none"/>`;
  } else if (/engineering|drawing|construction|mechanism/.test(kind)) {
    drawing = `<path d="M180 340V160H360V220H610V340Z" fill="#e2e8f0" stroke="#0f172a" stroke-width="5"/><circle cx="290" cy="250" r="55" fill="#fff" stroke="#2563eb" stroke-width="5"/><line x1="180" y1="390" x2="610" y2="390" stroke="#7c3aed" stroke-width="3"/><path d="M180 375V405M610 375V405" stroke="#7c3aed" stroke-width="3"/><text x="395" y="425" text-anchor="middle" font-family="Arial" font-size="20">L</text>`;
  } else {
    drawing = `<circle cx="400" cy="235" r="90" fill="#dbeafe" stroke="#2563eb" stroke-width="5"/>${safeLabels.slice(0,4).map((label,index) => { const angle = index * Math.PI/2; const x=400+Math.cos(angle)*210; const y=235+Math.sin(angle)*150; return `<line x1="${400+Math.cos(angle)*90}" y1="${235+Math.sin(angle)*90}" x2="${x}" y2="${y}" stroke="#2563eb" stroke-width="4" marker-end="url(#a)"/><text x="${x}" y="${y-12}" text-anchor="middle" font-family="Arial" font-size="19" font-weight="700">${xml(label)}</text>`; }).join("")}`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="480" viewBox="0 0 800 480" role="img" aria-label="${xml(spec.altText || title)}">${common}${drawing}</svg>`;
  return {
    url: dataUrl(svg),
    mimeType: "image/svg+xml",
    altText: String(spec.altText || title),
    caption: String(spec.caption || "Generated examination-support diagram"),
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
        caption: String(spec?.caption || "Use this image as part of the question.").slice(0, 500),
        labels: Array.isArray(spec?.labels) ? spec.labels.slice(0, 12) : [],
        mustShow: Array.isArray(spec?.mustShow) ? spec.mustShow.slice(0, 12) : [],
      },
    };
  });
}
