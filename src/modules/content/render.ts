import React, { type ReactNode } from "react";

export interface ProseMirrorNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
  marks?: ProseMirrorMark[];
  text?: string;
}

export interface ProseMirrorMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface ProseMirrorDoc {
  type: "doc";
  content?: ProseMirrorNode[];
}

const ALLOWED_EMBED_DOMAINS = [
  "https://www.youtube.com",
  "https://www.youtube-nocookie.com",
];

function isAllowedEmbedSrc(src: string): boolean {
  try {
    const url = new URL(src);
    return ALLOWED_EMBED_DOMAINS.some(
      (domain) => url.origin.toLowerCase() === domain.toLowerCase(),
    );
  } catch {
    return false;
  }
}

/**
 * Safely renders a text node with its marks (bold, italic, strike, code, link).
 */
function renderTextWithMarks(
  text: string,
  marks: ProseMirrorMark[] = [],
  key: string,
): ReactNode {
  let element: ReactNode = text;

  for (let i = 0; i < marks.length; i++) {
    const mark = marks[i];
    if (!mark) continue;
    const markKey = `${key}-mark-${i}`;

    switch (mark.type) {
      case "bold":
      case "strong":
        element = React.createElement("strong", { key: markKey }, element);
        break;
      case "italic":
      case "em":
        element = React.createElement("em", { key: markKey }, element);
        break;
      case "strike":
        element = React.createElement("s", { key: markKey }, element);
        break;
      case "code":
        element = React.createElement(
          "code",
          {
            key: markKey,
            className:
              "rounded bg-slate-100 px-1 py-0.5 font-mono text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-200",
          },
          element,
        );
        break;
      case "link": {
        const href =
          typeof mark.attrs?.href === "string" ? mark.attrs.href : "#";
        const isSafe = /^https?:\/\//i.test(href);
        element = React.createElement(
          "a",
          {
            key: markKey,
            href: isSafe ? href : "#",
            target: "_blank",
            rel: "noopener noreferrer",
            className:
              "text-indigo-600 underline hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300",
          },
          element,
        );
        break;
      }
    }
  }

  return React.createElement(React.Fragment, { key }, element);
}

/**
 * Recursively maps a single ProseMirror node to a React component.
 * Raw HTML nodes are strictly rejected / discarded.
 */
function renderNode(node: ProseMirrorNode, index: number): ReactNode {
  const key = `node-${index}`;

  if (node.type === "text" && typeof node.text === "string") {
    return renderTextWithMarks(node.text, node.marks, key);
  }

  const children = node.content?.map((child, i) => renderNode(child, i));

  switch (node.type) {
    case "paragraph":
      return React.createElement(
        "p",
        {
          key,
          className: "mb-4 leading-relaxed text-slate-700 dark:text-slate-300",
        },
        children && children.length > 0 ? children : React.createElement("br"),
      );

    case "heading": {
      const level = Number(node.attrs?.level) || 1;
      const tag = `h${Math.min(6, Math.max(1, level))}`;
      const headingClasses: Record<number, string> = {
        1: "mb-6 mt-8 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white",
        2: "mb-4 mt-6 text-2xl font-bold tracking-tight text-slate-900 dark:text-white",
        3: "mb-3 mt-5 text-xl font-semibold text-slate-900 dark:text-white",
        4: "mb-2 mt-4 text-lg font-semibold text-slate-900 dark:text-white",
      };
      return React.createElement(
        tag,
        { key, className: headingClasses[level] || headingClasses[3] },
        children,
      );
    }

    case "bulletList":
      return React.createElement(
        "ul",
        {
          key,
          className:
            "mb-4 list-disc pl-6 space-y-1 text-slate-700 dark:text-slate-300",
        },
        children,
      );

    case "orderedList":
      return React.createElement(
        "ol",
        {
          key,
          className:
            "mb-4 list-decimal pl-6 space-y-1 text-slate-700 dark:text-slate-300",
        },
        children,
      );

    case "listItem":
      return React.createElement(
        "li",
        { key, className: "leading-relaxed" },
        children,
      );

    case "blockquote":
      return React.createElement(
        "blockquote",
        {
          key,
          className:
            "mb-4 border-l-4 border-indigo-500 pl-4 italic text-slate-600 dark:border-indigo-400 dark:text-slate-400",
        },
        children,
      );

    case "codeBlock":
      return React.createElement(
        "pre",
        {
          key,
          className:
            "mb-4 overflow-x-auto rounded-lg bg-slate-900 p-4 font-mono text-sm text-slate-100",
        },
        React.createElement("code", null, children),
      );

    case "horizontalRule":
      return React.createElement("hr", {
        key,
        className: "my-6 border-slate-200 dark:border-slate-800",
      });

    case "image": {
      const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
      const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
      const title =
        typeof node.attrs?.title === "string" ? node.attrs.title : undefined;

      // Allow /api/v1/media/* or safe external https URLs
      const isAllowed =
        src.startsWith("/api/v1/media/") ||
        src.startsWith("https://") ||
        src.startsWith("blob:");

      if (!isAllowed) return null;

      const imgElement = React.createElement("img", {
        src,
        alt,
        title,
        className:
          "max-h-[600px] w-auto max-w-full rounded-lg border border-slate-200 object-contain shadow-sm dark:border-slate-800",
        loading: "lazy",
      });

      const captionElement = alt
        ? React.createElement(
            "figcaption",
            {
              className:
                "mt-2 text-center text-xs text-slate-500 dark:text-slate-400",
            },
            alt,
          )
        : null;

      return React.createElement(
        "figure",
        { key, className: "my-6" },
        imgElement,
        captionElement,
      );
    }

    case "iframe":
    case "youtube": {
      const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
      if (!isAllowedEmbedSrc(src)) {
        return React.createElement(
          "div",
          {
            key,
            className:
              "my-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
          },
          "Blocked external embed from unauthorized domain.",
        );
      }
      return React.createElement(
        "div",
        {
          key,
          className:
            "my-6 aspect-video w-full overflow-hidden rounded-lg shadow-sm",
        },
        React.createElement("iframe", {
          src,
          title: "Embedded Content",
          className: "h-full w-full border-0",
          allow:
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
          allowFullScreen: true,
        }),
      );
    }

    default:
      // Unknown or disallowed nodes (e.g., raw HTML)
      return children || null;
  }
}

/**
 * Server-safe ProseMirror renderer.
 * Maps AST nodes to React elements against a strict allowlist.
 */
export function renderProseMirror(doc: unknown): ReactNode {
  if (!doc || typeof doc !== "object") {
    return null;
  }

  const pmDoc = doc as ProseMirrorDoc;
  if (pmDoc.type !== "doc" || !Array.isArray(pmDoc.content)) {
    // If it's a generic structured JSON object (e.g. syllabus key-value sections)
    const entries = Object.entries(doc as Record<string, unknown>);
    if (entries.length > 0) {
      return React.createElement(
        "div",
        { className: "space-y-4" },
        entries.map(([key, val], idx) => {
          const title = key
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (str) => str.toUpperCase());
          return React.createElement(
            "div",
            { key: `entry-${idx}` },
            React.createElement(
              "h3",
              {
                className: "text-base font-bold text-slate-900 dark:text-white",
              },
              title,
            ),
            React.createElement(
              "p",
              {
                className:
                  "mt-1 text-slate-700 dark:text-slate-300 text-sm whitespace-pre-wrap",
              },
              typeof val === "string" ? val : JSON.stringify(val),
            ),
          );
        }),
      );
    }
    return null;
  }

  return React.createElement(
    "div",
    { className: "prose prose-slate max-w-none dark:prose-invert" },
    pmDoc.content.map((node, i) => renderNode(node, i)),
  );
}
