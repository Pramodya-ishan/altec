export const AI_WORKFLOW_STAGES = {
  thinking: "Thinking",
  auth: "Verifying account",
  profile: "Reading your profile",
  progress: "Checking your progress",
  memory: "Loading study memory",
  sources: "Checking lesson sources",
  search: "Searching web",
  planning: "Planning answer",
  generating: "Writing answer",
  saving: "Saving memory",
  done: "Thought",
  error: "Stopped",
};

export function sendSSE(res: any, event: string, data: any) {
  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (res.flush) res.flush();
  } catch (e) {
    // Client disconnected
  }
}
