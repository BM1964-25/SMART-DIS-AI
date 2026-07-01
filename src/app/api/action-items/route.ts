import { NextResponse } from "next/server";
import {
  listLocalActionLists,
  saveLocalActionList,
  updateLocalActionItemStatus
} from "@/lib/action-items/local-action-items";
import { tryGetServerEnv } from "@/lib/server-env";

export const runtime = "nodejs";

type SaveActionItemsRequest = {
  content?: unknown;
};

type UpdateActionItemRequest = {
  itemId?: unknown;
  status?: unknown;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (tryGetServerEnv()) {
    return jsonError("Projektaufgaben werden im MVP nur lokal gespeichert.", 501);
  }

  const body = (await request.json().catch(() => ({}))) as SaveActionItemsRequest;
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (content.length < 20) {
    return jsonError("Die Handlungsliste ist zu kurz.", 400);
  }

  try {
    const actionList = await saveLocalActionList(content);

    return NextResponse.json({
      actionListId: actionList.id,
      itemCount: actionList.items.length
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Handlungsliste konnte nicht gespeichert werden.",
      422
    );
  }
}

export async function GET() {
  if (tryGetServerEnv()) {
    return jsonError("Projektaufgaben werden im MVP nur lokal gelesen.", 501);
  }

  try {
    const actionLists = await listLocalActionLists();

    return NextResponse.json({
      actionLists,
      itemCount: actionLists.reduce((sum, list) => sum + list.items.length, 0)
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Projektaufgaben konnten nicht geladen werden.",
      502
    );
  }
}

export async function PATCH(request: Request) {
  if (tryGetServerEnv()) {
    return jsonError("Projektaufgaben werden im MVP nur lokal aktualisiert.", 501);
  }

  const body = (await request.json().catch(() => ({}))) as UpdateActionItemRequest;
  const itemId = typeof body.itemId === "string" ? body.itemId.trim() : "";
  const status = body.status === "open" || body.status === "done" ? body.status : null;

  if (!itemId || !status) {
    return jsonError("Bitte Aufgabe und Status angeben.", 400);
  }

  try {
    const actionLists = await updateLocalActionItemStatus({ itemId, status });

    return NextResponse.json({
      actionLists,
      itemCount: actionLists.reduce((sum, list) => sum + list.items.length, 0)
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Aufgabe konnte nicht aktualisiert werden.",
      422
    );
  }
}
