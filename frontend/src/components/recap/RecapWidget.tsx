'use client'

import { useState, useEffect } from 'react'
import type { Lecture, CourseRecap, CourseRecapDetail } from '@/types/course'
import { getRecaps, getRecap, deleteRecap, generateRecap } from '@/lib/api'
import RecapList from './RecapList'
import RecapSelection from './RecapSelection'
import RecapReader from './RecapReader'

interface RecapWidgetProps {
  courseId: string
  lectures: Lecture[]
}

type ViewState = 'LIST' | 'SELECTION' | 'READER'

export default function RecapWidget({ courseId, lectures }: RecapWidgetProps) {
  const [view, setView] = useState<ViewState>('LIST')
  const [recaps, setRecaps] = useState<CourseRecap[]>([])
  const [activeRecap, setActiveRecap] = useState<CourseRecapDetail | null>(null)
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Quick teacher check (naive role extraction from JWT)
  const [isTeacher, setIsTeacher] = useState(false)

  useEffect(() => {
    try {
      const token = localStorage.getItem('antigravity_access_token')
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]))
        if (payload.role === 'TEACHER' || payload.role === 'ADMIN') {
          setIsTeacher(true)
        }
      }
    } catch (e) {}
  }, [])

  useEffect(() => {
    loadRecaps()
  }, [courseId])

  async function loadRecaps() {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getRecaps(courseId)
      setRecaps(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load recaps')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleGenerate(lectureIds: string[]) {
    setIsLoading(true)
    setError(null)
    try {
      const recap = await generateRecap(courseId, lectureIds)
      setRecaps([recap, ...recaps])
      setActiveRecap(recap)
      setView('READER')
    } catch (err: any) {
      setError(err.message || 'Generation failed')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleViewRecap(id: string) {
    setIsLoading(true)
    setError(null)
    try {
      const recap = await getRecap(courseId, id)
      setActiveRecap(recap)
      setView('READER')
    } catch (err: any) {
      setError(err.message || 'Failed to load recap')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDeleteRecap(id: string) {
    if (!confirm('Delete this study guide?')) return
    setIsLoading(true)
    try {
      await deleteRecap(courseId, id)
      setRecaps(recaps.filter(r => r.id !== id))
      setView('LIST')
      setActiveRecap(null)
    } catch (err: any) {
      setError(err.message || 'Failed to delete')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full flex-1 rounded-[20px] bg-[#E9E5E6] flex flex-col overflow-hidden shadow-sm" style={{ minHeight: 400, boxShadow: 'var(--shadow-card)' }}>
      <div className="px-6 py-4 flex justify-between items-center border-b border-black/5">
        <h3 className="font-semibold text-black/80">AI Study Guides (Recaps)</h3>
        {isTeacher && view === 'LIST' && (
          <button 
            onClick={() => setView('SELECTION')}
            className="px-3 py-1 text-sm font-medium bg-black text-white rounded hover:bg-black/80 transition-colors"
          >
            + Generate Guide
          </button>
        )}
        {(view === 'SELECTION' || view === 'READER') && (
          <button 
            onClick={() => { setView('LIST'); setActiveRecap(null) }}
            className="text-sm font-medium text-black/60 hover:text-black"
          >
            ← Back
          </button>
        )}
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm border border-red-200">
            {error}
          </div>
        )}

        {view === 'LIST' && (
          <RecapList 
            recaps={recaps} 
            isLoading={isLoading} 
            onView={handleViewRecap} 
            isTeacher={isTeacher}
            onDelete={isTeacher ? handleDeleteRecap : undefined}
          />
        )}

        {view === 'SELECTION' && (
          <RecapSelection 
            lectures={lectures} 
            isGenerating={isLoading} 
            onGenerate={handleGenerate} 
          />
        )}

        {view === 'READER' && activeRecap && (
          <RecapReader 
            recap={activeRecap} 
            isTeacher={isTeacher} 
            onDelete={() => handleDeleteRecap(activeRecap.id)} 
          />
        )}
      </div>
    </div>
  )
}
