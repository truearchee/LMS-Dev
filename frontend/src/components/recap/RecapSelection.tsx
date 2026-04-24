'use client'

import { useState } from 'react'
import type { Lecture } from '@/types/course'

interface RecapSelectionProps {
  lectures: any[] // Using any[] to tolerate the presence of aiSummaries from backend
  isGenerating: boolean
  onGenerate: (lectureIds: string[]) => void
}

export default function RecapSelection({ lectures, isGenerating, onGenerate }: RecapSelectionProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleLecture = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const handleGenerateClick = () => {
    if (selectedIds.size < 2) return
    onGenerate(Array.from(selectedIds))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h4 className="font-medium text-black/80">Select Lectures</h4>
        <p className="text-sm text-black/50">Choose between 2 and 20 lectures to synthesize into a study guide.</p>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-2">
        {lectures.map(lecture => {
          // If aiSummaries is provided by backend, check it. Otherwise assume selectable.
          const hasSummary = lecture.aiSummaries ? lecture.aiSummaries.some((s: any) => s.type === 'BRIEF') : true
          const disabled = !hasSummary || isGenerating

          return (
            <label 
              key={lecture.id} 
              className={`flex items-start gap-3 p-3 rounded-xl border ${disabled ? 'opacity-50 cursor-not-allowed bg-black/5' : 'cursor-pointer hover:bg-white/60 bg-white/30 border-transparent'} transition-colors`}
            >
              <input 
                type="checkbox" 
                className="mt-1"
                checked={selectedIds.has(lecture.id)}
                onChange={() => toggleLecture(lecture.id)}
                disabled={disabled}
              />
              <div>
                <div className="font-medium text-sm text-black/80">{lecture.title}</div>
                {!hasSummary && (
                  <div className="text-xs text-red-600 mt-0.5">Missing AI Summary</div>
                )}
              </div>
            </label>
          )
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-black/5 flex justify-end">
        <button
          disabled={selectedIds.size < 2 || isGenerating}
          onClick={handleGenerateClick}
          className="px-4 py-2 font-medium bg-black text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-black/80 transition-colors"
        >
          {isGenerating ? 'Generating (up to 90s)...' : `Generate Study Guide (${selectedIds.size})`}
        </button>
      </div>
    </div>
  )
}
