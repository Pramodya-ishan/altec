export const AI_WORKFLOW_STAGES = {
  thinking: "සොයමින්...",
  auth: "ගිණුම තහවුරු කරමින්...",
  profile: "ඔබගේ දත්ත ගනිමින්...",
  progress: "ප්‍රගතිය පරීක්ෂා කරමින්...",
  memory: "පාඩම් සටහන් ගනිමින්...",
  sources: "මූලාශ්‍ර පරීක්ෂා කරමින්...",
  search: "වෙබ් සෙවීම සිදු කරමින්...",
  planning: "පිළිතුර සකස් කරමින්...",
  generating: "පිළිතුර ලියමින්...",
  saving: "සුරකිමින්...",
  done: "සම්පූර්ණයි",
  error: "නවතා ඇත",
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
