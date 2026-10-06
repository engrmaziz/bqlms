import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-6 border-b border-zinc-800">
      <div>
        <h1
          id="page-heading"
          tabIndex={-1}
          className="text-2xl sm:text-3xl font-bold tracking-tight text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
        >
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-zinc-400 max-w-2xl">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-3 shrink-0">{actions}</div>
      )}
    </header>
  );
}
