import { PageHeader } from "@/components/app/page-header";
import { ImportWizard } from "./import-wizard";

export default function AdminImportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch Import People & Enrollments"
        description="Batch load users, profiles, and course section enrollments from spreadsheets."
      />
      <ImportWizard />
    </div>
  );
}
