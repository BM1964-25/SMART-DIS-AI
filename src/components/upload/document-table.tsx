"use client";

import { RefreshCcw } from "lucide-react";
import { documentTypeLabels, type DocumentType } from "@/domain/documents";
import type { DocumentRecord } from "@/domain/document-record";

type DocumentTableProps = {
  documents: DocumentRecord[];
  isLoading: boolean;
  errorMessage?: string;
};

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

function getSourceLabel(document: DocumentRecord) {
  if (document.sourceKind === "linked_folder" && document.sourceStatus === "missing") {
    return "Lokale Quelle fehlt";
  }

  if (document.sourceKind === "linked_folder") {
    return "Lokaler Ordner";
  }

  if (document.sourceKind === "upload") {
    return "Upload";
  }

  return "Storage";
}

function getAnalysisQuality(document: DocumentRecord) {
  if (document.analysisQuality === "needs_ocr") {
    return { label: "OCR nötig", tone: "bg-red-50 text-red-700 border-red-200" };
  }

  if (document.analysisQuality === "good") {
    return { label: "Gut", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }

  if (document.analysisQuality === "medium") {
    return { label: "Mittel", tone: "bg-amber-50 text-amber-700 border-amber-200" };
  }

  if (document.analysisQuality === "basic") {
    return { label: "Basis", tone: "bg-sky-50 text-sky-700 border-sky-200" };
  }

  const textLength = document.analysisTextLength ?? 0;
  const readableRatio = document.analysisReadableRatio ?? 0;
  const brokenCharRatio = document.analysisBrokenCharRatio ?? 0;

  if (textLength === 0) {
    return { label: "Offen", tone: "bg-muted text-muted-foreground border-border" };
  }

  if (brokenCharRatio > 0.08 || readableRatio < 0.55) {
    return { label: "OCR nötig", tone: "bg-red-50 text-red-700 border-red-200" };
  }

  if (textLength >= 5_000 && readableRatio >= 0.8) {
    return { label: "Gut", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }

  if (textLength >= 500 && readableRatio >= 0.7) {
    return { label: "Mittel", tone: "bg-amber-50 text-amber-700 border-amber-200" };
  }

  return { label: "Basis", tone: "bg-sky-50 text-sky-700 border-sky-200" };
}

function buildDocumentTypeStats(documents: DocumentRecord[]) {
  const counts = new Map<string, number>();

  documents.forEach((document) => {
    counts.set(document.documentType, (counts.get(document.documentType) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([documentType, count]) => ({
      documentType,
      label: getDocumentTypeLabel(documentType),
      count
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "de"));
}

export function DocumentTable({ documents, isLoading, errorMessage }: DocumentTableProps) {
  const documentTypeStats = buildDocumentTypeStats(documents);

  return (
    <div className="rounded-lg border border-border bg-surface shadow-subtle">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Hochgeladene Dokumente ({documents.length})
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Dateien aus dem aktiven Speicherbackend mit Metadaten.
          </p>
          {documentTypeStats.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {documentTypeStats.map((entry) => (
                <span
                  key={entry.documentType}
                  className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
                >
                  {entry.label}: {entry.count}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <a
          href="/upload"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-medium text-foreground transition hover:bg-muted"
        >
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          Aktualisieren
        </a>
      </div>

      {errorMessage ? (
        <div className="border-b border-border bg-amber-50 px-5 py-3 text-sm text-amber-800">
          {errorMessage}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/60">
            <tr>
              {["Dokument", "Typ", "Quelle", "Analyse", "Größe", "Status", "Upload"].map(
                (column) => (
                  <th
                    key={column}
                    scope="col"
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                  >
                    {column}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  Dokumente werden geladen.
                </td>
              </tr>
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  Noch keine Dokumente hochgeladen.
                </td>
              </tr>
            ) : (
              documents.map((document) => {
                const analysisQuality = getAnalysisQuality(document);

                return (
                  <tr key={document.id} className="transition hover:bg-muted/40">
                    <td className="max-w-[320px] px-5 py-4">
                      <a
                        href={`/documents/${document.id}`}
                        className="truncate text-sm font-medium text-foreground transition hover:text-primary"
                      >
                        {document.title}
                      </a>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {document.fileName}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="w-fit rounded-full border border-border bg-muted px-2 py-1 text-xs font-medium uppercase text-muted-foreground">
                          {document.fileType}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {getDocumentTypeLabel(document.documentType)}
                        </span>
                      </div>
                    </td>
                    <td className="max-w-[260px] px-5 py-4">
                      <p className="text-sm font-medium text-foreground">
                        {getSourceLabel(document)}
                      </p>
                      {document.sourceKind === "linked_folder" ? (
                        <span
                          className={[
                            "mt-1 inline-flex w-fit rounded-full border px-2 py-0.5 text-xs font-medium",
                            document.sourceStatus === "missing"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          ].join(" ")}
                        >
                          {document.sourceStatus === "missing" ? "Quelle fehlt" : "Quelle aktiv"}
                        </span>
                      ) : null}
                      <p
                        className="mt-1 truncate text-xs text-muted-foreground"
                        title={document.localFilePath ?? document.storagePath}
                      >
                        {document.localFilePath ?? document.storagePath}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <div className="flex flex-col gap-1">
                        <span
                          className={`w-fit rounded-full border px-2 py-1 text-xs font-medium ${analysisQuality.tone}`}
                        >
                          {analysisQuality.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {document.riskCount ?? 0} Risiken · {document.deadlineCount ?? 0} Fristen
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-muted-foreground">
                      {formatBytes(document.sizeBytes)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span
                        className={[
                          "rounded-full border px-2 py-1 text-xs font-medium",
                          document.sourceStatus === "missing"
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : document.status === "needs_ocr"
                              ? "border-red-200 bg-red-50 text-red-700"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        ].join(" ")}
                      >
                        {document.sourceStatus === "missing" ? "source_missing" : document.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-muted-foreground">
                      {formatDate(document.createdAt)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
