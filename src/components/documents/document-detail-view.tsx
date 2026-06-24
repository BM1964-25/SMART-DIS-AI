"use client";

import { ArrowLeft, BrainCircuit, FileText, Loader2, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { documentTypeLabels, type DocumentType } from "@/domain/documents";
import type { DocumentDetailRecord } from "@/domain/document-record";

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

export function DocumentDetailView({ documentId }: { documentId: string }) {
  const [detailState, setDetailState] = useState<DetailState>({ status: "loading" });
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

  useEffect(() => {
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
  }, [documentId]);

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
          Zurueck zum Upload
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          {detailState.message}
        </div>
      </main>
    );
  }

  const document = detailState.document;
  const extraction = document.extraction;

  return (
    <main className="space-y-6">
      <Link
        href="/upload"
        className="inline-flex items-center gap-2 text-sm font-medium text-primary"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Zurueck zum Upload
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
          <button
            type="button"
            onClick={() => void analyzeRisks()}
            disabled={riskAnalyzeState.status === "running" || !document.extraction}
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
            disabled={deadlineAnalyzeState.status === "running" || !document.extraction}
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
            disabled={semanticIndexState.status === "running" || !document.extraction}
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
          <StatusBadge tone="neutral">{document.status}</StatusBadge>
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
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Zusammenfassung
                </p>
                <p className="mt-2 text-sm leading-7 text-foreground">
                  {extraction.summary ?? "Keine Zusammenfassung gespeichert."}
                </p>
              </div>
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
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">
              Noch keine Analyse gespeichert. Starte die Analyse ueber den Button oben.
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
              {extraction?.extractedText ?? "Noch kein Text extrahiert."}
            </pre>
          </div>
        </article>
      </section>

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
            Noch keine Vertragsanalyse gespeichert. Fuehre zuerst die Dokumentenanalyse aus und
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
            Noch keine Risiken gespeichert. Fuehre zuerst die Dokumentenanalyse aus und starte
            danach die Risikoanalyse.
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
            Noch keine Fristen gespeichert. Fuehre zuerst die Dokumentenanalyse aus und starte
            danach die Fristenerkennung.
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
