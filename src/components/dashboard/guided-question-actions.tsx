"use client";

import { ArrowUpRight, FileSearch, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import { guidedQuestionPresets } from "@/domain/guided-questions";

type GuidedQuestionCount = {
  id: string;
  count: number;
  label: string;
};

type GuidedQuestionState =
  | { status: "loading"; counts: GuidedQuestionCount[] }
  | { status: "ready"; counts: GuidedQuestionCount[] }
  | { status: "error"; counts: GuidedQuestionCount[] };

export function GuidedQuestionActions() {
  const [state, setState] = useState<GuidedQuestionState>({ status: "loading", counts: [] });
  const countsByPreset = useMemo(
    () => new Map(state.counts.map((entry) => [entry.id, entry])),
    [state.counts]
  );

  useEffect(() => {
    let ignore = false;

    fetch("/api/dashboard", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();

        if (ignore) {
          return;
        }

        if (!response.ok) {
          setState({ status: "error", counts: [] });
          return;
        }

        setState({
          status: "ready",
          counts: Array.isArray(payload.guidedQuestionCounts) ? payload.guidedQuestionCounts : []
        });
      })
      .catch(() => {
        if (!ignore) {
          setState({ status: "error", counts: [] });
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <section className="rounded-lg border border-border bg-surface p-6 shadow-subtle">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeader
          eyebrow="Geführte KI-Abfragen"
          title="Wonach soll SMART DIS-AI suchen?"
          description="Starte typische Unternehmensfragen direkt aus dem Dashboard. Der Chat wird mit passender Frage und Dokumenttyp-Filter vorbereitet."
        />
        <a
          href="/chat"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-medium text-foreground transition hover:bg-muted"
        >
          <FileSearch className="h-4 w-4" aria-hidden="true" />
          Freie Frage öffnen
        </a>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {guidedQuestionPresets.map((preset) => {
          const count = countsByPreset.get(preset.id);

          return (
            <a
              key={preset.id}
              href={`/chat?preset=${preset.id}`}
              className="rounded-lg border border-border bg-white p-4 transition hover:border-primary hover:bg-blue-50/40"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">{preset.label}</h3>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{preset.description}</p>
              <div className="mt-4 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                {state.status === "loading" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Zähler werden geladen
                  </>
                ) : (
                  <span className="rounded-full border border-border bg-muted px-2.5 py-1">
                    {count?.count ?? 0} {count?.label ?? "Hinweise"}
                  </span>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
