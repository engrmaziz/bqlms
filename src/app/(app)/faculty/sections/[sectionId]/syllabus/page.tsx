import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { requireActor } from "@/lib/auth/session";
import { sectionsTable } from "@/modules/academics/schema";
import {
  canManageSectionContent,
  getLatestSyllabus,
  getSyllabusHistory,
  renderProseMirror,
} from "@/modules/content";
import { SyllabusClient } from "./syllabus-client";

interface PageProps {
  params: Promise<{
    sectionId: string;
  }>;
}

export default async function FacultySyllabusPage({ params }: PageProps) {
  const { sectionId } = await params;
  const actor = await requireActor(await headers());

  const isAllowed = await canManageSectionContent(actor, sectionId);
  if (!isAllowed) {
    notFound();
  }

  const [section] = await db
    .select()
    .from(sectionsTable)
    .where(eq(sectionsTable.id, sectionId))
    .limit(1);

  if (!section) {
    notFound();
  }

  const latestSyllabus = await getLatestSyllabus(sectionId);
  const history = await getSyllabusHistory(sectionId);
  const renderedLatest = latestSyllabus
    ? renderProseMirror(latestSyllabus.content)
    : null;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <SyllabusClient
        sectionId={sectionId}
        sectionCode={section.code}
        latestSyllabus={latestSyllabus}
        history={history}
        renderedLatest={renderedLatest}
      />
    </div>
  );
}
