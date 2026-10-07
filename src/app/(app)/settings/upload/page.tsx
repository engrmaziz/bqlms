import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { getActor } from "@/lib/auth/session";
import { UploadClient } from "./upload-client";

export default async function MediaUploadPage() {
  const actor = await getActor();
  if (!actor) {
    redirect("/sign-in");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="File & Media Center"
        description="Upload course materials, documents, and preview video lectures."
      />
      <UploadClient />
    </div>
  );
}
