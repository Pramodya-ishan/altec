import { cn } from "../../lib/utils";

interface PageSkeletonProps {
  pathname: string;
}

function PulseBlock({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("animate-pulse rounded-2xl bg-slate-200/80", className)} />;
}

function CardSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className={cn("rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.04)]", wide && "md:col-span-2")}>
      <div className="mb-5 flex items-center gap-3">
        <PulseBlock className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="w-full space-y-2"><PulseBlock className="h-3 w-24" /><PulseBlock className="h-5 w-2/3" /></div>
      </div>
      <div className="space-y-3"><PulseBlock className="h-3 w-full" /><PulseBlock className="h-3 w-5/6" /><PulseBlock className="h-3 w-2/3" /></div>
    </div>
  );
}

export function PageSkeleton({ pathname }: PageSkeletonProps) {
  const isChat = pathname === "/clora-x" || pathname === "/ai-chat";
  const isLibrary = ["/past-papers", "/syllabus", "/pdf-sources"].includes(pathname);
  const isAnalytics = ["/paper-marks", "/admission-predictor"].includes(pathname);

  if (isChat) {
    return (
      <section className="flex h-full min-h-[70vh] flex-col bg-white px-4 py-6" role="status" aria-label="Loading conversation">
        <span className="sr-only">Loading conversation</span>
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-7">
          <PulseBlock className="h-8 w-40" />
          <PulseBlock className="ml-auto mt-8 h-12 w-64 rounded-3xl" />
          <div className="flex gap-3"><PulseBlock className="h-9 w-9 shrink-0 rounded-full" /><PulseBlock className="h-24 w-[72%]" /></div>
          <PulseBlock className="mt-auto h-24 w-full rounded-3xl" />
        </div>
      </section>
    );
  }

  if (isLibrary) {
    return (
      <section className="space-y-5" role="status" aria-label="Loading files">
        <span className="sr-only">Loading files</span>
        <div className="rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-6 flex items-center justify-between gap-5"><div className="space-y-2"><PulseBlock className="h-5 w-40" /><PulseBlock className="h-3 w-60 max-w-full" /></div><PulseBlock className="h-10 w-32" /></div>
          <PulseBlock className="mb-6 h-12 w-full rounded-xl" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {["resource-a", "resource-b", "resource-c", "resource-d", "resource-e", "resource-f"].map((key) => (
              <div key={key} className="space-y-4 rounded-2xl border border-slate-200 p-4"><PulseBlock className="h-5 w-20" /><PulseBlock className="h-6 w-4/5" /><PulseBlock className="h-4 w-1/2" /><div className="flex gap-2 pt-6"><PulseBlock className="h-9 flex-1" /><PulseBlock className="h-9 w-9 rounded-full" /></div></div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (isAnalytics) {
    return (
      <section className="space-y-6" role="status" aria-label="Loading analytics">
        <span className="sr-only">Loading analytics</span>
        <div className="grid gap-4 sm:grid-cols-3">{["metric-a", "metric-b", "metric-c"].map((key) => <div key={key} className="rounded-2xl border border-slate-200 bg-white p-5"><PulseBlock className="mb-5 h-3 w-24" /><PulseBlock className="h-8 w-28" /><PulseBlock className="mt-3 h-3 w-36" /></div>)}</div>
        <div className="rounded-[1.8rem] border border-slate-200 bg-white p-6"><PulseBlock className="mb-8 h-5 w-52" /><div className="flex h-56 items-end gap-4 border-b border-l border-slate-100 px-5">{[36, 55, 46, 72, 62, 83, 70].map((height, index) => <PulseBlock key={`bar-${index}`} className="w-full rounded-b-none" style={{ height: `${height}%` } as React.CSSProperties} />)}</div></div>
        <div className="grid gap-5 lg:grid-cols-2"><CardSkeleton /><CardSkeleton /></div>
      </section>
    );
  }

  return (
    <section className="space-y-6" role="status" aria-label="Loading page">
      <span className="sr-only">Loading page</span>
      <div className="flex items-center justify-between"><div className="space-y-2"><PulseBlock className="h-5 w-48" /><PulseBlock className="h-3 w-72 max-w-[70vw]" /></div><PulseBlock className="h-10 w-28" /></div>
      <div className="grid gap-5 md:grid-cols-2"><CardSkeleton /><CardSkeleton /></div>
      <div className="rounded-[1.8rem] border border-slate-200 bg-white p-6 shadow-[0_8px_28px_rgba(15,23,42,0.04)]"><PulseBlock className="mb-6 h-5 w-44" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{["lesson-a", "lesson-b", "lesson-c", "lesson-d", "lesson-e", "lesson-f"].map((key) => <PulseBlock key={key} className="h-16" />)}</div></div>
    </section>
  );
}
