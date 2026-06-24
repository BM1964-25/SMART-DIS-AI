"use client";

import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";

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
  risksByCategory: Array<{ category: string; count: number }>;
  topRisks: DashboardRisk[];
};

type DashboardState =
  | { status: "loading" }
  | { status: "ready"; data: DashboardData }
  | { status: "error"; message: string };

function scoreColor(score: number | null) {
  if ((score ?? 0) >= 80) {
    return "bg-red-600";
  }

  if ((score ?? 0) >= 60) {
    return "bg-amber-500";
  }

  return "bg-emerald-600";
}

export function RiskDashboard() {
  const [state, setState] = useState<DashboardState>({ status: "loading" });

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
                : "Dashboard konnte nicht geladen werden."
          });
          return;
        }

        setState({ status: "ready", data: payload });
      })
      .catch(() => {
        if (!ignore) {
          setState({ status: "error", message: "Dashboard konnte nicht geladen werden." });
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

function RiskMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
