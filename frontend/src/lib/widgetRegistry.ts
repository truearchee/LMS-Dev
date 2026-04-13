import { WidgetConfig, WidgetTile } from '@/types/widgets'

export const defaultWidgets: WidgetConfig[] = [
  {
    id: 'upcoming-classes',
    instanceId: 'instance-upcoming-classes-1',
    size: 'large',
    label: 'Upcoming Classes',
    component: null,
  },
  {
    id: 'quizzes',
    instanceId: 'instance-quizzes-1',
    size: 'small',
    label: 'Quizzes',
    component: null,
  },
  {
    id: 'assignments',
    instanceId: 'instance-assignments-1',
    size: 'small',
    label: 'Assignments',
    component: null,
  },
  {
    id: 'spotlight-events',
    instanceId: 'instance-spotlight-1',
    size: 'medium',
    label: 'Spotlight Events',
    component: null,
  },
  {
    id: 'favorites',
    instanceId: 'instance-favorites-1',
    size: 'medium',
    label: 'Favorites',
    component: null,
  },
]

// Available tiles shown in the Add Widget panel
// These are templates — each drag creates a new instance
export const availableWidgetTiles: WidgetTile[] = [
  {
    id: 'upcoming-classes',
    size: 'large',
    label: 'Upcoming Classes',
    description: 'Your schedule for the day',
  },
  {
    id: 'quizzes',
    size: 'small',
    label: 'Quizzes',
    description: 'Upcoming quiz reminders',
  },
  {
    id: 'assignments',
    size: 'small',
    label: 'Assignments',
    description: 'Due dates and submissions',
  },
  {
    id: 'spotlight-events',
    size: 'medium',
    label: 'Spotlight Events',
    description: 'Campus events and announcements',
  },
  {
    id: 'favorites',
    size: 'medium',
    label: 'Favorites',
    description: 'Your pinned content',
  },
  {
    id: 'ai-recap',
    size: 'large',
    label: 'AI Recap',
    description: 'Summary of your last lecture',
  },
  {
    id: 'grades',
    size: 'medium',
    label: 'Grades',
    description: 'Recent grades and GPA',
  },
  {
    id: 'notes',
    size: 'small',
    label: 'Notes',
    description: 'Quick personal notes',
  },
]

// Helper: generate a unique instance ID for a new widget dragged from the panel
export const createWidgetInstance = (tile: WidgetTile): WidgetConfig => ({
  id: tile.id,
  instanceId: `instance-${tile.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  size: tile.size,
  label: tile.label,
  component: null,
})
