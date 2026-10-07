"use client";

import { CheckCircle2, Clock, Download, FileText, Lock } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { VideoPlayer } from "@/components/app/video-player";
import type { LessonType, VideoMetadata } from "@/modules/content";

export interface LessonRendererProps {
  lesson: {
    id: string;
    type: LessonType;
    title: string;
    body?: Record<string, unknown> | null | undefined;
    fileId?: string | null | undefined;
    file?:
      | {
          id: string;
          storageKey: string;
          declaredMime: string;
          sizeBytes: number;
        }
      | null
      | undefined;
    video?: VideoMetadata | null | undefined;
    estMinutes?: number | undefined;
    isLocked?: boolean | undefined;
    reason?: string | undefined;
    unlocksAt?: Date | string | undefined;
    progress?:
      | {
          status: "not_started" | "in_progress" | "completed";
          progressPct: number;
        }
      | null
      | undefined;
  };
  renderedBody?: React.ReactNode | undefined;
}

export function LessonRenderer({ lesson, renderedBody }: LessonRendererProps) {
  const [_dwellSeconds, setDwellSeconds] = useState(0);
  const [isEndReached, setIsEndReached] = useState(false);
  const [progressPct, setProgressPct] = useState(
    lesson.progress?.progressPct || 0,
  );
  const [isCompleted, setIsCompleted] = useState(
    lesson.progress?.status === "completed",
  );

  const lastHeartbeatTimeRef = useRef<number>(Date.now());
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const videoIntervalsRef = useRef<[number, number][]>([]);
  const dwellSecondsRef = useRef<number>(0);
  const isEndReachedRef = useRef<boolean>(false);

  // 1. Send heartbeat helper
  const sendHeartbeat = useCallback(
    async (isBeacon = false) => {
      if (lesson.isLocked) return;

      const payload = {
        lessonId: lesson.id,
        dwellSeconds: dwellSecondsRef.current,
        isEndReached: isEndReachedRef.current,
        intervals: videoIntervalsRef.current,
        isBeacon,
      };

      if (
        isBeacon &&
        typeof navigator !== "undefined" &&
        navigator.sendBeacon
      ) {
        const blob = new Blob([JSON.stringify(payload)], {
          type: "application/json",
        });
        navigator.sendBeacon("/api/v1/progress/heartbeat", blob);
        return;
      }

      try {
        const res = await fetch("/api/v1/progress/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.progressPct !== undefined) {
            setProgressPct(data.progressPct);
          }
          if (data.status === "completed") {
            setIsCompleted(true);
          }
          lastHeartbeatTimeRef.current = Date.now();
        }
      } catch {
        // Background retry
      }
    },
    [lesson.id, lesson.isLocked],
  );

  // 2. Dwell timer & regular 60-second heartbeat
  useEffect(() => {
    if (lesson.isLocked) return;

    const timer = setInterval(() => {
      dwellSecondsRef.current += 1;
      setDwellSeconds(dwellSecondsRef.current);

      // Check if 60 seconds have elapsed since last heartbeat
      if (Date.now() - lastHeartbeatTimeRef.current >= 60_000) {
        sendHeartbeat(false);
      }
    }, 1000);

    const handlePageHide = () => {
      sendHeartbeat(true);
    };

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", handlePageHide);
      sendHeartbeat(true);
    };
  }, [lesson.isLocked, sendHeartbeat]);

  // 3. Scroll to end detection for rich text
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 30) {
      if (!isEndReached) {
        setIsEndReached(true);
        isEndReachedRef.current = true;
        // Trigger heartbeat upon reaching end
        setTimeout(() => sendHeartbeat(false), 500);
      }
    }
  };

  // If locked, render deterministic safe stub
  if (lesson.isLocked) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-amber-200 bg-amber-50/50 p-12 text-center dark:border-amber-900/60 dark:bg-amber-950/20">
        <div className="mb-4 rounded-full bg-amber-100 p-4 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
          <Lock className="h-8 w-8" />
        </div>
        <h3 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">
          {lesson.title}
        </h3>
        <p className="max-w-md text-sm text-amber-800 dark:text-amber-300">
          {lesson.reason || "This lesson is currently locked."}
        </p>
        {lesson.unlocksAt && (
          <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            <Clock className="h-4 w-4" />
            Unlocks:{" "}
            {new Date(lesson.unlocksAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header with Title and Progress */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {lesson.title}
          </h1>
          <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="capitalize">{lesson.type.replace("_", " ")}</span>
            <span>•</span>
            <span>~{lesson.estMinutes || 5} min read</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isCompleted ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Completed
            </span>
          ) : (
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
              <span>{progressPct}% completed</span>
              <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300 dark:bg-indigo-400"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lesson Body depending on type */}
      {lesson.type === "rich_text" && (
        <div
          ref={contentContainerRef}
          onScroll={handleScroll}
          className="max-h-[800px] overflow-y-auto rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900"
        >
          {renderedBody ?? (
            <p className="text-sm italic text-slate-400">
              No content provided.
            </p>
          )}
        </div>
      )}

      {lesson.type === "video" && (
        <div className="flex flex-col gap-4">
          {lesson.video?.url ? (
            <VideoPlayer
              urlOrId={lesson.video.url}
              title={lesson.title}
              onProgress={(seconds: number) => {
                const start = Math.max(0, seconds - 2);
                videoIntervalsRef.current.push([start, seconds]);
              }}
            />
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              No video source attached.
            </div>
          )}
        </div>
      )}

      {lesson.type === "file" && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
              <FileText className="h-8 w-8" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-slate-900 dark:text-white">
                {lesson.file?.storageKey?.split("/").pop() || "Attached File"}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lesson.file?.declaredMime || "Document"} •{" "}
                {lesson.file?.sizeBytes
                  ? `${(lesson.file.sizeBytes / 1024).toFixed(1)} KB`
                  : ""}
              </p>
            </div>
            {lesson.fileId && (
              <a
                href={`/api/v1/files/${lesson.fileId}/download`}
                download
                onClick={() => {
                  // Mark as completed on download
                  setTimeout(() => sendHeartbeat(false), 500);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
