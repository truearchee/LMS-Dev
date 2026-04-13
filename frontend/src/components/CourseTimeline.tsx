'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import type { Lecture } from '@/types/course'

// ── Constants ────────────────────────────────────────────────────────────────
const ITEM_HEIGHT   = 72   // px — height of each lecture item
const HEADER_HEIGHT = 40   // px — height of each week header

// ── Types ────────────────────────────────────────────────────────────────────
type TimelineItem =
  | { kind: 'week-header'; id: string; weekNumber: number; startDate: string | null }
  | { kind: 'lecture';     id: string; lecture: Lecture;   label: string }

// ── Helpers ──────────────────────────────────────────────────────────────────
function getLectureLabel(lecture: Lecture, all: Lecture[]): string {
  switch (lecture.contentType) {
    case 'LAB': {
      const pos = all.filter(l => l.contentType === 'LAB').findIndex(l => l.id === lecture.id) + 1
      return `Lab ${pos}`
    }
    case 'QUIZ': {
      const pos = all.filter(l => l.contentType === 'QUIZ').findIndex(l => l.id === lecture.id) + 1
      return `Quiz ${pos}`
    }
    default:
      return `Lecture ${lecture.orderIndex}`
  }
}

function buildItems(lectures: Lecture[]): TimelineItem[] {
  const sorted = [...lectures].sort((a, b) => {
    const mod = (a.moduleNumber ?? 0) - (b.moduleNumber ?? 0)
    return mod !== 0 ? mod : a.orderIndex - b.orderIndex
  })

  const items: TimelineItem[] = []
  let currentWeek = -1

  for (const lecture of sorted) {
    const week = lecture.moduleNumber ?? 0
    if (week !== currentWeek) {
      currentWeek = week
      items.push({
        kind: 'week-header',
        id: `week-${week}`,
        weekNumber: week,
        startDate: lecture.scheduledAt
          ? new Date(lecture.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : null,
      })
    }
    items.push({
      kind: 'lecture',
      id: lecture.id,
      lecture,
      label: getLectureLabel(lecture, sorted),
    })
  }

  return items
}

function getItemStyle(normalizedDistance: number, isScrolling: boolean): React.CSSProperties {
  const absD      = Math.abs(normalizedDistance)
  const opacity   = Math.max(0.2,  1 - absD * 0.85)
  const scale     = 1.05 - absD * 0.18
  const rotateX   = normalizedDistance * 3
  const translateY = Math.sign(normalizedDistance) * absD * absD * 8

  return {
    opacity,
    transform: `perspective(800px) rotateX(${rotateX}deg) scale(${scale}) translateY(${translateY}px)`,
    transformOrigin: 'center center',
    transition: isScrolling ? 'none' : 'transform 0.2s ease-out, opacity 0.2s ease-out',
    willChange: 'transform, opacity',
  }
}

function getHeaderStyle(normalizedDistance: number, isScrolling: boolean): React.CSSProperties {
  const opacity = Math.max(0.15, 1 - Math.abs(normalizedDistance) * 0.9)
  return {
    opacity,
    transition: isScrolling ? 'none' : 'opacity 0.2s ease-out',
  }
}

// ── Component ────────────────────────────────────────────────────────────────
interface CourseTimelineProps {
  lectures: Lecture[]
}

export function CourseTimeline({ lectures }: CourseTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs     = useRef<Map<string, HTMLDivElement>>(new Map())
  const [, forceUpdate]   = useState(0)
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const items = buildItems(lectures)

  // ── Compute normalised distance from container center ─────────────────────
  const computeNormalizedDistance = useCallback((itemEl: HTMLDivElement): number => {
    const container = containerRef.current
    if (!container) return 0

    const containerRect = container.getBoundingClientRect()
    const itemRect      = itemEl.getBoundingClientRect()
    const containerCY   = containerRect.top + containerRect.height / 2
    const itemCY        = itemRect.top + itemRect.height / 2
    const distance      = itemCY - containerCY
    const halfHeight    = containerRect.height / 2

    return halfHeight > 0 ? distance / halfHeight : 0
  }, [])

  // ── Scroll handler ────────────────────────────────────────────────────────
  const handleScroll = useCallback(() => {
    setIsScrolling(true)
    forceUpdate(n => n + 1)

    if (scrollTimer.current) clearTimeout(scrollTimer.current)
    scrollTimer.current = setTimeout(() => {
      setIsScrolling(false)
      forceUpdate(n => n + 1)
    }, 150)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // ── Cleanup timer on unmount ──────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current)
    }
  }, [])

  if (lectures.length === 0) {
    return (
      <div className="w-[420px] flex-shrink-0 flex items-center justify-center">
        <span className="text-sm text-black/30">No lectures yet.</span>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-[420px] flex-shrink-0 relative scrollbar-none"
      style={{
        height: '100%',
        overflowY: 'scroll',
        overflowX: 'hidden',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        scrollSnapType: 'y mandatory',
        WebkitOverflowScrolling: 'touch',
      } as React.CSSProperties}
    >
      <div
        className="flex flex-col"
        style={{ paddingTop: '50%', paddingBottom: '50%' }}
      >
        {/* Center focus band — purely decorative, stays fixed at scroll center */}
        <div
          aria-hidden="true"
          style={{
            position: 'sticky',
            top: `calc(50% - ${ITEM_HEIGHT / 2}px)`,
            height: ITEM_HEIGHT,
            marginLeft: 12,
            marginRight: 12,
            borderRadius: 12,
            background: 'rgba(0,0,0,0.035)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {items.map((item) => {
          const el = itemRefs.current.get(item.id)
          const normalizedDistance = el ? computeNormalizedDistance(el) : 0

          if (item.kind === 'week-header') {
            return (
              <div
                key={item.id}
                ref={(el) => {
                  if (el) itemRefs.current.set(item.id, el)
                  else itemRefs.current.delete(item.id)
                }}
                style={{
                  height: HEADER_HEIGHT,
                  display: 'flex',
                  alignItems: 'flex-end',
                  paddingBottom: 6,
                  paddingLeft: 24,
                  flexShrink: 0,
                  ...getHeaderStyle(normalizedDistance, isScrolling),
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'rgba(0,0,0,0.40)',
                    userSelect: 'none',
                  }}
                >
                  {`Week ${item.weekNumber}`}
                  {item.startDate ? ` · ${item.startDate}` : ''}
                </span>
              </div>
            )
          }

          // Lecture item
          const { lecture, label } = item
          const contentTypeColor =
            lecture.contentType === 'QUIZ' ? 'rgba(0,0,0,0.45)' :
            lecture.contentType === 'LAB'  ? 'rgba(0,0,0,0.28)' :
                                             'rgba(0,0,0,0.38)'

          return (
            <div
              key={item.id}
              ref={(el) => {
                if (el) itemRefs.current.set(item.id, el)
                else itemRefs.current.delete(item.id)
              }}
              style={{
                height: ITEM_HEIGHT,
                scrollSnapAlign: 'center',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                paddingLeft: 24,
                paddingRight: 16,
                borderRadius: 12,
                cursor: 'pointer',
                position: 'relative',
                zIndex: 1,
                ...getItemStyle(normalizedDistance, isScrolling),
              } as React.CSSProperties}
            >
              <span
                style={{
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: contentTypeColor,
                  userSelect: 'none',
                  lineHeight: 1,
                }}
              >
                {label}
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'rgba(0,0,0,0.72)',
                  marginTop: 4,
                  lineHeight: 1.3,
                  userSelect: 'none',
                }}
              >
                {lecture.title}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
