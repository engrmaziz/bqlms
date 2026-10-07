import { eq } from "drizzle-orm";
import { ArrowLeft, FileText } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { requireActor } from "@/lib/auth/session";
import { sectionsTable } from "@/modules/academics/schema";
import { getLatestSyllabus, renderProseMirror } from "@/modules/content";

interface PageProps {
  params: Promise<{
    sectionId: string;
  }>;
}

export default async function StudentSyllabusPage({ params }: PageProps) {
  const { sectionId } = await params;
  await requireActor(await headers());

  const [section] = await db
    .select()
    .from(sectionsTable)
    .where(eq(sectionsTable.id, sectionId))
    .limit(1);

  if (!section) {
    notFound();
  }

  const latestSyllabus = await getLatestSyllabus(sectionId);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Link
          href={`/student/sections/${sectionId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Course Curriculum
        </Link>
      </div>

      <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
              {section.code}
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Course Syllabus
            </h1>
          </div>
          {latestSyllabus && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Version {latestSyllabus.version} • Published{" "}
              {new Date(latestSyllabus.publishedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        {latestSyllabus ? (
          renderProseMirror(latestSyllabus.content)
        ) : (
          <div className="py-12 text-center text-sm text-slate-400">
            <FileText className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p>No syllabus has been published for this section yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
