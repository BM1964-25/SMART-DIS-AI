"use client";

import { Bot, Loader2, SendHorizontal, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { SectionHeader } from "@/components/ui/section-header";

type ChatSource = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  similarity: number;
  excerpt: string;
};

type ChatMessage =
  | {
      role: "user";
      content: string;
    }
  | {
      role: "assistant";
      content: string;
      sources: ChatSource[];
    };

type ChatState = { status: "idle" } | { status: "loading" } | { status: "error"; message: string };

function formatSimilarity(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function DocumentChat() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<ChatState>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuestion = question.trim();

    if (trimmedQuestion.length < 3) {
      setState({ status: "error", message: "Bitte stelle eine Frage mit mindestens 3 Zeichen." });
      return;
    }

    setMessages((current) => [...current, { role: "user", content: trimmedQuestion }]);
    setQuestion("");
    setState({ status: "loading" });

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ question: trimmedQuestion })
      });
      const payload = await response.json();

      if (!response.ok) {
        setState({
          status: "error",
          message: typeof payload.error === "string" ? payload.error : "Chat fehlgeschlagen."
        });
        return;
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: payload.answer,
          sources: Array.isArray(payload.sources) ? payload.sources : []
        }
      ]);
      setState({ status: "idle" });
    } catch {
      setState({ status: "error", message: "Chat konnte nicht ausgefuehrt werden." });
    }
  }

  return (
    <main className="space-y-6">
      <section className="rounded-lg border border-border bg-surface px-6 py-7 shadow-subtle md:px-8">
        <SectionHeader
          eyebrow="KI Chat"
          title="Fragen zu importierten Dokumenten"
          description="Antworten basieren ausschliesslich auf semantisch indexierten Dokumenten und zeigen die verwendeten Quellen."
        />
      </section>

      <section className="rounded-lg border border-border bg-surface shadow-subtle">
        <div className="min-h-[520px] space-y-5 p-5">
          {messages.length === 0 ? (
            <div className="rounded-lg border border-border bg-white p-6 text-sm leading-6 text-muted-foreground">
              Stelle eine Frage wie: Welche Verträge enthalten automatische Verlaengerungen? Der
              Chat nutzt nur Dokumente, die zuvor semantisch indexiert wurden.
            </div>
          ) : (
            messages.map((message, index) => (
              <article
                key={`${message.role}-${index}`}
                className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={[
                    "max-w-3xl rounded-lg border p-4",
                    message.role === "user"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-white text-foreground"
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {message.role === "user" ? (
                      <UserRound className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Bot className="h-4 w-4" aria-hidden="true" />
                    )}
                    {message.role === "user" ? "Du" : "SMART DIS-AI"}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{message.content}</p>

                  {message.role === "assistant" ? (
                    <div className="mt-5 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Quellen
                      </p>
                      {message.sources.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Keine ausreichenden Quellen in den importierten Dokumenten gefunden.
                        </p>
                      ) : (
                        message.sources.map((source) => (
                          <a
                            key={source.chunkId}
                            href={`/documents/${source.documentId}`}
                            className="block rounded-lg border border-border bg-muted p-3 transition hover:bg-surface"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium text-foreground">
                                {source.documentTitle}
                              </p>
                              <span className="text-xs text-muted-foreground">
                                {formatSimilarity(source.similarity)}
                              </span>
                            </div>
                            <p className="mt-2 text-xs leading-5 text-muted-foreground">
                              {source.excerpt}
                            </p>
                          </a>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              </article>
            ))
          )}

          {state.status === "loading" ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Antwort wird aus Dokumentquellen erstellt.
            </div>
          ) : null}

          {state.status === "error" ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {state.message}
            </div>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-border p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              className="min-h-24 flex-1 resize-none rounded-md border border-border bg-white px-3 py-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-blue-500/10"
              placeholder="Frage zu den importierten Dokumenten stellen..."
            />
            <button
              type="submit"
              disabled={state.status === "loading"}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 sm:self-end"
            >
              {state.status === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <SendHorizontal className="h-4 w-4" aria-hidden="true" />
              )}
              Senden
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
