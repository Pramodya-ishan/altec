import React from "react";

export function SafeReasoningSummary({ items }: { items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-2 p-3 bg-zinc-900 rounded-xl border border-zinc-800 shadow-sm text-xs text-zinc-400 font-mono">
      <div className="font-bold text-zinc-300 mb-2 pb-2 border-b border-zinc-800">How this answer was prepared</div>
      <ul className="space-y-1.5">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <span className="text-zinc-600 mt-0.5">›</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
