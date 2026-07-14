import React, { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Copy, Check } from "lucide-react";
import { sanitizeMathMarkdown } from "../../lib/mathSanitizer";
import "katex/dist/katex.min.css";

interface MessageRendererProps {
  content: string;
}

const getText = (node: any): string => {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(getText).join("");
  if (node?.props?.children) return getText(node.props.children);
  return "";
};

const PreComponent = ({ children, ...props }: any) => {
  const [copied, setCopied] = useState(false);

  const text = getText(children);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Failed to copy text", err);
    }
  };

  return (
    <div className="relative group/code my-4">
      <div className="absolute right-2.5 top-2.5 opacity-0 group-hover/code:opacity-100 transition-opacity z-10">
        <button
          type="button"
          onClick={handleCopy}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors border border-slate-700 active:scale-95 cursor-pointer flex items-center justify-center"
          title="Copy code"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <pre className="bg-slate-950 text-slate-200 p-4 rounded-xl overflow-x-auto font-mono text-xs shadow-inner scrollbar-none leading-relaxed" {...props}>
        {children}
      </pre>
    </div>
  );
};

import { stripRawVisualBlocks } from "../../lib/ai/stripVisualBlocks";
import { sanitizeMathText } from "../../lib/markdown/mathTextSanitizer";

export function MessageRenderer({ content }: MessageRendererProps) {
  const cleanedContent = stripRawVisualBlocks(content);
  const mathSanitized = sanitizeMathText(cleanedContent);
  const sanitizedContent = sanitizeMathMarkdown(mathSanitized);
  return (
    <div className="text-[15.5px] sm:text-[16px] text-slate-800 leading-[1.8] font-sans break-words prose prose-slate max-w-none prose-headings:font-bold prose-headings:text-slate-950 prose-headings:mt-4 prose-headings:mb-2 prose-p:mb-3 prose-p:leading-[1.8] prose-li:leading-[1.8]">
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          img: ({ node, ...props }) => {
            const src = props.src || "";
            if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:image/")) {
              return <img {...props} className="rounded-2xl shadow-sm border border-slate-200 my-4 max-w-full" loading="lazy" referrerPolicy="no-referrer" alt={props.alt || "AI response image"} />;
            }
            return null;
          },
          h1: ({ children }) => <h1 className="text-base font-extrabold mt-4 mb-2 text-slate-950 border-b border-slate-200 pb-1.5">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-bold mt-3 mb-1.5 text-slate-900">{children}</h2>,
          h3: ({ children }) => <h3 className="text-xs font-bold mt-2 mb-1 text-slate-700">{children}</h3>,
          pre: (props: any) => {
            const text = getText(props.children);
            if (text.includes('"visual_block"')) {
              return null;
            }
            return <PreComponent {...props} />;
          },
          code: ({ node, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !match;
            if (isInline) {
              return (
                <code className="font-mono text-xs bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-indigo-600 font-bold" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className="font-mono text-xs" {...props}>
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
            <th className="px-4 py-3 text-sm font-semibold border-b border-slate-200">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 align-top leading-relaxed">{children}</td>
          )
        }}
      >
        {sanitizedContent}
      </Markdown>
    </div>
  );
}
