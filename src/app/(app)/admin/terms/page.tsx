import { PageHeader } from "@/components/app/page-header";
import { getTermsQuery } from "@/modules/academics";
import { CreateTermDialog } from "./create-term-dialog";

export default async function AdminTermsPage() {
  const terms = await getTermsQuery();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Academic Terms"
          description="Manage academic calendar periods, census drop cutoffs, and term statuses."
        />
        <div className="shrink-0">
          <CreateTermDialog />
        </div>
      </div>

      <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-900/70 text-xs uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="px-4 py-3">Term Name</th>
                <th className="px-4 py-3">Starts On</th>
                <th className="px-4 py-3">Ends On</th>
                <th className="px-4 py-3">Census Date</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {terms.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-zinc-500"
                  >
                    No terms planned yet. Create your first academic term above.
                  </td>
                </tr>
              ) : (
                terms.map((term) => (
                  <tr
                    key={term.id}
                    className="hover:bg-zinc-900/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-white">
                      {term.name}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {new Date(term.startsOn).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {new Date(term.endsOn).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {new Date(term.censusDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                          term.status === "active"
                            ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
                            : term.status === "closed"
                              ? "bg-zinc-800 text-zinc-400"
                              : "bg-blue-950/80 text-blue-400 border border-blue-800"
                        }`}
                      >
                        {term.status}
                      </span>
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
