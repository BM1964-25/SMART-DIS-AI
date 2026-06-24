"use client";

import { RefreshCcw } from "lucide-react";
import type { DocumentRecord } from "@/domain/document-record";

type DocumentTableProps = {
  documents: DocumentRecord[];
  isLoading: boolean;
  errorMessage?: string;
  onRefresh: () => void | Promise<void>;
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

export function DocumentTable({
  documents,
  isLoading,
  errorMessage,
  onRefresh
}: DocumentTableProps) {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-subtle">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Hochgeladene Dokumente</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Dateien aus Supabase Storage mit PostgreSQL-Metadaten.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onRefresh()}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-medium text-foreground transition hover:bg-muted"
        >
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          Aktualisieren
        </button>
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
              {["Dokument", "Typ", "Groesse", "Status", "Upload"].map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  Dokumente werden geladen.
                </td>
              </tr>
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted-foreground">
                  Noch keine Dokumente hochgeladen.
                </td>
              </tr>
            ) : (
              documents.map((document) => (
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
                    <span className="rounded-full border border-border bg-muted px-2 py-1 text-xs font-medium uppercase text-muted-foreground">
                      {document.fileType}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-muted-foreground">
                    {formatBytes(document.sizeBytes)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                      {document.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-muted-foreground">
                    {formatDate(document.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
