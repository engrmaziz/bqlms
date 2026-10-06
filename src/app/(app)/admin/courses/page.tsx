import { PageHeader } from "@/components/app/page-header";
import { getCoursesQuery } from "@/modules/academics";
import { CreateCourseDialog } from "./create-course-dialog";

export default async function AdminCoursesPage() {
  const courses = await getCoursesQuery();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Course Catalog"
          description="Manage institutional courses, accreditation codes, and credit hours."
        />
        <div className="shrink-0">
          <CreateCourseDialog />
        </div>
      </div>

      <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-900/70 text-xs uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Credits</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {courses.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-zinc-500"
                  >
                    No courses in catalog yet. Click above to add a course.
                  </td>
                </tr>
              ) : (
                courses.map((course) => (
                  <tr
                    key={course.id}
                    className="hover:bg-zinc-900/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-semibold text-indigo-400">
                      {course.code}
                    </td>
                    <td className="px-4 py-3 font-medium text-white">
                      {course.title}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {course.credits} cr
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {new Date(course.createdAt).toLocaleDateString()}
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
