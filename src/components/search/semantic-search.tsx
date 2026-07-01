"use client";

import { Loader2, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { SectionHeader } from "@/components/ui/section-header";

type SearchResult = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  similarity: number;
};

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; results: SearchResult[] }
  | { status: "error"; message: string };

function formatSimilarity(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function SemanticSearch() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 3) {
      setState({ status: "error", message: "Bitte gib mindestens 3 Zeichen ein." });
      return;
    }

    setState({ status: "loading" });

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ query: trimmedQuery })
      });
      const payload = await response.json();

      if (!response.ok) {
        setState({
          status: "error",
          message: typeof payload.error === "string" ? payload.error : "Suche fehlgeschlagen."
        });
        return;
      }

      setState({ status: "ready", results: payload.results });
    } catch {
      setState({ status: "error", message: "Suche konnte nicht ausgeführt werden." });
    }
  }

  return (
    <main className="space-y-6">
      <section className="rounded-lg border border-border bg-surface px-6 py-7 shadow-subtle md:px-8">
        <SectionHeader
          eyebrow="Semantische Suche"
          title="Nach Bedeutung suchen"
          description="Findet Dokumentstellen anhand semantischer Ähnlichkeit, nicht nur anhand identischer Wörter."
        />

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-md border border-border bg-white pl-10 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-blue-500/10"
              placeholder="z.B. Welche Dokumente enthalten Haftungsrisiken?"
              type="search"
            />
          </div>
          <button
            type="submit"
            disabled={state.status === "loading"}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state.status === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="h-4 w-4" aria-hidden="true" />
            )}
            Suchen
          </button>
        </form>
      </section>

      {state.status === "error" ? (
        <section className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          {state.message}
        </section>
      ) : null}

      {state.status === "idle" ? (
        <section className="rounded-lg border border-border bg-surface p-6 text-sm text-muted-foreground shadow-subtle">
          Indexiere zuerst analysierte Dokumente über die Dokumentdetailseite.
        </section>
      ) : null}

      {state.status === "ready" ? (
        <section className="rounded-lg border border-border bg-surface shadow-subtle">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-lg font-semibold text-foreground">Suchergebnisse</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {state.results.length} semantische Treffer
            </p>
          </div>

          <div className="divide-y divide-border">
            {state.results.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                Keine passenden Treffer gefunden.
              </div>
            ) : (
              state.results.map((result) => (
                <a
                  key={result.chunkId}
                  href={`/documents/${result.documentId}`}
                  className="block p-5 transition hover:bg-muted/40"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {result.documentTitle}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Semantische Ähnlichkeit: {formatSimilarity(result.similarity)}
                      </p>
                    </div>
                    <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                      {result.chunkId.startsWith("local-") ? "lokal" : "pgvector"}
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-foreground">{result.content}</p>
                </a>
              ))
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}
