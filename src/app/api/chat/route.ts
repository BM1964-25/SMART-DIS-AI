import { NextResponse } from "next/server";
import { answerWithDocumentContext, type RagChatSource } from "@/lib/analysis/openai-rag-chat";
import { searchDocumentChunks } from "@/lib/search/semantic-search";
import { getOpenAiApiKey, getServerEnv } from "@/lib/server-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatRequest = {
  question?: unknown;
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

export async function POST(request: Request) {
  let env;

  try {
    env = getServerEnv();
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Supabase is not configured.", 503);
  }

  const body = (await request.json().catch(() => ({}))) as ChatRequest;
  const question = typeof body.question === "string" ? body.question.trim() : "";

  if (question.length < 3) {
    return jsonError("Bitte stelle eine Frage mit mindestens 3 Zeichen.", 400);
  }

  if (question.length > 1000) {
    return jsonError("Die Frage ist zu lang.", 400);
  }

  const supabase = createSupabaseAdminClient();

  try {
    const results = await searchDocumentChunks({
      query: question,
      organizationId: env.BUILTSMART_BOOTSTRAP_ORGANIZATION_ID,
      matchCount: 6,
      supabase
    });
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
