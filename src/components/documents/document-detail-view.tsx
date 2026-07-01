"use client";

import {
  ArrowLeft,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  RefreshCcw,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { documentTypeLabels, type DocumentType } from "@/domain/documents";
import type { DocumentDetailRecord } from "@/domain/document-record";
import type { OcrJobRecord } from "@/domain/ocr";

type DetailState =
  | { status: "loading" }
  | { status: "ready"; document: DocumentDetailRecord }
  | { status: "error"; message: string };

type AnalyzeState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type ContractAnalyzeState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type RiskAnalyzeState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type DeadlineAnalyzeState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type SemanticIndexState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type OcrPrepareState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type OcrRunState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

function formatBytes(bytes: number) {
  const megabytes = bytes / 1024 / 1024;
  return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function getDocumentTypeLabel(documentType: string) {
  return documentType in documentTypeLabels
    ? documentTypeLabels[documentType as DocumentType]
    : "Sonstige";
}

function getDocumentStatusTone(status: string) {
  if (status === "needs_ocr" || status === "failed") {
    return "danger";
  }

  if (status === "indexed" || status === "uploaded" || status === "linked") {
    return "success";
  }

  return "neutral";
}

type DocumentDetailViewProps = {
  documentId: string;
  initialDocument?: DocumentDetailRecord | null;
  initialOcrJob?: OcrJobRecord | null;
};

function getExtractedTextPreview(extractedText: string | null | undefined, needsOcr: boolean) {
  if (!extractedText) {
    return "Noch kein Text extrahiert.";
  }

  if (!needsOcr) {
    return extractedText;
  }

  return `${extractedText.slice(0, 1200)}\n\n[Textvorschau gekürzt: OCR erforderlich, vollständige Rohdaten werden wegen niedriger Textqualität nicht direkt gerendert.]`;
}

function getOcrPageText(extractedText: string | null | undefined, page: number) {
  if (!extractedText) {
    return "Kein OCR-Text für diese Seite vorhanden.";
  }

  const marker = `--- OCR Seite ${page} ---`;
  const start = extractedText.indexOf(marker);

  if (start === -1) {
    return extractedText.slice(0, 1800);
  }

  const nextMarker = extractedText.indexOf("--- OCR Seite", start + marker.length);
  const end = nextMarker === -1 ? extractedText.length : nextMarker;

  return extractedText
    .slice(start + marker.length, end)
    .trim()
    .slice(0, 2200);
}

function pageQualityTone(quality: string) {
  return quality === "needs_ocr" || quality === "none" ? "danger" : "success";
}

export function DocumentDetailView({
  documentId,
  initialDocument = null,
  initialOcrJob = null
}: DocumentDetailViewProps) {
  const [detailState, setDetailState] = useState<DetailState>(
    initialDocument ? { status: "ready", document: initialDocument } : { status: "loading" }
  );
  const [analyzeState, setAnalyzeState] = useState<AnalyzeState>({ status: "idle" });
  const [contractAnalyzeState, setContractAnalyzeState] = useState<ContractAnalyzeState>({
    status: "idle"
  });
  const [riskAnalyzeState, setRiskAnalyzeState] = useState<RiskAnalyzeState>({ status: "idle" });
  const [deadlineAnalyzeState, setDeadlineAnalyzeState] = useState<DeadlineAnalyzeState>({
    status: "idle"
  });
  const [semanticIndexState, setSemanticIndexState] = useState<SemanticIndexState>({
    status: "idle"
  });
  const [ocrPrepareState, setOcrPrepareState] = useState<OcrPrepareState>({ status: "idle" });
  const [ocrRunState, setOcrRunState] = useState<OcrRunState>({ status: "idle" });
  const [ocrMaxPages, setOcrMaxPages] = useState(5);
  const [ocrDpi, setOcrDpi] = useState(300);
  const [selectedOcrPage, setSelectedOcrPage] = useState(1);
  const [ocrPreviewZoom, setOcrPreviewZoom] = useState(100);
  const [ocrJob, setOcrJob] = useState<OcrJobRecord | null>(initialOcrJob);

  const loadDocument = useCallback(async () => {
    setDetailState({ status: "loading" });

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        cache: "no-store"
      });
      const payload = await response.json();

      if (!response.ok) {
        setDetailState({
          status: "error",
          message:
            typeof payload.error === "string"
              ? payload.error
              : "Dokument konnte nicht geladen werden."
        });
        return;
      }

      setDetailState({ status: "ready", document: payload.document });
    } catch {
      setDetailState({ status: "error", message: "Dokument konnte nicht geladen werden." });
    }
  }, [documentId]);

  async function analyzeDocument() {
    setAnalyzeState({ status: "running" });

    try {
      const response = await fetch(`/api/documents/${documentId}/analyze`, {
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok) {
        setAnalyzeState({
          status: "error",
          message: typeof payload.error === "string" ? payload.error : "Analyse fehlgeschlagen."
        });
        await loadDocument();
        return;
      }

      setAnalyzeState({
        status: "success",
        message: `Analyse abgeschlossen. Dokumenttyp: ${getDocumentTypeLabel(payload.documentType)}`
      });
      await loadDocument();
    } catch {
      setAnalyzeState({ status: "error", message: "Analyse konnte nicht gestartet werden." });
    }
  }

  async function analyzeContract() {
    setContractAnalyzeState({ status: "running" });

    try {
      const response = await fetch(`/api/documents/${documentId}/contract-analysis`, {
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok) {
        setContractAnalyzeState({
          status: "error",
          message:
            typeof payload.error === "string" ? payload.error : "Vertragsanalyse fehlgeschlagen."
        });
        await loadDocument();
        return;
      }

      setContractAnalyzeState({
        status: "success",
        message: "Vertragsanalyse abgeschlossen."
      });
      await loadDocument();
    } catch {
      setContractAnalyzeState({
        status: "error",
        message: "Vertragsanalyse konnte nicht gestartet werden."
      });
    }
  }

  async function analyzeRisks() {
    setRiskAnalyzeState({ status: "running" });

    try {
      const response = await fetch(`/api/documents/${documentId}/risk-analysis`, {
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok) {
        setRiskAnalyzeState({
          status: "error",
          message:
            typeof payload.error === "string" ? payload.error : "Risikoanalyse fehlgeschlagen."
        });
        await loadDocument();
        return;
      }

      setRiskAnalyzeState({
        status: "success",
        message: `${payload.riskCount} Risiken erkannt. Max Score: ${payload.maxRiskScore}`
      });
      await loadDocument();
    } catch {
      setRiskAnalyzeState({
        status: "error",
        message: "Risikoanalyse konnte nicht gestartet werden."
      });
    }
  }

  async function analyzeDeadlines() {
    setDeadlineAnalyzeState({ status: "running" });

    try {
      const response = await fetch(`/api/documents/${documentId}/deadline-analysis`, {
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok) {
        setDeadlineAnalyzeState({
          status: "error",
          message:
            typeof payload.error === "string" ? payload.error : "Fristenerkennung fehlgeschlagen."
        });
        await loadDocument();
        return;
      }

      setDeadlineAnalyzeState({
        status: "success",
        message: `${payload.deadlineCount} Fristen erkannt.`
      });
      await loadDocument();
    } catch {
      setDeadlineAnalyzeState({
        status: "error",
        message: "Fristenerkennung konnte nicht gestartet werden."
      });
    }
  }

  async function indexSemantically() {
    setSemanticIndexState({ status: "running" });

    try {
      const response = await fetch(`/api/documents/${documentId}/semantic-index`, {
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok) {
        setSemanticIndexState({
          status: "error",
          message:
            typeof payload.error === "string"
              ? payload.error
              : "Semantische Indexierung fehlgeschlagen."
        });
        await loadDocument();
        return;
      }

      setSemanticIndexState({
        status: "success",
        message: `${payload.chunkCount} Such-Chunks indexiert.`
      });
      await loadDocument();
    } catch {
      setSemanticIndexState({
        status: "error",
        message: "Semantische Indexierung konnte nicht gestartet werden."
      });
    }
  }

  async function prepareOcrPipeline() {
    setOcrPrepareState({ status: "running" });

    try {
      const response = await fetch(`/api/documents/${documentId}/ocr-preparation`, {
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok) {
        setOcrPrepareState({
          status: "error",
          message:
            typeof payload.error === "string" ? payload.error : "OCR-Vorbereitung fehlgeschlagen."
        });
        return;
      }

      setOcrPrepareState({
        status: "success",
        message: `OCR-Job vorbereitet. Empfohlener Provider: ${payload.ocrJob.recommendedProvider}.`
      });
      setOcrJob(payload.ocrJob);
    } catch {
      setOcrPrepareState({
        status: "error",
        message: "OCR-Vorbereitung konnte nicht gestartet werden."
      });
    }
  }

  async function runOcrPipeline() {
    setOcrRunState({ status: "running" });

    try {
      const response = await fetch(`/api/documents/${documentId}/ocr`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          maxPages: ocrMaxPages,
          dpi: ocrDpi
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        setOcrRunState({
          status: "error",
          message:
            typeof payload.error === "string" ? payload.error : "OCR-Ausführung fehlgeschlagen."
        });
        await loadDocument();
        return;
      }

      setOcrRunState({
        status: "success",
        message: `OCR abgeschlossen. ${payload.processedPages} Seite(n), ${ocrDpi} DPI, Status: ${payload.status}.`
      });
      await loadDocument();
    } catch {
      setOcrRunState({
        status: "error",
        message: "OCR konnte nicht gestartet werden."
      });
    }
  }

  useEffect(() => {
    if (initialDocument) {
      return;
    }

    let ignore = false;

    fetch(`/api/documents/${documentId}`, {
      cache: "no-store"
    })
      .then(async (response) => {
        const payload = await response.json();

        if (ignore) {
          return;
        }

        if (!response.ok) {
          setDetailState({
            status: "error",
            message:
              typeof payload.error === "string"
                ? payload.error
                : "Dokument konnte nicht geladen werden."
          });
          return;
        }

        setDetailState({ status: "ready", document: payload.document });
      })
      .catch(() => {
        if (!ignore) {
          setDetailState({ status: "error", message: "Dokument konnte nicht geladen werden." });
        }
      });

    return () => {
      ignore = true;
    };
  }, [documentId, initialDocument]);

  if (detailState.status === "loading") {
    return (
      <main className="rounded-lg border border-border bg-surface p-8 shadow-subtle">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Dokument wird geladen.
        </div>
      </main>
    );
  }

  if (detailState.status === "error") {
    return (
      <main className="space-y-5">
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Zurück zum Upload
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          {detailState.message}
        </div>
      </main>
    );
  }

  const document = detailState.document;
  const extraction = document.extraction;
  const needsOcr = document.status === "needs_ocr" || document.analysisQuality === "needs_ocr";
  const canRunLocalOcr = document.fileType === "pdf";
  const ocrPages = extraction?.ocrPages ?? [];
  const selectedOcrPageText = getOcrPageText(extraction?.extractedText, selectedOcrPage);
  const selectedOcrPageIndex = ocrPages.findIndex((page) => page.page === selectedOcrPage);
  const previousOcrPage = ocrPages[Math.max(0, selectedOcrPageIndex - 1)]?.page ?? selectedOcrPage;
  const nextOcrPage =
    ocrPages[Math.min(ocrPages.length - 1, selectedOcrPageIndex + 1)]?.page ?? selectedOcrPage;

  return (
    <main className="space-y-6">
      <Link
        href="/upload"
        className="inline-flex items-center gap-2 text-sm font-medium text-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Zurück zum Upload
      </Link>

      <section className="rounded-lg border border-border bg-surface px-6 py-7 shadow-subtle md:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeader
            eyebrow="Dokument"
            title={document.title}
            description={`${document.fileName} · ${formatBytes(document.sizeBytes)} · ${formatDate(document.createdAt)}`}
          />
          <button
            type="button"
            onClick={() => void analyzeDocument()}
            disabled={analyzeState.status === "running"}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {analyzeState.status === "running" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <BrainCircuit className="h-4 w-4" aria-hidden="true" />
            )}
            Dokument analysieren
          </button>
          <button
            type="button"
            onClick={() => void analyzeContract()}
            disabled={contractAnalyzeState.status === "running" || !document.extraction}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-white px-4 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {contractAnalyzeState.status === "running" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <BrainCircuit className="h-4 w-4" aria-hidden="true" />
            )}
            Vertrag analysieren
          </button>
          {canRunLocalOcr ? (
            <>
              <button
                type="button"
                onClick={() => void prepareOcrPipeline()}
                disabled={ocrPrepareState.status === "running"}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {ocrPrepareState.status === "running" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <FileText className="h-4 w-4" aria-hidden="true" />
                )}
                OCR vorbereiten
              </button>
              <button
                type="button"
                onClick={() => void runOcrPipeline()}
                disabled={ocrRunState.status === "running"}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-red-600 px-4 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {ocrRunState.status === "running" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <FileText className="h-4 w-4" aria-hidden="true" />
                )}
                {needsOcr ? "OCR ausführen" : "OCR erneut ausführen"}
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => void analyzeRisks()}
            disabled={riskAnalyzeState.status === "running" || !document.extraction || needsOcr}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-white px-4 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {riskAnalyzeState.status === "running" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <BrainCircuit className="h-4 w-4" aria-hidden="true" />
            )}
            Risiken analysieren
          </button>
          <button
            type="button"
            onClick={() => void analyzeDeadlines()}
            disabled={deadlineAnalyzeState.status === "running" || !document.extraction || needsOcr}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-white px-4 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deadlineAnalyzeState.status === "running" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <BrainCircuit className="h-4 w-4" aria-hidden="true" />
            )}
            Fristen erkennen
          </button>
          <button
            type="button"
            onClick={() => void indexSemantically()}
            disabled={semanticIndexState.status === "running" || !document.extraction || needsOcr}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-white px-4 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {semanticIndexState.status === "running" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <BrainCircuit className="h-4 w-4" aria-hidden="true" />
            )}
            Semantisch indexieren
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <StatusBadge tone={getDocumentStatusTone(document.status)}>{document.status}</StatusBadge>
          <StatusBadge tone={extraction ? "success" : "neutral"}>
            {extraction ? "Analyse vorhanden" : "Noch nicht analysiert"}
          </StatusBadge>
          <StatusBadge tone="neutral">{getDocumentTypeLabel(document.documentType)}</StatusBadge>
          <StatusBadge tone={document.contractAnalysis ? "success" : "neutral"}>
            {document.contractAnalysis ? "Vertragsanalyse vorhanden" : "Keine Vertragsanalyse"}
          </StatusBadge>
          <StatusBadge tone={document.risks.length > 0 ? "warning" : "neutral"}>
            {document.risks.length} Risiken
          </StatusBadge>
          <StatusBadge tone={document.deadlines.length > 0 ? "warning" : "neutral"}>
            {document.deadlines.length} Fristen
          </StatusBadge>
        </div>

        {needsOcr ? (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
            Die Textqualität ist niedrig. Dieses Ergebnis ist ein technischer Extraktionsbefund,
            keine belastbare Inhaltsanalyse. Für Risiken, Fristen und semantische Suche sollte
            dieses Dokument per OCR erneut verarbeitet werden.
          </div>
        ) : null}

        {canRunLocalOcr ? (
          <div className="mt-5 grid gap-4 rounded-lg border border-border bg-white p-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-foreground">
              OCR-Seitenlimit
              <input
                type="number"
                min={1}
                max={25}
                value={ocrMaxPages}
                onChange={(event) => setOcrMaxPages(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-border px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-blue-500/10"
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-foreground">
              OCR-DPI
              <input
                type="number"
                min={150}
                max={450}
                step={50}
                value={ocrDpi}
                onChange={(event) => setOcrDpi(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-border px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-blue-500/10"
              />
            </label>
          </div>
        ) : null}

        {ocrJob ? (
          <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
            OCR vorbereitet: Job <span className="font-medium">{ocrJob.status}</span>, empfohlener
            Provider <span className="font-medium">{ocrJob.recommendedProvider}</span>. Quelle:{" "}
            {ocrJob.sourceKind === "linked_folder" ? "lokaler Ordner" : "Storage"}.
          </div>
        ) : null}

        {analyzeState.status === "success" || analyzeState.status === "error" ? (
          <div
            className={[
              "mt-5 rounded-lg border p-4 text-sm",
              analyzeState.status === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            ].join(" ")}
          >
            {analyzeState.message}
          </div>
        ) : null}

        {contractAnalyzeState.status === "success" || contractAnalyzeState.status === "error" ? (
          <div
            className={[
              "mt-5 rounded-lg border p-4 text-sm",
              contractAnalyzeState.status === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            ].join(" ")}
          >
            {contractAnalyzeState.message}
          </div>
        ) : null}

        {riskAnalyzeState.status === "success" || riskAnalyzeState.status === "error" ? (
          <div
            className={[
              "mt-5 rounded-lg border p-4 text-sm",
              riskAnalyzeState.status === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            ].join(" ")}
          >
            {riskAnalyzeState.message}
          </div>
        ) : null}

        {deadlineAnalyzeState.status === "success" || deadlineAnalyzeState.status === "error" ? (
          <div
            className={[
              "mt-5 rounded-lg border p-4 text-sm",
              deadlineAnalyzeState.status === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            ].join(" ")}
          >
            {deadlineAnalyzeState.message}
          </div>
        ) : null}

        {semanticIndexState.status === "success" || semanticIndexState.status === "error" ? (
          <div
            className={[
              "mt-5 rounded-lg border p-4 text-sm",
              semanticIndexState.status === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            ].join(" ")}
          >
            {semanticIndexState.message}
          </div>
        ) : null}

        {ocrPrepareState.status === "success" || ocrPrepareState.status === "error" ? (
          <div
            className={[
              "mt-5 rounded-lg border p-4 text-sm",
              ocrPrepareState.status === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            ].join(" ")}
          >
            {ocrPrepareState.message}
          </div>
        ) : null}

        {ocrRunState.status === "success" || ocrRunState.status === "error" ? (
          <div
            className={[
              "mt-5 rounded-lg border p-4 text-sm",
              ocrRunState.status === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            ].join(" ")}
          >
            {ocrRunState.message}
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-lg border border-border bg-surface p-6 shadow-subtle">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">Analyseergebnis</h2>
            <button
              type="button"
              onClick={() => void loadDocument()}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              Aktualisieren
            </button>
          </div>

          {extraction ? (
            <div className="mt-5 space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Erkannter Dokumenttyp
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {getDocumentTypeLabel(extraction.classifiedDocumentType ?? document.documentType)}
                </p>
                {extraction.classifiedDocumentTypeConfidence !== null &&
                extraction.classifiedDocumentTypeConfidence !== undefined ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Confidence: {Math.round(extraction.classifiedDocumentTypeConfidence * 100)}%
                  </p>
                ) : null}
                {extraction.classifiedDocumentTypeReason ? (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {extraction.classifiedDocumentTypeReason}
                  </p>
                ) : null}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Zusammenfassung
                </p>
                <p className="mt-2 text-sm leading-7 text-foreground">
                  {extraction.summary ?? "Keine Zusammenfassung gespeichert."}
                </p>
              </div>
              {needsOcr ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
                  OCR erforderlich: Der extrahierte Text enthält zu viele nicht lesbare Zeichen oder
                  zu wenig verwertbaren Inhalt.
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">Confidence</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {extraction.confidence !== null
                      ? `${Math.round(extraction.confidence * 100)}%`
                      : "-"}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">Modell</p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {extraction.analysisModel ?? "-"}
                  </p>
                </div>
              </div>
              {extraction.ocrPages && extraction.ocrPages.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    OCR-Seitenqualität
                  </p>
                  <div className="mt-3 grid gap-2">
                    {extraction.ocrPages.map((page) => (
                      <div
                        key={page.page}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-white px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-foreground">Seite {page.page}</span>
                        <span className="text-muted-foreground">
                          {page.textLength} Zeichen · {Math.round(page.readableRatio * 100)}% lesbar
                          · {Math.round(page.brokenCharRatio * 100)}% defekt
                        </span>
                        <StatusBadge tone={page.quality === "needs_ocr" ? "danger" : "success"}>
                          {page.quality}
                        </StatusBadge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">
              Noch keine Analyse gespeichert. Starte die Analyse über den Button oben.
            </div>
          )}
        </article>

        <article className="rounded-lg border border-border bg-surface p-6 shadow-subtle">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-foreground">Extrahierter Text</h2>
          </div>
          <div className="mt-5 max-h-[560px] overflow-auto rounded-lg border border-border bg-white p-4">
            <pre className="whitespace-pre-wrap text-sm leading-6 text-foreground">
              {getExtractedTextPreview(extraction?.extractedText, needsOcr)}
            </pre>
          </div>
        </article>
      </section>

      {ocrPages.length > 0 ? (
        <section className="rounded-lg border border-border bg-surface p-6 shadow-subtle">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <SectionHeader
              eyebrow="OCR Review"
              title="Seitenqualität prüfen"
              description="OCR-Ergebnis pro Seite kontrollieren und bei Bedarf mit anderem Seitenlimit oder DPI erneut ausführen."
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
              <label className="space-y-2 text-sm font-medium text-foreground">
                Seitenlimit
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={ocrMaxPages}
                  onChange={(event) => setOcrMaxPages(Number(event.target.value))}
                  className="h-10 w-full rounded-md border border-border px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-blue-500/10"
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-foreground">
                DPI
                <input
                  type="number"
                  min={150}
                  max={450}
                  step={50}
                  value={ocrDpi}
                  onChange={(event) => setOcrDpi(Number(event.target.value))}
                  className="h-10 w-full rounded-md border border-border px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-blue-500/10"
                />
              </label>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
            <div className="space-y-3">
              {ocrPages.map((page) => (
                <button
                  key={page.page}
                  type="button"
                  onClick={() => setSelectedOcrPage(page.page)}
                  className={[
                    "w-full rounded-lg border p-4 text-left transition",
                    selectedOcrPage === page.page
                      ? "border-primary bg-blue-50"
                      : "border-border bg-white hover:bg-muted/40"
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-foreground">Seite {page.page}</span>
                    <StatusBadge tone={pageQualityTone(page.quality)}>{page.quality}</StatusBadge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <span>{page.textLength} Zeichen</span>
                    <span>{Math.round(page.readableRatio * 100)}% lesbar</span>
                    <span>{Math.round(page.brokenCharRatio * 100)}% defekt</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-lg border border-border bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Seitenbild {selectedOcrPage}
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedOcrPage(previousOcrPage)}
                      disabled={selectedOcrPageIndex <= 0}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-white text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Vorherige OCR-Seite"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedOcrPage(nextOcrPage)}
                      disabled={
                        selectedOcrPageIndex === -1 || selectedOcrPageIndex >= ocrPages.length - 1
                      }
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-white text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Nächste OCR-Seite"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setOcrPreviewZoom((value) => Math.max(60, value - 20))}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-white text-foreground transition hover:bg-muted"
                      aria-label="OCR-Vorschau verkleinern"
                    >
                      <ZoomOut className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <span className="min-w-12 text-center text-xs text-muted-foreground">
                      {ocrPreviewZoom}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setOcrPreviewZoom((value) => Math.min(180, value + 20))}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-white text-foreground transition hover:bg-muted"
                      aria-label="OCR-Vorschau vergrößern"
                    >
                      <ZoomIn className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div className="mt-4 max-h-[520px] overflow-auto rounded-md border border-border bg-muted">
                  <Image
                    src={`/api/documents/${documentId}/ocr-preview?page=${selectedOcrPage}&dpi=${Math.min(ocrDpi, 300)}`}
                    alt={`OCR-Seitenvorschau Seite ${selectedOcrPage}`}
                    width={900}
                    height={1200}
                    unoptimized
                    className="mx-auto h-auto w-full max-w-full bg-white object-contain"
                    style={{ width: `${ocrPreviewZoom}%`, maxWidth: "none" }}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    Textvorschau Seite {selectedOcrPage}
                  </h3>
                  <button
                    type="button"
                    onClick={() => void runOcrPipeline()}
                    disabled={ocrRunState.status === "running"}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {ocrRunState.status === "running" ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <RefreshCcw className="h-4 w-4" aria-hidden="true" />
                    )}
                    OCR neu starten
                  </button>
                </div>
                <pre className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 text-sm leading-6 text-foreground">
                  {selectedOcrPageText}
                </pre>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-border bg-surface p-6 shadow-subtle">
        <div className="flex items-center justify-between gap-3">
          <SectionHeader
            eyebrow="Vertragsanalyse"
            title="Strukturierte Vertragsdaten"
            description="Automatisch extrahierte Vertragsinformationen aus dem analysierten Dokumenttext."
          />
        </div>

        {document.contractAnalysis ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <ContractField
              label="Vertragspartner"
              value={
                document.contractAnalysis.contractPartners.length > 0
                  ? document.contractAnalysis.contractPartners.join(", ")
                  : null
              }
            />
            <ContractField label="Vertragsbeginn" value={document.contractAnalysis.contractStart} />
            <ContractField label="Vertragsende" value={document.contractAnalysis.contractEnd} />
            <ContractField
              label="Kündigungsfrist"
              value={document.contractAnalysis.terminationNotice}
            />
            <ContractField
              label="Vertragswert"
              value={
                document.contractAnalysis.contractValueAmount !== null
                  ? `${document.contractAnalysis.contractValueAmount.toLocaleString("de-DE")} ${document.contractAnalysis.contractValueCurrency ?? ""}`.trim()
                  : null
              }
            />
            <ContractField
              label="Zahlungsbedingungen"
              value={document.contractAnalysis.paymentTerms}
            />
            <ContractField
              label="Vertragsstrafen"
              value={document.contractAnalysis.contractualPenalties}
            />
            <ContractField label="Haftung" value={document.contractAnalysis.liability} />
            <ContractField
              label="Automatische Verlängerungen"
              value={document.contractAnalysis.automaticRenewal}
            />
            <ContractField
              label="Confidence"
              value={
                document.contractAnalysis.confidence !== null
                  ? `${Math.round(document.contractAnalysis.confidence * 100)}%`
                  : null
              }
            />
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">
            Noch keine Vertragsanalyse gespeichert. Führe zuerst die Dokumentenanalyse aus und
            starte danach die Vertragsanalyse.
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-surface p-6 shadow-subtle">
        <SectionHeader
          eyebrow="Risikoanalyse"
          title="Erkannte Risiken"
          description="Risiko Score, Kategorie und Begründung aus dem analysierten Dokumenttext."
        />

        {document.risks.length > 0 ? (
          <div className="mt-6 grid gap-4">
            {document.risks.map((risk) => (
              <article key={risk.id} className="rounded-lg border border-border bg-white p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{risk.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {risk.category} · {risk.severity}
                    </p>
                  </div>
                  <span className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-white">
                    Score {risk.riskScore ?? 0}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-7 text-foreground">{risk.description}</p>
                {risk.sourceExcerpt ? (
                  <blockquote className="mt-4 rounded-lg border-l-4 border-border bg-muted p-4 text-sm leading-6 text-muted-foreground">
                    {risk.sourceExcerpt}
                  </blockquote>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">
            Noch keine Risiken gespeichert. Führe zuerst die Dokumentenanalyse aus und starte danach
            die Risikoanalyse.
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-surface p-6 shadow-subtle">
        <SectionHeader
          eyebrow="Fristenerkennung"
          title="Erkannte Fristen"
          description="Kündigungsfristen, Vertragsenden, Zahlungsfristen und Projekttermine aus dem analysierten Dokumenttext."
        />

        {document.deadlines.length > 0 ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {document.deadlines.map((deadline) => (
              <article key={deadline.id} className="rounded-lg border border-border bg-white p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{deadline.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {deadline.deadlineType} · {deadline.status}
                    </p>
                  </div>
                  <span className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-white">
                    {formatDate(deadline.deadlineDate)}
                  </span>
                </div>
                {deadline.sourceExcerpt ? (
                  <blockquote className="mt-4 rounded-lg border-l-4 border-border bg-muted p-4 text-sm leading-6 text-muted-foreground">
                    {deadline.sourceExcerpt}
                  </blockquote>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">
            Noch keine Fristen gespeichert. Führe zuerst die Dokumentenanalyse aus und starte danach
            die Fristenerkennung.
          </div>
        )}
      </section>
    </main>
  );
}

function ContractField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm leading-6 text-foreground">{value ?? "Nicht eindeutig erkannt"}</p>
    </div>
  );
}
