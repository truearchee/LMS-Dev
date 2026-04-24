'use client'

import type { CourseRecap } from '@/types/course'

interface RecapListProps {
  recaps: CourseRecap[]
  isLoading: boolean
  onView: (id: string) => void
  isTeacher: boolean
  onDelete?: (id: string) => void
}

export default function RecapList({ recaps, isLoading, onView, isTeacher, onDelete }: RecapListProps) {
  if (isLoading && recaps.length === 0) {
    return <div className="text-black/40 text-sm">Loading study guides...</div>
  }

  if (recaps.length === 0) {
    return (
      <div className="text-black/40 text-sm py-4">
        No study guides available yet. {isTeacher && 'Generate one using the button above.'}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {recaps.map(recap => (
        <div 
          key={recap.id} 
          className="flex justify-between items-center p-4 bg-white/50 rounded-xl hover:bg-white transition-colors cursor-pointer"
          onClick={() => onView(recap.id)}
        >
          <div>
            <h4 className="font-medium text-black/90">{recap.title}</h4>
            <p className="text-xs text-black/50 mt-1">
              {recap.lectureCount} Lectures • Created {new Date(recap.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="text-sm font-medium text-blue-600 hover:text-blue-800">
              View Guide
            </button>
            {isTeacher && onDelete && (
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(recap.id) }}
                className="text-sm font-medium text-red-600 hover:text-red-800"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
