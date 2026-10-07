"use client";

import { AlertCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  extractYouTubeVideoId,
  getPrivacyEnhancedEmbedUrl,
  UNLISTED_VIDEO_DISCLAIMER,
} from "@/lib/video/youtube";

export interface VideoPlayerProps {
  urlOrId: string;
  title?: string;
  showDisclaimer?: boolean;
  onProgress?: (seconds: number, state: "playing" | "paused" | "ended") => void;
  className?: string;
}

export function VideoPlayer({
  urlOrId,
  title = "Course Video",
  showDisclaimer = true,
  onProgress,
  className = "",
}: VideoPlayerProps) {
  const videoId =
    extractYouTubeVideoId(urlOrId) ?? (urlOrId.length === 11 ? urlOrId : null);
  const containerRef = useRef<HTMLDivElement>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSeconds, setPlaybackSeconds] = useState(0);

  useEffect(() => {
    if (!videoId) return;

    const handleMessage = (event: MessageEvent) => {
      if (
        typeof event.origin === "string" &&
        !event.origin.includes("youtube") &&
        !event.origin.includes("youtube-nocookie")
      ) {
        return;
      }

      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.event === "onStateChange") {
          // YT.PlayerState: 1 = PLAYING, 2 = PAUSED, 0 = ENDED
          if (data.info === 1) {
            setIsPlaying(true);
            onProgress?.(playbackSeconds, "playing");
          } else if (data.info === 2) {
            setIsPlaying(false);
            onProgress?.(playbackSeconds, "paused");
          } else if (data.info === 0) {
            setIsPlaying(false);
            onProgress?.(playbackSeconds, "ended");
          }
        }
      } catch {
        // Ignore non-JSON postMessages from unrelated frames
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [videoId, playbackSeconds, onProgress]);

  useEffect(() => {
    if (!videoId) return;

    // Heartbeat every 60 seconds during active playback
    if (isPlaying) {
      heartbeatTimerRef.current = setInterval(() => {
        setPlaybackSeconds((prev) => {
          const next = prev + 60;
          onProgress?.(next, "playing");
          return next;
        });
      }, 60000);
    } else {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    }

    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };
  }, [isPlaying, videoId, onProgress]);

  if (!videoId) {
    return (
      <div
        data-testid="video-error"
        className="flex items-center gap-3 p-4 bg-red-950/40 border border-red-800 rounded-xl text-red-200 text-sm"
      >
        <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
        <p>Invalid or unsupported YouTube video URL.</p>
      </div>
    );
  }

  const embedUrl = getPrivacyEnhancedEmbedUrl(videoId, {
    enableJsApi: true,
  });

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-zinc-800 shadow-xl">
        <iframe
          ref={containerRef as unknown as React.RefObject<HTMLIFrameElement>}
          data-testid="youtube-iframe"
          src={embedUrl}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="w-full h-full border-0"
        />
      </div>

      {showDisclaimer && (
        <div
          data-testid="video-disclaimer"
          className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400"
        >
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>{UNLISTED_VIDEO_DISCLAIMER}</span>
        </div>
      )}
    </div>
  );
}
