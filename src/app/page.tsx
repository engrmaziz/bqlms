export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-zinc-950 text-zinc-100 selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-3xl space-y-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 md:p-12 backdrop-blur-xl shadow-2xl">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Infrastructure Online
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
            Single-College LMS Skeleton
          </h1>
          <p className="text-sm md:text-base text-zinc-400">
            Serving students, teachers, and administrators on zero-cost,
            no-credit-card infrastructure.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Architecture
            </div>
            <div className="text-sm font-medium text-zinc-200">
              Modular Monolith
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Quality Gates
            </div>
            <div className="text-sm font-medium text-zinc-200">
              Strict Verification
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Cost Profile
            </div>
            <div className="text-sm font-medium text-emerald-400">
              0$ / No Card
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-zinc-800 text-xs text-zinc-400">
          <a
            href="/api/health/live"
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3.5 py-2 text-zinc-200 transition-colors"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Health Endpoint: <code>/api/health/live</code>
          </a>
        </div>
      </div>
    </main>
  );
}
