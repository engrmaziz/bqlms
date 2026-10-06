"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/app/error-state";

export default function AppErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string; code?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console in client
    console.error("App boundary error caught:", error);
  }, [error]);

  const code = error.code || "INTERNAL";
  const requestId = error.digest || "req-client";

  return (
    <div className="py-8 max-w-2xl mx-auto">
      <ErrorState
        code={code}
        message={error.message || "An unexpected error occurred."}
        requestId={requestId}
        onRetry={() => reset()}
      />
    </div>
  );
}
