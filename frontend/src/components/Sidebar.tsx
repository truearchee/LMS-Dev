'use client'

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { WidgetConfig, WidgetSize, WidgetTile } from '@/types/widgets'
import { defaultWidgets, createWidgetInstance } from '@/lib/widgetRegistry'
import { SortableWidgetSlot } from '@/components/SortableWidgetSlot'
import { EditWidgetsButton } from '@/components/EditWidgetsButton'
import { WidgetDragGhost } from '@/components/WidgetDragGhost'
import { AddWidgetPanel } from '@/components/AddWidgetPanel'

const sizeClasses: Record<WidgetSize, { grid: string; rounded: string; height: string }> = {
  small:  { grid: 'col-span-1', height: 'h-[110px]', rounded: 'rounded-3xl' },
  medium: { grid: 'col-span-2', height: 'h-[110px]', rounded: 'rounded-2xl' },
  large:  { grid: 'col-span-2', height: 'h-[170px]', rounded: 'rounded-2xl' },
}

// Droppable empty state so panel tiles can be dropped into an empty sidebar
function EmptyDropZone() {
  const { setNodeRef } = useDroppable({ id: 'sidebar-empty' })
  return (
    <div
      ref={setNodeRef}
      className="col-span-2 h-[110px] rounded-2xl bg-[#F2F2F2]/50 flex items-center justify-center"
    >
      <p className="text-xs text-black/30">Drag a widget here</p>
    </div>
  )
}

export interface SidebarHandle {
  exitEditMode: () => void
}

interface SidebarProps {
  onEditModeChange?: (isEditMode: boolean) => void
}

export const Sidebar = forwardRef<SidebarHandle, SidebarProps>(function Sidebar(
  { onEditModeChange },
  ref
) {
  const [mounted, setMounted] = useState(false)
  const [widgets, setWidgets] = useState<WidgetConfig[]>(defaultWidgets)
  const [isEditMode, setIsEditMode] = useState(false)
  const [activeItem, setActiveItem] = useState<{
    instanceId: string
    size: WidgetSize
    label: string
  } | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    onEditModeChange?.(isEditMode)
  }, [isEditMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    })
  )

  const removeWidget = (instanceId: string) => {
    setWidgets(prev => prev.filter(w => w.instanceId !== instanceId))
  }

  const toggleEditMode = () => {
    setIsEditMode(prev => !prev)
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event

    if (active.data.current?.type === 'panel-tile') {
      const tile = active.data.current.tile as WidgetTile
      setActiveItem({ instanceId: active.id as string, size: tile.size, label: tile.label })
      return
    }

    const widget = widgets.find(w => w.instanceId === active.id)
    if (widget) {
      setActiveItem({ instanceId: widget.instanceId, size: widget.size, label: widget.label })
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveItem(null)

    if (!over) return

    // Case 1: dragging a panel tile into the sidebar
    if (active.data.current?.type === 'panel-tile') {
      const tile = active.data.current.tile as WidgetTile
      const newWidget = createWidgetInstance(tile)
      const overIndex = widgets.findIndex(w => w.instanceId === over.id)
      if (overIndex >= 0) {
        const updated = [...widgets]
        updated.splice(overIndex, 0, newWidget)
        setWidgets(updated)
      } else {
        // Dropped on empty zone or below last widget — append
        setWidgets(prev => [...prev, newWidget])
      }
      return
    }

    // Case 2: reordering within the sidebar
    if (active.id !== over.id) {
      setWidgets(prev => {
        const oldIndex = prev.findIndex(w => w.instanceId === active.id)
        const newIndex = prev.findIndex(w => w.instanceId === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  const handleDragCancel = () => {
    setActiveItem(null)
  }

  useImperativeHandle(ref, () => ({
    exitEditMode: () => {
      setIsEditMode(false)
    },
  }))

  if (!mounted) return <div className="w-[320px] flex-shrink-0" />

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        className="w-[320px] flex-shrink-0 flex flex-col rounded-[20px] p-1.5 gap-2"
        style={{
          position: 'relative',
          zIndex: 50,           // above panel (z-index 40) — sidebar is never covered
          height: '100%',
          maxHeight: '100%',
          background: '#E9E5E6',
          boxShadow: 'var(--shadow-card)',
          overflow: 'hidden',   // disable scrolling completely
        }}
      >
        <div className="flex-1 overflow-hidden px-0.5 py-0.5" style={{ minHeight: 0 }}>
          <SortableContext
            items={widgets.map(w => w.instanceId)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 gap-2">
              {widgets.map((widget, index) => (
                <SortableWidgetSlot
                  key={widget.instanceId}
                  widget={widget}
                  index={index}
                  isEditMode={isEditMode}
                  onRemove={removeWidget}
                  gridClass={sizeClasses[widget.size].grid}
                  heightClass={sizeClasses[widget.size].height}
                  roundedClass={sizeClasses[widget.size].rounded}
                />
              ))}

              {widgets.length === 0 && <EmptyDropZone />}
            </div>
          </SortableContext>
        </div>

        <div className="flex-shrink-0">
          <EditWidgetsButton
            isEditMode={isEditMode}
            isEmpty={widgets.length === 0}
            onToggle={toggleEditMode}
          />
        </div>
      </div>

      <DragOverlay
        dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}
      >
        {activeItem && (
          <WidgetDragGhost size={activeItem.size} label={activeItem.label} />
        )}
      </DragOverlay>

      {/* Fixed to bottom of screen — renders outside sidebar visually but inside DndContext tree */}
      <AddWidgetPanel isOpen={isEditMode} />
    </DndContext>
  )
})
