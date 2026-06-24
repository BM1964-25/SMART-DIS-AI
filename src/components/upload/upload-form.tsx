"use client";

import { CheckCircle2, FileText, Loader2, RefreshCcw, UploadCloud, X, XCircle } from "lucide-react";
import { useId, useMemo, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { allowedMimeTypes, maxFilesPerUpload, maxUploadSizeInBytes } from "@/domain/security";

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

const allowedAcceptValue = Object.keys(allowedMimeTypes).join(",");
const allowedMimeTypeSet = new Set(Object.keys(allowedMimeTypes));

function formatBytes(bytes: number) {
  const megabytes = bytes / 1024 / 1024;
  return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} MB`;
}

function getFileValidationError(file: File) {
  if (!allowedMimeTypeSet.has(file.type)) {
    return "Nur PDF, DOCX und TXT sind erlaubt.";
  }

  if (file.size <= 0) {
    return "Die Datei ist leer.";
  }

  if (file.size > maxUploadSizeInBytes) {
    return "Die Datei ist groesser als 25 MB.";
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
      setUploadState({ status: "error", message: "Bitte waehle mindestens eine Datei aus." });
      return;
    }

    if (fileErrors.length > 0) {
      setUploadState({
        status: "error",
        message: "Bitte entferne ungueltige Dateien vor dem Upload."
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Dateien hochladen</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Drag & Drop oder Dateiauswahl fuer bis zu {maxFilesPerUpload} Dokumente.
          </p>
        </div>
        <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          PDF · DOCX · TXT
        </span>
      </div>

      <div className="mt-5">
        <label htmlFor={titleId} className="text-sm font-medium text-foreground">
          Titel fuer Einzelupload
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
            Dateien hier ablegen oder auswaehlen
          </span>
          <span className="mt-1 text-xs text-muted-foreground">
            Maximal {formatBytes(maxUploadSizeInBytes)} pro Datei
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
        {selectedFiles.length > 1
          ? `${selectedFiles.length} Dokumente hochladen`
          : "Dokument hochladen"}
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

      <button
        type="button"
        onClick={() => {
          setSelectedFiles([]);
          setUploadState({ status: "idle" });
        }}
        className="mt-4 inline-flex h-9 items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <RefreshCcw className="h-4 w-4" aria-hidden="true" />
        Auswahl zuruecksetzen
      </button>
    </form>
  );
}
