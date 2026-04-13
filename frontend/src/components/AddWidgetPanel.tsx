'use client'

import { useDraggable } from '@dnd-kit/core'
import { WidgetTile, WidgetSize } from '@/types/widgets'
import { availableWidgetTiles } from '@/lib/widgetRegistry'

interface AddWidgetPanelProps {
  isOpen: boolean
}

const tileSize: Record<WidgetSize, string> = {
  small:  'w-[120px] h-[120px]',
  medium: 'w-[220px] h-[120px]',
  large:  'w-[220px] h-[160px]',
}

function DraggableTile({ tile }: { tile: WidgetTile }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `panel-tile-${tile.id}`,
    data: {
      type: 'panel-tile',
      tile,
    },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex-shrink-0 bg-[#F2F2F2] relative flex flex-col justify-end p-3 ${tileSize[tile.size]} ${tile.size === 'small' ? 'rounded-3xl' : 'rounded-2xl'}`}
      style={{
        boxShadow: 'var(--shadow-inner)',
        opacity: isDragging ? 0.4 : 1,
        cursor: 'grab',
      }}
    >
      <span className="text-xs text-black/40 font-medium leading-tight">{tile.label}</span>
      <span className="text-[10px] text-black/25 leading-tight mt-0.5 truncate">{tile.description}</span>
    </div>
  )
}

export function AddWidgetPanel({ isOpen }: AddWidgetPanelProps) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{
        background: '#E9E5E6',
        borderRadius: '24px 24px 0 0',
        boxShadow: '0px -4px 24px rgba(0,0,0,0.12), 0px 0px 0px 1px rgba(0,0,0,0.08)',
        maxHeight: '320px',
        transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
        opacity: isOpen ? 1 : 0,
        transition: isOpen
          ? 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease'
          : 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.15s ease',
        pointerEvents: isOpen ? 'auto' : 'none',
      }}
    >
      {/* Drag handle indicator */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full bg-black/20" />
      </div>

      {/* Panel title */}
      <div className="px-5 pb-3">
        <h3 className="text-sm font-semibold text-black/60">Add Widget</h3>
      </div>

      {/* Scrollable tile row */}
      <div className="flex flex-row gap-3 px-5 pb-6 overflow-x-auto overflow-y-hidden">
        {availableWidgetTiles.map((tile) => (
          <DraggableTile key={tile.id} tile={tile} />
        ))}
      </div>
    </div>
  )
}
