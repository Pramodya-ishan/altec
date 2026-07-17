import React from "react";
import { CoordinatePlane } from "./CoordinatePlane";
import { MessageRenderer } from "./MessageRenderer";
import { VisualBlock } from "../../lib/visualBlocks";
import { HelpCircle, Table as TableIcon, Layers, FileCode } from "lucide-react";

interface VisualBlockRendererProps {
  block: VisualBlock;
}

export function VisualBlockRenderer({ block }: VisualBlockRendererProps) {
  switch (block.type) {
    case "coordinate_plane":
      return (
        <div className="my-5 bg-slate-50 rounded-2xl p-4 border border-slate-200/60 max-w-md mx-auto space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60">
            <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-black text-slate-700 tracking-wide uppercase">
              {block.title || "Coordinate graph"}
            </span>
          </div>
          <CoordinatePlane
            points={block.points}
            lines={block.lines}
            showGrid={block.showGrid}
          />
          {block.explanation && (
            <p className="text-xs font-semibold text-slate-500 text-center leading-relaxed italic bg-white py-2 px-3 rounded-xl border border-slate-100">
              {block.explanation}
            </p>
          )}
        </div>
      );

    case "formula_card":
      return (
        <div className="my-5 bg-gradient-to-br from-indigo-50/40 via-purple-50/20 to-white rounded-2xl p-5 border border-indigo-100/80 shadow-xs max-w-lg mx-auto">
          <div className="flex items-center gap-2 pb-3 border-b border-indigo-100/60">
            <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center border border-indigo-200">
              <HelpCircle className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-black text-indigo-950 tracking-wide uppercase">
              {block.title || "Formula"}
            </span>
          </div>
          <div className="py-5 flex items-center justify-center bg-white/70 backdrop-blur-xs rounded-xl my-3 border border-slate-100 shadow-2xs">
            <MessageRenderer content={`$$\n${block.formula}\n$$`} />
          </div>
          {block.variables && block.variables.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Parameters:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {block.variables.map((v, i) => (
                  <div key={i} className="flex items-start gap-2 bg-white border border-slate-100 rounded-lg p-2">
                    <code className="font-mono text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-black shrink-0">
                      {v.symbol}
                    </code>
                    <span className="text-xs font-medium text-slate-600 leading-normal">
                      {v.meaning}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );

    case "scratch_steps":
      return (
        <div className="my-6 bg-amber-50/30 rounded-2xl p-5 border border-amber-200/60 shadow-2xs max-w-lg mx-auto space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-amber-200/50">
            <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
              <FileCode className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-black text-amber-950 tracking-wide uppercase">
              {block.title || "Step-by-step working"}
            </span>
          </div>
          <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-amber-100">
            {block.steps.map((step, idx) => (
              <div key={idx} className="relative pl-7 space-y-1.5">
                {/* Step indicator dot */}
                <div className="absolute left-1.5 top-1.5 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-white shadow-xs flex items-center justify-center text-[7px] font-bold text-white" />
                
                <h4 className="text-xs font-extrabold text-amber-900 leading-none">
                  {step.label}
                </h4>

                {step.formula && (
                  <div className="bg-white border border-amber-100/60 rounded-xl px-3 py-2.5 my-1 shadow-2xs inline-block max-w-full overflow-x-auto">
                    <MessageRenderer content={step.formula} />
                  </div>
                )}

                <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                  {step.explanation}
                </p>
              </div>
            ))}
          </div>
        </div>
      );

    case "table":
      return (
        <div className="my-5 bg-slate-50 rounded-2xl p-4 border border-slate-200/60 max-w-lg mx-auto space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60">
            <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200">
              <TableIcon className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-black text-slate-700 tracking-wide uppercase">
              {block.title || "Calculations"}
            </span>
          </div>
          <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {block.columns.map((col, i) => (
                    <th key={i} className="px-4 py-2.5 text-xs font-black text-slate-600 uppercase tracking-wider">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {block.rows.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/40 transition-colors">
                    {row.map((cell, j) => (
                      <td key={j} className="px-4 py-2.5 text-xs font-semibold text-slate-700">
                        {cell.includes("$") ? (
                          <MessageRenderer content={cell} />
                        ) : (
                          cell
                        )}
                      </td>
                    ))}
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
