import { FileQuestion } from "lucide-react";
import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl mb-4 text-zinc-400">
        <FileQuestion className="w-10 h-10" aria-hidden="true" />
      </div>
      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
        Page Not Found
      </h1>
      <p className="text-zinc-400 max-w-md mb-6 text-sm">
        The page or resource you requested could not be found or you do not have
        permission to access it.
      </p>
      <Link
        href="/"
        prefetch={false}
        className="inline-flex items-center justify-center px-5 py-2.5 min-h-[44px] min-w-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        Return to Portal
      </Link>
    </div>
  );
}
