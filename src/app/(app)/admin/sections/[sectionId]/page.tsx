import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { getSectionDetailsQuery } from "@/modules/academics";
import {
  getEnrollmentsForSectionQuery,
  getSectionCapacityQuery,
} from "@/modules/enrollment";
import { listUsersWithProfiles } from "@/modules/identity";
import {
  AddInstructorModal,
  AddScheduleModal,
  DropStudentButton,
} from "./section-actions";

interface SectionDetailsPageProps {
  params: Promise<{
    sectionId: string;
  }>;
}

const WEEKDAY_NAMES: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

export default async function AdminSectionDetailsPage({
  params,
}: SectionDetailsPageProps) {
  const { sectionId } = await params;

  const [section, enrollments, capacityStats, allUsers] = await Promise.all([
    getSectionDetailsQuery(sectionId),
    getEnrollmentsForSectionQuery(sectionId),
    getSectionCapacityQuery(sectionId),
    listUsersWithProfiles(),
  ]);

  if (!section) {
    notFound();
  }

  const facultyUsers = allUsers
    .filter((u) => u.roles.includes("faculty"))
    .map((u) => ({ id: u.id, name: u.name, email: u.email }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <Link
          href="/admin/sections"
          className="inline-flex items-center gap-1 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sections
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <PageHeader
            title={`${section.course.code} - ${section.code}`}
            description={`${section.course.title} • ${section.term.name}`}
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-right">
            <div className="text-xs text-zinc-400">Enrolled / Capacity</div>
            <div className="text-lg font-bold text-white">
              <span className="text-emerald-400">
                {capacityStats.enrolledCount}
              </span>{" "}
              / {capacityStats.capacity}
              {capacityStats.waitlistedCount > 0 && (
                <span className="text-xs font-normal text-amber-400 ml-2">
                  ({capacityStats.waitlistedCount} waitlisted)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Instructors Panel */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              Assigned Instructors
            </h3>
            <AddInstructorModal
              sectionId={section.id}
              facultyUsers={facultyUsers}
            />
          </div>

          {section.instructors.length === 0 ? (
            <p className="text-xs text-zinc-500 italic">
              No faculty instructors assigned to this section yet.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-900 text-sm">
              {section.instructors.map((inst) => (
                <li
                  key={`${inst.sectionId}-${inst.userId}`}
                  className="py-2 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-white">
                      {inst.user.name}
                    </div>
                    <div className="text-xs text-zinc-400">
                      {inst.user.email}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-xs uppercase bg-zinc-900 text-zinc-300 font-medium">
                    {inst.role}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Schedules Panel */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Class Schedule</h3>
            <AddScheduleModal sectionId={section.id} />
          </div>

          {section.schedules.length === 0 ? (
            <p className="text-xs text-zinc-500 italic">
              No class meeting times scheduled.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-900 text-sm">
              {section.schedules.map((sch) => (
                <li
                  key={sch.id}
                  className="py-2 flex items-center justify-between"
                >
                  <div>
                    <span className="font-medium text-indigo-400 mr-2">
                      {WEEKDAY_NAMES[sch.weekday] || `Day ${sch.weekday}`}
                    </span>
                    <span className="text-zinc-200">
                      {sch.startTime} - {sch.endTime}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-400">
                    {sch.room || "Room TBA"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Roster & Enrollments */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-zinc-400" />
            Class Roster ({enrollments.length} total)
          </h3>
        </div>

        <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-900/70 text-xs uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Student Number</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Waitlist Pos</th>
                <th className="px-4 py-3">Enrolled At</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {enrollments.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-zinc-500"
                  >
                    No students enrolled in this section.
                  </td>
                </tr>
              ) : (
                enrollments.map((enr) => (
                  <tr
                    key={enr.id}
                    className="hover:bg-zinc-900/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">
                        {enr.student.name}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {enr.student.email}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {enr.student.studentNumber || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                          enr.status === "enrolled"
                            ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
                            : enr.status === "waitlisted"
                              ? "bg-amber-950/80 text-amber-400 border border-amber-800"
                              : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {enr.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {enr.waitlistPosition ? `#${enr.waitlistPosition}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {new Date(enr.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {enr.status === "enrolled" ||
                      enr.status === "waitlisted" ? (
                        <DropStudentButton
                          sectionId={section.id}
                          studentId={enr.student.id}
                          studentName={enr.student.name}
                        />
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
