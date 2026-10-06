"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createCourseAction } from "@/modules/academics/actions";

export function CreateCourseDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [credits, setCredits] = useState(3);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await createCourseAction({
        code,
        title,
        credits: Number(credits),
      });

      if (!res.ok) {
        setError(res.error.message);
        setLoading(false);
        return;
      }

      setOpen(false);
      setCode("");
      setTitle("");
      setCredits(3);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create course.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
      >
        <Plus className="w-4 h-4" />
        New Course
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h2 className="text-lg font-semibold text-white">
              Add Course to Catalog
            </h2>

            {error && (
              <div className="p-3 bg-red-950/60 border border-red-800 rounded text-red-300 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    <span>Course Code</span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CS101"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    <span>Credits</span>
                    <input
                      type="number"
                      required
                      min={1}
                      max={20}
                      value={credits}
                      onChange={(e) => setCredits(Number(e.target.value))}
                      className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  <span>Course Title</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Introduction to Computer Science"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 rounded text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
                >
                  {loading ? "Adding..." : "Add Course"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
