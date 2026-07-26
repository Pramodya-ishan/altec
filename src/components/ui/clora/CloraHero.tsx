import type { ReactNode } from "react";
import { ArrowUpRight, BookOpenCheck, CircleAlert, FileQuestion } from "lucide-react";

interface CloraHeroProps {
  onSelectPrompt?: (prompt: string) => void;
  prompts?: { title: string; prompt: string; icon: ReactNode; color?: string }[];
}

const defaultPrompts = [
  {
    title: "Review my Error Log",
    description: "Open saved mistakes, including their images.",
    prompt: "Give my Error Log with images",
    icon: <CircleAlert className="h-5 w-5" />,
  },
  {
    title: "Solve a paper question",
    description: "Use a year, subject, and question number.",
    prompt: "Help me solve an official past paper question step by step",
    icon: <FileQuestion className="h-5 w-5" />,
  },
  {
    title: "Plan today’s revision",
    description: "Prioritise weak lessons and due work.",
    prompt: "Build a focused revision plan for today from my saved progress",
    icon: <BookOpenCheck className="h-5 w-5" />,
  },
];

export function CloraHero({ onSelectPrompt, prompts }: CloraHeroProps) {
  const items = prompts?.map((item) => ({ ...item, description: item.prompt })) || defaultPrompts;
  return (
    <section className="study-hero">
      <div className="study-hero__intro" data-reveal>
        <p className="product-eyebrow">Your study desk</p>
        <h2>Ask. Solve. Remember.</h2>
        <p>Work from your saved errors, syllabus, and past papers in Sinhala or English.</p>
      </div>
      <div className="study-prompt-grid" data-reveal>
        {items.map((item) => (
          <button key={item.title} type="button" onClick={() => onSelectPrompt?.(item.prompt)} className="study-prompt">
            <span className="study-prompt__icon">{item.icon}</span>
            <span className="min-w-0 flex-1"><strong>{item.title}</strong><small>{item.description}</small></span>
            <ArrowUpRight className="h-4 w-4" />
          </button>
        ))}
      </div>
      <p className="study-hero__note">Answers can use saved records and approved sources. Check official exam details before relying on them.</p>
    </section>
  );
}
