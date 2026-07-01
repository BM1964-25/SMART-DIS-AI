import {
  DeadlineOverview,
  type DeadlineOverviewData
} from "@/components/deadlines/deadline-overview";
import { listLocalDocumentDetails } from "@/lib/documents/local-document-store";
import { tryGetServerEnv } from "@/lib/server-env";

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function getInitialDeadlineOverview(): Promise<DeadlineOverviewData | undefined> {
  if (tryGetServerEnv()) {
    return undefined;
  }

  const documents = await listLocalDocumentDetails();
  const deadlines = documents
    .flatMap((document) =>
      document.deadlines.map((deadline) => ({
        ...deadline,
        documentTitle: document.title
      }))
    )
    .sort((left, right) => left.deadlineDate.localeCompare(right.deadlineDate));
  const today = toDateOnly(new Date());
  const next30DaysDate = new Date();
  next30DaysDate.setDate(next30DaysDate.getDate() + 30);
  const next30Days = toDateOnly(next30DaysDate);
  const typeCounts = new Map<string, number>();

  deadlines.forEach((deadline) => {
    typeCounts.set(deadline.deadlineType, (typeCounts.get(deadline.deadlineType) ?? 0) + 1);
  });

  return {
    deadlines,
    totalCount: deadlines.length,
    overdueCount: deadlines.filter(
      (deadline) => deadline.deadlineDate < today && deadline.status === "open"
    ).length,
    next30DaysCount: deadlines.filter(
      (deadline) =>
        deadline.deadlineDate >= today &&
        deadline.deadlineDate <= next30Days &&
        deadline.status === "open"
    ).length,
    byType: Array.from(typeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
  };
}

export default async function DeadlinesPage() {
  return <DeadlineOverview initialData={await getInitialDeadlineOverview()} />;
}
