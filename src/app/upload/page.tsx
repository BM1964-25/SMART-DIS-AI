import { UploadWorkspace } from "@/components/upload/upload-workspace";
import { SectionHeader } from "@/components/ui/section-header";
import { allowedFileExtensionText, maxUploadSizeInBytes } from "@/domain/security";
import { listDocuments } from "@/lib/documents/list-documents";

const maxUploadSizeInMegabytes = Math.round(maxUploadSizeInBytes / 1024 / 1024);

type UploadPageProps = {
  searchParams: Promise<{
    analysisDeadlines?: string;
    analysisError?: string;
    analysisFailed?: string;
    analysisRisks?: string;
    analysisUpdated?: string;
    backupError?: string;
    backupRestored?: string;
    folderError?: string;
    folderImported?: string;
    folderSkipped?: string;
  }>;
};

export default async function UploadPage({ searchParams }: UploadPageProps) {
  const {
    analysisDeadlines,
    analysisError,
    analysisFailed,
    analysisRisks,
    analysisUpdated,
    backupError,
    backupRestored,
    folderError,
    folderImported,
    folderSkipped
  } = await searchParams;
  const documentsResult = await listDocuments().then(
    (documents) => ({ documents, errorMessage: undefined }),
    (error: unknown) => ({
      documents: [],
      errorMessage:
        error instanceof Error ? error.message : "Dokumente konnten nicht geladen werden."
    })
  );

  return (
    <main className="space-y-6">
      <section className="rounded-lg border border-border bg-surface px-6 py-7 shadow-subtle md:px-8">
        <SectionHeader
          eyebrow="Dokument Upload"
          title="Datei sicher hochladen"
          description={`MVP Upload für ${allowedFileExtensionText} bis ${maxUploadSizeInMegabytes} MB. Ohne Supabase-Konfiguration speichert die App lokal, mit Supabase-Konfiguration im produktiven Storage.`}
        />
      </section>

      {folderImported ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {folderImported} Dateien aus lokalem Ordner verbunden, {folderSkipped ?? "0"}{" "}
          übersprungen.
        </div>
      ) : null}

      {folderError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {folderError}
        </div>
      ) : null}

      {analysisUpdated ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {analysisUpdated} Dokumente analysiert, {analysisRisks ?? "0"} Risiken und{" "}
          {analysisDeadlines ?? "0"} Fristen erkannt
          {analysisFailed ? `, ${analysisFailed} Dateien konnten nicht analysiert werden` : ""}.
        </div>
      ) : null}

      {analysisError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {analysisError}
        </div>
      ) : null}

      {backupRestored ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Sicherung importiert. {backupRestored} Dokumente sind jetzt registriert.
        </div>
      ) : null}

      {backupError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {backupError}
        </div>
      ) : null}

      <section className="rounded-lg border border-border bg-surface p-5 shadow-subtle">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Ordnerwissen aufbauen</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Analysiert die verbundenen lokalen Dateien, extrahiert Text und erzeugt erste Hinweise
              zu Risiken und Fristen.
            </p>
          </div>
          <form action="/api/documents/local-analysis" method="post">
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-white transition hover:brightness-95"
            >
              Lokale Dokumente analysieren
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5 shadow-subtle">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Dateisicherung</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Sichert den lokalen SMART DIS-AI Dokumentindex inklusive Analyseergebnissen. Die
              Originaldateien in verknüpften Ordnern werden nicht kopiert.
            </p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/api/documents/local-backup"
              className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-white px-4 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              Sicherung herunterladen
            </a>
            <form
              action="/api/documents/local-backup"
              method="post"
              encType="multipart/form-data"
              className="flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <input
                name="backup"
                accept="application/json,.json"
                className="h-11 rounded-md border border-border bg-white px-3 py-2 text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
                type="file"
                required
              />
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-white transition hover:brightness-95"
              >
                Sicherung hochladen
              </button>
            </form>
          </div>
        </div>
      </section>

      <UploadWorkspace
        initialDocuments={documentsResult.documents}
        initialErrorMessage={documentsResult.errorMessage}
      />
    </main>
  );
}
