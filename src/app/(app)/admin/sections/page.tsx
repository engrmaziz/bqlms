import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import {
  getCoursesQuery,
  getSectionsQuery,
  getTermsQuery,
} from "@/modules/academics";
import { CreateSectionDialog } from "./create-section-dialog";

export default async function AdminSectionsPage() {
  const [sections, courses, terms] = await Promise.all([
    getSectionsQuery(),
    getCoursesQuery(),
    getTermsQuery(),
  ]);

  const courseOptions = courses.map((c) => ({
    id: c.id,
    label: `${c.code} - ${c.title}`,
  }));
  const termOptions = terms.map((t) => ({
    id: t.id,
    label: `${t.name} (${t.status})`,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Course Sections"
          description="Manage active course offerings, capacity limits, and instructor assignments."
        />
        <div className="shrink-0">
          <CreateSectionDialog courses={courseOptions} terms={termOptions} />
        </div>
      </div>

      <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-900/70 text-xs uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="px-4 py-3">Section Code</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Term</th>
                <th className="px-4 py-3">Capacity</th>
                <th className="px-4 py-3">Delivery</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {sections.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-zinc-500"
                  >
                    No sections created yet. Add a section above.
                  </td>
                </tr>
              ) : (
                sections.map((section) => (
                  <tr
                    key={section.id}
                    className="hover:bg-zinc-900/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-semibold text-white">
                      {section.code}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">
                        {section.course.code}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {section.course.title}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {section.term.name}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">
                      {section.capacity} seats
                    </td>
                    <td className="px-4 py-3 capitalize text-zinc-400">
                      {section.delivery.replace("_", " ")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                          section.status === "published"
                            ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
                            : section.status === "archived"
                              ? "bg-zinc-800 text-zinc-400"
                              : "bg-amber-950/80 text-amber-400 border border-amber-800"
                        }`}
                      >
                        {section.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/sections/${section.id}`}
                        className="text-indigo-400 hover:text-indigo-300 font-medium text-xs underline"
                      >
                        View & Roster
                      </Link>
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
