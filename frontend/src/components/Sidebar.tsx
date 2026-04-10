import Link from "next/link";

export function Sidebar() {
  return (
    <aside className="w-64 border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] hidden md:flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-[var(--sidebar-border)]">
        <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">Nexus LMS</h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        <Link href="/" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] transition-colors">
          Dashboard
        </Link>
        <Link href="/graph" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] transition-colors">
          Curriculum Graph
        </Link>
        <Link href="/ai-chat" className="flex items-center px-3 py-2 text-sm font-medium rounded-md hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] transition-colors">
          AI Assistant
        </Link>
      </nav>
      
      <div className="p-4 border-t border-[var(--sidebar-border)]">
        <div className="text-xs text-gray-500">
          v0.1.0 MVP
        </div>
      </div>
    </aside>
  );
}
