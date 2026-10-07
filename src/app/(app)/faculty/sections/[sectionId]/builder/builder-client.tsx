"use client";

import { AlertTriangle, CheckCircle, Eye, FileCode } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ModuleTree } from "@/components/app/module-tree";
import { RichEditor } from "@/components/app/rich-editor";
import type {
  FacultyCurriculumLesson,
  FacultyCurriculumModule,
  LessonType,
  Module,
  StudentCurriculumModule,
} from "@/modules/content";
import {
  createLessonAction,
  createModuleAction,
  deleteLessonAction,
  deleteModuleAction,
  updateLessonAction,
} from "@/modules/content/actions";

export interface BuilderClientProps {
  sectionId: string;
  courseTitle: string;
  sectionCode: string;
  modules: FacultyCurriculumModule[];
}

export function BuilderClient({
  sectionId,
  courseTitle,
  sectionCode,
  modules: initialModules,
}: BuilderClientProps) {
  const router = useRouter();
  const [modules, setModules] = useState(initialModules);
  const [selectedLesson, setSelectedLesson] =
    useState<FacultyCurriculumLesson | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingBody, setEditingBody] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [_viewAsStudent, _setViewAsStudent] = useState(false);

  // Publish checklist:
  const emptyLessons = modules.flatMap((m) =>
    m.lessons.filter((l) => l.type === "rich_text" && !l.body),
  );
  const unverifiedFileLessons = modules.flatMap((m) =>
    m.lessons.filter((l) => l.type === "file" && !l.fileId),
  );
  const _isReadyToPublish =
    emptyLessons.length === 0 && unverifiedFileLessons.length === 0;

  const handleAddModule = async () => {
    const title = window.prompt("Enter module title:");
    if (!title?.trim()) return;

    try {
      const res = await createModuleAction({
        sectionId,
        title: title.trim(),
      });
      if (res.ok) {
        const newMod = res.value as Module;
        setModules((prev) => [...prev, { ...newMod, lessons: [] }]);
        router.refresh();
      }
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  };

  const handleAddLesson = async (moduleId: string) => {
    const title = window.prompt("Enter lesson title:");
    if (!title?.trim()) return;

    const typeStr = window.prompt(
      "Enter lesson type (rich_text, video, file):",
      "rich_text",
    );
    const type = (typeStr || "rich_text") as LessonType;

    try {
      const res = await createLessonAction({
        moduleId,
        type,
        title: title.trim(),
      });
      if (res.ok) {
        const newLesson = res.value as FacultyCurriculumLesson;
        setModules((prev) =>
          prev.map((m) =>
            m.id === moduleId
              ? { ...m, lessons: [...m.lessons, newLesson] }
              : m,
          ),
        );
        setSelectedLesson(newLesson);
        setEditingTitle(newLesson.title);
        setEditingBody(newLesson.body || null);
        router.refresh();
      }
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  };

  const handleSaveLesson = async () => {
    if (!selectedLesson) return;
    setIsSaving(true);
    try {
      const res = await updateLessonAction({
        lessonId: selectedLesson.id,
        title: editingTitle,
        body: editingBody,
      });
      if (res.ok) {
        const updatedLesson = res.value as FacultyCurriculumLesson;
        setModules((prev) =>
          prev.map((m) => ({
            ...m,
            lessons: m.lessons.map((l) =>
              l.id === selectedLesson.id ? updatedLesson : l,
            ),
          })),
        );
        setSelectedLesson(updatedLesson);
      }
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePublish = async (lesson: FacultyCurriculumLesson) => {
    const nextStatus = lesson.status === "published" ? "draft" : "published";
    try {
      const res = await updateLessonAction({
        lessonId: lesson.id,
        status: nextStatus,
      });
      if (res.ok) {
        const updatedLesson = res.value as FacultyCurriculumLesson;
        setModules((prev) =>
          prev.map((m) => ({
            ...m,
            lessons: m.lessons.map((l) =>
              l.id === lesson.id ? updatedLesson : l,
            ),
          })),
        );
        if (selectedLesson?.id === lesson.id) {
          setSelectedLesson(updatedLesson);
        }
      }
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  };

  // Convert faculty modules to student view schema for ModuleTree
  const studentViewModules: StudentCurriculumModule[] = modules.map((m) => ({
    id: m.id,
    title: m.title,
    position: m.position,
    status: m.status,
    lessons: m.lessons.map((l) => ({
      id: l.id,
      moduleId: l.moduleId,
      type: l.type,
      title: l.title,
      position: l.position,
      estMinutes: l.estMinutes,
      isLocked: false,
      status: l.status,
      progressStatus: "not_started",
      progressPct: 0,
    })),
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
              {sectionCode}
            </span>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Course Builder: {courseTitle}
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Author curriculum, structure modules, set release rules, and publish
            lessons.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/faculty/sections/${sectionId}/syllabus`}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            Syllabus
          </Link>

          <Link
            href={`/student/sections/${sectionId}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Eye className="h-3.5 w-3.5" />
            View as Student
          </Link>
        </div>
      </div>

      {/* Publish Checklist Banner */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Publish Checklist
        </h4>
        <div className="mt-2 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            {emptyLessons.length === 0 ? (
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
            <span>
              {emptyLessons.length === 0
                ? "No empty lessons"
                : `${emptyLessons.length} empty lesson(s) detected`}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {unverifiedFileLessons.length === 0 ? (
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
            <span>
              {unverifiedFileLessons.length === 0
                ? "All file references valid"
                : `${unverifiedFileLessons.length} file lesson(s) missing attachment`}
            </span>
          </div>
        </div>
      </div>

      {/* Main Builder Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Curriculum Tree */}
        <div className="lg:col-span-5">
          <ModuleTree
            sectionId={sectionId}
            modules={studentViewModules}
            isFaculty={true}
            activeLessonId={selectedLesson?.id}
            onAddModule={handleAddModule}
            onAddLesson={handleAddLesson}
            onDeleteLesson={async (lessonId) => {
              if (confirm("Delete this lesson?")) {
                await deleteLessonAction({ lessonId });
                router.refresh();
              }
            }}
            onDeleteModule={async (moduleId) => {
              if (confirm("Delete this module and all its lessons?")) {
                await deleteModuleAction({ moduleId });
                router.refresh();
              }
            }}
          />
        </div>

        {/* Right Column: Lesson Editor */}
        <div className="lg:col-span-7">
          {selectedLesson ? (
            <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-lg font-bold text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  placeholder="Lesson title..."
                />

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleTogglePublish(selectedLesson)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      selectedLesson.status === "published"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    }`}
                  >
                    {selectedLesson.status === "published"
                      ? "Published"
                      : "Draft"}
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveLesson}
                    disabled={isSaving}
                    className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>

              {selectedLesson.type === "rich_text" && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Content Editor (Tiptap / ProseMirror)
                  </span>
                  <RichEditor
                    initialContent={editingBody}
                    onChange={(doc) => setEditingBody(doc)}
                  />
                </div>
              )}

              {selectedLesson.type === "video" && (
                <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <label
                    htmlFor="video-lesson-url-input"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Video Lesson URL (YouTube unlisted only)
                  </label>
                  <input
                    id="video-lesson-url-input"
                    type="text"
                    defaultValue={selectedLesson.video?.url || ""}
                    onChange={(e) => {
                      const url = e.target.value.trim();
                      // Extract YouTube video id
                      const match = url.match(
                        /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/,
                      );
                      const videoId = match ? match[1] : "";
                      updateLessonAction({
                        lessonId: selectedLesson.id,
                        video: url ? { url, videoId } : null,
                      });
                    }}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
                  />
                  <p className="text-xs text-slate-500">
                    Notice: An unlisted video on YouTube can be viewed by anyone
                    with the link.
                  </p>
                </div>
              )}

              {selectedLesson.type === "file" && (
                <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <label
                    htmlFor="attached-file-id-input"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Attached File ID
                  </label>
                  <input
                    id="attached-file-id-input"
                    type="text"
                    defaultValue={selectedLesson.fileId || ""}
                    onChange={(e) => {
                      const fileId = e.target.value.trim();
                      if (fileId) {
                        updateLessonAction({
                          lessonId: selectedLesson.id,
                          fileId,
                        });
                      }
                    }}
                    placeholder="Paste uploaded file UUID..."
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
                  />
                  <p className="text-xs text-slate-500">
                    Upload documents (PDF, DOCX) in Settings &gt; Upload, then
                    link here.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-96 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400 dark:border-slate-800">
              <FileCode className="mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium">
                Select a lesson to edit content
              </p>
              <p className="mt-1 text-xs">
                Or click + on any module to add a new lesson.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
