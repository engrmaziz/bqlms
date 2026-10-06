import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: typeof Inbox;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 sm:p-12 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/30">
      <div className="p-3 bg-zinc-800/80 rounded-2xl mb-4 text-zinc-400">
        <Icon className="w-8 h-8" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-zinc-100 mb-1">{title}</h3>
      <p className="text-sm text-zinc-400 max-w-sm mb-6">{description}</p>
      {action && <div className="flex items-center">{action}</div>}
    </div>
  );
}
