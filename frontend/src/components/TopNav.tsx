export function TopNav() {
  return (
    <header className="h-16 border-b border-[var(--topnav-border)] bg-[var(--topnav-bg)] backdrop-blur-md sticky top-0 z-10 flex items-center justify-between px-6">
      <div className="flex items-center text-sm text-gray-500">
        <span>Home</span>
        <span className="mx-2">/</span>
        <span className="text-[var(--foreground)] font-medium">Dashboard</span>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold ring-2 ring-white dark:ring-gray-800 cursor-pointer hover:scale-105 transition-transform">
          AL
        </div>
      </div>
    </header>
  );
}
