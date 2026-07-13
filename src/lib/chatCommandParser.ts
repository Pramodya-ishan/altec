export type ChatCommandType = "tts" | "live" | "websearch" | "deepsearch" | "image" | "pdf" | "file" | "normal";

export interface ParsedCommand {
  command: ChatCommandType;
  text: string;
  args: string;
}

export function parseChatCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  
  if (trimmed.startsWith("@tts ")) {
    return { command: "tts", text: trimmed.substring(5).trim(), args: trimmed.substring(5).trim() };
  } else if (trimmed === "@tts") {
    return { command: "tts", text: "", args: "" };
  }
  
  if (trimmed.startsWith("@live")) {
    return { command: "live", text: trimmed.substring(5).trim(), args: trimmed.substring(5).trim() };
  }
  
  if (trimmed.startsWith("@websearch ")) {
    return { command: "websearch", text: trimmed.substring(11).trim(), args: trimmed.substring(11).trim() };
  } else if (trimmed === "@websearch") {
    return { command: "websearch", text: "", args: "" };
  }
  
  if (trimmed.startsWith("@deepsearch ")) {
    return { command: "deepsearch", text: trimmed.substring(12).trim(), args: trimmed.substring(12).trim() };
  } else if (trimmed === "@deepsearch") {
    return { command: "deepsearch", text: "", args: "" };
  }
  
  if (trimmed.startsWith("@image ")) {
    return { command: "image", text: trimmed.substring(7).trim(), args: trimmed.substring(7).trim() };
  } else if (trimmed === "@image") {
    return { command: "image", text: "", args: "" };
  }
  
  if (trimmed.startsWith("@pdf ")) {
    return { command: "pdf", text: trimmed.substring(5).trim(), args: trimmed.substring(5).trim() };
  } else if (trimmed === "@pdf") {
    return { command: "pdf", text: "", args: "" };
  }
  
  if (trimmed.startsWith("@file ")) {
    return { command: "file", text: trimmed.substring(6).trim(), args: trimmed.substring(6).trim() };
  } else if (trimmed === "@file") {
    return { command: "file", text: "", args: "" };
  }

  return { command: "normal", text: trimmed, args: "" };
}
