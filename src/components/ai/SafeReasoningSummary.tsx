import React from "react";

export function SafeReasoningSummary({ items }: { items: string[] }) {
  if (!items || items.length === 0) return null;

  return (
    <div className="text-xs text-slate-500 font-medium">
      <ul className="space-y-1.5 border-l-2 border-slate-200 pl-3 ml-1">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
