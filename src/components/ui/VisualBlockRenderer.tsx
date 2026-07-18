import React, { useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileCode,
  FlaskConical,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  ShieldCheck,
  Table as TableIcon,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import { CoordinatePlane } from "./CoordinatePlane";
import { MessageRenderer } from "./MessageRenderer";
import type { VisualBlock } from "../../lib/visualBlocks";
import { auth } from "../../lib/firebase";
import { apiUrl } from "../../lib/apiBase";

interface VisualBlockRendererProps {
  block: VisualBlock;
}

type PdfPreviewBlock = Extract<VisualBlock, { type: "pdf_image_preview" }>;

function PdfImagePreview({ block }: { block: PdfPreviewBlock }) {
  const [imageUrl, setImageUrl] = useState(block.imageUrl);
  const [failed, setFailed] = useState(false);
  const refreshAttempted = useRef(false);

  const refreshSignedUrl = async () => {
    if (refreshAttempted.current || !block.sourceId || !block.pageNumber) {
      setFailed(true);
      return;
    }
    refreshAttempted.current = true;
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
          pageNumber: block.pageNumber,
          crop: block.crop || null,
          title: block.title,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.imageUrl) throw new Error(payload?.code || "PREVIEW_REFRESH_FAILED");
      setImageUrl(payload.imageUrl);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  };

  if (failed) {
    return <p className="my-3 text-xs text-slate-500">PDF visual preview is temporarily unavailable.</p>;
  }

  return (
    <figure className="my-4 max-w-2xl">
      <img
        src={imageUrl}
        alt={block.title || "PDF question visual"}
        className="block max-h-[620px] w-auto max-w-full rounded-xl object-contain"
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => void refreshSignedUrl()}
      />
      <figcaption className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
        <ImageIcon className="h-3.5 w-3.5" />
        <span>{block.caption || block.title}{block.pageNumber ? ` · Page ${block.pageNumber}` : ""}</span>
      </figcaption>
    </figure>
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
