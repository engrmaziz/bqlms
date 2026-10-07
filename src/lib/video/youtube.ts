export const UNLISTED_VIDEO_DISCLAIMER =
  "Notice: An unlisted YouTube video can be viewed by anyone who possesses the link. Do not upload confidential college records or private student data.";

export const YOUTUBE_EMBED_BASE = "https://www.youtube-nocookie.com/embed";

// 11-character alphanumeric, underscore, hyphen ID standard in YouTube
const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

export function extractYouTubeVideoId(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase();

    // Check allowed domains
    const isStandardYouTube =
      hostname === "www.youtube.com" ||
      hostname === "youtube.com" ||
      hostname === "m.youtube.com";

    const isShortenedYouTube = hostname === "youtu.be";

    const isPrivacyYouTube =
      hostname === "www.youtube-nocookie.com" ||
      hostname === "youtube-nocookie.com";

    if (!isStandardYouTube && !isShortenedYouTube && !isPrivacyYouTube) {
      return null;
    }

    // 1. Shortened youtu.be/<id>
    if (isShortenedYouTube) {
      const pathname = parsed.pathname.slice(1);
      const id = pathname.split("/")[0] ?? "";
      return YOUTUBE_ID_REGEX.test(id) ? id : null;
    }

    // 2. Embed URLs: /embed/<id>
    if (parsed.pathname.startsWith("/embed/")) {
      const parts = parsed.pathname.split("/embed/");
      const id = parts[1]?.split("/")[0]?.split("?")[0] ?? "";
      return YOUTUBE_ID_REGEX.test(id) ? id : null;
    }

    // 3. Standard /watch?v=<id>
    if (isStandardYouTube && parsed.pathname === "/watch") {
      const id = parsed.searchParams.get("v") ?? "";
      return YOUTUBE_ID_REGEX.test(id) ? id : null;
    }

    return null;
  } catch {
    return null;
  }
}

export function isValidYouTubeUrl(url: string): boolean {
  return extractYouTubeVideoId(url) !== null;
}

export function getPrivacyEnhancedEmbedUrl(
  videoId: string,
  options?: {
    enableJsApi?: boolean;
    origin?: string;
    autoPlay?: boolean;
  },
): string {
  const url = new URL(`${YOUTUBE_EMBED_BASE}/${videoId}`);
  if (options?.enableJsApi ?? true) {
    url.searchParams.set("enablejsapi", "1");
  }
  if (options?.origin) {
    url.searchParams.set("origin", options.origin);
  }
  if (options?.autoPlay) {
    url.searchParams.set("autoplay", "1");
  }
  url.searchParams.set("rel", "0");
  url.searchParams.set("modestbranding", "1");

  return url.toString();
}
