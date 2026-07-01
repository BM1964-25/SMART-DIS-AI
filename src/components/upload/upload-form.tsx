"use client";

import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  FolderOpen,
  Loader2,
  RefreshCcw,
  UploadCloud,
  X,
  XCircle
} from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useState,
  useCallback,
  type ChangeEvent,
  type DragEvent,
  type FormEvent
} from "react";
import {
  allowedAcceptValue,
  allowedFileExtensionText,
  allowedMimeTypes,
  maxFilesPerUpload,
  maxUploadSizeInBytes
} from "@/domain/security";

type UploadFormProps = {
  onUploadComplete: () => void | Promise<void>;
};

type UploadState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "success"; uploadedCount: number; failed: UploadFailure[] }
  | { status: "error"; message: string };

type UploadFailure = {
  fileName: string;
  error: string;
};

type LinkedFolder = {
  path: string;
  connectedAt: string;
  lastSyncedAt: string;
  importedCount: number;
  skippedCount: number;
};

type SyncDocumentEntry = {
  id: string;
  title: string;
  fileName: string;
  filePath: string;
};

type SyncSkippedFile = {
  folderPath: string;
  filePath: string;
  reason: string;
};

type SyncSourceEntry = {
  documentId: string;
  title: string;
  fileName: string;
  filePath: string;
};

type FolderSyncState =
  | { status: "idle"; folders: LinkedFolder[] }
  | { status: "loading"; folders: LinkedFolder[] }
  | { status: "syncing"; folders: LinkedFolder[] }
  | {
      status: "success";
      folders: LinkedFolder[];
      importedCount: number;
      skippedCount: number;
      failedCount: number;
      importedDocuments: SyncDocumentEntry[];
      skippedFiles: SyncSkippedFile[];
      missingSources: SyncSourceEntry[];
      restoredSources: SyncSourceEntry[];
      isAutomatic: boolean;
    }
  | { status: "error"; folders: LinkedFolder[]; message: string };

const allowedMimeTypeSet = new Set(Object.keys(allowedMimeTypes));

async function fetchLinkedFolders() {
  const response = await fetch("/api/documents/local-folder/sync", { cache: "no-store" });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : "Verbundene Ordner konnten nicht geladen werden."
    );
  }

  return Array.isArray(payload.folders) ? (payload.folders as LinkedFolder[]) : [];
}

function formatBytes(bytes: number) {
  const megabytes = bytes / 1024 / 1024;
  return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`;
}

function getFileNameFromPath(filePath: string) {
  return filePath.split("/").pop() ?? filePath;
}

function getFileValidationError(file: File) {
  if (!allowedMimeTypeSet.has(file.type)) {
    const fileExtension = file.name.toLowerCase().split(".").pop() ?? "";

    if (!file.type && ["pdf", "docx", "txt", "xlsx", "xls", "csv"].includes(fileExtension)) {
      return null;
    }

    return `Nur ${allowedFileExtensionText} sind erlaubt.`;
  }

  if (file.size <= 0) {
    return "Die Datei ist leer.";
  }

  if (file.size > maxUploadSizeInBytes) {
    return "Die Datei ist größer als 25 MB.";
  }

  return null;
}

export function UploadForm({ onUploadComplete }: UploadFormProps) {
  const titleId = useId();
  const fileId = useId();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const [folderSyncState, setFolderSyncState] = useState<FolderSyncState>({
    status: "idle",
    folders: []
  });
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const fileErrors = useMemo(
    () =>
      selectedFiles
        .map((file) => ({ file, error: getFileValidationError(file) }))
        .filter((entry): entry is { file: File; error: string } => Boolean(entry.error)),
    [selectedFiles]
  );

  function addFiles(files: FileList | File[]) {
    const incomingFiles = Array.from(files);
    const nextFiles = [...selectedFiles, ...incomingFiles].slice(0, maxFilesPerUpload);
    setSelectedFiles(nextFiles);
    setUploadState({ status: "idle" });
  }

  const syncLinkedFolders = useCallback(
    async ({ isAutomatic = false }: { isAutomatic?: boolean } = {}) => {
      setFolderSyncState((current) => ({ status: "syncing", folders: current.folders }));

      try {
        const response = await fetch("/api/documents/local-folder/sync", {
          method: "POST"
        });
        const payload = await response.json();

        if (!response.ok) {
          setFolderSyncState((current) => ({
            status: "error",
            folders: current.folders,
            message:
              typeof payload.error === "string"
                ? payload.error
                : "Ordner konnten nicht synchronisiert werden."
          }));
          return;
        }

        setFolderSyncState({
          status: "success",
          folders: Array.isArray(payload.folders) ? payload.folders : [],
          importedCount: typeof payload.importedCount === "number" ? payload.importedCount : 0,
          skippedCount: typeof payload.skippedCount === "number" ? payload.skippedCount : 0,
          failedCount: Array.isArray(payload.failed) ? payload.failed.length : 0,
          importedDocuments: Array.isArray(payload.importedDocuments)
            ? payload.importedDocuments
            : [],
          skippedFiles: Array.isArray(payload.skippedFiles) ? payload.skippedFiles : [],
          missingSources: Array.isArray(payload.missingSources) ? payload.missingSources : [],
          restoredSources: Array.isArray(payload.restoredSources) ? payload.restoredSources : [],
          isAutomatic
        });
        await onUploadComplete();
      } catch {
        setFolderSyncState((current) => ({
          status: "error",
          folders: current.folders,
          message: "Ordner konnten nicht synchronisiert werden."
        }));
      }
    },
    [onUploadComplete]
  );

  useEffect(() => {
    let isMounted = true;

    async function loadInitialLinkedFolders() {
      try {
        const folders = await fetchLinkedFolders();

        if (isMounted) {
          setFolderSyncState({ status: "idle", folders });
        }
      } catch (error) {
        if (isMounted) {
          setFolderSyncState({
            status: "error",
            folders: [],
            message:
              error instanceof Error
                ? error.message
                : "Verbundene Ordner konnten nicht geladen werden."
          });
        }
      }
    }

    void loadInitialLinkedFolders();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!autoSyncEnabled || folderSyncState.folders.length === 0) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void syncLinkedFolders({ isAutomatic: true });
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [autoSyncEnabled, folderSyncState.folders.length, syncLinkedFolders]);

  function removeFile(fileToRemove: File) {
    setSelectedFiles((files) => files.filter((file) => file !== fileToRemove));
    setUploadState({ status: "idle" });
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      addFiles(event.target.files);
    }
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);

    if (event.dataTransfer.files.length > 0) {
      addFiles(event.dataTransfer.files);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedFiles.length === 0) {
      setUploadState({ status: "error", message: "Bitte wähle mindestens eine Datei aus." });
      return;
    }

    if (fileErrors.length > 0) {
      setUploadState({
        status: "error",
        message: "Bitte entferne ungültige Dateien vor dem Upload."
      });
      return;
    }

    const body = new FormData();
    selectedFiles.forEach((file) => body.append("files", file));
    body.append("title", title);

    setUploadState({ status: "uploading" });

    try {
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body
      });
      const payload = await response.json();

      if (!response.ok && (!Array.isArray(payload.documents) || payload.documents.length === 0)) {
        setUploadState({
          status: "error",
          message: typeof payload.error === "string" ? payload.error : "Upload fehlgeschlagen."
        });
        return;
      }

      const uploadedCount = Array.isArray(payload.documents) ? payload.documents.length : 0;
      const failed = Array.isArray(payload.failed) ? payload.failed : [];

      setUploadState({ status: "success", uploadedCount, failed });
      setTitle("");
      setSelectedFiles([]);
      event.currentTarget.reset();
      await onUploadComplete();
    } catch {
      setUploadState({
        status: "error",
        message: "Der Upload konnte nicht abgeschlossen werden."
      });
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-surface p-6 shadow-subtle"
    >
      <div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Dateien hochladen</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Drag & Drop oder Dateiauswahl für bis zu {maxFilesPerUpload} Dokumente.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <label htmlFor={titleId} className="text-sm font-medium text-foreground">
          Titel für Einzelupload
        </label>
        <input
          id={titleId}
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-2 h-11 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-blue-500/10"
          disabled={selectedFiles.length > 1}
          maxLength={160}
          placeholder="Optional, nur bei einer Datei"
          type="text"
        />
      </div>

      <div className="mt-5">
        <label htmlFor={fileId} className="text-sm font-medium text-foreground">
          Dateien
        </label>
        <label
          htmlFor={fileId}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={[
            "mt-2 flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 py-8 text-center transition",
            isDragging
              ? "border-primary bg-blue-50"
              : "border-slate-300 bg-white hover:border-primary hover:bg-blue-50/40"
          ].join(" ")}
        >
          <UploadCloud className="h-9 w-9 text-primary" aria-hidden="true" />
          <span className="mt-3 text-sm font-semibold text-foreground">
            Dateien hier ablegen oder auswählen
          </span>
          <span className="mt-1 text-xs text-muted-foreground">
            Maximal {formatBytes(maxUploadSizeInBytes)} pro Datei
          </span>
          <span className="mt-4 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            PDF · DOCX · TXT · XLSX · XLS · CSV
          </span>
        </label>
        <input
          id={fileId}
          name="files"
          accept={allowedAcceptValue}
          onChange={handleFileChange}
          className="sr-only"
          multiple
          type="file"
        />
      </div>

      <div className="mt-5 rounded-lg border border-border bg-muted/40 p-4">
        <p className="text-sm font-medium text-foreground">Lokalen Ordner verbinden</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Die Dateien werden nicht hochgeladen oder kopiert. Die App speichert den Ordnerpfad und
          liest ihn bei „Synchronisieren“ erneut ein. Neu abgelegte Dateien werden dann
          berücksichtigt.
        </p>
        {folderSyncState.folders.length > 0 ? (
          <div className="mt-3 space-y-2">
            {folderSyncState.folders.map((folder) => (
              <div
                key={folder.path}
                className="rounded-md border border-border bg-white p-3 text-xs text-muted-foreground"
              >
                <p className="break-all font-medium text-foreground">{folder.path}</p>
                <p className="mt-1">
                  Letzter Sync: {new Date(folder.lastSyncedAt).toLocaleString("de-DE")}
                </p>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <a
            href="/local-folder"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-medium text-foreground transition hover:bg-surface sm:w-auto"
          >
            <FolderOpen className="h-4 w-4" aria-hidden="true" />
            Ordnerbrowser öffnen
          </a>
          <button
            type="button"
            onClick={() => void syncLinkedFolders()}
            disabled={folderSyncState.status === "syncing" || folderSyncState.folders.length === 0}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-foreground px-3 text-sm font-medium text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {folderSyncState.status === "syncing" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            )}
            Verbundene Ordner synchronisieren
          </button>
        </div>
        <label className="mt-3 flex items-start gap-3 rounded-md border border-border bg-white p-3 text-xs text-muted-foreground">
          <input
            checked={autoSyncEnabled}
            onChange={(event) => setAutoSyncEnabled(event.target.checked)}
            disabled={folderSyncState.folders.length === 0}
            className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
            type="checkbox"
          />
          <span>
            <span className="block font-medium text-foreground">Auto-Sync alle 60 Sekunden</span>
            <span>
              Berücksichtigt neu abgelegte Dateien, solange diese Upload-Seite geöffnet bleibt.
            </span>
          </span>
        </label>
        {folderSyncState.status === "success" ? (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
            <p className="font-medium">
              {folderSyncState.isAutomatic ? "Auto-Sync" : "Sync"} abgeschlossen:{" "}
              {folderSyncState.importedCount} neue Dateien verbunden, {folderSyncState.skippedCount}{" "}
              übersprungen
              {folderSyncState.failedCount > 0 ? `, ${folderSyncState.failedCount} Fehler` : ""}.
            </p>
            {folderSyncState.importedDocuments.length > 0 ? (
              <div className="mt-2">
                <p className="font-medium">Neu verbunden</p>
                <ul className="mt-1 space-y-1">
                  {folderSyncState.importedDocuments.slice(0, 5).map((document) => (
                    <li key={document.id} className="break-all">
                      {document.fileName}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {folderSyncState.skippedFiles.length > 0 ? (
              <div className="mt-2">
                <p className="font-medium">Übersprungen</p>
                <ul className="mt-1 space-y-1">
                  {folderSyncState.skippedFiles.slice(0, 5).map((file) => (
                    <li key={`${file.filePath}-${file.reason}`} className="break-all">
                      {getFileNameFromPath(file.filePath)}: {file.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {folderSyncState.restoredSources.length > 0 ? (
              <div className="mt-2">
                <p className="font-medium">Quellen wieder verfügbar</p>
                <ul className="mt-1 space-y-1">
                  {folderSyncState.restoredSources.slice(0, 5).map((source) => (
                    <li key={source.documentId} className="break-all">
                      {source.fileName}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {folderSyncState.missingSources.length > 0 ? (
              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-800">
                <p className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  Lokale Quellen fehlen
                </p>
                <ul className="mt-1 space-y-1">
                  {folderSyncState.missingSources.slice(0, 5).map((source) => (
                    <li key={source.documentId} className="break-all">
                      {source.fileName}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
        {folderSyncState.status === "error" ? (
          <p className="mt-3 text-xs leading-5 text-red-700">{folderSyncState.message}</p>
        ) : null}
      </div>

      {selectedFiles.length > 0 ? (
        <div className="mt-5 space-y-2">
          {selectedFiles.map((file) => {
            const error = getFileValidationError(file);

            return (
              <div
                key={`${file.name}-${file.lastModified}-${file.size}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                    <p className={error ? "text-xs text-danger" : "text-xs text-muted-foreground"}>
                      {error ?? formatBytes(file.size)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(file)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label={`${file.name} entfernen`}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      <button
        className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={uploadState.status === "uploading" || selectedFiles.length === 0}
        type="submit"
      >
        {uploadState.status === "uploading" ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <UploadCloud className="h-4 w-4" aria-hidden="true" />
        )}
        {selectedFiles.length > 1 ? `${selectedFiles.length} Dateien hochladen` : "Datei hochladen"}
      </button>

      {uploadState.status === "success" ? (
        <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">{uploadState.uploadedCount} Dokumente gespeichert</p>
              {uploadState.failed.length > 0 ? (
                <div className="mt-2 space-y-1 text-xs">
                  {uploadState.failed.map((failure) => (
                    <p key={`${failure.fileName}-${failure.error}`}>
                      {failure.fileName}: {failure.error}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {uploadState.status === "error" ? (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{uploadState.message}</p>
          </div>
        </div>
      ) : null}

      <a
        href="/upload"
        className="mt-4 inline-flex h-9 items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <RefreshCcw className="h-4 w-4" aria-hidden="true" />
        Auswahl zurücksetzen
      </a>
    </form>
  );
}
