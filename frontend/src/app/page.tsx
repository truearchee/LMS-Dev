'use client'

import { useRef, useState } from 'react'
import { TopNav } from '@/components/TopNav'
import { Sidebar, type SidebarHandle } from '@/components/Sidebar'
import { ScrollableCardRow } from '@/components/ScrollableCardRow'
import ProtectedRoute from '@/components/ProtectedRoute'

export default function Home() {
  const [isWidgetEditMode, setIsWidgetEditMode] = useState(false)
  const sidebarRef = useRef<SidebarHandle>(null)

  const exitEditMode = () => {
    sidebarRef.current?.exitEditMode()
    setIsWidgetEditMode(false)
  }

  return (
    <ProtectedRoute>
    <div className="w-full h-screen bg-zinc-100 flex flex-col">
      {/* ① Top navigation */}
      <TopNav />

      {/* ② Content row */}
      <div className="flex flex-row gap-4 p-4 pb-6 pr-6 flex-1 overflow-visible">
        {/* ③ Sidebar — manages its own DnD context and edit mode */}
        <Sidebar ref={sidebarRef} onEditModeChange={setIsWidgetEditMode} />

        {/* Right — Main area: blurs when widget edit mode is active.
            Panel's z-index:40 ensures its own clicks are captured above this div. */}
        <div
          className="flex-1 flex flex-col gap-4 transition-all duration-300"
          style={{ filter: isWidgetEditMode ? 'blur(3px)' : 'none' }}
          onClick={exitEditMode}
        >
          {/* Hero card */}
          <div
            className="w-full h-[240px] flex-shrink-0 bg-[#E9E5E6] rounded-[20px]"
            style={{ boxShadow: 'var(--shadow-card)' }}
          />

          {/* Eight-card horizontally scrollable row */}
          <ScrollableCardRow />

          {/* Bottom wide card — fills remaining height */}
          <div
            className="w-full flex-1 bg-[#E9E5E6] rounded-[20px]"
            style={{ boxShadow: 'var(--shadow-card)' }}
          />
        </div>
      </div>
    </div>
    </ProtectedRoute>
  )
}
