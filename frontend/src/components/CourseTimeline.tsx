'use client'

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import type { Lecture } from '@/types/course'

// ── Constants ────────────────────────────────────────────────────────────────
const ITEM_HEIGHT   = 88   // px — tall enough for 3 lines: label + title + date
const HEADER_HEIGHT = 44   // px — week header height

// ── Types ────────────────────────────────────────────────────────────────────
interface ScheduleItem {
  id: string
  date: Date
  dayLabel: string         // e.g. "Wed, Apr 1"
  contentType: 'LECTURE' | 'LAB' | 'QUIZ'
  sequentialLabel: string  // e.g. "Lecture 3" | "Lab 2" | "Quiz 1: Weeks 1–2"
  title: string | null     // from DB if available, null otherwise
  weekNumber: number
  weekRange: string        // e.g. "March 30 — April 3"
}

type TimelineItem =
  | { kind: 'week-header';   id: string; weekNumber: number; weekRange: string }
  | { kind: 'schedule-item'; id: string; item: ScheduleItem }

interface ItemStyles {
  container: React.CSSProperties
  label: React.CSSProperties
  title: React.CSSProperties
}

// ── Part B Helpers (all defined OUTSIDE the component) ───────────────────────

// Format: "Wed, Apr 1"
function formatDayDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

// Format: "March 30"
function formatLongDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  })
}

// Find the Nth lecture (by sequential lecture number) from the DB array
function findLectureByNumber(lectures: Lecture[], n: number): Lecture | null {
  const sorted = lectures
    .filter(l => l.contentType === 'LECTURE')
    .sort((a, b) => a.orderIndex - b.orderIndex)
  return sorted[n - 1] ?? null
}

// Find the Nth lab (by sequential lab number) from the DB array
function findLabByNumber(lectures: Lecture[], n: number): Lecture | null {
  const sorted = lectures
    .filter(l => l.contentType === 'LAB')
    .sort((a, b) => a.orderIndex - b.orderIndex)
  return sorted[n - 1] ?? null
}

function generateSchedule(lectures: Lecture[]): ScheduleItem[] {
  const WEEK_START = new Date(2026, 2, 30) // March 30, 2026 (month is 0-indexed)
  const items: ScheduleItem[] = []
  let lectureCount = 0
  let labCount = 0
  let quizCount = 0

  for (let week = 1; week <= 4; week++) {
    const monday = new Date(WEEK_START)
    monday.setDate(WEEK_START.getDate() + (week - 1) * 7)

    const wednesday = new Date(monday)
    wednesday.setDate(monday.getDate() + 2)

    const thursday = new Date(monday)
    thursday.setDate(monday.getDate() + 3)

    const friday = new Date(monday)
    friday.setDate(monday.getDate() + 4)

    const weekRange = `${formatLongDate(monday)} — ${formatLongDate(friday)}`
    const isQuizWeek = week === 2 || week === 4

    // Monday — always a Lecture
    lectureCount++
    const mondayLecture = findLectureByNumber(lectures, lectureCount)
    items.push({
      id: `lecture-${lectureCount}`,
      date: monday,
      dayLabel: formatDayDate(monday),
      contentType: 'LECTURE',
      sequentialLabel: `Lecture ${lectureCount}`,
      title: mondayLecture?.title ?? null,
      weekNumber: week,
      weekRange,
    })

    if (!isQuizWeek) {
      // Wednesday — Lecture on normal weeks
      lectureCount++
      const wednesdayLecture = findLectureByNumber(lectures, lectureCount)
      items.push({
        id: `lecture-${lectureCount}`,
        date: wednesday,
        dayLabel: formatDayDate(wednesday),
        contentType: 'LECTURE',
        sequentialLabel: `Lecture ${lectureCount}`,
        title: wednesdayLecture?.title ?? null,
        weekNumber: week,
        weekRange,
      })
    } else {
      // Wednesday — Quiz on quiz weeks
      quizCount++
      const prevWeek = week - 1
      items.push({
        id: `quiz-${quizCount}`,
        date: wednesday,
        dayLabel: formatDayDate(wednesday),
        contentType: 'QUIZ',
        sequentialLabel: `Quiz ${quizCount}: Weeks ${prevWeek}–${week}`,
        title: null,
        weekNumber: week,
        weekRange,
      })
    }

    // Thursday — always a Lab
    labCount++
    const lab = findLabByNumber(lectures, labCount)
    items.push({
      id: `lab-${labCount}`,
      date: thursday,
      dayLabel: formatDayDate(thursday),
      contentType: 'LAB',
      sequentialLabel: `Lab ${labCount}`,
      title: lab?.title ?? null,
      weekNumber: week,
      weekRange,
    })
  }

  return items
}

function buildTimelineItems(scheduleItems: ScheduleItem[]): TimelineItem[] {
  const result: TimelineItem[] = []
  let currentWeek = -1

  for (const item of scheduleItems) {
    if (item.weekNumber !== currentWeek) {
      currentWeek = item.weekNumber
      result.push({
        kind: 'week-header',
        id: `week-header-${currentWeek}`,
        weekNumber: currentWeek,
        weekRange: item.weekRange,
      })
    }
    result.push({ kind: 'schedule-item', id: item.id, item })
  }

  return result
}

function getItemStyles(
  normalizedDistance: number,
  isScrolling: boolean
): ItemStyles {
  const absD  = Math.abs(normalizedDistance)
  const eased = absD * absD // quadratic ease for more natural falloff

  const opacity    = Math.max(0.18, 1 - absD * 0.85)
  const scale      = Math.max(0.84, 1.05 - absD * 0.22)
  const rotateX    = normalizedDistance * 2.5          // max ±2.5deg — very subtle
  const translateY = Math.sign(normalizedDistance) * eased * 10

  const labelSize  = Math.max(9,  11 - absD * 2.5)
  const titleSize  = Math.max(12, 17 - absD * 6)

  // Font weight: bold only when very close to center
  const titleWeight = absD < 0.12 ? 600 : 400

  const transition = isScrolling
    ? 'none'
    : 'transform 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.22s ease-out'

  return {
    container: {
      opacity,
      transform: `perspective(900px) rotateX(${rotateX}deg) scale(${scale}) translateY(${translateY}px)`,
      transformOrigin: 'center center',
      transition,
      willChange: 'transform, opacity',
    },
    label: {
      fontSize: labelSize,
      transition: isScrolling ? 'none' : 'font-size 0.22s ease-out',
    },
    title: {
      fontSize: titleSize,
      fontWeight: titleWeight,
    },
  }
}

function getHeaderStyles(
  normalizedDistance: number,
  isScrolling: boolean
): React.CSSProperties {
  const opacity = Math.max(0.12, 1 - Math.abs(normalizedDistance) * 0.92)
  return {
    opacity,
    transition: isScrolling ? 'none' : 'opacity 0.22s ease-out',
  }
}

// ── Component ────────────────────────────────────────────────────────────────
interface CourseTimelineProps {
  lectures: Lecture[]
}

export function CourseTimeline({ lectures }: CourseTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs     = useRef<Map<string, HTMLDivElement>>(new Map())
  const scrollTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [, setRenderTick]   = useState(0)
  const [isScrolling, setIsScrolling] = useState(false)

  // Build timeline items once — lectures array is stable after page load
  const timelineItems = useMemo(() => {
    const schedule = generateSchedule(lectures)
    return buildTimelineItems(schedule)
  }, [lectures])

  // Trigger initial render tick after mount so positions are measured
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const firstLectureItem = timelineItems.find(i => i.kind === 'schedule-item')
    if (!firstLectureItem) return
    requestAnimationFrame(() => {
      setRenderTick(n => n + 1)
    })
  }, [timelineItems])

  // ── Measure normalized distance for each item ─────────────────────────────
  const getNormalizedDistance = useCallback((el: HTMLDivElement): number => {
    const container = containerRef.current
    if (!container) return 0
    const cRect   = container.getBoundingClientRect()
    const iRect   = el.getBoundingClientRect()
    const centerY = cRect.top + cRect.height / 2
    const itemY   = iRect.top + iRect.height / 2
    const half    = cRect.height / 2
    return half > 0 ? (itemY - centerY) / half : 0
  }, [])

  // ── Scroll handler ────────────────────────────────────────────────────────
  const handleScroll = useCallback(() => {
    setIsScrolling(true)
    setRenderTick(n => n + 1)

    if (scrollTimer.current) clearTimeout(scrollTimer.current)
    scrollTimer.current = setTimeout(() => {
      setIsScrolling(false)
      setRenderTick(n => n + 1)
    }, 150)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  useEffect(() => {
    return () => { if (scrollTimer.current) clearTimeout(scrollTimer.current) }
  }, [])

  if (lectures.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 13, color: 'rgba(0,0,0,0.30)' }}>No lectures yet.</span>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>

      {/* Center focus band — absolute, stays fixed while items scroll through */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '50%',
          left: 12,
          right: 12,
          height: ITEM_HEIGHT,
          transform: 'translateY(-50%)',
          borderRadius: 12,
          background: 'rgba(0,0,0,0.04)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Scrollable container */}
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          inset: 0,
          overflowY: 'scroll',
          overflowX: 'hidden',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
          zIndex: 1,
        } as React.CSSProperties}
      >
        {/* Hide Webkit scrollbar — targets the inner scroller class */}
        <style>{`
          .timeline-scroller::-webkit-scrollbar { display: none; }
        `}</style>

        {/*
          Inner container.
          paddingTop/paddingBottom of 50% (= 190px on the 380px island) so the
          first and last items can reach the vertical center of the scroll window.
        */}
        <div
          className="timeline-scroller"
          style={{
            paddingTop: '50%',
            paddingBottom: '50%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {timelineItems.map((item) => {
            const el   = itemRefs.current.get(item.id)
            const dist = el ? getNormalizedDistance(el) : 0

            if (item.kind === 'week-header') {
              const headerStyle = getHeaderStyles(dist, isScrolling)
              return (
                <div
                  key={item.id}
                  ref={(el) => {
                    if (el) itemRefs.current.set(item.id, el)
                    else itemRefs.current.delete(item.id)
                  }}
                  style={{
                    height: HEADER_HEIGHT,
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    paddingBottom: 6,
                    paddingLeft: 20,
                    ...headerStyle,
                  }}
                >
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase' as const,
                    color: 'rgba(0,0,0,0.40)',
                    userSelect: 'none' as const,
                    lineHeight: 1,
                  }}>
                    {`Week ${item.weekNumber}`}
                  </span>
                  <span style={{
                    fontSize: 9,
                    color: 'rgba(0,0,0,0.28)',
                    userSelect: 'none' as const,
                    marginTop: 2,
                    lineHeight: 1,
                  }}>
                    {item.weekRange}
                  </span>
                </div>
              )
            }

            // Schedule item (lecture, lab, or quiz)
            const { item: scheduleItem } = item
            const styles = getItemStyles(dist, isScrolling)

            const labelColor =
              scheduleItem.contentType === 'QUIZ' ? 'rgba(0,0,0,0.45)' :
              scheduleItem.contentType === 'LAB'  ? 'rgba(0,0,0,0.30)' :
                                                    'rgba(0,0,0,0.40)'

            return (
              <div
                key={item.id}
                ref={(el) => {
                  if (el) itemRefs.current.set(item.id, el)
                  else itemRefs.current.delete(item.id)
                }}
                style={{
                  height: ITEM_HEIGHT,
                  flexShrink: 0,
                  scrollSnapAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  paddingLeft: 20,
                  paddingRight: 16,
                  borderRadius: 12,
                  cursor: 'pointer',
                  gap: 3,
                  ...styles.container,
                } as React.CSSProperties}
              >
                {/* Sequential label — e.g. "LECTURE 3" */}
                <span style={{
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.08em',
                  color: labelColor,
                  userSelect: 'none' as const,
                  lineHeight: 1,
                  ...styles.label,
                }}>
                  {scheduleItem.sequentialLabel}
                </span>

                {/* Title from DB — shown if available */}
                {scheduleItem.title && (
                  <span style={{
                    color: 'rgba(0,0,0,0.72)',
                    lineHeight: 1.3,
                    userSelect: 'none' as const,
                    ...styles.title,
                  }}>
                    {scheduleItem.title}
                  </span>
                )}

                {/* Date — e.g. "Wed, Apr 1" */}
                <span style={{
                  fontSize: 10,
                  color: 'rgba(0,0,0,0.28)',
                  userSelect: 'none' as const,
                  lineHeight: 1,
                }}>
                  {scheduleItem.dayLabel}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
