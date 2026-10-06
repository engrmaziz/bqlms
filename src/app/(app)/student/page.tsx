import { Award, BookOpen, Calendar, Clock } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { getActor } from "@/lib/auth/session";

export default async function StudentDashboardPage() {
  const actor = await getActor();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Portal"
        description={`Welcome back, ${actor?.name ?? "Student"}. Here is your academic overview.`}
      />

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400">
              Enrolled Courses
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-white mt-1">0</p>
          </div>
          <div className="p-3 bg-indigo-600/10 text-indigo-400 rounded-xl">
            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
          </div>
        </div>

        <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400">Due Assignments</p>
            <p className="text-2xl sm:text-3xl font-bold text-white mt-1">0</p>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
            <Clock className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
          </div>
        </div>

        <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400">
              Completed Credits
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-white mt-1">0</p>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <Award className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Active Courses Empty State */}
      <div className="p-8 border border-zinc-800 rounded-2xl bg-zinc-900/40 text-center space-y-3">
        <div className="mx-auto w-12 h-12 rounded-full bg-indigo-600/10 text-indigo-400 flex items-center justify-center">
          <Calendar className="w-6 h-6" aria-hidden="true" />
        </div>
        <h2 className="text-base font-semibold text-white">
          No active enrollments
        </h2>
        <p className="text-sm text-zinc-400 max-w-sm mx-auto">
          You are currently not enrolled in any course sections for the current
          academic term.
        </p>
      </div>
    </div>
  );
}
