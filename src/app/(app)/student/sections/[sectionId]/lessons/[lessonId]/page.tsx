import { ArrowLeft } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LessonRenderer } from "@/components/app/lesson-renderer";
import { requireActor } from "@/lib/auth/session";
import { getLessonForStudent, renderProseMirror } from "@/modules/content";

interface PageProps {
  params: Promise<{
    sectionId: string;
    lessonId: string;
  }>;
}

export default async function StudentLessonPage({ params }: PageProps) {
  const { sectionId, lessonId } = await params;
  const actor = await requireActor(await headers());

  let lessonData: Awaited<ReturnType<typeof getLessonForStudent>>;
  try {
    lessonData = await getLessonForStudent(lessonId, actor);
  } catch {
    notFound();
  }

  const renderedBody = lessonData.body
    ? renderProseMirror(lessonData.body)
    : null;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Back button */}
      <div className="mb-6">
        <Link
          href={`/student/sections/${sectionId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to {lessonData.section.code}
        </Link>
      </div>

      <LessonRenderer lesson={lessonData} renderedBody={renderedBody} />
    </div>
  );
}
