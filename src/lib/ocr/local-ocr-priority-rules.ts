import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getLocalDataDirectory } from "@/lib/local-data-path";

const localDataDirectory = getLocalDataDirectory();
const priorityRulesFilePath = path.join(localDataDirectory, "ocr-priority-rules.json");

export const defaultOcrPriorityRules: Record<string, number> = {
  contract: 32,
  defect_report: 28,
  invoice: 24,
  cost_list: 22,
  minutes: 18,
  construction_description: 16,
  project_report: 14,
  participant_list: 10,
  plan: 8,
  proposal: 8,
  policy: 8,
  other: 4
};

async function ensureLocalDataDirectory() {
  await mkdir(localDataDirectory, { recursive: true });
}

function sanitizeRules(value: unknown) {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rules = { ...defaultOcrPriorityRules };

  Object.keys(rules).forEach((key) => {
    const candidate = Number(source[key]);

    if (Number.isFinite(candidate)) {
      rules[key] = Math.min(60, Math.max(0, Math.round(candidate)));
    }
  });

  return rules;
}

export async function getLocalOcrPriorityRules() {
  await ensureLocalDataDirectory();

  try {
    const content = await readFile(priorityRulesFilePath, "utf8");
    return sanitizeRules(JSON.parse(content));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return defaultOcrPriorityRules;
    }

    throw error;
  }
}

export async function saveLocalOcrPriorityRules(rules: unknown) {
  const sanitizedRules = sanitizeRules(rules);
  await ensureLocalDataDirectory();
  await writeFile(priorityRulesFilePath, `${JSON.stringify(sanitizedRules, null, 2)}\n`, "utf8");

  return sanitizedRules;
}
