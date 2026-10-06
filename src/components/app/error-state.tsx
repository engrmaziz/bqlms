import { AlertCircle, RefreshCw } from "lucide-react";

export function ErrorState({
  code = "INTERNAL",
  message = "An unexpected error occurred while loading this page.",
  requestId,
  onRetry,
}: {
  code?: string;
  message?: string;
  requestId?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="p-6 rounded-2xl bg-red-950/40 border border-red-800/80 text-zinc-200"
    >
      <div className="flex items-start gap-4">
        <div className="p-2 bg-red-900/60 rounded-xl text-red-400 shrink-0 mt-0.5">
          <AlertCircle className="w-5 h-5" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-red-200 mb-1">
            {code === "FORBIDDEN"
              ? "Access Denied"
              : code === "NOT_FOUND"
                ? "Not Found"
                : "Error Loading Data"}
          </h3>
          <p className="text-sm text-red-300/90 mb-3">{message}</p>
          {requestId && (
            <p className="text-xs font-mono text-red-400/80 mb-4">
              Request ID: {requestId}
            </p>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[44px] min-w-[44px] rounded-lg bg-red-900/80 hover:bg-red-800 text-white text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-zinc-950"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
