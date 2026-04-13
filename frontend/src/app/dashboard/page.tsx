'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TopNav } from '@/components/TopNav'
import ProtectedRoute from '@/components/ProtectedRoute'
import { getCourses } from '@/lib/api'
import type { Course } from '@/types/course'

export default function DashboardPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCourses()
      .then(setCourses)
      .catch((err) => {
        console.error('Failed to load courses:', err)
        setError('Failed to load courses. Please try again.')
      })
      .finally(() => setIsLoading(false))
  }, [])

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center flex-1">
          <span className="text-sm text-black/30">Loading courses...</span>
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex items-center justify-center flex-1">
          <span className="text-sm text-black/40">{error}</span>
        </div>
      )
    }

    return (
      <main className="flex-1 p-8">
        <h2 className="text-sm font-medium text-black/40 mb-6 uppercase tracking-wider">
          My Courses
        </h2>

        {courses.length === 0 ? (
          <p className="text-sm text-black/30">
            You are not enrolled in any courses yet.
          </p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {courses.map((course) => (
              <Link key={course.id} href={`/courses/${course.id}`}>
                <div
                  className="w-[280px] h-[180px] bg-[#E9E5E6] rounded-[20px] flex flex-col justify-end p-4 cursor-pointer hover:scale-[1.02] transition-transform duration-200"
                  style={{ boxShadow: 'var(--shadow-card)' }}
                >
                  {course.teacher?.name && (
                    <span className="text-xs text-black/30 mb-1 leading-tight">
                      {course.teacher.name}
                    </span>
                  )}
                  <span className="text-base font-medium text-black leading-tight">
                    {course.title}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    )
  }

  return (
    <ProtectedRoute>
      <div
        className="w-full min-h-screen bg-[#F2F2F2] flex flex-col"
        style={{ fontFamily: "'SF Pro', system-ui, -apple-system, sans-serif" }}
      >
        <TopNav />
        {renderContent()}
      </div>
    </ProtectedRoute>
  )
}
