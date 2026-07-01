"use client";

import { useCallback, useEffect, useState } from "react";
import { DocumentTable } from "@/components/upload/document-table";
import { UploadForm } from "@/components/upload/upload-form";
import type { DocumentRecord } from "@/domain/document-record";

type DocumentsState =
  | { status: "loading"; documents: DocumentRecord[]; message?: string }
  | { status: "ready"; documents: DocumentRecord[]; message?: string }
  | { status: "error"; documents: DocumentRecord[]; message: string };

type UploadWorkspaceProps = {
  initialDocuments: DocumentRecord[];
  initialErrorMessage?: string;
};

export function UploadWorkspace({ initialDocuments, initialErrorMessage }: UploadWorkspaceProps) {
  const [documentsState, setDocumentsState] = useState<DocumentsState>(
    initialErrorMessage
      ? {
          status: "error",
          documents: initialDocuments,
          message: initialErrorMessage
        }
      : {
          status: "ready",
          documents: initialDocuments
        }
  );

  const loadDocuments = useCallback(async () => {
    try {
      const response = await fetch("/api/documents", {
        method: "GET",
        cache: "no-store"
      });
      const payload = await response.json();

      if (!response.ok) {
        setDocumentsState({
          status: "error",
          documents: [],
          message:
            typeof payload.error === "string"
              ? payload.error
              : "Dokumente konnten nicht geladen werden."
        });
        return;
      }

      setDocumentsState({
        status: "ready",
        documents: payload.documents
      });
    } catch {
      setDocumentsState({
        status: "error",
        documents: [],
        message: "Dokumente konnten nicht geladen werden."
      });
    }
  }, []);

  const refreshDocuments = useCallback(async () => {
    setDocumentsState((current) => ({
      status: current.documents.length > 0 ? "ready" : "loading",
      documents: current.documents
    }));
    await loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    let ignore = false;

    fetch("/api/documents", {
      method: "GET",
      cache: "no-store"
    })
      .then(async (response) => {
        const payload = await response.json();

        if (ignore) {
          return;
        }

        if (!response.ok) {
          setDocumentsState({
            status: "error",
            documents: [],
            message:
              typeof payload.error === "string"
                ? payload.error
                : "Dokumente konnten nicht geladen werden."
          });
          return;
        }

        setDocumentsState({
          status: "ready",
          documents: payload.documents
        });
      })
      .catch(() => {
        if (!ignore) {
          setDocumentsState({
            status: "error",
            documents: [],
            message: "Dokumente konnten nicht geladen werden."
          });
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <section className="grid gap-6 xl:grid-cols-[0.95fr_1.25fr]">
      <UploadForm onUploadComplete={refreshDocuments} />
      <DocumentTable
        documents={documentsState.documents}
        isLoading={documentsState.status === "loading"}
        errorMessage={documentsState.status === "error" ? documentsState.message : undefined}
      />
    </section>
  );
}
