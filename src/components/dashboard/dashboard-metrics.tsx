"use client";

import { Bot, CalendarClock, FileText, Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { MetricCard } from "@/components/dashboard/metric-card";

type DashboardMetricsData = {
  documentCount: number;
  indexedDocumentCount: number;
  needsOcrCount: number;
  deadlineCount: number;
  riskCount: number;
  highRiskCount: number;
};

type DashboardMetricsState =
  | { status: "loading" }
  | { status: "ready"; data: DashboardMetricsData }
  | { status: "error"; message: string };

export function DashboardMetrics() {
  const [state, setState] = useState<DashboardMetricsState>({ status: "loading" });

  useEffect(() => {
    let ignore = false;

    fetch("/api/dashboard", { cache: "no-store" })
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
                : "Dashboard-Kennzahlen konnten nicht geladen werden."
          });
          return;
        }

        setState({ status: "ready", data: payload });
      })
      .catch(() => {
        if (!ignore) {
          setState({
            status: "error",
            message: "Dashboard-Kennzahlen konnten nicht geladen werden."
          });
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-5 shadow-subtle xl:col-span-4">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Dashboard-Kennzahlen werden geladen.
          </div>
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 shadow-subtle">
        {state.message}
      </section>
    );
  }

  const metrics = [
    {
      label: "Dokumente",
      value: String(state.data.documentCount),
      detail: `${state.data.indexedDocumentCount} analysiert, ${state.data.needsOcrCount} benötigen OCR`,
      icon: FileText
    },
    {
      label: "Offene Risiken",
      value: String(state.data.riskCount),
      detail: `${state.data.highRiskCount} hoch priorisiert`,
      icon: ShieldAlert
    },
    {
      label: "Erkannte Fristen",
      value: String(state.data.deadlineCount),
      detail: "aus lokalen und analysierten Dokumenten",
      icon: CalendarClock
    },
    {
      label: "Chat-Quellen",
      value: String(state.data.indexedDocumentCount),
      detail: "für lokale Suche und Chat freigegeben",
      icon: Bot
    }
  ];

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <MetricCard key={metric.label} {...metric} />
      ))}
    </section>
  );
}
