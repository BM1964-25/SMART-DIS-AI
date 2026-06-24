import { UploadWorkspace } from "@/components/upload/upload-workspace";
import { SectionHeader } from "@/components/ui/section-header";
import { maxUploadSizeInBytes } from "@/domain/security";

const maxUploadSizeInMegabytes = Math.round(maxUploadSizeInBytes / 1024 / 1024);

export default function UploadPage() {
  return (
    <main className="space-y-6">
      <section className="rounded-lg border border-border bg-surface px-6 py-7 shadow-subtle md:px-8">
        <SectionHeader
          eyebrow="Dokument Upload"
          title="Datei sicher hochladen"
          description={`MVP Upload fuer PDF, DOCX und TXT bis ${maxUploadSizeInMegabytes} MB. Nach dem Upload wird das Dokument in Supabase Storage gespeichert und als Datensatz registriert.`}
        />
      </section>

      <UploadWorkspace />
    </main>
  );
}
