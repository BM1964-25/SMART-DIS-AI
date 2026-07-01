import { NextResponse } from "next/server";
import { documentTypes, type DocumentType } from "@/domain/documents";
import { answerWithDocumentContext, type RagChatSource } from "@/lib/analysis/openai-rag-chat";
import {
  answerWithLocalDocumentContext,
  searchLocalDocumentChunks
} from "@/lib/search/local-semantic-search";
import { searchDocumentChunks } from "@/lib/search/semantic-search";
import { getOpenAiApiKey, tryGetServerEnv } from "@/lib/server-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatRequest = {
  question?: unknown;
  documentTypes?: unknown;
};

type ChatResponse = {
  answer: string;
  sources: RagChatSource[];
};

type ChatErrorResponse = {
  error: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json<ChatErrorResponse>({ error: message }, { status });
}

function parseDocumentTypes(value: unknown): DocumentType[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is DocumentType =>
      typeof entry === "string" && documentTypes.includes(entry as DocumentType)
  );
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ChatRequest;
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const filterDocumentTypes = parseDocumentTypes(body.documentTypes);

  if (question.length < 3) {
    return jsonError("Bitte stelle eine Frage mit mindestens 3 Zeichen.", 400);
  }

  if (question.length > 1000) {
    return jsonError("Die Frage ist zu lang.", 400);
  }

  const optionalEnv = tryGetServerEnv();

  if (!optionalEnv) {
    try {
      const results = await searchLocalDocumentChunks({
        query: question,
        matchCount: 6,
        filterDocumentTypes
      });

      if (results.length === 0) {
        return jsonError(
          "Keine passende lokale Quelle gefunden. Prüfe, ob die Dokumente analysiert und indexiert wurden oder ob der Dokumenttyp-Filter zu eng ist.",
          409
        );
      }

      return NextResponse.json<ChatResponse>(
        answerWithLocalDocumentContext({
          question,
          results
        })
      );
    } catch (error) {
      return jsonError(
        error instanceof Error ? error.message : "Lokaler Chat fehlgeschlagen.",
        502
      );
    }
  }

  const supabase = createSupabaseAdminClient();

  try {
    const results = await searchDocumentChunks({
      query: question,
      organizationId: optionalEnv.BUILTSMART_BOOTSTRAP_ORGANIZATION_ID,
      matchCount: 6,
      supabase
    });

    if (results.length === 0) {
      return jsonError(
        "Chat ist erst verfügbar, wenn mindestens ein Dokument erfolgreich analysiert und semantisch indexiert wurde. Dokumente mit OCR-Bedarf werden nicht als Quelle verwendet.",
        409
      );
    }

    const answer = await answerWithDocumentContext({
      apiKey: getOpenAiApiKey(),
      question,
      results
    });

    return NextResponse.json<ChatResponse>(answer);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Chat fehlgeschlagen.", 502);
  }
}
