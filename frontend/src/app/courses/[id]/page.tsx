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
      {/* Content area — two columns, no scroll on the page itself */}
      <div className="flex flex-row flex-1 gap-4 p-4 overflow-hidden">

        {/* LEFT — Island card containing carousel */}
        <div
          className="w-[380px] flex-shrink-0 rounded-[20px] overflow-hidden"
          style={{
            background: '#E9E5E6',
            boxShadow: 'var(--shadow-card)',
            height: '100%',
          }}
        >
          <CourseTimeline lectures={course.lectures} />
        </div>

        {/* RIGHT — Five blocks */}
        <div
          className="flex-1 flex flex-col gap-4 overflow-y-auto overflow-x-hidden"
          style={{ scrollbarWidth: 'none' }}
        >
          {/* Block 1 — Large top (AI Recap) */}
          <div
            className="w-full flex-shrink-0 rounded-[20px] flex items-end p-4"
            style={{
              height: 220,
              background: '#E9E5E6',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <span className="text-sm text-black/30">AI Recap</span>
          </div>

          {/* Blocks 2–4 — Three equal medium blocks in a row */}
          <div className="flex flex-row gap-4 flex-shrink-0">
            {(['Course Materials', 'Assignments', 'My Notes'] as const).map((label) => (
              <div
                key={label}
                className="flex-1 rounded-[20px] flex items-end p-4"
                style={{
                  height: 200,
                  background: '#E9E5E6',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <span className="text-sm text-black/30">{label}</span>
              </div>
            ))}
          </div>

          {/* Block 5 — Large bottom (Progress), fills remaining height */}
          <div
            className="w-full flex-1 rounded-[20px] flex items-end p-4"
            style={{
              minHeight: 160,
              background: '#E9E5E6',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <span className="text-sm text-black/30">Progress</span>
          </div>
        </div>

      </div>
    </Shell>
  )
}
