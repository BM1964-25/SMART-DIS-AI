export type TextQualityLabel = "none" | "needs_ocr" | "basic" | "medium" | "good";

export type TextQualityResult = {
  quality: TextQualityLabel;
  textLength: number;
  readableRatio: number;
  brokenCharRatio: number;
};

const readableCharacterPattern = /[\p{L}\p{N}.,;:!?€%/()-]/u;
const brokenCharacterPattern = /[�□◻]/u;

export function evaluateTextQuality(text: string | null | undefined): TextQualityResult {
  const safeText = text ?? "";
  const visibleCharacters = Array.from(safeText).filter((character) => !/\s/.test(character));
  const visibleCharacterCount = Math.max(1, visibleCharacters.length);
  const readableCharacters = visibleCharacters.filter((character) =>
    readableCharacterPattern.test(character)
  );
  const brokenCharacters = visibleCharacters.filter((character) =>
    brokenCharacterPattern.test(character)
  );
  const readableRatio = readableCharacters.length / visibleCharacterCount;
  const brokenCharRatio = brokenCharacters.length / visibleCharacterCount;

  if (safeText.length === 0) {
    return {
      quality: "none",
      textLength: 0,
      readableRatio: 0,
      brokenCharRatio: 0
    };
  }

  if (brokenCharRatio > 0.08 || readableRatio < 0.55) {
    return {
      quality: "needs_ocr",
      textLength: safeText.length,
      readableRatio,
      brokenCharRatio
    };
  }

  if (safeText.length >= 5_000 && readableRatio >= 0.8) {
    return {
      quality: "good",
      textLength: safeText.length,
      readableRatio,
      brokenCharRatio
    };
  }

  if (safeText.length >= 500 && readableRatio >= 0.7) {
    return {
      quality: "medium",
      textLength: safeText.length,
      readableRatio,
      brokenCharRatio
    };
  }

  return {
    quality: "basic",
    textLength: safeText.length,
    readableRatio,
    brokenCharRatio
  };
}
