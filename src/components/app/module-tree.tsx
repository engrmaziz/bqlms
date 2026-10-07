"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileCode,
  FileText,
  GripVertical,
  Lock,
  Plus,
  Trash2,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type {
  LessonType,
  StudentCurriculumLesson,
  StudentCurriculumModule,
} from "@/modules/content";

export interface ModuleTreeProps {
  sectionId: string;
  modules: StudentCurriculumModule[];
  isFaculty?: boolean | undefined;
  activeLessonId?: string | undefined;
  onReorderLesson?:
    | ((lessonId: string, newPosition: string) => Promise<void>)
    | undefined;
  onReorderModule?:
    | ((moduleId: string, newPosition: string) => Promise<void>)
    | undefined;
  onAddModule?: (() => void) | undefined;
  onAddLesson?: ((moduleId: string) => void) | undefined;
  onDeleteLesson?: ((lessonId: string) => void) | undefined;
  onDeleteModule?: ((moduleId: string) => void) | undefined;
}

function getLessonIcon(type: LessonType) {
  switch (type) {
    case "video":
      return <Video className="h-4 w-4 text-rose-500" />;
    case "file":
      return <FileText className="h-4 w-4 text-blue-500" />;
    case "rich_text":
      return <FileCode className="h-4 w-4 text-emerald-500" />;
    default:
      return <FileText className="h-4 w-4 text-slate-500" />;
  }
}

function SortableLessonItem({
  lesson,
  sectionId,
  isFaculty,
  isActive,
  onDelete,
}: {
  lesson: StudentCurriculumLesson;
  sectionId: string;
  isFaculty?: boolean | undefined;
  isActive?: boolean | undefined;
  onDelete?: (() => void) | undefined;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isCompleted = lesson.progressStatus === "completed";
  const isLocked = lesson.isLocked;

  const content = (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
        isActive
          ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
          : isLocked
            ? "cursor-not-allowed opacity-75 text-slate-400 hover:bg-slate-50 dark:text-slate-500 dark:hover:bg-slate-900"
            : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60"
      }`}
    >
      <div className="flex items-center gap-2.5 truncate">
        {isFaculty && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}

        {isLocked ? (
          <Lock className="h-4 w-4 text-amber-500" />
        ) : (
          getLessonIcon(lesson.type)
        )}

        <span className="truncate">{lesson.title}</span>

        {isLocked && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Locked
          </span>
        )}

        {lesson.status === "draft" && isFaculty && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            Draft
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isCompleted && !isLocked && (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        )}

        {isLocked && lesson.unlocksAt && (
          <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
            <Clock className="h-3 w-3" />
            {new Date(lesson.unlocksAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}

        {isFaculty && onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onDelete();
            }}
            className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-700"
            title="Delete lesson"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );

  if (isFaculty) {
    return content;
  }

  return (
    <Link
      href={`/student/sections/${sectionId}/lessons/${lesson.id}`}
      className="block"
    >
      {content}
    </Link>
  );
}

export function ModuleTree({
  sectionId,
  modules: initialModules,
  isFaculty = false,
  activeLessonId,
  onReorderLesson,
  onAddModule,
  onAddLesson,
  onDeleteLesson,
  onDeleteModule,
}: ModuleTreeProps) {
  const [modules, setModules] = useState(initialModules);
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const toggleCollapse = (moduleId: string) => {
    setCollapsedMap((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  };

  const handleDragEnd = async (event: DragEndEvent, moduleId: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;

    const oldIndex = mod.lessons.findIndex((l) => l.id === active.id);
    const newIndex = mod.lessons.findIndex((l) => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistic UI update
    const reorderedLessons = arrayMove(mod.lessons, oldIndex, newIndex);
    const updatedModules = modules.map((m) =>
      m.id === moduleId ? { ...m, lessons: reorderedLessons } : m,
    );
    setModules(updatedModules);

    // Call server action to update fractional index if handler provided
    if (onReorderLesson) {
      try {
        await onReorderLesson(String(active.id), String(newIndex));
      } catch {
        // Rollback on error
        setModules(initialModules);
      }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Faculty Add Module Toolbar */}
      {isFaculty && onAddModule && (
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
          <span className="text-sm font-semibold text-slate-900 dark:text-white">
            Curriculum Structure
          </span>
          <button
            type="button"
            onClick={onAddModule}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Module
          </button>
        </div>
      )}

      {/* Modules List */}
      <div className="flex flex-col gap-3">
        {modules.map((mod) => {
          const isCollapsed = collapsedMap[mod.id] ?? false;

          return (
            <div
              key={mod.id}
              className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950"
            >
              {/* Module Header */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => toggleCollapse(mod.id)}
                  className="flex items-center gap-2 text-left font-semibold text-slate-900 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                  <span className="text-sm">{mod.title}</span>
                  {mod.status === "draft" && isFaculty && (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      Draft
                    </span>
                  )}
                </button>

                {isFaculty && (
                  <div className="flex items-center gap-1">
                    {onAddLesson && (
                      <button
                        type="button"
                        onClick={() => onAddLesson(mod.id)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        title="Add lesson to module"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                    {onDeleteModule && (
                      <button
                        type="button"
                        onClick={() => onDeleteModule(mod.id)}
                        className="rounded p-1 text-rose-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950 dark:hover:text-rose-300"
                        title="Delete module"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Module Lessons */}
              {!isCollapsed && (
                <div className="mt-2 pl-4 border-l-2 border-slate-100 dark:border-slate-800">
                  {mod.lessons.length === 0 ? (
                    <p className="py-2 text-xs italic text-slate-400">
                      No lessons in this module.
                    </p>
                  ) : isFaculty ? (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(e) => handleDragEnd(e, mod.id)}
                    >
                      <SortableContext
                        items={mod.lessons.map((l) => l.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="flex flex-col gap-1">
                          {mod.lessons.map((lesson) => (
                            <SortableLessonItem
                              key={lesson.id}
                              lesson={lesson}
                              sectionId={sectionId}
                              isFaculty={isFaculty}
                              isActive={lesson.id === activeLessonId}
                              onDelete={
                                onDeleteLesson
                                  ? () => onDeleteLesson(lesson.id)
                                  : undefined
                              }
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {mod.lessons.map((lesson) => (
                        <SortableLessonItem
                          key={lesson.id}
                          lesson={lesson}
                          sectionId={sectionId}
                          isFaculty={isFaculty}
                          isActive={lesson.id === activeLessonId}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
