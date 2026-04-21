'use client'

import React, { useMemo, useEffect, useRef } from 'react'
import type { Lecture } from '@/types/course'

const START_DATE = new Date('2026-01-12T09:00:00Z')

type GeneratedItem = {
  id: string
  week: number
  type: 'LECTURE' | 'LAB' | 'QUIZ'
  label: string
  title: string
  date: Date
  dbLectureId: string | null
}

function generateCourseData(lectures: Lecture[]): GeneratedItem[] {
  // Sort real lectures by orderIndex to pair with generated slots
  const sortedLectures = [...lectures].sort((a, b) => a.orderIndex - b.orderIndex)
  let lectureIdx = 0

  const items: GeneratedItem[] = []
  
  let lectureCount = 1
  let labCount = 1
  let quizCount = 1

  for (let week = 1; week <= 14; week++) {
    // 1. Monday = LECTURE
    const dMon = new Date(START_DATE)
    dMon.setDate(START_DATE.getDate() + (week - 1) * 7)
    
    items.push({
      id: `generated-w${week}-1`,
      week,
      type: 'LECTURE',
      label: `Lecture ${lectureCount}`,
      title: sortedLectures[lectureIdx] ? sortedLectures[lectureIdx].title : '',
      date: dMon,
      dbLectureId: sortedLectures[lectureIdx] ? sortedLectures[lectureIdx].id : null
    })
    lectureCount++
    lectureIdx++

    // 2. Tuesday = LECTURE
    const dTue = new Date(dMon)
    dTue.setDate(dMon.getDate() + 1)
    
    items.push({
      id: `generated-w${week}-2`,
      week,
      type: 'LECTURE',
      label: `Lecture ${lectureCount}`,
      title: sortedLectures[lectureIdx] ? sortedLectures[lectureIdx].title : '',
      date: dTue,
      dbLectureId: sortedLectures[lectureIdx] ? sortedLectures[lectureIdx].id : null
    })
    lectureCount++
    lectureIdx++

    // 3. Wednesday = Odd Week -> LAB, Even Week -> QUIZ
    const dWed = new Date(dMon)
    dWed.setDate(dMon.getDate() + 2)
    const isOdd = week % 2 !== 0
    const type = isOdd ? 'LAB' : 'QUIZ'
    
    items.push({
      id: `generated-w${week}-3`,
      week,
      type,
      label: isOdd ? `Lab ${labCount}` : `Quiz ${quizCount}`,
      title: sortedLectures[lectureIdx] ? sortedLectures[lectureIdx].title : '',
      date: dWed,
      dbLectureId: sortedLectures[lectureIdx] ? sortedLectures[lectureIdx].id : null
    })
    
    if (isOdd) labCount++
    else quizCount++
    lectureIdx++
  }

  return items
}

interface CourseTimelineProps {
  lectures: Lecture[]
  selectedLectureId: string | null
  onLectureSelect: (lectureId: string) => void
}

export function CourseTimeline({ lectures, selectedLectureId, onLectureSelect }: CourseTimelineProps) {
  const generatedItems = useMemo(() => generateCourseData(lectures), [lectures])
  
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef(new Map<string, HTMLDivElement>())
  const selectDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initial load scroll
  useEffect(() => {
    if (selectedLectureId && scrollerRef.current) {
      // Find the generated item id that maps to this DB id
      const mappingItem = generatedItems.find(i => i.dbLectureId === selectedLectureId)
      if (!mappingItem) return
      const el = itemRefs.current.get(mappingItem.id)
      if (el) {
        el.scrollIntoView({ behavior: 'auto', block: 'center' })
      }
    }
  }, [lectures]) // Only run strictly on initial data setup.
  
  // Intersection Observer
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const dbId = (entry.target as HTMLElement).getAttribute('data-dblid')
            if (dbId && dbId !== selectedLectureId) {
              if (selectDebounceRef.current) clearTimeout(selectDebounceRef.current)
              selectDebounceRef.current = setTimeout(() => {
                onLectureSelect(dbId)
              }, 150)
            }
          }
        }
      },
      {
        root: scroller,
        rootMargin: '-50% 0px -50% 0px',
        threshold: 0
      }
    )

    for (const el of itemRefs.current.values()) {
      observer.observe(el)
    }

    return () => observer.disconnect()
  }, [generatedItems, selectedLectureId, onLectureSelect])

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
    >
      {/* Absolute Focus Frame Dead-Center */}
      <div 
        className="absolute left-4 right-4 pointer-events-none rounded-[12px]"
        style={{ 
          top: '50%',
          transform: 'translateY(-50%)',
          height: '96px',
          background: 'rgba(0, 0, 0, 0.08)',
          zIndex: 0
        }}
      />
      
      {/* Scroll Area */}
      <div 
        ref={scrollerRef}
        data-timeline-carousel
        className="absolute inset-0 overflow-y-auto"
        style={{ 
          scrollSnapType: 'y mandatory',
          scrollbarWidth: 'none', 
          WebkitOverflowScrolling: 'touch',
          zIndex: 1
        }}
      >
        <style>{`[data-timeline-carousel]::-webkit-scrollbar { display: none; }`}</style>
        
        <div style={{ height: '50vh', flexShrink: 0 }} />

        {generatedItems.map((item) => (
          <div
            key={item.id}
            ref={(el) => {
              if (el) itemRefs.current.set(item.id, el)
              else itemRefs.current.delete(item.id)
            }}
            data-dblid={item.dbLectureId}
            onClick={() => {
               const el = itemRefs.current.get(item.id)
               if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }}
            style={{
               height: '96px',
               scrollSnapAlign: 'center',
               cursor: 'pointer',
               padding: '0 24px',
               display: 'flex',
               flexDirection: 'column',
               justifyContent: 'center',
            }}
          >
             <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', marginBottom: '4px' }}>
                {item.label}
             </div>
             {item.title && (
               <div style={{ fontSize: '15px', fontWeight: 500, color: 'rgba(0,0,0,0.85)', lineHeight: 1.3, marginBottom: '2px' }}>
                 {item.title}
               </div>
             )}
             <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.45)' }}>
                {item.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
             </div>
          </div>
        ))}

        <div style={{ height: '50vh', flexShrink: 0 }} />
      </div>
    </div>
  )
}
