import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleDashed, Clock3, Search, ShieldCheck, Sparkles } from "lucide-react";
import { apiFetch } from "../lib/api";
import { cn } from "../lib/utils";
import type { FeatureCategory, FeatureDeliveryState, PlatformFeature } from "../../shared/platform/featureCatalog";

interface CatalogResponse {
  ok: boolean;
  admin: boolean;
  categoryLabels: Record<FeatureCategory, string>;
  summary: {
    total: number;
    productionReadyPercent: number;
    integratedPercent: number;
    byState: Record<FeatureDeliveryState, number>;
  };
  features: PlatformFeature[];
}

const stateMeta: Record<FeatureDeliveryState, { label: string; icon: React.ElementType; className: string }> = {
  available: { label: "Available", icon: CheckCircle2, className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  foundation: { label: "Foundation", icon: CircleDashed, className: "border-amber-200 bg-amber-50 text-amber-700" },
  planned: { label: "Planned", icon: Clock3, className: "border-slate-200 bg-slate-50 text-slate-600" },
};

export default function FeatureCenter() {
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FeatureCategory | "all">("all");
  const [state, setState] = useState<FeatureDeliveryState | "all">("all");

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/platform/capabilities")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || payload.error || "Unable to load feature catalog");
        if (!cancelled) setData(payload);
      })
      .catch((reason) => !cancelled && setError(reason instanceof Error ? reason.message : String(reason)));
    return () => { cancelled = true; };
  }, []);

  const features = useMemo(() => {
    if (!data) return [];
    const normalizedQuery = query.trim().toLowerCase();
    return data.features.filter((feature) => {
      if (category !== "all" && feature.category !== category) return false;
      if (state !== "all" && feature.state !== state) return false;
      if (normalizedQuery && !`${feature.id} ${feature.title} ${feature.key}`.toLowerCase().includes(normalizedQuery)) return false;
      return true;
    });
  }, [data, query, category, state]);

  if (error) {
    return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm font-medium text-rose-800">{error}</div>;
  }
  if (!data) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">Loading feature catalog…</div>;
  }

  return (
    <section className="space-y-6 pb-10">
      <header className="overflow-hidden rounded-[30px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
              <ShieldCheck className="h-4 w-4" /> 300-feature delivery center
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">Platform capabilities</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Every requested capability is registered here. “Available” means an end-to-end path exists, “Foundation” means the typed service/schema or partial workflow is present, and “Planned” is not yet production-ready.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Total", data.summary.total],
              ["Available", data.summary.byState.available],
              ["Foundation", data.summary.byState.foundation],
              ["Integrated", `${data.summary.integratedPercent}%`],
            ].map(([label, value]) => (
              <div key={String(label)} className="min-w-[110px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search feature number or name" className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100" />
          </label>
          <select value={category} onChange={(event) => setCategory(event.target.value as FeatureCategory | "all")} className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100">
            <option value="all">All categories</option>
            {Object.entries(data.categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <select value={state} onChange={(event) => setState(event.target.value as FeatureDeliveryState | "all")} className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100">
            <option value="all">All states</option>
            <option value="available">Available</option>
            <option value="foundation">Foundation</option>
            <option value="planned">Planned</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3">
        {features.map((feature) => {
          const meta = stateMeta[feature.state];
          const Icon = meta.icon;
          return (
            <article key={feature.id} className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700">{feature.id}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold", meta.className)}><Icon className="h-3.5 w-3.5" />{meta.label}</span>
                    {feature.priority === "high" && <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700"><Sparkles className="h-3.5 w-3.5" />High priority</span>}
                    <span className="text-[11px] font-medium text-slate-400">{data.categoryLabels[feature.category]}</span>
                  </div>
                  <h2 className="mt-2 text-[15px] font-semibold leading-6 text-slate-900">{feature.title}</h2>
                  {data.admin && feature.implementationRefs.length > 0 && (
                    <p className="mt-2 truncate font-mono text-[10px] text-slate-400" title={feature.implementationRefs.join(", ")}>{feature.implementationRefs.join(" · ")}</p>
                  )}
                </div>
              </div>
            </article>
          );
        })}
        {features.length === 0 && <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-500">No features match these filters.</div>}
      </div>
    </section>
  );
}
