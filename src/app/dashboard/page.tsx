import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";

export default async function DashboardPage() {
  const actor = await getActor();
  if (!actor) {
    redirect("/sign-in");
  }

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h1
          className="text-2xl font-bold text-white mb-2"
          data-testid="dashboard-title"
        >
          Dashboard
        </h1>
        <p className="text-zinc-400 mb-4" data-testid="actor-welcome">
          Welcome back, {actor.name}!
        </p>
        <div className="text-sm text-zinc-300 space-y-1">
          <p>
            <span className="text-zinc-500">Email:</span> {actor.email}
          </p>
          <p>
            <span className="text-zinc-500">Roles:</span>{" "}
            {actor.roles.join(", ")}
          </p>
          <p>
            <span className="text-zinc-500">Status:</span> {actor.status}
          </p>
        </div>
      </div>
    </main>
  );
}
