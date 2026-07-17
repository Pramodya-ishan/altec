export const AI_WORKFLOW_STAGES = {
  thinking: "Thinking…",
  auth: "Verifying your account…",
  profile: "Loading your profile…",
  progress: "Checking your progress…",
  memory: "Loading your study notes…",
  sources: "Checking sources…",
  search: "Searching the web…",
  planning: "Preparing the answer…",
  generating: "Writing the answer…",
  saving: "Saving…",
  done: "Complete",
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
