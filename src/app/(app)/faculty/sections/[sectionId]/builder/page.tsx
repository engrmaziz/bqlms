import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireActor } from "@/lib/auth/session";
import { getSectionCurriculum } from "@/modules/content";
import { BuilderClient } from "./builder-client";

interface PageProps {
  params: Promise<{
    sectionId: string;
  }>;
}

export default async function FacultyBuilderPage({ params }: PageProps) {
  const { sectionId } = await params;
  const actor = await requireActor(await headers());

  const curriculum = await getSectionCurriculum(sectionId, actor);
  if (!curriculum.isInstructor) {
    notFound();
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <BuilderClient
        sectionId={sectionId}
        courseTitle={curriculum.section.code}
        sectionCode={curriculum.section.code}
        modules={curriculum.modules}
      />
    </div>
  );
}
