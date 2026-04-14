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
    <div className="w-full bg-[#F2F2F2] flex flex-col overflow-hidden" style={{ height: '100dvh', minHeight: '100dvh' }}>
      {/* ① Top navigation */}
      <div className="flex-shrink-0"><TopNav /></div>

      {/* ② Content row — no paddingBottom; the panel is a pure overlay that never
          pushes page content. The sidebar is never covered (panel left = 336px). */}
      <div
        className="flex flex-row gap-4 p-4 flex-1 overflow-hidden"
        style={{ minHeight: 0 }}
      >
        {/* ③ Sidebar — manages its own DnD context, edit mode, and AddWidgetPanel.
            The panel lives inside DndContext here so drag-to-sidebar works.
            Sidebar has z-index higher than the panel to stay above it. */}
        <Sidebar ref={sidebarRef} onEditModeChange={setIsWidgetEditMode} />

        {/* Right — Main area: blurs when widget edit mode is active.
            Clicking here exits edit mode. */}
        <div
          className="flex-1 flex flex-col gap-4 overflow-hidden transition-all duration-300"
          style={{ minHeight: 0, filter: isWidgetEditMode ? 'blur(3px)' : 'none' }}
          onClick={exitEditMode}
        >
          {/* Hero card */}
          <div
            className="w-full flex-shrink-0 bg-[#E9E5E6] rounded-[20px]"
            style={{ height: '28%', minHeight: 160, boxShadow: 'var(--shadow-card)' }}
          />

          {/* Eight-card horizontally scrollable row */}
          <ScrollableCardRow />

          {/* Bottom wide card — fills remaining height */}
          <div
            className="w-full flex-1 bg-[#E9E5E6] rounded-[20px]"
            style={{ minHeight: 80, boxShadow: 'var(--shadow-card)' }}
          />
        </div>
      </div>
    </div>
    </ProtectedRoute>
  )
}
