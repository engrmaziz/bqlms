"use client";

import { CalendarPlus, UserMinus, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  addScheduleAction,
  assignInstructorAction,
} from "@/modules/academics/actions";
import { dropEnrollmentAction } from "@/modules/enrollment/actions";

export function DropStudentButton({
  sectionId,
  studentId,
  studentName,
}: {
  sectionId: string;
  studentId: string;
  studentName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDrop = async () => {
    if (
      !confirm(
        `Are you sure you want to drop ${studentName} from this section?`,
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      const res = await dropEnrollmentAction({
        sectionId,
        studentId,
        reason: "Registrar administrative drop",
        override: true,
      });

      if (!res.ok) {
        alert(res.error.message);
        return;
      }

      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to drop student.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDrop}
      disabled={loading}
      className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
    >
      <UserMinus className="w-3.5 h-3.5" />
      {loading ? "Dropping..." : "Drop"}
    </button>
  );
}

export function AddInstructorModal({
  sectionId,
  facultyUsers,
}: {
  sectionId: string;
  facultyUsers: Array<{ id: string; name: string; email: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState(facultyUsers[0]?.id || "");
  const [role, setRole] = useState<"lead" | "co" | "ta">("lead");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await assignInstructorAction({
        sectionId,
        userId,
        role,
      });

      if (!res.ok) {
        alert(res.error.message);
        setLoading(false);
        return;
      }

      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      alert(
        err instanceof Error ? err.message : "Failed to assign instructor.",
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
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs font-medium transition-colors"
      >
        <UserPlus className="w-3.5 h-3.5" />
        Assign Instructor
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-white">
              Assign Instructor
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  <span>Faculty Member</span>
                  <select
                    required
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white text-xs focus:border-indigo-500 focus:outline-none"
                  >
                    {facultyUsers.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.email})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  <span>Instructor Role</span>
                  <select
                    value={role}
                    onChange={(e) =>
                      setRole(e.target.value as "lead" | "co" | "ta")
                    }
                    className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white text-xs focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="lead">Lead Instructor</option>
                    <option value="co">Co-Instructor</option>
                    <option value="ta">Teaching Assistant (TA)</option>
                  </select>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3 py-1.5 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 rounded text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded text-xs font-medium"
                >
                  {loading ? "Assigning..." : "Assign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function AddScheduleModal({ sectionId }: { sectionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [weekday, setWeekday] = useState(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:30");
  const [room, setRoom] = useState("Hall A");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await addScheduleAction({
        sectionId,
        weekday: Number(weekday),
        startTime,
        endTime,
        room: room.trim() || null,
      });

      if (!res.ok) {
        alert(res.error.message);
        setLoading(false);
        return;
      }

      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add schedule.");
    } finally {
      setLoading(false);
    }
  };

  const WEEKDAYS = [
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
    { value: 7, label: "Sunday" },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs font-medium transition-colors"
      >
        <CalendarPlus className="w-3.5 h-3.5" />
        Add Schedule Time
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-white">
              Add Meeting Time
            </h3>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  <span>Day of Week</span>
                  <select
                    value={weekday}
                    onChange={(e) => setWeekday(Number(e.target.value))}
                    className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white text-xs focus:border-indigo-500 focus:outline-none"
                  >
                    {WEEKDAYS.map((w) => (
                      <option key={w.value} value={w.value}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    <span>Start Time</span>
                    <input
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    <span>End Time</span>
                    <input
                      type="time"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  <span>Room / Location</span>
                  <input
                    type="text"
                    placeholder="e.g. Science Hall 102"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-white text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3 py-1.5 border border-zinc-700 hover:bg-zinc-800 text-zinc-300 rounded text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded text-xs font-medium"
                >
                  {loading ? "Adding..." : "Add Time"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
