"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createTermAction } from "@/modules/academics/actions";

export function CreateTermDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [censusDate, setCensusDate] = useState("");
  const [status, setStatus] = useState<"planned" | "active" | "closed">(
    "planned",
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await createTermAction({
        name,
        startsOn: new Date(startsOn).toISOString(),
        endsOn: new Date(endsOn).toISOString(),
        censusDate: new Date(censusDate).toISOString(),
        status,
      });

      if (!res.ok) {
        setError(res.error.message);
        setLoading(false);
        return;
      }

      setOpen(false);
      setName("");
      setStartsOn("");
      setEndsOn("");
      setCensusDate("");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create term.");
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
        New Term
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h2 className="text-lg font-semibold text-white">
              Create Academic Term
            </h2>

            {error && (
              <div className="p-3 bg-red-950/60 border border-red-800 rounded text-red-300 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  <span>Term Name</span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fall 2026"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    <span>Start Date</span>
                    <input
                      type="date"
                      required
                      value={startsOn}
                      onChange={(e) => setStartsOn(e.target.value)}
                      className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    <span>End Date</span>
                    <input
                      type="date"
                      required
                      value={endsOn}
                      onChange={(e) => setEndsOn(e.target.value)}
                      className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  <span>Census Date (Drop Deadline)</span>
                  <input
                    type="date"
                    required
                    value={censusDate}
                    onChange={(e) => setCensusDate(e.target.value)}
                    className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  <span>Initial Status</span>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(
                        e.target.value as "planned" | "active" | "closed",
                      )
                    }
                    className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="planned">Planned</option>
                    <option value="active">Active</option>
                    <option value="closed">Closed</option>
                  </select>
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
                  {loading ? "Creating..." : "Save Term"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
