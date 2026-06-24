import {
  ArrowUpRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  Database,
  FileText,
  ShieldAlert,
  UploadCloud
} from "lucide-react";
import Link from "next/link";
import { MetricCard } from "@/components/dashboard/metric-card";
import { RiskDashboard } from "@/components/dashboard/risk-dashboard";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { analysisPipelineSteps, documentTypeLabels, supportedFileTypes } from "@/domain/documents";

const metrics = [
  {
    label: "Dokumente",
    value: "0",
    detail: "Upload-Modul als nächster Schritt",
    icon: FileText
  },
  {
    label: "Offene Risiken",
    value: "0",
    detail: "Analyse-Pipeline noch nicht aktiv",
    icon: ShieldAlert
  },
  {
    label: "Erkannte Fristen",
    value: "0",
    detail: "Fristenerkennung vorbereitet",
    icon: CalendarClock
  },
  {
    label: "Chat-Sessions",
    value: "0",
    detail: "RAG-Chat folgt nach Indexierung",
    icon: Bot
  }
];

const modules = [
  {
    title: "Upload",
    description: "PDF, DOCX und TXT mit Größen-, MIME- und Organisationsvalidierung.",
    status: "Vorbereitet"
  },
  {
    title: "Text Extraction",
    description: "Serverseitige Extraktion als separater Schritt vor jeder KI-Auswertung.",
    status: "Geplant"
  },
  {
    title: "Klassifizierung",
    description:
      "Einordnung in Verträge, Angebote, Rechnungen, Protokolle, Richtlinien oder Sonstige.",
    status: "Geplant"
  },
  {
    title: "Risiken & Fristen",
    description:
      "Strukturierte Ergebnisse mit Quelle, Schweregrad, Datum, Confidence und Review-Status.",
    status: "Geplant"
  },
  {
    title: "Chunking & Embeddings",
    description: "Dokumentabschnitte werden für semantische Suche in pgvector indexiert.",
    status: "Vorbereitet"
  },
  {
    title: "RAG Chat",
    description: "Quellenbasierte Antworten ausschließlich aus autorisierten Dokument-Chunks.",
    status: "Geplant"
  }
];

const documentTypeEntries = Object.entries(documentTypeLabels);

export default function DashboardPage() {
  return (
    <main className="space-y-8">
      <section className="rounded-lg border border-border bg-surface px-6 py-7 shadow-subtle md:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-primary">BuiltSmart AI Plattform</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-foreground md:text-5xl">
              SMART DIS-AI
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              Ein intelligentes Unternehmensgedächtnis für Dokumentanalyse, Risiken, Fristen,
              strukturierte Informationen und quellenbasierten KI-Chat.
            </p>
          </div>
          <Link
            href="/upload"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:brightness-95"
          >
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            Dokument hochladen
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <RiskDashboard />

      <section className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <div className="rounded-lg border border-border bg-surface p-6 shadow-subtle">
          <SectionHeader
            eyebrow="MVP Module"
            title="Analysefähigkeiten"
            description="Die Plattform bleibt monolithisch in Next.js API Routes. Keine Microservices, keine unnötigen Frameworks."
          />
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {modules.map((module) => (
              <article
                key={module.title}
                className="rounded-lg border border-border bg-white p-4 transition hover:border-slate-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">{module.title}</h3>
                  <StatusBadge tone={module.status === "Vorbereitet" ? "success" : "neutral"}>
                    {module.status}
                  </StatusBadge>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{module.description}</p>
              </article>
            ))}
          </div>
        </div>

        <aside className="rounded-lg border border-border bg-surface p-6 shadow-subtle">
          <SectionHeader
            eyebrow="Datenmodell"
            title="MVP Umfang"
            description="Der nächste Implementierungsschritt kann direkt auf dem Supabase-Schema aufsetzen."
          />
          <div className="mt-6 rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileText className="h-4 w-4" aria-hidden="true" />
              Unterstützte Dateien
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {supportedFileTypes.map((fileType) => (
                <StatusBadge key={fileType} tone="success">
                  {fileType.toUpperCase()}
                </StatusBadge>
              ))}
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Database className="h-4 w-4" aria-hidden="true" />
              Dokumenttypen
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {documentTypeEntries.map(([key, label]) => (
                <div key={key} className="text-sm text-muted-foreground">
                  {label}
                </div>
              ))}
            </div>
          </div>
          <a
            href="/api/health"
            className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary"
          >
            API Status prüfen
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </aside>
      </section>

      <section className="rounded-lg border border-border bg-surface p-6 shadow-subtle">
        <SectionHeader
          eyebrow="Pipeline"
          title="MVP Verarbeitungsfluss"
          description="Jeder Schritt wird einzeln implementiert und bleibt nach jeder Iteration lauffähig."
        />
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {analysisPipelineSteps.map((step, index) => (
            <div key={step} className="rounded-lg border border-border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {index === 0 || index === 8 ? (
                  <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                ) : null}
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">{step}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
