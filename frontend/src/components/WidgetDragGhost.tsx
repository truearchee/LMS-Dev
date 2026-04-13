import { WidgetSize } from '@/types/widgets'

interface WidgetDragGhostProps {
  size: WidgetSize
  label: string
}

const ghostSize: Record<WidgetSize, string> = {
  small:  'w-[140px] h-[144px] rounded-3xl',
  medium: 'w-[296px] h-[144px] rounded-2xl',
  large:  'w-[296px] h-[220px] rounded-2xl',
}

export function WidgetDragGhost({ size, label }: WidgetDragGhostProps) {
  return (
    <div
      className={`${ghostSize[size]} bg-[#F2F2F2] flex items-end justify-start p-3 pointer-events-none`}
      style={{
        boxShadow: '0px 8px 32px rgba(0,0,0,0.20), 0px 0px 0px 1px rgba(0,0,0,0.10)',
        opacity: 0.92,
        cursor: 'grabbing',
      }}
    >
      <span className="text-xs text-black/30 font-medium">{label}</span>
    </div>
  )
}
