# Technical Audit Report: CourseTimeline Component
**Date:** 04-20-2026
**Status:** Diagnostic Review Complete (Read-Only)

## 1. Component Structure
The `CourseTimeline` component (`frontend/src/components/CourseTimeline.tsx`) is a specialized "roulette-style" vertical navigation component.

### Props
- `lectures`: An array of `Lecture` objects containing real database data.
- `selectedLectureId`: The current selection (CUID string).
- `onLectureSelect`: A callback to update the selection in the parent state.

### Internal Architecture
Refers to DOM elements directly for performance optimization, bypassing React's reconciliation loop during scroll events.
- `itemElementRefs`: A Map storing references to the container, label, and title elements for each item.
- `scheduleItemToLectureId`: A memoized Map that correlates visual schedule IDs (e.g., `lec-w1-mon`) to actual database CUIDs.

## 2. Data Mapping
The timeline does not display a simple list. It maps database lectures onto a generated academic calendar.

### Sorting & Grouping
The `generateSchedule` function creates a flat sequence based on a hardcoded 16-week semester starting Jan 12, 2026.
1. **Filtering:** Database lectures are filtered into two sorted buckets: `LECTURE` and `LAB`.
2. **Calendar Injection:** It iterates through weeks, skipping break weeks (indices 8 and 9).
3. **Pattern:** Each teaching week is assigned a fixed pattern:
   - Monday: `LECTURE`
   - Tuesday: `LECTURE`
   - Wednesday: `LAB`

```typescript
// Mapping Logic Snippet
for (let calIdx = 0; calIdx < CALENDAR_WEEKS_TO_GENERATE; calIdx++) {
  if (BREAK_WEEK_INDICES.has(calIdx)) continue;
  teachingWeek++;
  // ... Date calculations ...
  
  // Assigns the Nth LECTURE from DB to the Monday slot
  lectureCount++;
  items.push({
    id: `lec-w${teachingWeek}-mon`,
    lectureDbId: null, // Populated via mapping later
    contentType: 'LECTURE',
    sequentialLabel: `Lecture ${lectureCount}`,
    title: sortedLectures[lectureCount - 1]?.title ?? null,
    // ...
  });
}
```

### Transformation to UI Items
`buildTimelineItems` then takes this schedule and inserts `week-header` objects whenever the week number changes, creating the final array used for rendering.

## 3. Event Handling (Click & Scroll Sync)
Interaction relies on identifying the connection between the virtual calendar slot and the real database record.

### Identifying the Clicked Lecture
When a user clicks an item, the component uses the visual element's ID to look up the database CUID in a pre-computed map.

```typescript
// Click Handler Identification
const dbLectureId = scheduleItemToLectureId.get(item.id) ?? null;

// ... inside onClick ...
if (Math.abs(scrollOffset) < 2) {
  // Select immediately if centered
  onLectureSelect?.(dbLectureId)
} else {
  // Smooth scroll first, then update parent state
  containerEl.scrollBy({ top: scrollOffset, behavior: 'smooth' })
  setTimeout(() => onLectureSelect?.(dbLectureId), 350)
}
```

### Identifier Usage
It uses **real database IDs** (CUIDs) for highlighting and parent event emission. It does *not* parse strings from the UI; the `scheduleItemToLectureId` Map (created via `useMemo`) provides a stable lookup table.

## 4. Parent Integration
The `CoursePage` component (`frontend/src/app/courses/[id]/page.tsx`) acts as the state orchestrator.

- **State Management:** `const [selectedLectureId, setSelectedLectureId] = useState<string | null>(null)`.
- **Flow:**
  1. Parent fetches all course data including the `lectures` array.
  2. Passes the entire `lectures` array to `CourseTimeline`.
  3. Timeline emits a CUID via `onLectureSelect`.
  4. Parent updates state, triggering a re-render that displays the `LectureDetailPanel`.

```tsx
// Integration Snippet in page.tsx
<CourseTimeline
  lectures={course.lectures}
  selectedLectureId={selectedLectureId}
  onLectureSelect={setSelectedLectureId}
/>
```

---
**Audit Summary:** The implementation is robust for performance but tightly coupled to a specific weekly pattern (Mon/Tue/Wed). The identification of clicks is secure as it uses a pre-calculated mapping to real CUIDs rather than DOM-based string parsing.
