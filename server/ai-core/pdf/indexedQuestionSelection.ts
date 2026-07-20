export type IndexedQuestionChunk = {
  id: string;
  text: string;
  pageNumber?: number;
  chunkIndex?: number;
  questionNo?: string | number;
};

function requestedNumber(value: unknown) {
  return String(value || "").match(/\d+/)?.[0] || "";
}

export function hasExactQuestionMarker(value: unknown, questionNo: unknown): boolean {
  const number = requestedNumber(questionNo);
  if (!number) return false;
  const escaped = number.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const text = String(value || "");
  const patterns = [
    new RegExp(`(?:^|\\n)\\s*(?:mcq\\s*)?(?:q(?:uestion)?\\s*)?0*${escaped}\\s*['’.\\):\\-]`, "im"),
    new RegExp(`(?:^|\\n)\\s*(?:q|question)\\s*(?:no\\.?|number)?\\s*[:.\\-]?\\s*0*${escaped}(?:\\s|['’.):-]|$)`, "im"),
    new RegExp(`(?:^|\\n)\\s*(?:essay|structured)\\s*(?:q(?:uestion)?\\s*)?0*${escaped}(?:\\s|['’.):-]|$)`, "im"),
    new RegExp(`(?:^|\\n)\\s*\\(\\s*0*${escaped}\\s*\\)\\s+`, "m"),
    new RegExp(`(?:^|\\n)\\s*(?:ප්‍රශ්නය|ප්රශ්නය)\\s*0*${escaped}(?:\\s|[.):-]|$)`, "m"),
    new RegExp(`(?:^|\\n)\\s*0*${escaped}\\s*(?:වන|වෙනි)(?:\\s|$)`, "m"),
  ];
  return patterns.some((pattern) => pattern.test(text));
}

function chunkContainsQuestion(chunk: IndexedQuestionChunk, questionNo: string) {
  const number = requestedNumber(questionNo);
  if (!number) return false;
  if (requestedNumber(chunk.questionNo) === number) return true;
  return hasExactQuestionMarker(chunk.text, number);
}

export function selectIndexedQuestionChunks<T extends IndexedQuestionChunk>(chunks: T[], questionNo: string): T[] {
  const sorted = [...chunks].sort((a, b) => Number(a.chunkIndex || 0) - Number(b.chunkIndex || 0));
  const matches = sorted
    .map((chunk, index) => ({ chunk, index }))
    .filter(({ chunk }) => chunkContainsQuestion(chunk, questionNo));

  const selectedIndexes = new Set<number>();
  for (const { index } of matches) {
    for (let offset = -1; offset <= 2; offset += 1) {
      if (sorted[index + offset]) selectedIndexes.add(index + offset);
    }
  }

  return [...selectedIndexes]
    .sort((a, b) => a - b)
    .map((index) => sorted[index])
    .filter(Boolean)
    .slice(0, 12);
}
