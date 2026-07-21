import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileCode,
  FlaskConical,
  ExternalLink,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
  Table as TableIcon,
  Crop as CropIcon,
  Maximize2,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import { CoordinatePlane } from "./CoordinatePlane";
import { MessageRenderer } from "./MessageRenderer";
import type { VisualBlock } from "../../lib/visualBlocks";
import { auth } from "../../lib/firebase";
import { apiUrl } from "../../lib/apiBase";
import { useAuthenticatedImage } from "../../hooks/useAuthenticatedImage";

interface VisualBlockRendererProps {
  block: VisualBlock;
}

type PdfPreviewBlock = Extract<VisualBlock, { type: "pdf_image_preview" }>;
type MistakePreviewBlock = Extract<VisualBlock, { type: "mistake_image_preview" }>;
type PredictionQuestionBlock = Extract<VisualBlock, { type: "prediction_question_card" }>;

function MistakeImagePreview({ block }: { block: MistakePreviewBlock }) {
  const endpoint = `/api/student/mistakes/${encodeURIComponent(block.mistakeId)}/image?owner=${encodeURIComponent(block.ownerPath || "uid")}`;
  const { url: imageUrl, failed } = useAuthenticatedImage(endpoint);

  if (failed) return <p className="my-3 text-xs text-slate-500">Saved error image could not be opened.</p>;
  if (!imageUrl) return <div className="my-4 h-40 max-w-2xl animate-pulse rounded-xl bg-slate-100" aria-label="Loading saved error image" />;
  return (
    <figure className="my-4 max-w-2xl">
      <img src={imageUrl} alt={block.title || "Saved error image"} className="block max-h-[620px] w-auto max-w-full rounded-xl object-contain" />
      <figcaption className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><ImageIcon className="h-3.5 w-3.5" />{block.caption || block.title}</figcaption>
    </figure>
  );
}

function PdfImagePreview({ block }: { block: PdfPreviewBlock }) {
  const [imageUrl, setImageUrl] = useState(block.imageUrl || "");
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(!block.imageUrl);
  const [zoom, setZoom] = useState(1);
  const [viewMode, setViewMode] = useState<'crop' | 'page'>(block.crop ? 'crop' : 'page');
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const refreshAttempted = useRef(false);

  const refreshSignedUrl = async () => {
    if (refreshAttempted.current || !block.sourceId || !block.pageNumber) {
      setLoading(false);
      setFailed(true);
      return;
    }
    refreshAttempted.current = true;
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("LOGIN_REQUIRED");
      const response = await apiFetch(apiUrl("/api/pdf/question-preview"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sourceId: block.sourceId,
          storagePath: block.storagePath,
          pageNumber: block.pageNumber,
          crop: block.crop || null,
          title: block.sourceTitle || block.title,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.imageUrl) throw new Error(payload?.code || "PREVIEW_REFRESH_FAILED");
      setImageUrl(payload.imageUrl);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!imageUrl) void refreshSignedUrl();
    // A preview is fetched only once for a given immutable message block.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalizedCrop = (() => {
    if (!block.crop || !naturalSize.width || !naturalSize.height) return null;
    const raw = block.crop;
    const x = raw.x <= 1 ? raw.x : raw.x / naturalSize.width;
    const y = raw.y <= 1 ? raw.y : raw.y / naturalSize.height;
    const width = raw.width <= 1 ? raw.width : raw.width / naturalSize.width;
    const height = raw.height <= 1 ? raw.height : raw.height / naturalSize.height;
    if (![x, y, width, height].every(Number.isFinite) || width <= 0.02 || height <= 0.02) return null;
    return {
      x: Math.max(0, Math.min(0.98, x)),
      y: Math.max(0, Math.min(0.98, y)),
      width: Math.max(0.02, Math.min(1 - x, width)),
      height: Math.max(0.02, Math.min(1 - y, height)),
    };
  })();

  if (failed) {
    return (
      <div className="my-4 max-w-4xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        Original PDF layout preview is temporarily unavailable. The verified question text and answer remain visible below.
      </div>
    );
  }

  return (
    <figure className="pdf-question-card my-5 w-full max-w-4xl overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_14px_44px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/90 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-indigo-600">
            <ImageIcon className="h-3.5 w-3.5" /> Original PDF question
          </div>
          <p className="mt-1 truncate text-sm font-bold text-slate-900">{block.questionLabel || block.title || "Question"}</p>
          {(block.sourceTitle || block.pageNumber) && (
            <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
              {block.sourceTitle || "Selected source"}{block.pageNumber ? ` · Page ${block.pageNumber}` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {block.crop ? (
            <>
              <button type="button" onClick={() => { setViewMode('crop'); setZoom(1); }} className={`hidden h-8 items-center gap-1.5 rounded-lg border px-2 text-[10px] font-bold sm:inline-flex ${viewMode === 'crop' ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100'}`} aria-label="Show question crop"><CropIcon className="h-3.5 w-3.5" /> Question</button>
              <button type="button" onClick={() => { setViewMode('page'); setZoom(1); }} className={`hidden h-8 items-center gap-1.5 rounded-lg border px-2 text-[10px] font-bold sm:inline-flex ${viewMode === 'page' ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100'}`} aria-label="Show full PDF page"><Maximize2 className="h-3.5 w-3.5" /> Page</button>
            </>
          ) : null}
          <button type="button" onClick={() => setZoom((value) => Math.max(0.8, Number((value - 0.2).toFixed(1))))} disabled={zoom <= 0.8} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 disabled:opacity-40" aria-label="Zoom out PDF question"><Minus className="h-3.5 w-3.5" /></button>
          <span className="min-w-12 text-center text-[10px] font-black tabular-nums text-slate-500">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((value) => Math.min(2, Number((value + 0.2).toFixed(1))))} disabled={zoom >= 2} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 disabled:opacity-40" aria-label="Zoom in PDF question"><Plus className="h-3.5 w-3.5" /></button>
          {imageUrl && <a href={imageUrl} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100" aria-label="Open original PDF question image"><ExternalLink className="h-3.5 w-3.5" /></a>}
        </div>
      </div>

      <div className="relative max-h-[760px] overflow-auto bg-[#eef1f5] p-3 sm:p-5">
        {loading && (
          <div className="flex min-h-64 items-center justify-center gap-2 rounded-xl bg-white text-xs font-semibold text-slate-500 shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading the exact printed question…
          </div>
        )}
        {imageUrl && viewMode === 'crop' && normalizedCrop ? (
          <div className="mx-auto w-full max-w-3xl overflow-auto text-center">
            <div
              className="relative mx-auto overflow-hidden rounded-sm bg-white shadow-[0_4px_18px_rgba(15,23,42,0.16)]"
              style={{ width: `${zoom * 100}%`, aspectRatio: `${normalizedCrop.width * naturalSize.width} / ${normalizedCrop.height * naturalSize.height}` }}
            >
              <img
                src={imageUrl}
                alt={block.title || "Original PDF question"}
                className="absolute max-w-none bg-white"
                style={{
                  width: `${100 / normalizedCrop.width}%`,
                  height: 'auto',
                  left: `${-(normalizedCrop.x / normalizedCrop.width) * 100}%`,
                  top: `${-(normalizedCrop.y / normalizedCrop.height) * 100}%`,
                }}
                loading="lazy"
                referrerPolicy="no-referrer"
                onLoad={(event) => { setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }); setLoading(false); }}
                onError={() => void refreshSignedUrl()}
              />
            </div>
          </div>
        ) : imageUrl ? (
          <div className="mx-auto w-fit min-w-full text-center">
            <img
              src={imageUrl}
              alt={block.title || "Original PDF question"}
              className="mx-auto block h-auto rounded-sm bg-white object-contain shadow-[0_4px_18px_rgba(15,23,42,0.16)] transition-[width] duration-200"
              style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
              loading="lazy"
              referrerPolicy="no-referrer"
              onLoad={(event) => { setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }); setLoading(false); }}
              onError={() => void refreshSignedUrl()}
            />
          </div>
        ) : null}
      </div>

      <figcaption className="border-t border-slate-200 px-4 py-3 text-[11px] font-medium leading-5 text-slate-500">
        {block.caption || "Original layout preserved from the selected PDF, including tables, graphs, diagrams, labels, dimensions, and allocated marks."}
      </figcaption>
    </figure>
  );
}

function normalizeExamQuestionText(value: unknown) {
  let text = String(value || "").normalize("NFKC").replace(/\r\n?/g, "\n").trim();
  if (!text) return "";
  const marker = "(?:[a-h]|i{1,3}|iv|v|vi{0,3}|ix|x)";
  text = text.replace(new RegExp(`\\s*(?=\\(${marker}\\)\\s*)`, "giu"), "\n\n");
  text = text.replace(/\s*(\((?:ලකුණු|marks?)\s*[:\-]?\s*\d{1,3}\))\s*(?=\S)/giu, " $1\n\n");
  text = text.replace(/\s+(?=(?:[①②③④⑤⑥⑦⑧⑨⑩]|[•●▪])\s*)/gu, "\n");
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function PredictionQuestionCard({ block }: { block: PredictionQuestionBlock }) {
  const questionText = normalizeExamQuestionText(block.text);
  const paragraphs = questionText.split(/\n{2,}/u).map((part) => part.trim()).filter(Boolean);
  const probability = Math.max(0, Math.min(100, Number(block.predictionProbability || 0)));
  const confidence = Math.max(0, Math.min(100, Number(block.predictionConfidence || 0)));

  return (
    <article lang="si" className="prediction-paper-card mx-auto my-5 w-full max-w-[780px] overflow-hidden border border-slate-300 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.07)] [font-family:'Noto_Sans_Sinhala','Nirmala_UI','Iskoola_Pota','Segoe_UI',sans-serif]">
      <header className="border-b-2 border-slate-900 px-4 py-3 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">AI revision forecast · official paper style</p>
            <h3 className="mt-1 text-sm font-black text-slate-950 sm:text-[15px]">{block.targetYear} {block.subject} — {block.paperType}</h3>
          </div>
          <span className="border border-slate-400 px-2 py-1 text-[10px] font-bold text-slate-700">Practice only</span>
        </div>
      </header>

      <div className="px-4 py-5 sm:px-7 sm:py-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <p className="min-w-0 text-[11px] font-semibold text-slate-500">{block.lesson}{block.subtopic ? ` · ${block.subtopic}` : ""}</p>
          {block.marks > 0 && <span className="shrink-0 text-xs font-bold text-slate-700">(ලකුණු {block.marks.toString().padStart(2, "0")})</span>}
        </div>

        <div className="flex items-start gap-2.5 text-[15px] font-medium leading-8 text-slate-900 [overflow-wrap:anywhere] [word-break:normal] sm:gap-3">
          <span className="shrink-0 pt-0.5 text-[16px] font-black text-slate-950">{String(block.questionNo).padStart(2, "0")}.</span>
          <div className="min-w-0 flex-1 space-y-3">
            {paragraphs.map((paragraph, index) => (
              <div key={`${block.questionNo}-paragraph-${index}`} className="exam-question-paragraph">
                <MessageRenderer content={paragraph} />
              </div>
            ))}
          </div>
        </div>

        {block.image?.url && (
          <figure className="mx-auto mt-5 w-full max-w-[680px] border-y border-slate-200 bg-white py-4 text-center">
            <img
              src={block.image.url}
              alt={block.image.altText || `ප්‍රශ්න ${block.questionNo} රූපසටහන`}
              className="mx-auto block h-auto max-h-[460px] w-auto max-w-full object-contain"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            {(block.caption || block.image.caption) && <figcaption className="mx-auto mt-2 max-w-xl text-[11px] font-medium leading-5 text-slate-500">{block.caption || block.image.caption}</figcaption>}
          </figure>
        )}

        {Array.isArray(block.options) && block.options.length > 0 && (
          <ol className="mt-5 grid gap-x-8 gap-y-2 border-t border-slate-200 pt-4 text-[14px] leading-6 text-slate-900 sm:grid-cols-2">
            {block.options.map((option, index) => <li key={`${block.questionNo}-option-${index}`} className="flex gap-2"><span className="font-bold">({index + 1})</span><span>{option}</span></li>)}
          </ol>
        )}
      </div>

      <footer className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-[10px] leading-5 text-slate-500 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <span>{block.disclaimer || "AI-generated revision practice; not an official or guaranteed examination question."}</span>
          {(probability > 0 || confidence > 0) && <span className="font-semibold tabular-nums text-slate-600">Revision priority {Math.round(probability)}% · evidence confidence {Math.round(confidence)}%</span>}
        </div>
        {block.referenceSourceTitle && <p className="mt-1">Visual pattern reference: {block.referenceSourceTitle}. The practice question and diagram are newly generated.</p>}
      </footer>
    </article>
  );
}

function PanelTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2 border-b border-slate-200/70 pb-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
        {icon}
      </span>
      <span className="min-w-0 truncate text-[11px] font-black uppercase tracking-[0.12em] text-slate-700">
        {children}
      </span>
    </div>
  );
}

export function VisualBlockRenderer({ block }: VisualBlockRendererProps) {
  switch (block.type) {
    case "source_evidence":
      return null;

    case "pdf_image_preview":
      return <PdfImagePreview block={block} />;

    case "mistake_image_preview":
      return <MistakeImagePreview block={block} />;

    case "prediction_question_card":
      return <PredictionQuestionCard block={block} />;

    case "mechanics_diagram":
      return (
        <figure className="my-5 max-w-4xl rounded-2xl border border-slate-200 bg-white p-4">
          <PanelTitle icon={<ArrowRight className="h-4 w-4" />}>{block.title || "නිදහස් බල රූපසටහන"}</PanelTitle>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {block.scenes.map((scene, index) => {
              const angle = Math.max(0, Math.min(75, Number(scene.angleDeg) || 0));
              const radians = angle * Math.PI / 180;
              const endX = 230 + Math.cos(radians) * 92;
              const endY = 88 - Math.sin(radians) * 92;
              return (
                <div key={`${scene.title}-${index}`} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
                  <p className="mb-2 text-xs font-bold text-slate-700">{scene.title} · {scene.surface === "rough" ? "රළු පෘෂ්ඨය" : "සුමට පෘෂ්ඨය"}</p>
                  <svg viewBox="0 0 360 210" role="img" aria-label={`${scene.massKg} kg mass with applied force ${scene.appliedForceN} N`} className="h-auto w-full">
                    <defs>
                      <marker id={`arrow-${index}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="currentColor" /></marker>
                    </defs>
                    <line x1="25" y1="145" x2="335" y2="145" stroke="#64748b" strokeWidth="3" />
                    {scene.surface === "rough" && Array.from({ length: 13 }).map((_, mark) => <line key={mark} x1={35 + mark * 23} y1="145" x2={25 + mark * 23} y2="158" stroke="#94a3b8" strokeWidth="1.5" />)}
                    <rect x="145" y="88" width="85" height="57" rx="5" fill="#fff" stroke="#0f172a" strokeWidth="2.5" />
                    <text x="187.5" y="121" textAnchor="middle" fontSize="15" fontWeight="700" fill="#0f172a">{scene.massKg} kg</text>
                    <g color="#2563eb"><line x1="187" y1="88" x2="187" y2="28" stroke="currentColor" strokeWidth="3" markerEnd={`url(#arrow-${index})`} /><text x="196" y="39" fontSize="14" fontWeight="700" fill="currentColor">R</text></g>
                    <g color="#dc2626"><line x1="187" y1="145" x2="187" y2="198" stroke="currentColor" strokeWidth="3" markerEnd={`url(#arrow-${index})`} /><text x="197" y="191" fontSize="14" fontWeight="700" fill="currentColor">W = mg</text></g>
                    <g color="#059669"><line x1="230" y1="88" x2={endX} y2={endY} stroke="currentColor" strokeWidth="3" markerEnd={`url(#arrow-${index})`} /><text x={Math.min(306, endX - 4)} y={Math.max(20, endY - 8)} textAnchor="end" fontSize="13" fontWeight="700" fill="currentColor">F = {scene.appliedForceN} N</text></g>
                    {angle > 0 && <><path d="M260 88 A30 30 0 0 0 250 69" fill="none" stroke="#475569" strokeWidth="1.5" /><text x="261" y="72" fontSize="12" fill="#334155">θ = {angle}°</text></>}
                    {scene.surface === "rough" && <g color="#d97706"><line x1="145" y1="124" x2="78" y2="124" stroke="currentColor" strokeWidth="3" markerEnd={`url(#arrow-${index})`} /><text x="83" y="113" fontSize="13" fontWeight="700" fill="currentColor">fₛ(max) = {scene.frictionN} N</text></g>}
                  </svg>
                </div>
              );
            })}
          </div>
          {block.caption && <figcaption className="mt-3 text-xs leading-relaxed text-slate-500">{block.caption}</figcaption>}
        </figure>
      );

    case "coordinate_plane":
      return (
        <div className="mx-auto my-5 max-w-md space-y-3 rounded-2xl border border-slate-200/70 bg-slate-50 p-4">
          <PanelTitle icon={<Layers className="h-4 w-4" />}>{block.title || "Coordinate graph"}</PanelTitle>
          <CoordinatePlane points={block.points} lines={block.lines} showGrid={block.showGrid} />
          {block.explanation && <p className="rounded-xl bg-white px-3 py-2 text-center text-xs font-medium leading-relaxed text-slate-500 ring-1 ring-slate-100">{block.explanation}</p>}
        </div>
      );

    case "formula_card":
      return (
        <div className="my-5 max-w-lg border-l-2 border-slate-200 pl-4">
          <PanelTitle icon={<HelpCircle className="h-4 w-4" />}>{block.title || "Formula"}</PanelTitle>
          <div className="my-3 overflow-x-auto py-2 text-left">
            <MessageRenderer content={`$$\n${block.formula}\n$$`} />
          </div>
          {block.variables?.length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {block.variables.map((variable, index) => (
                <div key={`${variable.symbol}-${index}`} className="flex items-start gap-2 py-1">
                  <code className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-black text-indigo-600">{variable.symbol}</code>
                  <span className="text-xs font-medium leading-normal text-slate-600">{variable.meaning}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );

    case "reaction_diagram":
      return (
        <div className="my-5 max-w-2xl border-l-2 border-slate-200 pl-4">
          <PanelTitle icon={<FlaskConical className="h-4 w-4" />}>{block.title || "Reaction"}</PanelTitle>
          <div className="my-3 overflow-x-auto font-mono text-[15px] font-semibold tracking-wide text-slate-900 sm:text-lg">
            <span className="whitespace-nowrap">{block.equation}</span>
          </div>
          {block.caption && <p className="text-xs leading-relaxed text-slate-500">{block.caption}</p>}
        </div>
      );

    case "comparison_bars": {
      const maxValue = Math.max(1, ...block.items.map((item) => item.value));
      return (
        <div className="my-5 max-w-2xl border-l-2 border-slate-200 pl-4">
          <PanelTitle icon={<BarChart3 className="h-4 w-4" />}>{block.title || "Comparison"}</PanelTitle>
          <div className="mt-4 space-y-3">
            {block.items.map((item, index) => (
              <div key={`${item.label}-${index}`} className="grid grid-cols-[minmax(0,1fr)_48px] items-center gap-3">
                <div className="min-w-0">
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-xs font-bold text-slate-700" title={item.label}>{item.label}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full min-w-[8px] rounded-full bg-slate-700 transition-[width] duration-500"
                      style={{ width: `${Math.max(4, (item.value / maxValue) * 100)}%` }}
                    />
                  </div>
                </div>
                <span className="px-1 text-center text-xs font-semibold text-slate-700">
                  {item.displayValue || item.value}
                </span>
              </div>
            ))}
          </div>
          {block.caption && <p className="mt-3 text-xs leading-relaxed text-slate-500">{block.caption}</p>}
        </div>
      );
    }

    case "process_flow":
      return (
        <div className="mx-auto my-5 max-w-3xl rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <PanelTitle icon={<Layers className="h-4 w-4" />}>{block.title || "Process"}</PanelTitle>
          <div className="mt-4 flex min-w-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            {block.steps.map((step, index) => (
              <React.Fragment key={`${step}-${index}`}>
                <div className="min-w-0 flex-1 rounded-xl bg-white px-3 py-3 text-center text-xs font-bold leading-relaxed text-slate-700 ring-1 ring-slate-200">
                  {step}
                </div>
                {index < block.steps.length - 1 && <ArrowRight className="mx-auto h-4 w-4 shrink-0 rotate-90 text-slate-400 sm:rotate-0" />}
              </React.Fragment>
            ))}
          </div>
          {block.caption && <p className="mt-3 text-center text-xs font-medium text-slate-500">{block.caption}</p>}
        </div>
      );

    case "scratch_steps":
      return (
        <div className="mx-auto my-6 max-w-lg space-y-4 rounded-2xl border border-amber-200/70 bg-amber-50/35 p-5">
          <PanelTitle icon={<FileCode className="h-4 w-4" />}>{block.title || "Step-by-step working"}</PanelTitle>
          <div className="relative space-y-4 before:absolute before:bottom-2 before:left-3 before:top-2 before:w-px before:bg-amber-200">
            {block.steps.map((step, index) => (
              <div key={`${step.label}-${index}`} className="relative space-y-1.5 pl-8">
                <span className="absolute left-1.5 top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-amber-500 shadow-sm" />
                <h4 className="text-xs font-extrabold text-amber-900">{step.label}</h4>
                {step.formula && <div className="inline-block max-w-full overflow-x-auto rounded-xl bg-white px-3 py-2 ring-1 ring-amber-100"><MessageRenderer content={step.formula} /></div>}
                <p className="text-xs font-medium leading-relaxed text-slate-600">{step.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case "table":
      return (
        <div className="mx-auto my-5 max-w-2xl space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <PanelTitle icon={<TableIcon className="h-4 w-4" />}>{block.title || "Table"}</PanelTitle>
          <div className="w-full overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {block.columns.map((column, index) => <th key={`${column}-${index}`} className="px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-600">{column}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {block.rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="transition-colors hover:bg-slate-50/50">
                    {row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-2.5 text-xs font-semibold text-slate-700">{cell.includes("$") ? <MessageRenderer content={cell} /> : cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

    default:
      return null;
  }
}
