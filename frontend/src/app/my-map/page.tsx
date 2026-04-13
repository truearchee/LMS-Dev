'use client'

import { TopNav } from '@/components/TopNav'
import ProtectedRoute from '@/components/ProtectedRoute'

export default function MyMapPage() {
  return (
    <ProtectedRoute>
      <div className="w-full min-h-screen bg-[#F2F2F2] flex flex-col" style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}>
        <TopNav />
        <main className="flex-1 flex items-center justify-center">
          <span className="text-lg text-black/30">Coming soon</span>
        </main>
      </div>
    </ProtectedRoute>
  )
}
