"use client";

import { useState } from "react";
import { FileUploader } from "@/components/app/file-uploader";
import { VideoPlayer } from "@/components/app/video-player";
import type { FileRecord } from "@/modules/files/schema";

export function UploadClient() {
  const [videoUrl, setVideoUrl] = useState(
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  );
  const [activeVideo, setActiveVideo] = useState(
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  );
  const [lastUploaded, setLastUploaded] = useState<FileRecord | null>(null);

  return (
    <div className="space-y-8">
      {/* File Upload Section */}
      <section className="p-6 bg-zinc-900/60 border border-zinc-800 rounded-2xl space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Upload Documents & Media
          </h2>
          <p className="text-xs text-zinc-400">
            Upload files with automatic size check, client-side image
            compression, and server-side verification.
          </p>
        </div>

        <FileUploader
          purpose="lesson_document"
          onSuccess={(file) => setLastUploaded(file)}
        />

        {lastUploaded && (
          <div className="mt-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-1 text-xs">
            <p className="font-medium text-zinc-200">Latest Upload Details:</p>
            <p className="text-zinc-400">
              ID:{" "}
              <span className="font-mono text-zinc-300">{lastUploaded.id}</span>
            </p>
            <p className="text-zinc-400">
              Purpose:{" "}
              <span className="text-zinc-300">{lastUploaded.purpose}</span>
            </p>
            <p className="text-zinc-400">
              Storage Key:{" "}
              <span className="font-mono text-zinc-300">
                {lastUploaded.storageKey}
              </span>
            </p>
          </div>
        )}
      </section>

      {/* Video Player Section */}
      <section className="p-6 bg-zinc-900/60 border border-zinc-800 rounded-2xl space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Video Lesson Preview
          </h2>
          <p className="text-xs text-zinc-400">
            Preview unlisted YouTube videos using the privacy-enhanced embed
            domain.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            data-testid="video-url-input"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="Enter YouTube URL (e.g. https://www.youtube.com/watch?v=...)"
            className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            data-testid="load-video-button"
            onClick={() => setActiveVideo(videoUrl)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Load Video
          </button>
        </div>

        <div className="max-w-2xl">
          <VideoPlayer urlOrId={activeVideo} title="Lecture Preview" />
        </div>
      </section>
    </div>
  );
}
