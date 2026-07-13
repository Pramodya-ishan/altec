import { SYLLABUS } from "../../src/constants/syllabus";

export function detectLessonForChunk(text: string, subject: string): string | null {
  const normSubj = subject.toLowerCase().trim();
  const def = SYLLABUS[normSubj];
  if (!def) return null;

  // Extract all distinct topics from mcqItems and partAItems
  const topics = new Set<string>();
  if (def.mcqItems) {
    for (const item of def.mcqItems) {
      if (item.title) topics.add(item.title);
    }
  }
  if (def.partAItems) {
    for (const item of def.partAItems) {
      if (item.topics) {
        for (const t of item.topics) topics.add(t);
      }
    }
  }
  if (def.bcdGroups) {
    for (const g of def.bcdGroups) {
      if (g.items) {
        for (const item of g.items) {
          if (item.topics) {
            for (const t of item.topics) topics.add(t);
          }
        }
      }
    }
  }

  // Very basic string match (case insensitive)
  const lowerText = text.toLowerCase();
  for (const topic of topics) {
    // If the chunk mentions the topic, we assign it.
    // Sinhala text is case insensitive mostly anyway.
    if (topic.length > 3 && lowerText.includes(topic.toLowerCase())) {
      return topic;
    }
  }

  return null;
}
