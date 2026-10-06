import { BookOpen, Calendar, Clock, Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { getActor } from "@/lib/auth/session";

export default async function FacultyDashboardPage() {
  const actor = await getActor();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Faculty Workspace"
        description={`Welcome back, Professor ${actor?.name ?? ""}. Manage academic sections, syllabus items, and student progress.`}
      />

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400">
              Assigned Sections
            </p>
            <p className="text-3xl font-bold text-white mt-1">0</p>
          </div>
          <div className="p-3 bg-indigo-600/10 text-indigo-400 rounded-xl">
            <BookOpen className="w-6 h-6" aria-hidden="true" />
          </div>
        </div>

        <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400">
              Enrolled Students
            </p>
            <p className="text-3xl font-bold text-white mt-1">0</p>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <Users className="w-6 h-6" aria-hidden="true" />
          </div>
        </div>

        <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-400">
              Upcoming Sessions
            </p>
            <p className="text-3xl font-bold text-white mt-1">0</p>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
            <Clock className="w-6 h-6" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Course Sections Empty State / Section List */}
      <div className="p-8 border border-zinc-800 rounded-2xl bg-zinc-900/40 text-center space-y-3">
        <div className="mx-auto w-12 h-12 rounded-full bg-indigo-600/10 text-indigo-400 flex items-center justify-center">
          <Calendar className="w-6 h-6" aria-hidden="true" />
        </div>
        <h2 className="text-base font-semibold text-white">
          No active course sections
        </h2>
        <p className="text-sm text-zinc-400 max-w-md mx-auto">
          You are currently not assigned to any course sections for the current
          academic term. Contact the college registrar for scheduling updates.
        </p>
      </div>
    </div>
  );
}
