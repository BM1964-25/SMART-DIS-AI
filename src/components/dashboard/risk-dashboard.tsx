"use client";

import { AlertTriangle, Loader2, Play, Save, ShieldAlert, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { documentTypeLabels, type DocumentType } from "@/domain/documents";

type DashboardRisk = {
  id: string;
  documentId: string;
  documentTitle: string;
  title: string;
  category: string;
  severity: string;
  riskScore: number | null;
  reasoning: string;
};

type DashboardData = {
  documentCount: number;
  riskCount: number;
  averageRiskScore: number;
  highRiskCount: number;
  documentStatusDistribution: Array<{ status: string; count: number }>;
  ocrQueue: Array<{
    id: string;
    title: string;
    fileName: string;
    documentType: string;
    status: string;
    textLength: number;
    readableRatio: number;
    brokenCharRatio: number;
    priorityScore: number;
    priorityReason: string;
  }>;
  risksByCategory: Array<{ category: string; count: number }>;
  topRisks: DashboardRisk[];
};

type DashboardState =
  | { status: "loading" }
  | { status: "ready"; data: DashboardData }
  | { status: "error"; message: string };
type OcrActionState =
  | { status: "idle" }
  | { status: "running"; documentId: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };
type PriorityRulesState =
  | { status: "loading" }
  | { status: "ready"; rules: Record<string, number> }
  | { status: "saving"; rules: Record<string, number> }
  | { status: "error"; message: string; rules: Record<string, number> };

function scoreColor(score: number | null) {
  if ((score ?? 0) >= 80) {
    return "bg-red-600";
  }

  if ((score ?? 0) >= 60) {
    return "bg-amber-500";
  }

  return "bg-emerald-600";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    indexed: "Analysiert",
    needs_ocr: "OCR erforderlich",
    uploaded: "Hochgeladen",
    linked: "Verknüpft",
    processing: "In Verarbeitung",
    failed: "Fehlgeschlagen"
  };

  return labels[status] ?? status;
}

function statusBarColor(status: string) {
  if (status === "needs_ocr" || status === "failed") {
    return "bg-red-500";
  }

  if (status === "indexed") {
    return "bg-emerald-600";
  }

  if (status === "uploaded" || status === "linked") {
    return "bg-blue-600";
  }

  return "bg-slate-500";
}

function documentTypeLabel(documentType: string) {
  return documentType in documentTypeLabels
    ? documentTypeLabels[documentType as DocumentType]
    : "Sonstige";
}

export function RiskDashboard() {
  const [state, setState] = useState<DashboardState>({ status: "loading" });
  const [ocrActionState, setOcrActionState] = useState<OcrActionState>({ status: "idle" });
  const [priorityRulesState, setPriorityRulesState] = useState<PriorityRulesState>({
    status: "loading"
  });

  const loadDashboard = useCallback(() => {
    fetch("/api/dashboard", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();

        if (!response.ok) {
          setState({
            status: "error",
            message:
              typeof payload.error === "string"
                ? payload.error
                : "Dashboard konnte nicht geladen werden."
          });
          return;
        }

        setState({ status: "ready", data: payload });
      })
      .catch(() => {
        setState({ status: "error", message: "Dashboard konnte nicht geladen werden." });
      });
  }, []);

  useEffect(() => {
    loadDashboard();

    fetch("/api/ocr-priority-rules", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();

        if (!response.ok) {
          setPriorityRulesState({
            status: "error",
            message:
              typeof payload.error === "string"
                ? payload.error
                : "Prioritätsregeln konnten nicht geladen werden.",
            rules: {}
          });
          return;
        }

        setPriorityRulesState({ status: "ready", rules: payload.rules ?? {} });
      })
      .catch(() => {
        setPriorityRulesState({
          status: "error",
          message: "Prioritätsregeln konnten nicht geladen werden.",
          rules: {}
        });
      });
  }, [loadDashboard]);

  async function startOcr(documentId: string) {
    setOcrActionState({ status: "running", documentId });

    try {
      const response = await fetch(`/api/documents/${documentId}/ocr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxPages: 5, dpi: 300 })
      });
      const payload = await response.json();

      if (!response.ok) {
        setOcrActionState({
          status: "error",
          message: typeof payload.error === "string" ? payload.error : "OCR konnte nicht starten."
        });
        return;
      }

      setOcrActionState({
        status: "success",
        message: `OCR abgeschlossen: ${payload.processedPages} Seite(n), Status ${payload.status}. Automatische Analyse: ${payload.riskCount ?? 0} Risiken, ${payload.deadlineCount ?? 0} Fristen.`
      });
      loadDashboard();
    } catch {
      setOcrActionState({ status: "error", message: "OCR konnte nicht gestartet werden." });
    }
  }

  async function savePriorityRules() {
    const currentRules =
      priorityRulesState.status === "ready" ||
      priorityRulesState.status === "saving" ||
      priorityRulesState.status === "error"
        ? priorityRulesState.rules
        : {};
    setPriorityRulesState({ status: "saving", rules: currentRules });

    try {
      const response = await fetch("/api/ocr-priority-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: currentRules })
      });
      const payload = await response.json();

      if (!response.ok) {
        setPriorityRulesState({
          status: "error",
          message:
            typeof payload.error === "string"
              ? payload.error
              : "Prioritätsregeln konnten nicht gespeichert werden.",
          rules: currentRules
        });
        return;
      }

      setPriorityRulesState({ status: "ready", rules: payload.rules ?? currentRules });
      loadDashboard();
    } catch {
      setPriorityRulesState({
        status: "error",
        message: "Prioritätsregeln konnten nicht gespeichert werden.",
        rules: currentRules
      });
    }
  }

  function updatePriorityRule(documentType: string, value: number) {
    const currentRules =
      priorityRulesState.status === "ready" ||
      priorityRulesState.status === "saving" ||
      priorityRulesState.status === "error"
        ? priorityRulesState.rules
        : {};

    setPriorityRulesState({
      status: "ready",
      rules: {
        ...currentRules,
        [documentType]: value
      }
    });
  }

  if (state.status === "loading") {
    return (
      <section className="rounded-lg border border-border bg-surface p-6 shadow-subtle">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Risikodashboard wird geladen.
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        {state.message}
      </section>
    );
  }

  const maxCategoryCount = Math.max(1, ...state.data.risksByCategory.map((entry) => entry.count));

  return (
    <section className="rounded-lg border border-border bg-surface p-6 shadow-subtle">
      <SectionHeader
        eyebrow="Risikoanalyse"
        title="Risikodashboard"
        description="Aggregierte Risiken aus analysierten Dokumenten mit Score, Kategorie und Begründung."
      />

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <RiskMetric label="Dokumente" value={state.data.documentCount} />
        <RiskMetric label="Risiken" value={state.data.riskCount} />
        <RiskMetric label="Ø Risiko Score" value={state.data.averageRiskScore} />
      </div>

      <div className="mt-6 rounded-lg border border-border bg-white p-5">
        <div className="flex items-center gap-2">
          <FileStatusIcon />
          <h3 className="text-sm font-semibold text-foreground">Dokumentstatus</h3>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {state.data.documentStatusDistribution.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Dokumente vorhanden.</p>
          ) : (
            state.data.documentStatusDistribution.map((entry) => (
              <div key={entry.status} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-foreground">{statusLabel(entry.status)}</span>
                  <span className="text-muted-foreground">{entry.count}</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-muted">
                  <div
                    className={`h-2 rounded-full ${statusBarColor(entry.status)}`}
                    style={{
                      width: `${(entry.count / Math.max(1, state.data.documentCount)) * 100}%`
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-primary" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-foreground">OCR-Prioritätsregeln</h3>
          </div>
          <button
            type="button"
            onClick={() => void savePriorityRules()}
            disabled={
              priorityRulesState.status === "loading" || priorityRulesState.status === "saving"
            }
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            {priorityRulesState.status === "saving" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="h-4 w-4" aria-hidden="true" />
            )}
            Speichern
          </button>
        </div>
        {priorityRulesState.status === "loading" ? (
          <p className="mt-4 text-sm text-muted-foreground">Prioritätsregeln werden geladen.</p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Object.entries(priorityRulesState.rules).map(([documentType, value]) => (
              <label key={documentType} className="space-y-2 text-xs font-medium text-foreground">
                {documentType}
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={value}
                  onChange={(event) => updatePriorityRule(documentType, Number(event.target.value))}
                  className="h-9 w-full rounded-md border border-border px-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-blue-500/10"
                />
              </label>
            ))}
          </div>
        )}
        {priorityRulesState.status === "error" ? (
          <p className="mt-3 text-sm text-red-700">{priorityRulesState.message}</p>
        ) : null}
      </div>

      <div className="mt-6 rounded-lg border border-border bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-foreground">OCR-Warteschlange</h3>
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {state.data.ocrQueue.length} Dokumente
          </span>
        </div>
        <div className="mt-5 divide-y divide-border rounded-lg border border-border">
          {state.data.ocrQueue.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Keine Dokumente mit OCR-Bedarf.</p>
          ) : (
            state.data.ocrQueue.map((document, index) => (
              <article key={document.id} className="p-4 transition hover:bg-muted/40">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <a
                      href={`/documents/${document.id}`}
                      className="truncate text-sm font-semibold text-foreground hover:text-primary"
                    >
                      {document.title}
                    </a>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {document.fileName}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {index === 0 ? (
                        <span className="rounded-full border border-primary/30 bg-blue-50 px-2 py-1 text-xs font-semibold text-primary">
                          Nächster OCR-Kandidat
                        </span>
                      ) : null}
                      <span className="rounded-full border border-border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                        {documentTypeLabel(document.documentType)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-foreground px-2 py-1 font-semibold text-white">
                      Priorität {document.priorityScore}
                    </span>
                    <span>{Math.round(document.readableRatio * 100)}% lesbar</span>
                    <span>{Math.round(document.brokenCharRatio * 100)}% defekt</span>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {document.priorityReason}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void startOcr(document.id)}
                    disabled={
                      ocrActionState.status === "running" &&
                      ocrActionState.documentId === document.id
                    }
                    className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {ocrActionState.status === "running" &&
                    ocrActionState.documentId === document.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Play className="h-4 w-4" aria-hidden="true" />
                    )}
                    OCR starten
                  </button>
                  <a
                    href={`/documents/${document.id}`}
                    className="inline-flex h-9 items-center rounded-md border border-border bg-white px-3 text-xs font-medium text-foreground transition hover:bg-muted"
                  >
                    Review öffnen
                  </a>
                </div>
              </article>
            ))
          )}
        </div>
        {ocrActionState.status === "success" || ocrActionState.status === "error" ? (
          <div
            className={[
              "mt-4 rounded-lg border p-3 text-sm",
              ocrActionState.status === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            ].join(" ")}
          >
            {ocrActionState.message}
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-lg border border-border bg-white p-5">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-foreground">Risiken nach Kategorie</h3>
          </div>
          <div className="mt-5 space-y-4">
            {state.data.risksByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Risiken vorhanden.</p>
            ) : (
              state.data.risksByCategory.map((entry) => (
                <div key={entry.category}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="font-medium text-foreground">{entry.category}</span>
                    <span className="text-muted-foreground">{entry.count}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${(entry.count / maxCategoryCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-white p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-foreground">Top Risiken</h3>
          </div>
          <div className="mt-5 space-y-3">
            {state.data.topRisks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Risiken analysiert.</p>
            ) : (
              state.data.topRisks.map((risk) => (
                <a
                  key={risk.id}
                  href={`/documents/${risk.documentId}`}
                  className="block rounded-lg border border-border p-4 transition hover:border-slate-300 hover:bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{risk.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {risk.category} · {risk.documentTitle}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold text-white ${scoreColor(
                        risk.riskScore
                      )}`}
                    >
                      {risk.riskScore ?? 0}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{risk.reasoning}</p>
                </a>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function FileStatusIcon() {
  return <ShieldAlert className="h-5 w-5 text-primary" aria-hidden="true" />;
}

function RiskMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
