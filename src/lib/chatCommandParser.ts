export type ChatCommandType =
  | 'tts'
  | 'live'
  | 'websearch'
  | 'deepsearch'
  | 'image'
  | 'pdf'
  | 'file'
  | 'guessing'
  | 'video'
  | 'explain'
  | 'personalize'
  | 'normal';

export interface ParsedCommand {
  command: ChatCommandType;
  text: string;
  args: string;
}

const commandAliases: Array<{ names: string[]; command: ChatCommandType }> = [
  { names: ['@tts'], command: 'tts' },
  { names: ['@live'], command: 'live' },
  { names: ['@websearch', '@web'], command: 'websearch' },
  { names: ['@deepsearch', '@deep'], command: 'deepsearch' },
  { names: ['@image'], command: 'image' },
  { names: ['@pdf'], command: 'pdf' },
  { names: ['@file'], command: 'file' },
  { names: ['@guessing', '@guess'], command: 'guessing' },
  { names: ['@video'], command: 'video' },
  { names: ['@explain'], command: 'explain' },
  { names: ['@personalize'], command: 'personalize' },
];

export function parseChatCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();
  for (const entry of commandAliases) {
    const alias = entry.names.find((name) => lower === name || lower.startsWith(`${name} `));
    if (!alias) continue;
    const text = trimmed.slice(alias.length).trim();
    return { command: entry.command, text, args: text };
  }
  return { command: 'normal', text: trimmed, args: '' };
}
