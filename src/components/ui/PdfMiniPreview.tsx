import React, { useEffect, useRef, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { apiFetch } from "../../lib/api";

export function PdfMiniPreview({ sourceId, title, className = "h-28" }: {
  sourceId?: string;
  title: string;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || visible) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "160px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || !sourceId) return;
    const controller = new AbortController();
    let url: string | null = null;
    void apiFetch(`/api/rag/sources/${encodeURIComponent(sourceId)}/download`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Preview unavailable");
        const blob = await response.blob();
        if (!blob.type.toLowerCase().includes("pdf")) throw new Error("Not a PDF");
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      })
      .catch((error) => { if (error?.name !== "AbortError") setFailed(true); });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [sourceId, visible]);

  return (
    <div ref={rootRef} className={`relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 ${className}`} aria-label={`${title} PDF preview`}>
      {blobUrl ? (
        <object data={`${blobUrl}#page=1&toolbar=0&navpanes=0&scrollbar=0`} type="application/pdf" className="pointer-events-none h-full w-full" aria-label={`${title} first page`}>
          <div className="grid h-full place-items-center text-slate-400"><FileText className="h-6 w-6" /></div>
        </object>
      ) : (
        <div className="grid h-full place-items-center px-3 text-center text-[11px] font-semibold text-slate-400">
          {failed || !sourceId ? <div><FileText className="mx-auto mb-1 h-6 w-6" />PDF document</div> : <div><Loader2 className="mx-auto mb-1 h-5 w-5 animate-spin text-indigo-500" />Loading preview…</div>}
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/55 to-transparent px-2 pb-1.5 pt-6 text-[9px] font-bold text-white">Page 1 preview</div>
    </div>
  );
}
