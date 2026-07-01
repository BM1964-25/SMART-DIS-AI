import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const localDataDirectory = path.join(process.cwd(), ".local-data");
const actionItemsFilePath = path.join(localDataDirectory, "action-items.json");

export type LocalActionItem = {
  id: string;
  title: string;
  owner: string;
  dueDate: string | null;
  risk: string;
  source: string;
  excerpt: string;
  status: "open" | "done";
  createdAt: string;
  completedAt?: string | null;
};

type LocalActionList = {
  id: string;
  title: string;
  source: "chat";
  content: string;
  items: LocalActionItem[];
  createdAt: string;
};

async function ensureLocalDataDirectory() {
  await mkdir(localDataDirectory, { recursive: true });
}

async function readActionLists(): Promise<LocalActionList[]> {
  await ensureLocalDataDirectory();

  try {
    const content = await readFile(actionItemsFilePath, "utf8");
    const parsed = JSON.parse(content);

    return Array.isArray(parsed) ? parsed.filter(isActionList) : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeActionLists(actionLists: LocalActionList[]) {
  await ensureLocalDataDirectory();
  await writeFile(actionItemsFilePath, `${JSON.stringify(actionLists, null, 2)}\n`, "utf8");
}

function isActionList(value: unknown): value is LocalActionList {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<LocalActionList>;

  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.content === "string" &&
    Array.isArray(record.items) &&
    typeof record.createdAt === "string"
  );
}

function parseDueDate(value: string) {
  const match = value.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/);

  if (!match) {
    return null;
  }

  const year = match[3].length === 2 ? `20${match[3]}` : match[3];

  return `${year.padStart(4, "0")}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function parseActionItems(content: string): LocalActionItem[] {
  const actionSection = content.split("\n\nRisiken")[0] ?? content;
  const blocks = actionSection.split(/\n(?=\d+\.\s)/).filter((block) => /^\d+\.\s/.test(block));
  const now = new Date().toISOString();

  return blocks.slice(0, 20).map((block) => {
    const lines = block.split("\n").map((line) => line.trim());
    const title = lines[0]?.replace(/^\d+\.\s*/, "").trim() || "Aufgabe prüfen";
    const owner = lines
      .find((line) => line.startsWith("Verantwortlich:"))
      ?.replace("Verantwortlich:", "")
      .trim();
    const due = lines
      .find((line) => line.startsWith("Termin:"))
      ?.replace("Termin:", "")
      .trim();
    const risk = lines
      .find((line) => line.startsWith("Risiko:"))
      ?.replace("Risiko:", "")
      .trim();
    const sourceLine = lines
      .find((line) => line.startsWith("Quelle:"))
      ?.replace("Quelle:", "")
      .trim();

    return {
      id: crypto.randomUUID(),
      title,
      owner: owner || "Nicht zugewiesen",
      dueDate: due ? parseDueDate(due) : null,
      risk: risk || "Prüfpunkt",
      source: sourceLine?.split(" - ")[0] ?? "Chat",
      excerpt: sourceLine?.split(" - ").slice(1).join(" - ") ?? "",
      status: "open",
      createdAt: now,
      completedAt: null
    };
  });
}

export async function saveLocalActionList(content: string) {
  const trimmedContent = content.trim();

  if (!trimmedContent.includes("Handlungsliste")) {
    throw new Error("Die Chatantwort enthält keine Handlungsliste.");
  }

  const items = parseActionItems(trimmedContent);

  if (items.length === 0) {
    throw new Error("Es konnten keine Aufgaben aus der Handlungsliste extrahiert werden.");
  }

  const actionLists = await readActionLists();
  const actionList: LocalActionList = {
    id: crypto.randomUUID(),
    title: `Handlungsliste ${new Date().toLocaleDateString("de-DE")}`,
    source: "chat",
    content: trimmedContent,
    items,
    createdAt: new Date().toISOString()
  };

  actionLists.unshift(actionList);
  await writeActionLists(actionLists.slice(0, 100));

  return actionList;
}

export async function listLocalActionLists() {
  return readActionLists();
}

export async function updateLocalActionItemStatus({
  itemId,
  status
}: {
  itemId: string;
  status: "open" | "done";
}) {
  const actionLists = await readActionLists();
  let updated = false;

  const nextLists = actionLists.map((actionList) => ({
    ...actionList,
    items: actionList.items.map((item) => {
      if (item.id !== itemId) {
        return item;
      }

      updated = true;

      return {
        ...item,
        status,
        completedAt: status === "done" ? new Date().toISOString() : null
      };
    })
  }));

  if (!updated) {
    throw new Error("Aufgabe wurde nicht gefunden.");
  }

  await writeActionLists(nextLists);

  return nextLists;
}
