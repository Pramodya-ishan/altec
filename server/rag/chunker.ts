export function normalizeText(text: string): string {
  // Normalize Sinhala unicode and basic punctuation
  return text
    .replace(/\\u200B/g, '') // zero-width space
    .replace(/\\r\\n/g, '\\n')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\\s+/g, ' ')
    .trim();
}

export function extractKeywords(text: string): string[] {
  const words = text.toLowerCase().split(/[\\s\\.,\\-\\?!\\(\\)"']+/);
  const stops = new Set(['the','is','in','at','of','on','and','a','to','it','for','as','with','this','that','by','an','be','from','or','are','was','will','can','not','have','has','but','all','if','we','you','they','what','which','who','when','where','how']);
  const kw = new Set<string>();
  words.forEach(w => {
    if (w.length > 3 && !stops.has(w)) kw.add(w);
  });
  return Array.from(kw);
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function chunkText(fullText: string, maxTokens: number = 500, overlapTokens: number = 50): string[] {
  // Simple paragraph/sentence-based chunking
  const paragraphs = fullText.split(/\\n\\s*\\n/);
  const chunks: string[] = [];
  let currentChunk = "";
  
  for (const para of paragraphs) {
    const pTokens = estimateTokens(para);
    if (estimateTokens(currentChunk) + pTokens > maxTokens) {
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
      }
      
      // If a single paragraph is too large, split by sentences
      if (pTokens > maxTokens) {
        const sentences = para.split(/(?<=[\\.\\?!])\\s+/);
        let sChunk = "";
        for (const s of sentences) {
          if (estimateTokens(sChunk) + estimateTokens(s) > maxTokens) {
            chunks.push(sChunk.trim());
            sChunk = s + " ";
          } else {
            sChunk += s + " ";
          }
        }
        currentChunk = sChunk;
      } else {
        currentChunk = para + "\\n\\n";
      }
    } else {
      currentChunk += para + "\\n\\n";
    }
  }
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}
