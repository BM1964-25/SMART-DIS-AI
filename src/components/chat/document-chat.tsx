"use client";

import {
  Bot,
  CheckCircle2,
  Download,
  FileSearch,
  Loader2,
  Save,
  SendHorizontal,
  UserRound
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { SectionHeader } from "@/components/ui/section-header";
import type { DocumentType } from "@/domain/documents";
import {
  getGuidedQuestionPreset,
  guidedQuestionDocumentTypeOptions,
  guidedQuestionPresets,
  type GuidedQuestionPreset
} from "@/domain/guided-questions";

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
type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

function formatSimilarity(value: number) {
  return `${Math.round(value * 100)}%`;
}

function parseStructuredSections(content: string) {
  const sectionTitles = ["Handlungsliste", "Risiken", "Fristen", "Vorbereitung", "Einordnung"];
  const sections: Array<{ title: string; body: string }> = [];

  for (const title of sectionTitles) {
    const startPattern = new RegExp(`(?:^|\\n)${title}\\n`, "u");
    const startMatch = startPattern.exec(content);

    if (!startMatch) {
      continue;
    }

    const startIndex = startMatch.index + startMatch[0].length;
    const rest = content.slice(startIndex);
    const nextTitleMatch = new RegExp(`\\n(?:${sectionTitles.join("|")})\\n`, "u").exec(rest);
    const body = rest.slice(0, nextTitleMatch?.index ?? rest.length).trim();

    if (body.length > 0) {
      sections.push({ title, body });
    }
  }

  return sections;
}

function StructuredAnswer({ content }: { content: string }) {
  const sections = parseStructuredSections(content);

  if (sections.length === 0) {
    return <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{content}</p>;
  }

  return (
    <div className="mt-4 grid gap-3">
      {sections.map((section) => (
        <section key={section.title} className="rounded-lg border border-border bg-muted/50 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {section.title}
          </h4>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground">
            {section.body}
          </p>
        </section>
      ))}
    </div>
  );
}

function downloadActionList(content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `smart-dis-ai-handlungsliste-${new Date().toISOString().slice(0, 10)}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function downloadStructuredTable(content: string) {
  const rows = parseStructuredSections(content).flatMap((section) =>
    section.body
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => [section.title, line])
  );
  const csv = [["Bereich", "Eintrag"], ...(rows.length > 0 ? rows : [["Antwort", content]])]
    .map((row) => row.map(escapeCsvCell).join(";"))
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `smart-dis-ai-auswertung-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DocumentChat() {
  const searchParams = useSearchParams();
  const initialPreset = getGuidedQuestionPreset(searchParams.get("preset"));
  const [question, setQuestion] = useState(initialPreset?.question ?? "");
  const [selectedDocumentTypes, setSelectedDocumentTypes] = useState<DocumentType[]>(
    initialPreset?.documentTypes ?? []
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<ChatState>({ status: "idle" });
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });

  function applyPreset(preset: GuidedQuestionPreset) {
    setQuestion(preset.question);
    setSelectedDocumentTypes(preset.documentTypes);
    setState({ status: "idle" });
  }

  function toggleDocumentType(documentType: DocumentType) {
    setSelectedDocumentTypes((current) =>
      current.includes(documentType)
        ? current.filter((entry) => entry !== documentType)
        : [...current, documentType]
    );
  }

  async function saveActionList(content: string) {
    setSaveState({ status: "saving" });

    try {
      const response = await fetch("/api/action-items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ content })
      });
      const payload = await response.json();

      if (!response.ok) {
        setSaveState({
          status: "error",
          message:
            typeof payload.error === "string"
              ? payload.error
              : "Handlungsliste konnte nicht gespeichert werden."
        });
        return;
      }

      setSaveState({
        status: "success",
        message: `${payload.itemCount} Aufgaben gespeichert.`
      });
    } catch {
      setSaveState({ status: "error", message: "Handlungsliste konnte nicht gespeichert werden." });
    }
  }

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
        body: JSON.stringify({
          question: trimmedQuestion,
          documentTypes: selectedDocumentTypes
        })
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
      setState({ status: "error", message: "Chat konnte nicht ausgeführt werden." });
    }
  }

  return (
    <main className="space-y-6">
      <section className="rounded-lg border border-border bg-surface px-6 py-7 shadow-subtle md:px-8">
        <SectionHeader
          eyebrow="KI Chat"
          title="Fragen zu importierten Dokumenten"
          description="Antworten basieren ausschließlich auf analysierten, semantisch indexierten Dokumenten. Dokumente mit OCR-Bedarf werden erst nach erfolgreicher OCR als Quellen zugelassen."
        />
      </section>

      <section className="rounded-lg border border-border bg-surface shadow-subtle">
        <div className="border-b border-border p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileSearch className="h-4 w-4 text-primary" aria-hidden="true" />
            Geführte Abfragen
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {guidedQuestionPresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset)}
                className="rounded-md border border-border bg-white px-3 py-3 text-left text-sm font-medium text-foreground transition hover:border-primary hover:bg-blue-50/40"
              >
                <span className="block">{preset.label}</span>
                <span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">
                  {preset.description}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Dokumenttypen eingrenzen
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {guidedQuestionDocumentTypeOptions.map((option) => {
                const isSelected = selectedDocumentTypes.includes(option.value);

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleDocumentType(option.value)}
                    className={[
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted text-muted-foreground hover:border-primary hover:text-foreground"
                    ].join(" ")}
                  >
                    {option.label}
                  </button>
                );
              })}
              {selectedDocumentTypes.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setSelectedDocumentTypes([])}
                  className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  Filter löschen
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <div className="min-h-[520px] space-y-5 p-5">
          {messages.length === 0 ? (
            <div className="rounded-lg border border-border bg-white p-6 text-sm leading-6 text-muted-foreground">
              Stelle eine Frage wie: Welche Verträge enthalten automatische Verlängerungen? Der Chat
              nutzt nur Dokumente, die zuvor erfolgreich analysiert und semantisch indexiert wurden.
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
                  {message.role === "assistant" && message.content.includes("Handlungsliste") ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => downloadActionList(message.content)}
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-white px-3 text-xs font-medium text-foreground transition hover:bg-muted"
                      >
                        <Download className="h-4 w-4" aria-hidden="true" />
                        Exportieren
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadStructuredTable(message.content)}
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-white px-3 text-xs font-medium text-foreground transition hover:bg-muted"
                      >
                        <Download className="h-4 w-4" aria-hidden="true" />
                        Als Tabelle exportieren
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveActionList(message.content)}
                        disabled={saveState.status === "saving"}
                        className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-white px-3 text-xs font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {saveState.status === "saving" ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : saveState.status === "success" ? (
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Save className="h-4 w-4" aria-hidden="true" />
                        )}
                        Als Aufgaben speichern
                      </button>
                    </div>
                  ) : null}
                  <StructuredAnswer content={message.content} />

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

          {saveState.status === "success" || saveState.status === "error" ? (
            <div
              className={[
                "rounded-lg border p-4 text-sm",
                saveState.status === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-800"
              ].join(" ")}
            >
              {saveState.message}
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
