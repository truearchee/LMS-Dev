# Phase 1 — Step 1.5 Implementation Report
## Course Page — Roulette Timeline Component

---

## What Was Built

A self-contained `CourseTimeline` component implementing the Apple iOS Date Picker scroll interaction for the course page's left lecture panel. The component replaces the previous two-column spine layout entirely.

---

## Part A — Files Read Before Writing

Per the spec's instruction to read before acting, the following files were read in full:

- `frontend/src/app/courses/[id]/page.tsx` — identified all code to remove: `formatDate`, `getLectureLabel`, `WeekGroup` interface, `weeks` useMemo, and the two-column spine + lecture list JSX
- `frontend/src/app/globals.css` — confirmed `.scrollbar-none` already defined with all three browser rules (Firefox `scrollbar-width: none`, IE/Edge `ms-overflow-style: none`, Webkit `::-webkit-scrollbar { display: none }`)
- `frontend/src/types/course.ts` — confirmed `Lecture` type has all required fields

---

## Part B — Component Created: `CourseTimeline.tsx`

**File:** `frontend/src/components/CourseTimeline.tsx`

### Architecture

The component receives a flat `lectures: Lecture[]` array and owns all grouping, rendering, and scroll interaction internally. The page passes one prop and nothing else.

### Data transformation — `buildItems()`

Converts the flat lecture array into a flat list of `TimelineItem` entries — interleaving `week-header` separators between groups. Each week header carries the week number and a formatted date derived from the first lecture's `scheduledAt`. Sorting is `moduleNumber` asc → `orderIndex` asc, mirroring the backend order.

### Scroll interaction

The container div (`containerRef`) has:
- `overflow-y: scroll` + `scroll-snap-type: y mandatory` — CSS handles the snap physics
- `scrollbar-width: none` + `ms-overflow-style: none` + the existing `.scrollbar-none` Tailwind class — scrollbar hidden across all browsers
- `WebkitOverflowScrolling: touch` — iOS momentum scrolling

A `scroll` event listener (passive) fires `handleScroll` on every scroll event. `handleScroll` calls `forceUpdate` (a `useState` counter) to trigger a re-render, which recomputes each item's `normalizedDistance` from the container center. This is the mechanism that drives real-time transform updates during scroll — React does not re-render on scroll events automatically.

A 150ms debounce timer sets `isScrolling = false` after scrolling stops. This switches item styles from `transition: none` (during scroll — no lag) to `transition: transform 0.2s ease-out, opacity 0.2s ease-out` (after settle — smooth final ease).

### Transform math — `getItemStyle()`

Each item's `normalizedDistance` is computed by comparing its center Y to the container's center Y, normalized by half the container height. Range: −1 (top edge) to +1 (bottom edge), 0 = exactly centered.

Four transforms are composed into a single `transform` string:

| Property | Center (distance=0) | Edge (distance=±1) | Formula |
|----------|--------------------|--------------------|---------|
| `opacity` | 1.0 | 0.2 | `max(0.2, 1 − absD × 0.85)` |
| `scale` | 1.05 | 0.87 | `1.05 − absD × 0.18` |
| `rotateX` | 0deg | ±3deg | `distance × 3` |
| `translateY` | 0px | ±8px | `sign(d) × d² × 8` |

The `perspective(800px)` gives the 3D context. The tilt and translate are intentionally subtle — the spec describes it as "a whisper of depth, not a spinning cylinder."

Week headers use `getHeaderStyle()` — opacity fade only, no scale or 3D transforms.

### Center focus band (Part D)

A `position: sticky` decorative div placed before the items in the DOM. It sticks to `top: calc(50% - 36px)` within the scroll container's viewport, so it remains fixed at the center while items scroll through it. Background is `rgba(0,0,0,0.035)` — barely visible. `pointerEvents: none` and `aria-hidden="true"` ensure it is invisible to interaction and accessibility tools.

### Item z-index

The focus band has `zIndex: 0`. Lecture items have `zIndex: 1` so they render in front of the band as they scroll through it.

### Spec deviation — webkit scrollbar

The spec placed a `<style>` tag targeting `.course-timeline::-webkit-scrollbar` on the inner (non-scrollable) div. The webkit scrollbar belongs to the outer scroll container. Since `globals.css` already defines `.scrollbar-none::-webkit-scrollbar { display: none }`, the `scrollbar-none` class was added to the outer container instead. This achieves the intended result correctly.

---

## Part C — Page Updated: `page.tsx`

Removed from `page.tsx`:
- `useMemo` import (no longer needed)
- `Lecture` type import (no longer directly referenced)
- `CourseDetail` remains (still used for `useState<CourseDetail | null>`)
- `formatDate` function
- `getLectureLabel` function
- `WeekGroup` interface
- `weeks` useMemo block
- Entire two-column spine + lecture list JSX (80+ lines)

Added:
- `import { CourseTimeline } from '@/components/CourseTimeline'`
- Left panel replaced with 4 lines: a wrapper div + `<CourseTimeline lectures={course.lectures} />`

The right panel, Shell wrapper, loading state, error state, TopNav, and ProtectedRoute are all unchanged.

---

## Verification Checklist

### Code Quality
- [x] `CourseTimeline` is a `'use client'` component
- [x] `getLectureLabel`, `buildItems`, `getItemStyle`, `getHeaderStyle` all defined outside the component
- [x] `page.tsx` no longer contains `weeks`, `WeekGroup`, `formatDate`, `getLectureLabel`
- [x] No Framer Motion — pure CSS transforms and JS scroll events
- [x] No new packages installed
- [x] Right panel untouched
- [x] TopNav, auth, and all other components untouched
- [x] `{ passive: true }` on scroll event listener
- [x] `scrollSnapAlign: 'center'` on lecture items only — not on week headers
- [x] `forceUpdate` called in scroll handler to drive re-renders
- [x] `paddingTop/paddingBottom: '50%'` on inner container — first/last items can reach center
- [x] `npx tsc --noEmit` frontend — **0 errors**

---

## Files Changed

### Created
| File | Purpose |
|------|---------|
| `frontend/src/components/CourseTimeline.tsx` | Roulette timeline component — full scroll interaction, transform math, week grouping |

### Modified
| File | Change |
|------|--------|
| `frontend/src/app/courses/[id]/page.tsx` | Removed helpers + useMemo + two-column JSX; added `CourseTimeline` import and usage |

### Unchanged
| File | Reason |
|------|--------|
| `frontend/src/types/course.ts` | `Lecture` type already complete |
| `frontend/src/lib/api.ts` | `getCourse()` unchanged |
| `frontend/src/components/TopNav.tsx` | Not touched |
| `frontend/src/app/globals.css` | `.scrollbar-none` already present — reused |
| All backend files | Frontend-only change |

---

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Student 1–5 | `student1@mbzuai.ac.ae` … `student5@mbzuai.ac.ae` | `student123` |
| Teacher | `teacher@mbzuai.ac.ae` | `teacher123` |
| Admin | `admin@mbzuai.ac.ae` | `admin123` |
