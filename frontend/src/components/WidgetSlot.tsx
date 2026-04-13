import { WidgetConfig } from '@/types/widgets'

interface WidgetSlotProps {
  widget: WidgetConfig
  index: number
  isEditMode: boolean
  onRemove: (id: string) => void
  gridClass: string
  heightClass: string
  roundedClass: string
}

export function WidgetSlot({
  widget,
  index,
  isEditMode,
  onRemove,
  gridClass,
  heightClass,
  roundedClass,
}: WidgetSlotProps) {
  const jiggleClass = isEditMode
    ? index % 2 === 0
      ? 'widget-jiggle'
      : 'widget-jiggle-offset'
    : ''

  return (
    <div
      className={`relative ${gridClass} ${heightClass} ${roundedClass} bg-[#F2F2F2] ${isEditMode ? 'overflow-visible' : 'overflow-hidden'} ${jiggleClass}`}
      style={{ boxShadow: 'var(--shadow-inner)' }}
    >
      <div className="w-full h-full">
        {widget.component ? <widget.component /> : null}
      </div>

      {isEditMode && (
        <button
          onClick={() => onRemove(widget.id)}
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
