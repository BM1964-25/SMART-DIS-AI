import { documentTypeLabels, type DocumentType } from "@/domain/documents";

export type GuidedQuestionPreset = {
  id: string;
  label: string;
  description: string;
  question: string;
  documentTypes: DocumentType[];
};

export const guidedQuestionDocumentTypeOptions: Array<{ value: DocumentType; label: string }> = [
  { value: "contract", label: documentTypeLabels.contract },
  { value: "minutes", label: documentTypeLabels.minutes },
  { value: "defect_report", label: documentTypeLabels.defect_report },
  { value: "invoice", label: documentTypeLabels.invoice },
  { value: "proposal", label: documentTypeLabels.proposal },
  { value: "cost_list", label: documentTypeLabels.cost_list },
  { value: "project_report", label: documentTypeLabels.project_report },
  { value: "construction_description", label: documentTypeLabels.construction_description }
];

export const guidedQuestionPresets: GuidedQuestionPreset[] = [
  {
    id: "contract-deadlines",
    label: "Fristen in Verträgen",
    description: "Kündigung, Vertragsende, Zahlung und Verlängerungen prüfen.",
    question:
      "Welche Kündigungsfristen, Vertragsenden, Zahlungsfristen und automatischen Verlängerungen sind in den Verträgen enthalten? Erstelle eine priorisierte Handlungsliste mit Quellen.",
    documentTypes: ["contract"]
  },
  {
    id: "risk-overview",
    label: "Risiken finden",
    description: "Rechtliche, finanzielle, technische und terminliche Risiken bündeln.",
    question:
      "Welche rechtlichen, finanziellen, terminlichen oder technischen Risiken ergeben sich aus den Dokumenten? Bewerte die Risiken und nenne die wichtigsten Quellen.",
    documentTypes: ["contract", "minutes", "project_report", "defect_report"]
  },
  {
    id: "defect-overview",
    label: "Mängelübersicht",
    description: "Mängel, offene Punkte, Fristen und Verantwortliche extrahieren.",
    question:
      "Welche Mängel, offenen Punkte, Nachbesserungen oder Beanstandungen werden genannt? Erstelle eine Mängelübersicht mit Status, Verantwortlichkeit, Frist und Quelle.",
    documentTypes: ["defect_report", "minutes", "project_report"]
  },
  {
    id: "meeting-actions",
    label: "Aufgaben aus Protokollen",
    description: "Aufgaben, Entscheidungen und nächste Schritte aus Protokollen ableiten.",
    question:
      "Welche Aufgaben, Entscheidungen, offenen Punkte und Termine ergeben sich aus den Protokollen? Erstelle eine Handlungsliste mit Verantwortlichen, Fristen und Quellen.",
    documentTypes: ["minutes"]
  },
  {
    id: "cost-review",
    label: "Kosten prüfen",
    description: "Kosten, Nachträge, Rechnungen und Zahlungsbedingungen bewerten.",
    question:
      "Welche Kosten, Nachträge, Rechnungen, Zahlungsbedingungen oder Budgetrisiken sind in den Dokumenten erkennbar? Erstelle eine Übersicht mit Quellen.",
    documentTypes: ["invoice", "cost_list", "proposal", "contract"]
  },
  {
    id: "preparation",
    label: "Vorbereitung nötig",
    description: "Termine, Unterlagen, Prüfungen und Vorbereitungserfordernisse erkennen.",
    question:
      "Welche Termine oder Themen erfordern Vorbereitung? Nenne benötigte Unterlagen, offene Prüfungen, Verantwortliche und Quellen.",
    documentTypes: ["minutes", "contract", "project_report", "defect_report"]
  }
];

export function getGuidedQuestionPreset(presetId: string | null) {
  return guidedQuestionPresets.find((preset) => preset.id === presetId) ?? null;
}
