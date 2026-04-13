'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { TopNav } from '@/components/TopNav'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getCourse } from '@/lib/api'
import type { CourseDetail } from '@/types/course'
import { CourseTimeline } from '@/components/CourseTimeline'

// ─── Main page component ─────────────────────────────────────────────────────

export default function CoursePage() {
  const params = useParams()
  const courseId = params.id as string

  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!courseId) return
    setIsLoading(true)
    setError(null)
    getCourse(courseId)
      .then(setCourse)
      .catch((err) => {
        console.error('Failed to load course:', err)
        setError('Course not found or you do not have access.')
      })
      .finally(() => setIsLoading(false))
  }, [courseId])

  // ── Shell used by all states ──────────────────────────────────────────────

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <ProtectedRoute>
      <div
        className="w-full h-screen bg-[#F2F2F2] flex flex-col overflow-hidden"
        style={{ fontFamily: "'SF Pro', system-ui, -apple-system, sans-serif" }}
      >
        <TopNav courseTitle={course?.title} />
        {children}
      </div>
    </ProtectedRoute>
  )

  // ── Loading state ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <Shell>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm text-black/30">Loading course...</span>
        </div>
      </Shell>
    )
  }

  // ── Error / not found state ───────────────────────────────────────────────

  if (error || !course) {
    return (
      <Shell>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-sm text-black/40">
            {error ?? 'Course not found.'}
          </span>
        </div>
      </Shell>
    )
  }

  // ── Loaded state ──────────────────────────────────────────────────────────

  return (
    <Shell>
      {/* Content row: left panel + divider + right panel */}
      <div className="flex flex-row flex-1 overflow-hidden gap-4 p-4">

        {/* ── LEFT PANEL: Timeline ───────────────────────────────────────── */}
        <div
          className="w-[420px] flex-shrink-0"
          style={{ height: '100%', overflow: 'hidden' }}
        >
          <CourseTimeline lectures={course.lectures} />
        </div>

        {/* Divider */}
        <div className="w-[1px] bg-black/[0.06] flex-shrink-0 self-stretch" />

        {/* ── RIGHT PANEL: Widget blocks (unchanged placeholders) ─────────── */}
        <div
          className="flex-1 flex flex-col gap-4 overflow-y-auto overflow-x-hidden scrollbar-none"
          style={{ height: '100%' }}
        >
          {[
            { id: 'recap',       label: 'AI Recap',        height: 'h-[200px]' },
            { id: 'materials',   label: 'Course Materials', height: 'h-[240px]' },
            { id: 'assignments', label: 'Assignments',      height: 'h-[200px]' },
            { id: 'notes',       label: 'My Notes',         height: 'h-[180px]' },
            { id: 'progress',    label: 'Progress',         height: 'h-[160px]' },
          ].map((block) => (
            <div
              key={block.id}
              className={`w-full ${block.height} flex-shrink-0 bg-[#E9E5E6] rounded-[20px] flex items-end p-4`}
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <span className="text-sm text-black/30">{block.label}</span>
            </div>
          ))}
        </div>

      </div>
    </Shell>
  )
}
