import type { RagChatAnswer } from "@/lib/analysis/openai-rag-chat";
import { documentTypes, type DocumentType } from "@/domain/documents";
import { listLocalDocumentDetails } from "@/lib/documents/local-document-store";
import type { SemanticSearchResult } from "@/lib/search/semantic-search";

const stopWords = new Set([
  "aber",
  "alle",
  "als",
  "auch",
  "auf",
  "aus",
  "bei",
  "bis",
  "das",
  "dem",
  "den",
  "der",
  "des",
  "die",
  "ein",
  "eine",
  "einem",
  "einen",
  "einer",
  "es",
  "für",
  "im",
  "in",
  "ist",
  "mit",
  "nach",
  "oder",
  "sind",
  "und",
  "von",
  "was",
  "welche",
  "welcher",
  "welches",
  "wie",
  "zu",
  "zum",
  "zur"
]);

const semanticGroups = [
  ["risiko", "risiken", "gefahr", "problem", "mangel", "haftung", "verzug", "schaden"],
  ["frist", "fristen", "termin", "termine", "deadline", "kündigung", "kuendigung", "ende"],
  ["zahlung", "zahlbar", "rechnung", "fälligkeit", "faelligkeit", "kosten", "betrag", "honorar"],
  ["vertrag", "vertrags", "vereinbarung", "laufzeit", "auftraggeber", "auftragnehmer"],
  ["mangel", "mängel", "maengel", "beanstandung", "nachbesserung", "abnahme"],
  ["vorbereitung", "vorbereiten", "unterlage", "unterlagen", "nachweis", "prüfung", "pruefung"]
];
const localVectorDimensions = 96;

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9äöüß\s-]/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalize(value)
    .split(/\s+/)
    .map((token) => token.replace(/(ungen|keiten|keit|lich|isch|ern|en|er|es|e|s)$/u, ""))
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

function expandTokens(tokens: string[]) {
  const expanded = new Set(tokens);

  for (const token of tokens) {
    for (const group of semanticGroups) {
      const normalizedGroup = group.map(normalize);

      if (normalizedGroup.some((entry) => entry.startsWith(token) || token.startsWith(entry))) {
        normalizedGroup.forEach((entry) => expanded.add(entry));
      }
    }
  }

  return expanded;
}

function hashToken(token: string) {
  let hash = 2166136261;

  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash);
}

function toLocalVector(tokens: Iterable<string>) {
  const vector = Array.from({ length: localVectorDimensions }, () => 0);

  for (const token of tokens) {
    const hash = hashToken(token);
    const index = hash % localVectorDimensions;
    const sign = hash % 2 === 0 ? 1 : -1;
    vector[index] += sign;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

  if (norm === 0) {
    return vector;
  }

  return vector.map((value) => value / norm);
}

function cosineSimilarity(left: number[], right: number[]) {
  return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}

function splitIntoChunks(text: string) {
  const paragraphs = text
    .split(/\n{2,}|(?<=\.)\s+(?=[A-ZÄÖÜ0-9])/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter((paragraph) => paragraph.length >= 40);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (`${current} ${paragraph}`.length > 1200 && current.length > 0) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = current ? `${current}\n${paragraph}` : paragraph;
    }
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks.length > 0 ? chunks : [text.slice(0, 1200)];
}

function scoreChunk(query: string, queryTokens: Set<string>, content: string) {
  const contentTokens = expandTokens(tokenize(content));
  const queryVector = toLocalVector(queryTokens);
  const contentVector = toLocalVector(contentTokens);
  let hits = 0;

  for (const token of queryTokens) {
    if (
      [...contentTokens].some(
        (contentToken) => contentToken.includes(token) || token.includes(contentToken)
      )
    ) {
      hits += 1;
    }
  }

  const phraseBonus = normalize(content).includes(normalize(query)) ? 0.2 : 0;
  const density = hits / Math.max(queryTokens.size, 1);
  const vectorScore = Math.max(0, cosineSimilarity(queryVector, contentVector));
  const lexicalScore = density * 0.62 + phraseBonus + Math.min(hits, 4) * 0.04;

  return Math.min(0.98, lexicalScore * 0.65 + vectorScore * 0.35);
}

function containsAny(content: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(content));
}

function firstDate(content: string) {
  return content.match(/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/)?.[0] ?? "zu klären";
}

function compactExcerpt(content: string, maxLength = 220) {
  return content.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function isDocumentType(value: string): value is DocumentType {
  return documentTypes.includes(value as DocumentType);
}

function classifyAction(result: SemanticSearchResult) {
  const content = result.content;

  if (/brandschutz|rettungsweg|bauaufsicht|din\s?\d+|baybo|lar/i.test(content)) {
    return {
      action: "Technische Freigabe und Nachweise prüfen",
      owner: "Projektleitung / Fachplanung",
      due: firstDate(content),
      risk: "Compliance-Risiko"
    };
  }

  if (/mangel|mängel|undichtigkeit|durchfeuchtung|wassereintritt|nachbesserung/i.test(content)) {
    return {
      action: "Mangelstatus, Fotos und Fristsetzung prüfen",
      owner: "Bauleitung / Gewerk",
      due: firstDate(content),
      risk: "Projekt- oder Ausführungsrisiko"
    };
  }

  if (/zahlung|rechnung|fälligkeit|kosten|betrag|nachtrag/i.test(content)) {
    return {
      action: "Zahlungs- oder Nachtragslage prüfen",
      owner: "Projektkaufmann / Einkauf",
      due: firstDate(content),
      risk: "Kosten- oder Liquiditätsrisiko"
    };
  }

  if (/vertrag|kündigung|laufzeit|haftung|gewährleistung/i.test(content)) {
    return {
      action: "Vertragsklausel und Fristwirkung prüfen",
      owner: "Vertragsmanagement / Recht",
      due: firstDate(content),
      risk: "Vertragsrisiko"
    };
  }

  return {
    action: "Quelle fachlich prüfen und nächste Entscheidung festlegen",
    owner: "Dokumentverantwortliche Stelle",
    due: firstDate(content),
    risk: "Prüfpunkt"
  };
}

function buildStructuredLocalAnswer(question: string, results: SemanticSearchResult[]) {
  const combined = results.map((result) => result.content).join("\n");
  const risks = results
    .filter((result) =>
      containsAny(result.content, [
        /risiko|gefahr|mangel|mängel|undichtigkeit|durchfeuchtung|haftung|verzug|brandschutz/i
      ])
    )
    .slice(0, 3);
  const deadlines = Array.from(
    new Set(combined.match(/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g) ?? [])
  ).slice(0, 8);
  const preparation = results
    .filter((result) =>
      containsAny(result.content, [/nachweis|prüfung|pruefung|terminplan|stellungnahme|ursache/i])
    )
    .slice(0, 3);
  const actions = results.slice(0, 5).map((result) => ({
    ...classifyAction(result),
    source: result.documentTitle,
    excerpt: compactExcerpt(result.content, 180)
  }));

  const riskLines =
    risks.length > 0
      ? risks
          .map(
            (result) =>
              `- ${result.documentTitle}: ${result.content.replace(/\s+/g, " ").slice(0, 260)}`
          )
          .join("\n")
      : "- Keine eindeutigen Risikohinweise in den gefundenen Quellen.";
  const deadlineLines =
    deadlines.length > 0
      ? deadlines.map((deadline) => `- ${deadline}`).join("\n")
      : "- Keine eindeutigen Datumsangaben in den gefundenen Quellen.";
  const preparationLines =
    preparation.length > 0
      ? preparation
          .map((result) => `- ${result.content.replace(/\s+/g, " ").slice(0, 220)}`)
          .join("\n")
      : "- Quellen prüfen, Verantwortliche klären und offene Nachweise zusammentragen.";
  const actionLines = actions
    .map(
      (action, index) =>
        `${index + 1}. ${action.action}\n   Verantwortlich: ${action.owner}\n   Termin: ${action.due}\n   Risiko: ${action.risk}\n   Quelle: ${action.source} - ${action.excerpt}`
    )
    .join("\n");

  return [
    "Lokale Antwort auf Grundlage der importierten Dokumente.",
    "",
    "Handlungsliste",
    actionLines,
    "",
    "Risiken",
    riskLines,
    "",
    "Fristen",
    deadlineLines,
    "",
    "Vorbereitung",
    preparationLines,
    "",
    "Einordnung",
    "Diese Antwort nutzt nur lokale Dokumentquellen und kein externes Wissen. Dokumente mit OCR-Bedarf werden ausgeschlossen.",
    "",
    `Frage: ${question}`
  ].join("\n");
}

export async function searchLocalDocumentChunks({
  query,
  matchCount,
  filterDocumentTypes = []
}: {
  query: string;
  matchCount: number;
  filterDocumentTypes?: DocumentType[];
}): Promise<SemanticSearchResult[]> {
  const documents = await listLocalDocumentDetails();
  const queryTokens = expandTokens(tokenize(query));
  const results: SemanticSearchResult[] = [];
  const documentTypeFilter = new Set(
    filterDocumentTypes.filter((documentType) => documentTypes.includes(documentType))
  );

  for (const document of documents) {
    if (document.status !== "indexed" || !document.extraction?.extractedText) {
      continue;
    }

    if (
      documentTypeFilter.size > 0 &&
      (!isDocumentType(document.documentType) || !documentTypeFilter.has(document.documentType))
    ) {
      continue;
    }

    const chunks = splitIntoChunks(document.extraction.extractedText);

    chunks.forEach((chunk, index) => {
      const similarity = scoreChunk(query, queryTokens, chunk);

      if (similarity < 0.18) {
        return;
      }

      results.push({
        chunkId: `local-${document.id}-${index}`,
        documentId: document.id,
        documentTitle: document.title,
        content: chunk.slice(0, 1400),
        similarity
      });
    });
  }

  return results.sort((left, right) => right.similarity - left.similarity).slice(0, matchCount);
}

export function answerWithLocalDocumentContext({
  question,
  results
}: {
  question: string;
  results: SemanticSearchResult[];
}): RagChatAnswer {
  if (results.length === 0) {
    return {
      answer:
        "Ich habe in den lokal analysierten Dokumenten keine belastbare Quelle gefunden. Dokumente mit OCR-Bedarf werden nicht verwendet.",
      sources: []
    };
  }

  const topResults = results.slice(0, 4);
  return {
    answer: buildStructuredLocalAnswer(question, topResults),
    sources: topResults.map((result) => ({
      chunkId: result.chunkId,
      documentId: result.documentId,
      documentTitle: result.documentTitle,
      similarity: result.similarity,
      excerpt: result.content.slice(0, 900)
    }))
  };
}
