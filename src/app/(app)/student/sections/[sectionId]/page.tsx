import { CheckCircle, FileText } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ModuleTree } from "@/components/app/module-tree";
import { requireActor } from "@/lib/auth/session";
import {
  getLatestSyllabus,
  getSectionCurriculum,
  type StudentCurriculumModule,
} from "@/modules/content";
import { getSectionProgressSummary } from "@/modules/progress";

interface PageProps {
  params: Promise<{
    sectionId: string;
  }>;
}

export default async function StudentSectionPage({ params }: PageProps) {
  const { sectionId } = await params;
  const actor = await requireActor(await headers());

  const curriculum = await getSectionCurriculum(sectionId, actor, {
    viewAsStudent: true,
  });

  if (!curriculum.section) {
    notFound();
  }

  const latestSyllabus = await getLatestSyllabus(sectionId);
  const progressSummary = curriculum.enrollment
    ? await getSectionProgressSummary(curriculum.enrollment.id, sectionId)
    : null;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
              {curriculum.section.code}
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Course Curriculum
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Term: {curriculum.term.name} • Timezone:{" "}
            {curriculum.collegeTimezone}
          </p>
        </div>

        {latestSyllabus && (
          <Link
            href={`/student/sections/${sectionId}/syllabus`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <FileText className="h-4 w-4" />
            View Syllabus (v{latestSyllabus.version})
          </Link>
        )}
      </div>

      {/* Overall Progress Card */}
      {progressSummary && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Course Progress
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {progressSummary.completedLessons} of{" "}
                {progressSummary.totalLessons} lessons completed
              </p>
            </div>

            <div className="flex items-center gap-3">
              {progressSummary.isCompleted && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Course Completed!
                </span>
              )}
              <span className="text-lg font-bold text-slate-900 dark:text-white">
                {progressSummary.overallProgressPct}%
              </span>
            </div>
          </div>

          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full bg-indigo-600 transition-all duration-300 dark:bg-indigo-400"
              style={{ width: `${progressSummary.overallProgressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Curriculum Modules */}
      <div className="mt-8">
        <ModuleTree
          sectionId={sectionId}
          modules={curriculum.modules as StudentCurriculumModule[]}
          isFaculty={false}
        />
      </div>
    </div>
  );
}
