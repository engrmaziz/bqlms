"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function CopyLinkButton({
  url,
  label = "Copy Link",
}: {
  url: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Link copied to clipboard" : label}
        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] min-w-[44px] rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-[0.98]"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            <span className="text-emerald-400">Copied!</span>
          </>
        ) : (
          <>
            <Copy className="w-4 h-4 text-zinc-400" aria-hidden="true" />
            <span>{label}</span>
          </>
        )}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Link copied to clipboard" : ""}
      </span>
    </div>
  );
}
