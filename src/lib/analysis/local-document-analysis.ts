import type { SupportedFileType } from "@/domain/documents";
import type { DocumentDeadlineRecord, DocumentRiskRecord } from "@/domain/document-record";
import { extractTextFromBuffer } from "@/lib/analysis/text-extraction";
import {
  listLocalDocuments,
  readLocalDocumentFile,
  updateLocalDocumentAnalysis
} from "@/lib/documents/local-document-store";
import { evaluateTextQuality } from "@/lib/analysis/text-quality";

type LocalDocumentAnalysisResult = {
  documentId: string;
  documentType: string;
  summary: string;
  extractedTextLength: number;
  riskCount: number;
  deadlineCount: number;
};

type LocalBulkAnalysisResult = {
  analyzedCount: number;
  failed: Array<{
    documentId: string;
    fileName: string;
    error: string;
  }>;
  riskCount: number;
  deadlineCount: number;
};

const supportedLocalAnalysisTypes = new Set(["pdf", "docx", "txt", "csv", "xlsx"]);

type ClassificationRule = {
  documentType: string;
  label: string;
  fileNamePattern: RegExp;
  textPattern: RegExp;
  fileNameWeight: number;
  textWeight: number;
};

const classificationRules: ClassificationRule[] = [
  {
    documentType: "construction_description",
    label: "Baubeschreibung",
    fileNamePattern: /baubeschreibung|leistungsbeschreibung|bau[-_\s]?beschreibung/i,
    textPattern: /baubeschreibung|leistungsbeschreibung|ausstattung|bauleistung|gewerke/i,
    fileNameWeight: 6,
    textWeight: 4
  },
  {
    documentType: "defect_report",
    label: "Mängelbericht",
    fileNamePattern: /mangel|mängel|maengel|defect|nachbegehung/i,
    textPattern: /mangel|mängel|maengel|nachbesserung|abnahme|beanstandung/i,
    fileNameWeight: 6,
    textWeight: 4
  },
  {
    documentType: "cost_list",
    label: "Kostenliste",
    fileNamePattern: /kostenliste|kosten|cost[-_\s]?fee|budget|kalkulation/i,
    textPattern: /kostenliste|kostengruppe|budget|summe|netto|brutto|honorar|kosten/i,
    fileNameWeight: 6,
    textWeight: 3
  },
  {
    documentType: "participant_list",
    label: "Projektbeteiligtenliste",
    fileNamePattern: /projektbeteilig|beteiligtenliste|teilnehmerliste|kontakte|adress/i,
    textPattern: /projektbeteilig|beteiligte|ansprechpartner|telefon|e-mail|email|funktion/i,
    fileNameWeight: 6,
    textWeight: 4
  },
  {
    documentType: "minutes",
    label: "Protokoll",
    fileNamePattern: /protokoll|jour[-_\s]?fixe|\bjf\b|besprechung|meeting/i,
    textPattern: /protokoll|jour fixe|besprechung|teilnehmer|agenda|beschluss|aufgabe/i,
    fileNameWeight: 6,
    textWeight: 4
  },
  {
    documentType: "project_report",
    label: "Bericht",
    fileNamePattern: /bericht|report|managementbericht|statusbericht|projektbericht/i,
    textPattern: /bericht|status|management summary|projektstand|fortschritt|ampel/i,
    fileNameWeight: 5,
    textWeight: 3
  },
  {
    documentType: "plan",
    label: "Plan",
    fileNamePattern: /lageplan|grundriss|plan|_gr_|[-_\s]gr[-_\s]|schnitt|ansicht|mzk_.*_gr_/i,
    textPattern: /lageplan|grundriss|massstab|maßstab|planung|planstand|zeichnung/i,
    fileNameWeight: 7,
    textWeight: 2
  },
  {
    documentType: "contract",
    label: "Vertrag",
    fileNamePattern: /vertrag|gu[-_\s]?vertrag|vereinbarung|rahmenvertrag/i,
    textPattern: /vertrag|auftragnehmer|auftraggeber|vertragsstrafe|kündigung|kuendigung/i,
    fileNameWeight: 6,
    textWeight: 4
  },
  {
    documentType: "proposal",
    label: "Angebot",
    fileNamePattern: /angebot|offerte|kostenschätzung|kostenschaetzung/i,
    textPattern: /angebot|offerte|kostenschätzung|kostenschaetzung|bindefrist/i,
    fileNameWeight: 6,
    textWeight: 3
  },
  {
    documentType: "invoice",
    label: "Rechnung",
    fileNamePattern: /rechnung|invoice|abschlagsrechnung|schlussrechnung/i,
    textPattern: /rechnung|zahlbar|fälligkeit|faelligkeit|abschlagsrechnung|rechnungsnummer/i,
    fileNameWeight: 6,
    textWeight: 4
  },
  {
    documentType: "policy",
    label: "Richtlinie",
    fileNamePattern: /richtlinie|policy|vorgabe|handbuch|anweisung/i,
    textPattern: /richtlinie|policy|vorgabe|verbindlich|regelung|compliance/i,
    fileNameWeight: 5,
    textWeight: 4
  }
];

const riskRules = [
  {
    pattern: /vertragsstrafe|pönale|poenale/i,
    title: "Mögliche Vertragsstrafe",
    category: "Vertrag",
    severity: "high",
    score: 82,
    advice:
      "Vorbereitung: Vertragsklausel, Auslöseereignis, Fristbezug und mögliche Gegenargumente zusammentragen."
  },
  {
    pattern: /haftung|schadensersatz|gewährleistung|gewaehrleistung/i,
    title: "Haftungs- oder Gewährleistungsrisiko",
    category: "Haftung",
    severity: "high",
    score: 78,
    advice:
      "Vorbereitung: Haftungsumfang, Gewährleistungsfrist, Schadensnachweise und Verantwortlichkeiten klären."
  },
  {
    pattern: /kündigung|kuendigung|kündigungsfrist|kuendigungsfrist/i,
    title: "Kündigungsrelevante Regelung",
    category: "Frist",
    severity: "medium",
    score: 66,
    advice:
      "Vorbereitung: Kündigungsfrist, Zugangserfordernis, Vertragslaufzeit und spätestes Handlungsdatum prüfen."
  },
  {
    pattern: /zahlungsverzug|zahlung|fälligkeit|faelligkeit|abschlagszahlung/i,
    title: "Zahlungs- oder Liquiditätsrisiko",
    category: "Zahlung",
    severity: "medium",
    score: 62,
    advice:
      "Vorbereitung: Rechnung, Zahlungsziel, Freigabestatus und offene Nachweise oder Einbehalte prüfen."
  },
  {
    pattern:
      /mangel|mängel|maengel|verzug|behinderung|nachtrag|wassereintritt|durchfeuchtung|undichtigkeit/i,
    title: "Projekt- oder Ausführungsrisiko",
    category: "Projekt",
    severity: "medium",
    score: 68,
    advice:
      "Vorbereitung: Fotodokumentation, Verantwortliche, Fristsetzung, Status der Mangelbeseitigung und Folgeschäden prüfen."
  },
  {
    pattern: /gu-vertrag|vertrag/i,
    title: "Vertragsdokument fachlich prüfen",
    category: "Vertrag",
    severity: "medium",
    score: 58,
    advice:
      "Vorbereitung: Vertragspartner, Leistungsumfang, Laufzeit, Zahlungsbedingungen und Nachtragsregeln extrahieren."
  },
  {
    pattern: /sicherheit|bürgschaft|buergschaft|einbehalt/i,
    title: "Sicherheiten oder Einbehalte prüfen",
    category: "Finanzen",
    severity: "medium",
    score: 60,
    advice:
      "Vorbereitung: Art der Sicherheit, Höhe, Rückgabebedingungen und relevante Fristen gegenüberstellen."
  },
  {
    pattern: /brandschutz|rettungsweg|bauaufsicht|din\s?\d+|baybo|lar/i,
    title: "Regulatorisches oder technisches Compliance-Risiko",
    category: "Compliance",
    severity: "high",
    score: 76,
    advice:
      "Vorbereitung: Normbezug, Prüfvermerk, Verantwortliche und erforderliche Freigaben oder Nachweise sammeln."
  }
];

type LocalClassificationResult = {
  documentType: string;
  confidence: number;
  reason: string;
};

export function classifyLocalDocument(fileName: string, text: string): LocalClassificationResult {
  const normalizedFileName = fileName.toLowerCase();
  const boundedText = text.slice(0, 12000).toLowerCase();
  let bestMatch = {
    documentType: "other",
    label: "Sonstige",
    score: 0,
    matchedFileName: false,
    matchedText: false
  };

  for (const rule of classificationRules) {
    let score = 0;
    const matchedFileName = rule.fileNamePattern.test(normalizedFileName);
    const matchedText = rule.textPattern.test(boundedText);

    if (matchedFileName) {
      score += rule.fileNameWeight;
    }

    if (matchedText) {
      score += rule.textWeight;
    }

    if (score > bestMatch.score) {
      bestMatch = {
        documentType: rule.documentType,
        label: rule.label,
        score,
        matchedFileName,
        matchedText
      };
    }
  }

  if (bestMatch.score < 3) {
    return {
      documentType: "other",
      confidence: 0.35,
      reason:
        "Es wurden keine ausreichend starken Signale im Dateinamen oder extrahierten Text gefunden."
    };
  }

  const confidence = Math.min(0.95, 0.45 + bestMatch.score / 14);
  const signalParts = [
    bestMatch.matchedFileName ? "Dateiname" : null,
    bestMatch.matchedText ? "Dokumenttext" : null
  ].filter(Boolean);

  return {
    documentType: bestMatch.documentType,
    confidence,
    reason: `${bestMatch.label} erkannt anhand von ${signalParts.join(" und ")}.`
  };
}

function createSummary(fileName: string, text: string) {
  const normalizedLines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 20);
  const firstLines = normalizedLines.slice(0, 3).join(" ");
  const summary = firstLines || `Dokument ${fileName} wurde eingelesen.`;

  return summary.length > 700 ? `${summary.slice(0, 697)}...` : summary;
}

function createOcrRequiredSummary(fileName: string) {
  return [
    "Die technische Textextraktion ist nicht belastbar.",
    "Das Dokument wurde registriert und anhand des Dateinamens grob klassifiziert, benötigt aber OCR, bevor Risiken, Fristen oder Inhalte verlässlich bewertet werden.",
    `Betroffene Datei: ${fileName}.`
  ].join(" ");
}

function createSourceExcerpt(text: string, index: number) {
  const lineStart = Math.max(0, text.lastIndexOf("\n", index - 1) + 1);
  const nextLineBreak = text.indexOf("\n", index);
  const lineEnd = nextLineBreak === -1 ? text.length : nextLineBreak;
  const line = text
    .slice(lineStart, lineEnd)
    .replace(/[^\p{L}\p{N}\s.,;:!?()[\]€%/+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (line.length >= 8 && line.length <= 220) {
    return line;
  }

  const start = Math.max(0, index - 120);
  const end = Math.min(text.length, index + 220);

  return text
    .slice(start, end)
    .replace(/[^\p{L}\p{N}\s.,;:!?()[\]€%/+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 420);
}

export function analyzeLocalRisks(documentId: string, text: string): DocumentRiskRecord[] {
  const now = new Date().toISOString();
  const risks: DocumentRiskRecord[] = [];

  for (const rule of riskRules) {
    const match = text.match(rule.pattern);

    if (!match || match.index === undefined) {
      continue;
    }

    risks.push({
      id: crypto.randomUUID(),
      documentId,
      title: rule.title,
      description: `${rule.advice} Die lokale Analyse ist regelbasiert und ersetzt keine rechtliche oder technische Bewertung.`,
      severity: rule.severity,
      category: rule.category,
      riskScore: rule.score,
      sourceExcerpt: createSourceExcerpt(text, match.index),
      confidence: 0.62,
      isReviewed: false,
      createdAt: now,
      updatedAt: now
    });
  }

  return risks.sort((left, right) => (right.riskScore ?? 0) - (left.riskScore ?? 0)).slice(0, 8);
}

function toIsoDate(day: string, month: string, year: string) {
  const normalizedYear = year.length === 2 ? `20${year}` : year;
  const date = new Date(Number(normalizedYear), Number(month) - 1, Number(day));

  if (
    date.getFullYear() !== Number(normalizedYear) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }

  return `${normalizedYear.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function getDeadlineType(context: string) {
  if (/kündigung|kuendigung/i.test(context)) {
    return "Kündigungsfrist";
  }

  if (/vertrag|laufzeit|ende/i.test(context)) {
    return "Vertragsende";
  }

  if (/zahlung|rechnung|fälligkeit|faelligkeit/i.test(context)) {
    return "Zahlungsfrist";
  }

  return "Projekttermin";
}

function getDeadlineTitle(rawDate: string, context: string) {
  const deadlineType = getDeadlineType(context);

  if (/mangel|mängel|maengel|abnahme|nachbesserung/i.test(context)) {
    return `Mangel-/Abnahmetermin: ${rawDate}`;
  }

  if (deadlineType === "Kündigungsfrist") {
    return `Kündigungsrelevante Frist: ${rawDate}`;
  }

  if (deadlineType === "Zahlungsfrist") {
    return `Zahlungsrelevante Frist: ${rawDate}`;
  }

  if (deadlineType === "Vertragsende") {
    return `Vertragsrelevanter Termin: ${rawDate}`;
  }

  return `Projekttermin mit Vorbereitungsbedarf: ${rawDate}`;
}

function getDeadlinePreparationHint(context: string) {
  if (/mangel|mängel|maengel|abnahme|nachbesserung/i.test(context)) {
    return "Vorbereitung: Status der Mangelbeseitigung, Fotodokumentation und Verantwortliche prüfen.";
  }

  if (/kündigung|kuendigung/i.test(context)) {
    return "Vorbereitung: spätestes Versanddatum, Zugangsnachweis und Vertragslaufzeit prüfen.";
  }

  if (/zahlung|rechnung|fälligkeit|faelligkeit/i.test(context)) {
    return "Vorbereitung: Rechnungsfreigabe, Zahlungsziel und offene Nachweise prüfen.";
  }

  return "Vorbereitung: Terminverantwortliche, notwendige Unterlagen und nächste Entscheidung klären.";
}

export function analyzeLocalDeadlines(documentId: string, text: string): DocumentDeadlineRecord[] {
  const now = new Date().toISOString();
  const deadlines: DocumentDeadlineRecord[] = [];
  const seenDates = new Set<string>();
  const datePattern = /\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/g;
  let match: RegExpExecArray | null;

  while ((match = datePattern.exec(text)) && deadlines.length < 20) {
    const isoDate = toIsoDate(match[1], match[2], match[3]);

    if (!isoDate || seenDates.has(isoDate)) {
      continue;
    }

    const context = createSourceExcerpt(text, match.index);
    const contextLooksRelevant =
      /frist|termin|kündigung|kuendigung|vertrag|zahlung|rechnung|ende|beginn|abnahme|fertigstellung|protokoll/i.test(
        context
      );

    if (!contextLooksRelevant) {
      continue;
    }

    seenDates.add(isoDate);
    deadlines.push({
      id: crypto.randomUUID(),
      documentId,
      title: getDeadlineTitle(match[0], context),
      deadlineDate: isoDate,
      deadlineType: getDeadlineType(context),
      status: "open",
      sourceExcerpt: `${context} ${getDeadlinePreparationHint(context)}`,
      confidence: contextLooksRelevant ? 0.68 : 0.52,
      createdAt: now,
      updatedAt: now
    });
  }

  return deadlines.sort((left, right) => left.deadlineDate.localeCompare(right.deadlineDate));
}

export async function analyzeLocalDocument(
  documentId: string
): Promise<LocalDocumentAnalysisResult> {
  const { document, fileBuffer } = await readLocalDocumentFile(documentId);

  if (!supportedLocalAnalysisTypes.has(document.fileType)) {
    throw new Error(`Dateityp ${document.fileType} wird lokal noch nicht analysiert.`);
  }

  const extracted = await extractTextFromBuffer(document.fileType as SupportedFileType, fileBuffer);
  const textQuality = evaluateTextQuality(extracted.text);

  const now = new Date().toISOString();
  const classification = classifyLocalDocument(document.fileName, extracted.text);
  const documentType = classification.documentType;
  const needsOcr = textQuality.quality === "needs_ocr" || textQuality.quality === "none";
  const analysisText = needsOcr ? document.fileName : `${document.fileName}\n${extracted.text}`;
  const summary = needsOcr
    ? createOcrRequiredSummary(document.fileName)
    : createSummary(document.fileName, analysisText);
  const risks = needsOcr ? [] : analyzeLocalRisks(document.id, analysisText);
  const deadlines = needsOcr ? [] : analyzeLocalDeadlines(document.id, analysisText);

  await updateLocalDocumentAnalysis(document.id, {
    documentType,
    status: needsOcr ? "needs_ocr" : "indexed",
    extraction: {
      id: crypto.randomUUID(),
      documentId: document.id,
      summary,
      extractedText: extracted.text,
      classifiedDocumentType: documentType,
      classifiedDocumentTypeConfidence: classification.confidence,
      classifiedDocumentTypeReason: classification.reason,
      confidence: needsOcr ? 0.24 : 0.64,
      analysisModel: "local-mvp-rules",
      promptVersion: "local-2026-06-30",
      createdAt: now,
      updatedAt: now
    },
    risks,
    deadlines
  });

  return {
    documentId: document.id,
    documentType,
    summary,
    extractedTextLength: extracted.text.length,
    riskCount: risks.length,
    deadlineCount: deadlines.length
  };
}

export async function analyzeAllLocalDocuments(): Promise<LocalBulkAnalysisResult> {
  const documents = await listLocalDocuments();
  const result: LocalBulkAnalysisResult = {
    analyzedCount: 0,
    failed: [],
    riskCount: 0,
    deadlineCount: 0
  };

  for (const document of documents) {
    try {
      const analysis = await analyzeLocalDocument(document.id);
      result.analyzedCount += 1;
      result.riskCount += analysis.riskCount;
      result.deadlineCount += analysis.deadlineCount;
    } catch (error) {
      result.failed.push({
        documentId: document.id,
        fileName: document.fileName,
        error: error instanceof Error ? error.message : "Analyse fehlgeschlagen."
      });
    }
  }

  return result;
}
