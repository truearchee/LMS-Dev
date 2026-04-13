'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

interface ScrollArrowProps {
  direction: 'left' | 'right'
  visible: boolean
  onClick: () => void
}

function ScrollArrow({ direction, visible, onClick }: ScrollArrowProps) {
  return (
    <button
      onClick={onClick}
      className={`
        absolute top-1/2 -translate-y-1/2 z-10
        w-8 h-8
        rounded-[8px]
        flex items-center justify-center
        cursor-pointer
        transition-all duration-200
        hover:scale-105
        ${direction === 'left' ? 'left-2' : 'right-2'}
        ${visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
      `}
      style={{
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(0,0,0,0.10)',
        boxShadow: '0px 2px 8px rgba(0,0,0,0.12)',
        marginBottom: '4px',
      }}
      aria-label={direction === 'left' ? 'Scroll left' : 'Scroll right'}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {direction === 'left' ? (
          <path
            d="M9 2L4 7L9 12"
            stroke="rgba(0,0,0,0.55)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M5 2L10 7L5 12"
            stroke="rgba(0,0,0,0.55)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </button>
  )
}

export function ScrollableCardRow() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const CARD_WIDTH_APPROX = 0.25
  const GAP = 16

  const getScrollAmount = useCallback(() => {
    if (!scrollRef.current) return 300
    return scrollRef.current.offsetWidth * CARD_WIDTH_APPROX + GAP
  }, [])

  const updateArrowState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 8)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateArrowState()
    el.addEventListener('scroll', updateArrowState, { passive: true })
    window.addEventListener('resize', updateArrowState)
    return () => {
      el.removeEventListener('scroll', updateArrowState)
      window.removeEventListener('resize', updateArrowState)
    }
  }, [updateArrowState])

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({
      left: -getScrollAmount(),
      behavior: 'smooth',
    })
  }

  const scrollRight = () => {
    scrollRef.current?.scrollBy({
      left: getScrollAmount(),
      behavior: 'smooth',
    })
  }

  return (
    <div className="scroll-fade-right relative flex-shrink-0">

      <ScrollArrow
        direction="left"
        visible={canScrollLeft}
        onClick={scrollLeft}
      />

      <div
        ref={scrollRef}
        className="flex flex-row gap-4 overflow-x-auto overflow-y-hidden scrollbar-none scroll-momentum scroll-snap-x px-1 py-1"
      >
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="flex-shrink-0 w-[calc(25%-12px)] h-[256px] bg-[#E9E5E6] rounded-[20px] scroll-snap-start"
            style={{ boxShadow: 'var(--shadow-card)' }}
          />
        ))}
      </div>

      <ScrollArrow
        direction="right"
        visible={canScrollRight}
        onClick={scrollRight}
      />

    </div>
  )
}
