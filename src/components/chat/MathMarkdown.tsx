import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";

import "katex/dist/katex.min.css";

import { normalizeMathMarkdown } from "../../utils/normalizeMathMarkdown";
import { stripRawVisualBlocks } from "../../lib/ai/stripVisualBlocks";
import { normalizeAnswerMarkdown } from "../../lib/markdown/normalizeAnswerMarkdown";

interface MathMarkdownProps {
  content: string;
  isStreaming?: boolean;
}

export const MathMarkdown = memo(function MathMarkdown({
  content,
  isStreaming = false,
}: MathMarkdownProps) {
  const normalizedContent = useMemo(() => {
    const withoutBlocks = normalizeAnswerMarkdown(stripRawVisualBlocks(content));
    return normalizeMathMarkdown(withoutBlocks, isStreaming);
  }, [content, isStreaming]);

  return (
    <div className="ai-markdown relative inline-block w-full">
      <ReactMarkdown
        remarkPlugins={isStreaming ? [remarkGfm] : [remarkGfm, remarkMath]}
        rehypePlugins={isStreaming ? [] : [
          [
            rehypeKatex,
            {
              throwOnError: false,
              strict: false,
              trust: false,
              output: "htmlAndMathml",
            },
          ],
        ]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-3 mt-7 border-b border-slate-200 pb-2 text-xl font-black tracking-tight text-slate-950">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-7 flex items-center gap-2 text-[17px] font-black tracking-tight text-slate-950 before:h-5 before:w-1 before:rounded-full before:bg-indigo-500">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-5 text-[15px] font-extrabold text-slate-900">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="ai-markdown__paragraph block min-w-0 [overflow-wrap:anywhere]">{children}</p>
          ),
          strong: ({ children }) => <strong className="font-extrabold text-slate-950">{children}</strong>,
          blockquote: ({ children }) => (
            <blockquote className="my-4 rounded-r-xl border-l-4 border-indigo-400 bg-indigo-50/60 px-4 py-3 font-semibold text-slate-800">{children}</blockquote>
          ),
          ul: ({ children }) => <ul className="my-3 space-y-2 pl-5 marker:text-indigo-500">{children}</ul>,
          ol: ({ children }) => <ol className="my-3 space-y-2 pl-5 marker:font-bold marker:text-indigo-600">{children}</ol>,
          li: ({ children }) => <li className="pl-1 leading-7 text-slate-700">{children}</li>,
          hr: () => <hr className="my-6 border-slate-200" />,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="font-semibold text-indigo-600 underline decoration-indigo-200 underline-offset-4 hover:text-indigo-700">{children}</a>
          ),

          code: ({ className, children, ...props }: any) => {
            const isBlockCode = Boolean(className);

            if (!isBlockCode) {
              return (
                <code className="ai-markdown__inline-code bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-indigo-600 font-mono text-[0.85em] font-medium" {...props}>
                  {children}
                </code>
              );
            }

            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto my-4 rounded-lg border border-slate-200 shadow-sm">
              <table className="w-full text-sm text-left">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-50 text-slate-700 font-semibold">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-slate-200">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-slate-50 transition-colors">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 text-sm font-semibold">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 align-top leading-relaxed">{children}</td>
          ),
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-1.5 h-4 ml-1 bg-indigo-500 rounded-full animate-pulse align-middle" />
      )}
    </div>
  );
});
