'use client'
import { useState, useEffect } from 'react'
import { getLecture } from '@/lib/api'
import type { LectureDetail } from '@/types/course'
import { PracticeQuiz } from './PracticeQuiz'

interface Props {
  lectureId: string
  onClose: () => void
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month:   'short',
    day:     'numeric',
  })
}

function fileIcon(mimeType: string | null, type: string): string {
  if (mimeType?.startsWith('video/') || type === 'RECORDING') return '🎥'
  if (mimeType === 'application/pdf')                          return '📄'
  if (type === 'SLIDES')                                       return '📑'
  return '🔗'
}

export function LectureDetailPanel({ lectureId, onClose }: Props) {
  const [lecture, setLecture] = useState<LectureDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeSummaryType, setActiveSummaryType] = useState<'BRIEF' | 'FULL' | 'BULLET_POINTS'>('BRIEF')

  useEffect(() => {
    if (!lectureId) return
    setIsLoading(true)
    getLecture(lectureId)
      .then(setLecture)
      .catch(() => setError('Failed to load lecture details.'))
      .finally(() => setIsLoading(false))
  }, [lectureId])

  if (isLoading) return <div className="w-full h-full flex items-center justify-center text-sm text-black/30 animate-pulse">Loading lecture...</div>
  if (error || !lecture) return <div className="w-full h-full flex items-center justify-center text-sm text-black/40">{error ?? 'Not found'}</div>

  // Create UI sections using your standard card style: 
  const cardStyle = "w-full flex-shrink-0 rounded-[20px] p-5 bg-[#E9E5E6] shadow-[var(--shadow-card)]"

  const isEmpty = lecture.aiSummaries.length === 0 && lecture.files.length === 0 && lecture.transcripts.length === 0 && !lecture.teacherNote

  const availableTypes = ['BRIEF', 'FULL', 'BULLET_POINTS'] as const
  const activeSummary = lecture.aiSummaries.find(s => s.type === activeSummaryType) ?? lecture.aiSummaries[0]
  const isSelectedSummaryFallback = activeSummary && activeSummary.type !== activeSummaryType

  return (
    <div className="w-full h-full flex flex-col gap-4 overflow-y-auto overflow-x-hidden lecture-panel-enter" style={{ scrollbarWidth: 'none' }}>
      
      {/* 1. Header Card */}
      <div className={cardStyle}>
        <button 
          onClick={onClose} 
          className="text-xs text-black/40 hover:text-black/60 transition-colors mb-4 flex items-center gap-1"
        >
          ← Back to selection
        </button>
        <div className="flex flex-col gap-2">
          {lecture.moduleNumber != null && (
            <span className="text-[11px] font-medium tracking-wide uppercase text-black/40">
              Week {lecture.moduleNumber}
              {lecture.scheduledAt ? ` · ${formatDate(lecture.scheduledAt)}` : ''}
              {lecture.durationMinutes ? ` · ${lecture.durationMinutes} min` : ''}
            </span>
          )}
          <h2 className="text-[22px] font-semibold text-black/90 leading-tight m-0">
            {lecture.title}
          </h2>
          {lecture.description && (
            <p className="text-[13px] text-black/50 leading-snug m-0 mt-1">
              {lecture.description}
            </p>
          )}
        </div>
      </div>
      
      {/* 2. AI Summary Card */}
      {lecture.aiSummaries.length > 0 && (
        <div className={cardStyle}>
          <div className="flex flex-col mb-4">
            <span className="text-[10px] font-semibold tracking-[0.08em] uppercase text-black/40 mb-3">AI Summary</span>
            <div className="flex gap-2">
              {availableTypes.map(type => {
                const hasType = lecture.aiSummaries.some(s => s.type === type)
                const isActive = (activeSummaryType === type && !isSelectedSummaryFallback) || (isSelectedSummaryFallback && activeSummary?.type === type)
                return (
                  <button
                    key={type}
                    disabled={!hasType}
                    onClick={() => setActiveSummaryType(type)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                      isActive ? 'bg-black/80 text-white shadow-sm' : 
                      hasType ? 'bg-black/5 text-black/60 hover:bg-black/10' : 
                      'bg-transparent text-black/20 cursor-not-allowed border outline-dashed outline-1 outline-black/10 -outline-offset-1'
                    }`}
                  >
                    {type.replace('_', ' ')}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="text-[13px] text-black/70 leading-relaxed whitespace-pre-wrap">
             {activeSummary?.content}
          </div>
          {activeSummary && (
            <div className="mt-3 text-[10px] text-black/30 text-right">
              Generated by {activeSummary.modelUsed}
            </div>
          )}
        </div>
      )}

      {/* 3. Materials Card */}
      {lecture.files.length > 0 && (
        <div className={cardStyle}>
          <span className="block text-[10px] font-semibold tracking-[0.08em] uppercase text-black/40 mb-3">Materials</span>
          <div className="flex flex-col gap-2">
            {lecture.files.map(file => {
              const isExternal = file.url.startsWith('http')
              return (
                <a
                  key={file.id}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] bg-black/5 hover:bg-black/10 transition-colors no-underline"
                >
                  <span className="text-base">{fileIcon(file.mimeType, file.type)}</span>
                  <span className="flex-1 text-[13px] text-black/75 leading-tight">
                    {file.label ?? file.url.split('/').pop()}
                  </span>
                  <span className="text-[11px] text-black/30">
                    {isExternal ? '↗' : '↓'}
                  </span>
                </a>
              )
            })}
          </div>
        </div>
      )}

      {/* 4. Teacher Note Card */}
      {lecture.teacherNote && (
        <div className={cardStyle}>
          <span className="block text-[10px] font-semibold tracking-[0.08em] uppercase text-black/40 mb-3">Professor's Note</span>
          <div className="px-3 py-2.5 rounded-[10px] bg-black/5 text-[13px] text-black/70 leading-relaxed">
            {lecture.teacherNote}
          </div>
        </div>
      )}

      {/* 5. Practice Quiz */}
      <PracticeQuiz lectureId={lecture.id} />

      {/* 6. Empty State */}
      {isEmpty && (
        <div className="w-full h-[200px] flex items-center justify-center rounded-[20px] bg-[#E9E5E6] shadow-[var(--shadow-card)]">
          <span className="text-sm text-black/30">No content uploaded for this lecture yet.</span>
        </div>
      )}
    </div>
  )
}
