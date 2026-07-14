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
          p: ({ children }) => (
            <p className="ai-markdown__paragraph block">{children}</p>
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
