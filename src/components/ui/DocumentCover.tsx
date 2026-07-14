import { FileText } from "lucide-react";
import { cn } from "../../lib/utils";

interface DocumentCoverProps {
  title: string;
  eyebrow?: string;
  compact?: boolean;
  className?: string;
}

export function DocumentCover({ title, eyebrow = "PDF document", compact = false, className }: DocumentCoverProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative isolate overflow-hidden rounded-2xl bg-slate-950 text-white",
        compact ? "h-16 w-16 shrink-0 rounded-xl" : "h-32 w-full",
        className,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,rgba(99,102,241,0.3),transparent_38%)]" />
      <div className={cn("relative flex h-full flex-col", compact ? "items-center justify-center gap-1 p-2" : "justify-between p-4")}>
        <div className={cn("flex items-center gap-2", compact && "flex-col gap-1")}>
          <span className={cn("grid place-items-center rounded-lg bg-white/10", compact ? "h-8 w-8" : "h-9 w-9")}>
            <FileText className={compact ? "h-4 w-4" : "h-5 w-5"} />
          </span>
          {!compact && <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">{eyebrow}</span>}
        </div>
        {!compact && <p className="line-clamp-2 max-w-[90%] text-sm font-semibold leading-5 text-white/95">{title}</p>}
        {compact && <span className="text-[9px] font-bold uppercase tracking-wider text-white/65">PDF</span>}
      </div>
    </div>
  );
}
