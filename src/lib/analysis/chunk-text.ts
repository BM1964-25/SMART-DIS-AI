export type TextChunk = {
  chunkIndex: number;
  content: string;
  tokenCount: number;
};

const wordsPerChunk = 520;
const overlapWords = 80;

export function chunkText(text: string): TextChunk[] {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length === 0) {
    return [];
  }

  const words = normalized.split(" ");
  const chunks: TextChunk[] = [];
  let cursor = 0;

  while (cursor < words.length) {
    const chunkWords = words.slice(cursor, cursor + wordsPerChunk);

    if (chunkWords.length === 0) {
      break;
    }

    chunks.push({
      chunkIndex: chunks.length,
      content: chunkWords.join(" "),
      tokenCount: Math.ceil(chunkWords.length * 1.3)
    });

    if (cursor + wordsPerChunk >= words.length) {
      break;
    }

    cursor += wordsPerChunk - overlapWords;
  }

  return chunks;
}
