let pendingTopicHighlight: string | null = null;

export function setPendingTopicHighlight(topic: string) {
  pendingTopicHighlight = topic.trim() || null;
}

export function consumePendingTopicHighlight() {
  const value = pendingTopicHighlight;
  pendingTopicHighlight = null;
  return value;
}
