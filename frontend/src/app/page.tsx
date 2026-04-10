export default function Home() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Build it</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] p-6 shadow-sm hover:shadow-md transition-all group">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Active Course</h3>
          </div>
          <div className="text-2xl font-bold text-blue-600 group-hover:scale-105 transition-transform origin-left">
            Calculus & Linear Algebra
          </div>
          <p className="text-xs text-gray-500 mt-2">Next up: Node 3 - Integration Basics</p>
        </div>

        <div className="rounded-xl border border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] p-6 shadow-sm hover:shadow-md transition-all group">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">Nodes Completed</h3>
          </div>
          <div className="text-2xl font-bold group-hover:scale-105 transition-transform origin-left">
            12 / 48
          </div>
          <p className="text-xs text-gray-500 mt-2">25% of curriculum mapped</p>
        </div>

        <div className="rounded-xl border border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] p-6 shadow-sm hover:shadow-md transition-all group">
          <div className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="tracking-tight text-sm font-medium">AI Insights</h3>
          </div>
          <div className="text-2xl font-bold text-purple-600 group-hover:scale-105 transition-transform origin-left">
            2 New
          </div>
          <p className="text-xs text-gray-500 mt-2">from your recent transcripts</p>
        </div>
      </div>
    </div>
  );
}
