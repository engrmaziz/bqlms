"use client";

import { History, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import { RichEditor } from "@/components/app/rich-editor";
import type { SyllabusVersion } from "@/modules/content";
import { publishSyllabusAction } from "@/modules/content/actions";

export interface SyllabusClientProps {
  sectionId: string;
  sectionCode: string;
  latestSyllabus: SyllabusVersion | null;
  history: SyllabusVersion[];
  renderedLatest?: React.ReactNode | undefined;
}

export function SyllabusClient({
  sectionId,
  sectionCode,
  latestSyllabus,
  history,
  renderedLatest,
}: SyllabusClientProps) {
  const router = useRouter();
  const [content, setContent] = useState<Record<string, unknown>>(
    latestSyllabus?.content || {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: `Syllabus: ${sectionCode}` }],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Welcome to this course. Review policies, expectations, and grading criteria below.",
            },
          ],
        },
      ],
    },
  );
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "preview" | "history">(
    "edit",
  );

  const handlePublish = async () => {
    if (
      !confirm(
        "Publish this syllabus version? Published versions are immutable.",
      )
    ) {
      return;
    }

    setIsPublishing(true);
    try {
      const res = await publishSyllabusAction({
        sectionId,
        content,
      });
      if (res.ok) {
        alert("Syllabus published successfully! Students have been notified.");
        router.refresh();
      }
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
              {sectionCode}
            </span>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Course Syllabus Management
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Current Version: v{latestSyllabus?.version || 0} • Published
            versions are immutable.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/faculty/sections/${sectionId}/builder`}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            Curriculum Builder
          </Link>

          <button
            type="button"
            onClick={handlePublish}
            disabled={isPublishing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {isPublishing ? "Publishing..." : "Publish New Version"}
          </button>
        </div>
      </div>

      {latestSyllabus && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Published Version: v{latestSyllabus.version}
            </h2>
            <span className="text-xs text-slate-500">
              Published:{" "}
              {new Date(latestSyllabus.publishedAt).toLocaleDateString()}
            </span>
          </div>
          {renderedLatest}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-slate-200 text-sm font-medium dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab("edit")}
          className={`border-b-2 pb-2 transition-colors ${
            activeTab === "edit"
              ? "border-indigo-600 font-semibold text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          Author & Edit
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-1.5 border-b-2 pb-2 transition-colors ${
            activeTab === "history"
              ? "border-indigo-600 font-semibold text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <History className="h-4 w-4" />
          Version History ({history.length})
        </button>
      </div>

      {activeTab === "edit" && (
        <div className="flex flex-col gap-2">
          <RichEditor initialContent={content} onChange={setContent} />
        </div>
      )}

      {activeTab === "history" && (
        <div className="flex flex-col gap-4">
          {history.length === 0 ? (
            <p className="text-sm italic text-slate-400">
              No published versions yet.
            </p>
          ) : (
            history.map((ver) => (
              <div
                key={ver.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                  <span className="font-bold text-slate-900 dark:text-white">
                    Version {ver.version}
                  </span>
                  <span className="text-xs text-slate-500">
                    Published: {new Date(ver.publishedAt).toLocaleString()}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Published by faculty. Immutable historical record.
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
