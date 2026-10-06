"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSectionAction } from "@/modules/academics/actions";

interface Option {
  id: string;
  label: string;
}

export function CreateSectionDialog({
  courses,
  terms,
}: {
  courses: Option[];
  terms: Option[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [courseId, setCourseId] = useState(courses[0]?.id || "");
  const [termId, setTermId] = useState(terms[0]?.id || "");
  const [code, setCode] = useState("SEC-01");
  const [capacity, setCapacity] = useState(30);
  const [delivery, setDelivery] = useState<"in_person" | "online" | "hybrid">(
    "in_person",
  );
  const [status, setStatus] = useState<"draft" | "published" | "archived">(
    "published",
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await createSectionAction({
        courseId,
        termId,
        code,
        capacity: Number(capacity),
        delivery,
        status,
      });

      if (!res.ok) {
        setError(res.error.message);
        setLoading(false);
        return;
      }

      setOpen(false);
      setCode("SEC-01");
      setCapacity(30);
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to create section.",
      );
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
        New Section
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h2 className="text-lg font-semibold text-white">Create Section</h2>

            {error && (
              <div className="p-3 bg-red-950/60 border border-red-800 rounded text-red-300 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  <span>Term</span>
                  <select
                    required
                    value={termId}
                    onChange={(e) => setTermId(e.target.value)}
                    className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    {terms.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  <span>Course</span>
                  <select
                    required
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    <span>Section Code</span>
                    <input
                      type="text"
                      required
                      placeholder="SEC-01"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    <span>Max Capacity</span>
                    <input
                      type="number"
                      required
                      min={1}
                      max={500}
                      value={capacity}
                      onChange={(e) => setCapacity(Number(e.target.value))}
                      className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    <span>Delivery Mode</span>
                    <select
                      value={delivery}
                      onChange={(e) =>
                        setDelivery(
                          e.target.value as "in_person" | "online" | "hybrid",
                        )
                      }
                      className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="in_person">In Person</option>
                      <option value="online">Online</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    <span>Status</span>
                    <select
                      value={status}
                      onChange={(e) =>
                        setStatus(
                          e.target.value as "draft" | "published" | "archived",
                        )
                      }
                      className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                      <option value="archived">Archived</option>
                    </select>
                  </label>
                </div>
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
                  {loading ? "Creating..." : "Create Section"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
