"use client";

import { CheckCircle2, CheckSquare, Loader2, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/section-header";

type ActionItem = {
  id: string;
  title: string;
  owner: string;
  dueDate: string | null;
  risk: string;
  source: string;
  excerpt: string;
  status: "open" | "done";
  createdAt: string;
  completedAt?: string | null;
};

type ActionList = {
  id: string;
  title: string;
  items: ActionItem[];
  createdAt: string;
};

type ActionItemsState =
  | { status: "loading" }
  | { status: "ready"; actionLists: ActionList[]; itemCount: number }
  | { status: "error"; message: string };
type TaskFilter = "open" | "done" | "all";

function formatDate(value: string | null) {
  if (!value) {
    return "Termin offen";
  }

  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value));
}

export function ActionItemsOverview() {
  const [state, setState] = useState<ActionItemsState>({ status: "loading" });
  const [filter, setFilter] = useState<TaskFilter>("open");
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    fetch("/api/action-items", { cache: "no-store" })
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
                : "Aufgaben konnten nicht geladen werden."
          });
          return;
        }

        setState({
          status: "ready",
          actionLists: Array.isArray(payload.actionLists) ? payload.actionLists : [],
          itemCount: typeof payload.itemCount === "number" ? payload.itemCount : 0
        });
      })
      .catch(() => {
        if (!ignore) {
          setState({ status: "error", message: "Aufgaben konnten nicht geladen werden." });
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  async function updateItemStatus(itemId: string, status: "open" | "done") {
    setUpdatingItemId(itemId);

    try {
      const response = await fetch("/api/action-items", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ itemId, status })
      });
      const payload = await response.json();

      if (!response.ok) {
        setState({
          status: "error",
          message:
            typeof payload.error === "string"
              ? payload.error
              : "Aufgabe konnte nicht aktualisiert werden."
        });
        return;
      }

      setState({
        status: "ready",
        actionLists: Array.isArray(payload.actionLists) ? payload.actionLists : [],
        itemCount: typeof payload.itemCount === "number" ? payload.itemCount : 0
      });
    } finally {
      setUpdatingItemId(null);
    }
  }

  if (state.status === "loading") {
    return (
      <main className="rounded-lg border border-border bg-surface p-6 shadow-subtle">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Aufgaben werden geladen.
        </div>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        {state.message}
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <section className="rounded-lg border border-border bg-surface px-6 py-7 shadow-subtle md:px-8">
        <SectionHeader
          eyebrow="Projektaufgaben"
          title="Gespeicherte Handlungspunkte"
          description={`${state.itemCount} offene Aufgaben aus Chat-Handlungslisten.`}
        />
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 shadow-subtle">
        <div className="flex flex-wrap gap-2">
          {(["open", "done", "all"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              className={[
                "inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition",
                filter === option
                  ? "bg-foreground text-white"
                  : "border border-border bg-white text-foreground hover:bg-muted"
              ].join(" ")}
            >
              {option === "open" ? "Offen" : option === "done" ? "Erledigt" : "Alle"}
            </button>
          ))}
        </div>
      </section>

      {state.actionLists.length === 0 ? (
        <section className="rounded-lg border border-border bg-surface p-6 text-sm text-muted-foreground shadow-subtle">
          Noch keine Handlungsliste gespeichert. Erzeuge im Chat eine Antwort mit Handlungsliste und
          speichere sie als Aufgaben.
        </section>
      ) : (
        state.actionLists.map((actionList) => (
          <section
            key={actionList.id}
            className="rounded-lg border border-border bg-surface p-6 shadow-subtle"
          >
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-foreground">{actionList.title}</h2>
            </div>
            <div className="mt-5 grid gap-3">
              {actionList.items
                .filter((item) => filter === "all" || item.status === filter)
                .map((item) => (
                  <article key={item.id} className="rounded-lg border border-border bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.owner} · {item.risk}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                          {formatDate(item.dueDate)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            void updateItemStatus(item.id, item.status === "done" ? "open" : "done")
                          }
                          disabled={updatingItemId === item.id}
                          className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-white px-3 text-xs font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {updatingItemId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          ) : item.status === "done" ? (
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {item.status === "done" ? "Wieder öffnen" : "Erledigt"}
                        </button>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      Quelle: {item.source}
                      {item.excerpt ? ` - ${item.excerpt}` : ""}
                    </p>
                  </article>
                ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}
