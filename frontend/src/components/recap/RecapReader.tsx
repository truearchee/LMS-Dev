'use client'

import type { CourseRecapDetail } from '@/types/course'
import { marked } from 'marked'

// Configure marked for safe rendering
marked.setOptions({ breaks: true })

interface RecapReaderProps {
  recap: CourseRecapDetail
  isTeacher: boolean
  onDelete: () => void
}

export default function RecapReader({ recap, isTeacher, onDelete }: RecapReaderProps) {

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold text-black/90">{recap.title}</h2>
          <p className="text-sm text-black/50 mt-1">
            Generated from {recap.lectureCount} lectures
          </p>
        </div>
        {isTeacher && (
          <button 
            onClick={onDelete}
            className="text-sm font-medium text-red-600 hover:text-red-800 px-3 py-1 bg-red-50 rounded-md"
          >
            Delete
          </button>
        )}
      </div>

      <div
        className="prose prose-slate prose-sm max-w-none"
        style={{ fontSize: 13, color: 'rgba(0,0,0,0.72)', lineHeight: 1.7, maxHeight: 520, overflowY: 'auto', scrollbarWidth: 'none' }}
        dangerouslySetInnerHTML={{ __html: marked(recap.content) as string }}
      />
    </div>
  )
}
