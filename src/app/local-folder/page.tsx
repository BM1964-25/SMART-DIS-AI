import { ChevronLeft, FolderOpen } from "lucide-react";
import { browseLocalDirectories } from "@/lib/documents/local-document-store";

type LocalFolderPageProps = {
  searchParams: Promise<{
    path?: string;
  }>;
};

export default async function LocalFolderPage({ searchParams }: LocalFolderPageProps) {
  const { path } = await searchParams;
  const browserResult = await browseLocalDirectories(path).then(
    (browser) => ({ browser, error: null }),
    (error: unknown) => ({
      browser: null,
      error: error instanceof Error ? error.message : "Lokaler Ordner konnte nicht gelesen werden."
    })
  );

  if (browserResult.error) {
    return (
      <main className="space-y-6">
        <section className="rounded-lg border border-border bg-surface px-6 py-7 shadow-subtle md:px-8">
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-primary">
            Lokaler Ordnerbrowser
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-normal text-foreground">
            Ordner konnte nicht geöffnet werden
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            {browserResult.error}
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <a
              href="/local-folder"
              className="inline-flex h-10 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-white transition hover:brightness-95"
            >
              Startordner anzeigen
            </a>
            <a
              href="/upload"
              className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-white px-4 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              Zurück zum Upload
            </a>
          </div>
        </section>
      </main>
    );
  }

  const browser = browserResult.browser;

  if (!browser) {
    return null;
  }

  const connectHref = `/api/documents/local-folder/connect?path=${encodeURIComponent(browser.currentPath)}`;

  return (
    <main className="space-y-6">
      <section className="rounded-lg border border-border bg-surface px-6 py-7 shadow-subtle md:px-8">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-primary">
          Lokaler Ordnerbrowser
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal text-foreground">
          Ordner für SMART DIS-AI auswählen
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
          Wähle einen lokalen Ordner aus. Die Dateien werden nicht hochgeladen oder kopiert, sondern
          als lokale Quellen verbunden.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5 shadow-subtle">
        <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Aktueller Ordner
            </p>
            <p className="mt-1 break-all text-sm font-medium text-foreground">
              {browser.currentPath}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href={connectHref}
              className="inline-flex h-10 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-white transition hover:brightness-95"
            >
              Diesen Ordner verbinden
            </a>
            <a
              href="/upload"
              className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-white px-4 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              Zurück zum Upload
            </a>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {browser.parentPath ? (
            <a
              href={`/local-folder?path=${encodeURIComponent(browser.parentPath)}`}
              className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground transition hover:bg-surface"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Eine Ebene höher
            </a>
          ) : null}

          {browser.directories.length === 0 ? (
            <p className="rounded-md border border-border bg-muted px-3 py-4 text-sm text-muted-foreground">
              Keine Unterordner gefunden.
            </p>
          ) : (
            browser.directories.map((directory) => (
              <a
                key={directory.path}
                href={`/local-folder?path=${encodeURIComponent(directory.path)}`}
                className="flex items-center gap-3 rounded-md border border-border bg-white px-3 py-3 text-sm font-medium text-foreground transition hover:border-primary hover:bg-blue-50"
              >
                <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">{directory.name}</span>
              </a>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
