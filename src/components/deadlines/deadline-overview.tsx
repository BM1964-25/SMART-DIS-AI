"use client";

import { CalendarClock, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";

export type DeadlineOverviewRecord = {
  id: string;
  documentId: string;
  documentTitle: string;
  title: string;
  deadlineDate: string;
  deadlineType: string;
  status: string;
  sourceExcerpt: string | null;
  confidence: number | null;
};

export type DeadlineOverviewData = {
  deadlines: DeadlineOverviewRecord[];
  totalCount: number;
  overdueCount: number;
  next30DaysCount: number;
  byType: Array<{ type: string; count: number }>;
};

type DeadlineState =
  | { status: "loading" }
  | { status: "ready"; data: DeadlineOverviewData }
  | { status: "error"; message: string };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium"
  }).format(new Date(value));
}

function daysUntil(value: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(value);
  deadline.setHours(0, 0, 0, 0);
  return Math.round((deadline.getTime() - today.getTime()) / 86_400_000);
}

function urgencyLabel(value: string) {
  const days = daysUntil(value);

  if (days < 0) {
    return `${Math.abs(days)} Tage überfällig`;
  }

  if (days === 0) {
    return "Heute";
  }

  return `in ${days} Tagen`;
}

export function DeadlineOverview({ initialData }: { initialData?: DeadlineOverviewData }) {
  const [state, setState] = useState<DeadlineState>(
    initialData ? { status: "ready", data: initialData } : { status: "loading" }
  );

  useEffect(() => {
    let ignore = false;

    fetch("/api/deadlines", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();

        if (ignore) {
          return;
        }

        if (!response.ok) {
          setState({
            status: "error",
            message:
              typeof payload.error === "string"
                ? payload.error
                : "Fristen konnten nicht geladen werden."
          });
          return;
        }

        setState({ status: "ready", data: payload });
      })
      .catch(() => {
        if (!ignore) {
          setState({ status: "error", message: "Fristen konnten nicht geladen werden." });
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <section className="rounded-lg border border-border bg-surface p-6 shadow-subtle">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Fristen werden geladen.
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

  const maxTypeCount = Math.max(1, ...state.data.byType.map((entry) => entry.count));

  return (
    <main className="space-y-6">
      <section className="rounded-lg border border-border bg-surface px-6 py-7 shadow-subtle md:px-8">
        <SectionHeader
          eyebrow="Fristen"
          title="Fristenübersicht"
          description="Kündigungsfristen, Vertragsenden, Zahlungsfristen und Projekttermine aus analysierten Dokumenten."
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <DeadlineMetric label="Gesamt" value={state.data.totalCount} />
        <DeadlineMetric label="Ueberfaellig" value={state.data.overdueCount} />
        <DeadlineMetric label="Naechste 30 Tage" value={state.data.next30DaysCount} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-lg border border-border bg-surface p-6 shadow-subtle">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-foreground">Fristen nach Typ</h2>
          </div>
          <div className="mt-5 space-y-4">
            {state.data.byType.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Fristen erkannt.</p>
            ) : (
              state.data.byType.map((entry) => (
                <div key={entry.type}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="font-medium text-foreground">{entry.type}</span>
                    <span className="text-muted-foreground">{entry.count}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${(entry.count / maxTypeCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface shadow-subtle">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-lg font-semibold text-foreground">Alle Fristen</h2>
            <p className="mt-1 text-sm text-muted-foreground">Sortiert nach Datum.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/60">
                <tr>
                  {["Frist", "Typ", "Datum", "Status", "Dokument"].map((column) => (
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
                {state.data.deadlines.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-10 text-center text-sm text-muted-foreground"
                    >
                      Noch keine Fristen vorhanden.
                    </td>
                  </tr>
                ) : (
                  state.data.deadlines.map((deadline) => (
                    <tr key={deadline.id} className="transition hover:bg-muted/40">
                      <td className="max-w-[280px] px-5 py-4">
                        <p className="truncate text-sm font-medium text-foreground">
                          {deadline.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {urgencyLabel(deadline.deadlineDate)}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-muted-foreground">
                        {deadline.deadlineType}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-foreground">
                        {formatDate(deadline.deadlineDate)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <span className="rounded-full border border-border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                          {deadline.status}
                        </span>
                      </td>
                      <td className="max-w-[220px] px-5 py-4">
                        <a
                          href={`/documents/${deadline.documentId}`}
                          className="truncate text-sm font-medium text-primary"
                        >
                          {deadline.documentTitle}
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}

function DeadlineMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-subtle">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
