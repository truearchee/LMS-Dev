'use client'

import { TopNav } from '@/components/TopNav'
import ProtectedRoute from '@/components/ProtectedRoute'

const weeks = [
  {
    weekNumber: 1,
    startDate: 'Jan 6',
    items: [
      { type: 'lecture', label: 'Lecture 1', title: 'Introduction to Calculus' },
      { type: 'lecture', label: 'Lecture 2', title: 'Limits and Continuity' },
      { type: 'lab',     label: 'Lab 1',     title: 'Problem Set 1' },
    ]
  },
  {
    weekNumber: 2,
    startDate: 'Jan 13',
    items: [
      { type: 'lecture', label: 'Lecture 3', title: 'Derivatives — Part I' },
      { type: 'lecture', label: 'Lecture 4', title: 'Derivatives — Part II' },
      { type: 'quiz',    label: 'Quiz 1',    title: 'Midterm Quiz — Weeks 1–2' },
    ]
  },
  {
    weekNumber: 3,
    startDate: 'Jan 20',
    items: [
      { type: 'lecture', label: 'Lecture 5', title: 'Chain Rule and Implicit Differentiation' },
      { type: 'lecture', label: 'Lecture 6', title: 'Applications of Derivatives' },
      { type: 'lab',     label: 'Lab 2',     title: 'Problem Set 2' },
    ]
  },
  {
    weekNumber: 4,
    startDate: 'Jan 27',
    items: [
      { type: 'lecture', label: 'Lecture 7', title: 'Introduction to Integration' },
      { type: 'lecture', label: 'Lecture 8', title: 'The Fundamental Theorem of Calculus' },
      { type: 'quiz',    label: 'Quiz 2',    title: 'Quiz — Weeks 3–4' },
    ]
  },
]

export default function CoursePage() {
  return (
    <ProtectedRoute>
    <div className="w-full h-screen bg-[#F2F2F2] flex flex-col overflow-hidden" style={{ fontFamily: "'SF Pro', system-ui, sans-serif" }}>
      <TopNav />

      <div className="flex flex-row flex-1 overflow-hidden gap-4 p-4">

        {/* Left panel — date spine + lecture list */}
        <div className="w-[420px] flex-shrink-0 overflow-y-auto scrollbar-none" style={{ height: '100%' }}>
          <div className="flex flex-row">

            {/* Date spine column */}
            <div className="w-[80px] flex-shrink-0 flex flex-col items-center relative">
              {/* Continuous vertical line */}
              <div className="absolute top-0 bottom-0 left-[39px] w-[1px] bg-black/10" />

              {weeks.map(week => (
                <div key={week.weekNumber} className="w-full flex flex-col items-center">
                  <div className="h-[48px] flex flex-col items-center justify-end pb-1 relative z-10">
                    <span className="text-[10px] font-semibold text-black/35 uppercase tracking-wider">{`W${week.weekNumber}`}</span>
                    <span className="text-[9px] text-black/25">{week.startDate}</span>
                  </div>

                  {week.items.map((item, i) => (
                    <div key={i} className="h-[72px] flex items-center justify-center relative z-10">
                      {item.type === 'lecture' && (
                        <div className="w-2 h-2 rounded-full bg-black/20" />
                      )}
                      {item.type === 'lab' && (
                        <div className="w-2 h-2 rotate-45 bg-black/15" />
                      )}
                      {item.type === 'quiz' && (
                        <div className="w-2 h-2 rounded-[2px] bg-black/30" />
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Lecture list column */}
            <div className="flex-1 flex flex-col">
              {weeks.map(week => (
                <div key={week.weekNumber}>
                  <div className="h-[48px] flex items-end pb-2 px-3">
                    <span className="text-[11px] font-semibold text-black/35 uppercase tracking-wider">
                      Week {week.weekNumber}
                    </span>
                  </div>

                  {week.items.map((item, i) => (
                    <div
                      key={i}
                      className="h-[72px] flex flex-col justify-center px-3 rounded-[12px] hover:bg-black/[0.03] cursor-pointer transition-colors duration-150"
                    >
                      <span className={`text-[10px] uppercase tracking-wider ${
                        item.type === 'quiz' ? 'text-black/40' :
                        item.type === 'lab' ? 'text-black/25' :
                        'text-black/35'
                      }`}>
                        {item.label}
                      </span>
                      <span className="text-sm font-medium text-black/70 leading-tight mt-0.5">
                        {item.title}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Divider */}
        <div className="w-[1px] bg-black/[0.06] flex-shrink-0 self-stretch" />

        {/* Right panel — widget blocks */}
        <div className="flex-1 overflow-y-auto scrollbar-none flex flex-col gap-4" style={{ height: '100%' }}>

          {/* Row 1: two blocks side by side */}
          <div className="flex flex-row gap-4">
            <div
              className="flex-1 h-[140px] bg-[#E9E5E6] rounded-[20px] flex items-end p-4"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <span className="text-sm text-black/30">AI Recap</span>
            </div>
            <div
              className="flex-1 h-[140px] bg-[#E9E5E6] rounded-[20px] flex items-end p-4"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <span className="text-sm text-black/30">Course Materials</span>
            </div>
          </div>

          {/* Row 2: one wide block */}
          <div
            className="w-full h-[200px] bg-[#E9E5E6] rounded-[20px] flex items-end p-4"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <span className="text-sm text-black/30">Assignments</span>
          </div>

          {/* Row 3: three blocks */}
          <div className="flex flex-row gap-4">
            <div
              className="flex-1 h-[240px] bg-[#E9E5E6] rounded-[20px] flex items-end p-4"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <span className="text-sm text-black/30">My Notes</span>
            </div>
            <div
              className="flex-1 h-[240px] bg-[#E9E5E6] rounded-[20px] flex items-end p-4"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <span className="text-sm text-black/30">Progress</span>
            </div>
            <div
              className="flex-1 h-[240px] bg-[#E9E5E6] rounded-[20px] flex items-end p-4"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <span className="text-sm text-black/30">Study Groups</span>
            </div>
          </div>

        </div>
      </div>
    </div>
    </ProtectedRoute>
  )
}
