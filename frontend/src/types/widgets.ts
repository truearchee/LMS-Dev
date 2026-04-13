import type { ComponentType } from 'react'

export type WidgetSize = 'small' | 'medium' | 'large'

export interface WidgetConfig {
  id: string           // widget type: "upcoming-classes", "quizzes", etc.
  instanceId: string   // unique per slot — used as DnD item ID
  size: WidgetSize
  label: string
  component: ComponentType | null  // null = not yet implemented
}

// Panel tile — what appears in the Add Widget panel
export interface WidgetTile {
  id: string           // matches WidgetConfig.id
  size: WidgetSize
  label: string
  description: string  // short description for the panel tile
}
