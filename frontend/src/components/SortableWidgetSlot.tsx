'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { WidgetConfig } from '@/types/widgets'

interface SortableWidgetSlotProps {
  widget: WidgetConfig
  index: number
  isEditMode: boolean
  onRemove: (instanceId: string) => void
  gridClass: string
  heightClass: string
  roundedClass: string
}

export function SortableWidgetSlot({
  widget,
  index,
  isEditMode,
  onRemove,
  gridClass,
  heightClass,
  roundedClass,
}: SortableWidgetSlotProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.instanceId })

  const jiggleClass =
    isEditMode && !isDragging
      ? index % 2 === 0
        ? 'widget-jiggle'
        : 'widget-jiggle-offset'
      : ''

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    boxShadow: 'var(--shadow-inner)',
    zIndex: isDragging ? 1 : 'auto',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative bg-[#F2F2F2] ${gridClass} ${heightClass} ${roundedClass} ${isEditMode ? 'overflow-visible' : 'overflow-hidden'} ${jiggleClass}`}
      {...(isEditMode ? { ...attributes, ...listeners } : {})}
    >
      <div className="w-full h-full">
        {widget.component ? <widget.component /> : null}
      </div>

      {isEditMode && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove(widget.instanceId)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-[-6px] left-[-6px] z-20 w-[18px] h-[18px] rounded-full flex items-center justify-center text-[8px] font-bold leading-none cursor-pointer transition-colors duration-150 hover:scale-110"
          style={{
            background: '#3C3C3C',
            color: '#FFFFFF',
            boxShadow: '0px 1px 4px rgba(0,0,0,0.35)',
          }}
          aria-label={`Remove ${widget.label}`}
        >
          ✕
        </button>
      )}
    </div>
  )
}
