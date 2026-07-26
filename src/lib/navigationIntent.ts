let pendingTopicHighlight: string | null = null;
let pendingStudyPrompt: string | null = null;

export function setPendingTopicHighlight(topic: string) {
  pendingTopicHighlight = topic.trim() || null;
}

export function consumePendingTopicHighlight() {
  const value = pendingTopicHighlight;
  pendingTopicHighlight = null;
  return value;
}

export function setPendingStudyPrompt(prompt: string) {
  pendingStudyPrompt = prompt.trim() || null;
}

export function consumePendingStudyPrompt() {
  const value = pendingStudyPrompt;
  pendingStudyPrompt = null;
  return value;
}
