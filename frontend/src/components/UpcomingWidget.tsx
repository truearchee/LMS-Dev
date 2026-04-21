'use client'

import { useState, useMemo } from 'react'
import type { Lecture } from '@/types/course'

// ── Constants ─────────────────────────────────────────────────────────────

// How many upcoming items to show before the "show all" toggle
const DEFAULT_VISIBLE = 5

// Academic schedule start — must match CourseTimeline rules
const SCHEDULE_WEEK_START = new Date(2026, 0, 12)

// 0-indexed calendar week indices to skip (break weeks)
const BREAK_WEEK_INDICES = new Set([8, 9])
const CALENDAR_WEEKS_TO_GENERATE = 16

// ── Types ──────────────────────────────────────────────────────────────────

interface ScheduleEntry {
  id: string
  date: Date | null
  contentType: 'LECTURE' | 'LAB' | 'QUIZ' | 'UNKNOWN'
  label: string    // e.g. "Lecture 3", "Lab 1", "Quiz 1: Weeks 1-2"
  title: string    // from DB, or empty string
  isPast: boolean
  isToday: boolean
}

interface UpcomingWidgetProps {
  lectures: Lecture[]
}

// ── Date utilities (defined outside component) ────────────────────────────

/**
 * Returns local midnight boundaries for today.
 * Note: DB scheduledAt values are UTC ISO strings. Comparison with local
 * midnight is close enough for the pilot — at most a few hours off in edge
 * cases near midnight at UTC+4.
 */
function getTodayBounds(): { todayStart: Date; tomorrowStart: Date } {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(todayStart.getDate() + 1)
  return { todayStart, tomorrowStart }
}

function formatScheduleDate(date: Date): string {
  // → "Wed, Apr 1"
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Narrow a raw contentType string to a known union member.
 * Unknown values fall back to 'UNKNOWN' instead of crashing.
 */
function normalizeContentType(raw: string | null | undefined): ScheduleEntry['contentType'] {
  switch (raw?.toUpperCase()) {
    case 'LECTURE': return 'LECTURE'
    case 'LAB':     return 'LAB'
    case 'QUIZ':    return 'QUIZ'
    default:        return 'UNKNOWN'
  }
}

// ── Schedule builders (defined outside component) ─────────────────────────

/**
 * Build schedule entries from real DB scheduledAt dates.
 * Used when at least one lecture has a non-null scheduledAt.
 * Lectures without scheduledAt receive date=null and show "TBD".
 */
function buildFromDbDates(lectures: Lecture[]): ScheduleEntry[] {
  const semesterStart = new Date(2026, 0, 12)
  const hasValidDates = lectures.some(l => {
    if (!l.scheduledAt) return false
    return new Date(l.scheduledAt) >= semesterStart
  })

  if (!hasValidDates) {
    // DB dates predate the real semester — fall back to generated schedule
    return buildFromGeneratedSchedule(lectures)
  }

  const { todayStart, tomorrowStart } = getTodayBounds()

  let lectureCount = 0
  let labCount = 0
  let quizCount = 0

  return lectures
    .slice()
    .sort((a, b) => {
      // Sort: items with dates first by date, then items without dates by orderIndex
      if (a.scheduledAt && b.scheduledAt) {
        return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      }
      if (a.scheduledAt && !b.scheduledAt) return -1
      if (!a.scheduledAt && b.scheduledAt) return 1
      return a.orderIndex - b.orderIndex
    })
    .map(lecture => {
      const contentType = normalizeContentType(lecture.contentType)

      let label: string
      switch (contentType) {
        case 'LAB':
          labCount++
          label = `Lab ${labCount}`
          break
        case 'QUIZ':
          quizCount++
          label = `Quiz ${quizCount}`
          break
        case 'LECTURE':
        default:
          lectureCount++
          label = `Lecture ${lectureCount}`
          break
      }

      const date = lecture.scheduledAt ? new Date(lecture.scheduledAt) : null
      const isPast  = date ? date < todayStart : false
      const isToday = date ? (date >= todayStart && date < tomorrowStart) : false

      return {
        id: `db-${lecture.id}`,
        date,
        contentType,
        label,
        title: lecture.title ?? '',
        isPast,
        isToday,
      }
    })
}

/**
 * Generate schedule entries from hardcoded academic calendar rules.
 * Fallback when scheduledAt is not populated in the database.
 *
 * Rules (must match CourseTimeline):
 * - Week 1 starts Monday March 30, 2026
 * - Monday = LECTURE
 * - Wednesday = LECTURE (weeks 1, 3) or QUIZ (weeks 2, 4)
 * - Thursday = LAB (every week)
 */
function buildFromGeneratedSchedule(lectures: Lecture[]): ScheduleEntry[] {
  const { todayStart, tomorrowStart } = getTodayBounds()
  const entries: ScheduleEntry[] = []

  const sortedLectures = lectures
    .filter(l => l.contentType?.toUpperCase() === 'LECTURE')
    .sort((a, b) => a.orderIndex - b.orderIndex)

  const sortedLabs = lectures
    .filter(l => l.contentType?.toUpperCase() === 'LAB')
    .sort((a, b) => a.orderIndex - b.orderIndex)

  let lectureCount = 0
  let labCount = 0
  let teachingWeek = 0

  for (let calIdx = 0; calIdx < CALENDAR_WEEKS_TO_GENERATE; calIdx++) {
    if (BREAK_WEEK_INDICES.has(calIdx)) continue

    teachingWeek++

    const monday = new Date(SCHEDULE_WEEK_START)
    monday.setDate(SCHEDULE_WEEK_START.getDate() + calIdx * 7)

    const tuesday = new Date(monday)
    tuesday.setDate(monday.getDate() + 1)

    const wednesday = new Date(monday)
    wednesday.setDate(monday.getDate() + 2)

    // Monday — Lecture
    lectureCount++
    entries.push({
      id: `lec-w${teachingWeek}-mon`,
      date: new Date(monday), // copy — do not hold reference to mutating variable
      contentType: 'LECTURE',
      label: `Lecture ${lectureCount}`,
      title: sortedLectures[lectureCount - 1]?.title ?? '',
      isPast: monday < todayStart,
      isToday: monday >= todayStart && monday < tomorrowStart,
    })

    // Tuesday — Lecture
    lectureCount++
    entries.push({
      id: `lec-w${teachingWeek}-tue`,
      date: new Date(tuesday),
      contentType: 'LECTURE',
      label: `Lecture ${lectureCount}`,
      title: sortedLectures[lectureCount - 1]?.title ?? '',
      isPast: tuesday < todayStart,
      isToday: tuesday >= todayStart && tuesday < tomorrowStart,
    })

    // Wednesday — Lab
    labCount++
    entries.push({
      id: `lab-w${teachingWeek}-wed`,
      date: new Date(wednesday),
      contentType: 'LAB',
      label: `Lab ${labCount}`,
      title: sortedLabs[labCount - 1]?.title ?? '',
      isPast: wednesday < todayStart,
      isToday: wednesday >= todayStart && wednesday < tomorrowStart,
    })
  }

  return entries
}

// ── Dot style helper (defined outside component) ──────────────────────────

function getDotStyle(contentType: ScheduleEntry['contentType']): React.CSSProperties {
  const base: React.CSSProperties = { flexShrink: 0, marginTop: 5 }
  switch (contentType) {
    case 'LAB':
      return { ...base, width: 7, height: 7, borderRadius: 1, background: 'rgba(0,0,0,0.28)', transform: 'rotate(45deg)' }
    case 'QUIZ':
      return { ...base, width: 7, height: 7, borderRadius: 2, background: 'rgba(0,0,0,0.50)' }
    default: // LECTURE + UNKNOWN
      return { ...base, width: 7, height: 7, borderRadius: '50%', background: 'rgba(0,0,0,0.40)' }
  }
}

// ── Component ─────────────────────────────────────────────────────────────

export function UpcomingWidget({ lectures }: UpcomingWidgetProps) {
  const [showAll, setShowAll] = useState(false)

  const allEntries = useMemo<ScheduleEntry[]>(() => {
    if (!lectures || lectures.length === 0) return []
    const hasRealDates = lectures.some(
      l => l.scheduledAt !== null && l.scheduledAt !== undefined
    )
    return hasRealDates
      ? buildFromDbDates(lectures)
      : buildFromGeneratedSchedule(lectures)
  }, [lectures])

  // Upcoming = today and future (not strictly in the past)
  const upcomingEntries = useMemo(
    () => allEntries.filter(e => e.isToday || !e.isPast),
    [allEntries]
  )

  const pastEntries = useMemo(
    () => allEntries.filter(e => e.isPast && !e.isToday),
    [allEntries]
  )

  // How many upcoming items are hidden in collapsed mode
  const hiddenUpcomingCount = Math.max(0, upcomingEntries.length - DEFAULT_VISIBLE)

  // Collapsed: first DEFAULT_VISIBLE upcoming items
  // Expanded: all items including past
  const visibleEntries = showAll
    ? allEntries
    : upcomingEntries.slice(0, DEFAULT_VISIBLE)

  // ── Empty state ──────────────────────────────────────────────────────────
  if (allEntries.length === 0) {
    return (
      <div
        className="w-full flex-shrink-0 rounded-[20px] flex items-center justify-center"
        style={{ height: 220, background: '#E9E5E6', boxShadow: 'var(--shadow-card)' }}
      >
        <span style={{ fontSize: 13, color: 'rgba(0,0,0,0.30)' }}>
          No schedule available.
        </span>
      </div>
    )
  }

  return (
    <div
      className="w-full flex-shrink-0 rounded-[20px]"
      style={{
        background: '#E9E5E6',
        boxShadow: 'var(--shadow-card)',
        padding: '20px 20px 16px',
      }}
    >
      {/* Section label */}
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase' as const,
        color: 'rgba(0,0,0,0.40)',
        marginBottom: 14,
        userSelect: 'none' as const,
      }}>
        Upcoming
      </div>

      {/* All sessions complete — no upcoming items */}
      {upcomingEntries.length === 0 && !showAll && (
        <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.35)', marginBottom: 10 }}>
          All sessions complete.{' '}
          <button
            onClick={() => setShowAll(true)}
            style={{
              fontSize: 13,
              color: 'rgba(0,0,0,0.45)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            View history
          </button>
        </div>
      )}

      {/* Entry list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {visibleEntries.map(entry => {
          const isMuted = entry.isPast && !entry.isToday

          return (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 10,
                background: entry.isToday ? 'rgba(0,0,0,0.05)' : 'transparent',
                opacity: isMuted ? 0.45 : 1,
              }}
            >
              {/* Type indicator dot */}
              <div style={getDotStyle(entry.contentType)} />

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Date + type label row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: entry.title ? 2 : 0,
                  flexWrap: 'wrap' as const,
                }}>
                  <span style={{
                    fontSize: 11,
                    color: entry.isToday ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0.40)',
                    fontWeight: entry.isToday ? 500 : 400,
                    flexShrink: 0,
                  }}>
                    {entry.date ? formatScheduleDate(entry.date) : 'TBD'}
                  </span>
                  <span style={{ fontSize: 10, color: 'rgba(0,0,0,0.28)', flexShrink: 0 }}>·</span>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase' as const,
                    color: 'rgba(0,0,0,0.35)',
                    flexShrink: 0,
                  }}>
                    {entry.label}
                  </span>
                </div>

                {/* Title — truncated with browser tooltip for full text on hover */}
                {entry.title && (
                  <div
                    title={entry.title}
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'rgba(0,0,0,0.72)',
                      lineHeight: 1.35,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap' as const,
                    }}
                  >
                    {entry.title}
                  </div>
                )}
              </div>

              {/* Today badge */}
              {entry.isToday && (
                <div style={{
                  flexShrink: 0,
                  alignSelf: 'center',
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase' as const,
                  color: 'rgba(0,0,0,0.50)',
                  background: 'rgba(0,0,0,0.08)',
                  borderRadius: 4,
                  padding: '2px 5px',
                  userSelect: 'none' as const,
                }}>
                  Today
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Show all / collapse toggle */}
      {(hiddenUpcomingCount > 0 || showAll) && (
        <button
          onClick={() => setShowAll(prev => !prev)}
          style={{
            marginTop: 10,
            fontSize: 12,
            color: 'rgba(0,0,0,0.40)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 0',
            textAlign: 'left' as const,
            width: '100%',
            userSelect: 'none' as const,
          }}
        >
          {showAll
            ? `Hide past (${pastEntries.length}) ↑`
            : `Show all ${upcomingEntries.length} items including past →`}
        </button>
      )}
    </div>
  )
}
