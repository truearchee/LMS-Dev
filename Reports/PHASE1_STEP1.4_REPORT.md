# Phase 1 — Step 1.4 Implementation Report

---

## What Was Built

Two workstreams: backend sort fix (Part A) and course page rewrite wired to the live API (Part B).

---

## Part A — Backend Verification and Fix

### A.1 — Live endpoint verification

Started with the backend already running on port 3001. Ran the full three-command curl chain:

1. `POST /auth/login` as `student1@mbzuai.ac.ae` → obtained access token
2. `GET /courses` → extracted first course ID: `calculus-linear-algebra`
3. `GET /courses/calculus-linear-algebra` → printed full response

Response confirmed:
- Envelope: `{ course: { ... } }` — wrapped object ✓
- Lectures array present under key `lectures` ✓
- All required fields present on each lecture: `id`, `title`, `moduleNumber`, `orderIndex`, `contentType`, `scheduledAt`, `teacherNote`, `isLocked`, `durationMinutes`, `createdAt`, `updatedAt`, `courseId` ✓
- Content types in the seed data: `LECTURE`, `LAB`, `QUIZ` ✓
- 12 lectures across 4 module groups (weeks) ✓

### A.2 — Backend sort fix

The `GET /courses/:id` handler was using a single-field `orderBy: { orderIndex: 'asc' }`. The spec requires sorting by `moduleNumber` first, then `orderIndex` — critical for correctness when lectures are added out of order in the future.

Also switched from `include` (returns all fields including `deletedAt`) to an explicit `select` block that names exactly the fields the frontend needs. This stops `deletedAt` from leaking into API responses.

**Change in `backend/src/routes/courses.ts`:**

```typescript
// Before
include: { lectures: { where: { deletedAt: null }, orderBy: { orderIndex: 'asc' } } }

// After
include: {
  lectures: {
    where: { deletedAt: null },
    orderBy: [
      { moduleNumber: 'asc' },
      { orderIndex: 'asc' },
    ],
    select: {
      id: true, title: true, description: true,
      moduleNumber: true, orderIndex: true, contentType: true,
      scheduledAt: true, teacherNote: true, isLocked: true,
      durationMinutes: true, createdAt: true, updatedAt: true,
      courseId: true,
    },
  },
},
```

`npx tsc --noEmit` backend — 0 errors after change.

---

## Part B — Course Page Rewrite

### B.1 — Lecture type check

Reviewed `frontend/src/types/course.ts`. The `Lecture` interface already included all required fields from Step 1.3. No changes needed.

### B.2 — Full rewrite of `app/courses/[id]/page.tsx`

Replaced the entire file. The old file had a hardcoded `weeks` constant with four static week objects and twelve hardcoded lecture titles — none of it came from the API. The new file has zero hardcoded course data.

#### Key design decisions

**`formatDate` and `getLectureLabel` outside the component**

Both helpers are pure functions with no dependency on component state. Defined at module level so they are not re-created on every render.

**`getLectureLabel` counts globally**

Labs and quizzes are numbered by their position across the entire course, not within a single week. This matches the spec — "Lab 1", "Lab 2" etc. are course-wide counters, not per-week. The function receives `allLectures` (the full `course.lectures` array) and filters it by `contentType` to find the global position of each item.

**`useMemo` for week grouping**

The grouping/sorting logic runs once when `course` changes and is memoised with `[course]` as the dependency. The sort within `useMemo` mirrors the backend sort (moduleNumber asc → orderIndex asc) as a client-side safety net.

**`Shell` component**

A small inner component defined inside `CoursePage` that wraps `ProtectedRoute` + the page frame. All three render states (loading, error, loaded) use it — `ProtectedRoute` appears exactly once and covers every path through the component.

**`course?.title` in all states**

`TopNav` receives `courseTitle={course?.title}` in every state. During loading and error, `course` is `null` so `course?.title` is `undefined`, and TopNav falls back to "Course" in the breadcrumb. Once loaded, the real title appears.

**ProtectedRoute import**

The spec template used a named import `{ ProtectedRoute }`. The actual file exports it as a default export. Used `import ProtectedRoute from '@/components/ProtectedRoute'` to match the file's actual export shape.

**Unknown `contentType` fallback**

The marker column has a fourth branch for any `contentType` value that isn't `LECTURE`, `LAB`, or `QUIZ`. It renders a neutral dot. No crash, no missing UI.

**Empty lectures state**

If `course.lectures` is an empty array, both the spine column and the list column show their respective empty messages ("No lectures" / "No lectures yet.") instead of rendering nothing.

---

## Verification Checklist

### Part A — Backend
- [x] Curl output printed in full (not truncated)
- [x] Response envelope confirmed: `{ course: { ... } }`
- [x] All required lecture fields present: `id`, `title`, `moduleNumber`, `orderIndex`, `contentType`, `scheduledAt`
- [x] Backend sort changed to dual-field: `moduleNumber` asc, `orderIndex` asc
- [x] Explicit `select` block — `deletedAt` no longer returned on lectures
- [x] `npx tsc --noEmit` backend — 0 errors

### Part B — Frontend
- [x] `Lecture` type already had all required fields — no changes needed
- [x] All hardcoded `weeks` data and mock lecture titles removed
- [x] `'use client'` at top of file
- [x] `useParams()` extracts course ID — not hardcoded
- [x] `getCourse(courseId)` called on mount via `useEffect`
- [x] `useMemo` used for week grouping with `[course]` dependency
- [x] `formatDate` and `getLectureLabel` defined outside the component
- [x] `Shell` wraps all three render states
- [x] `ProtectedRoute` appears exactly once (inside `Shell`)
- [x] Loading state: "Loading course..."
- [x] Error state: shows error message — no crash
- [x] Real course title passed to `TopNav` on load
- [x] Breadcrumb shows real course name (falls back to "Course" during load)
- [x] Weeks grouped by `moduleNumber`
- [x] Lectures sorted: `moduleNumber` asc, `orderIndex` asc within week
- [x] Week header shows week number and date from first lecture's `scheduledAt`
- [x] "TBD" shown where `scheduledAt` is null
- [x] LECTURE → filled dot, LAB → rotated square, QUIZ → rounded square
- [x] Unknown `contentType` → neutral dot (no crash)
- [x] `getLectureLabel` counts labs and quizzes globally across all lectures
- [x] Empty lectures → "No lectures yet."
- [x] Right panel blocks unchanged (AI Recap, Course Materials, Assignments, My Notes, Progress)
- [x] `scrollbar-none` class verified present in `globals.css`
- [x] `npx tsc --noEmit` frontend — 0 errors

---

## Files Changed

### Modified
| File | Change |
|------|--------|
| `backend/src/routes/courses.ts` | `GET /courses/:id` — dual-field sort, explicit `select` block on lectures |
| `frontend/src/app/courses/[id]/page.tsx` | Full rewrite — hardcoded weeks replaced with real API data, loading/error/loaded states, Shell wrapper pattern |

### Unchanged
| File | Reason |
|------|--------|
| `frontend/src/types/course.ts` | `Lecture` already had all required fields |
| `frontend/src/lib/api.ts` | `getCourse(id)` already existed from Step 1.3 |
| `frontend/src/components/TopNav.tsx` | `courseTitle` prop already existed from Step 1.3 |
| All other files | Not touched |

---

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@mbzuai.ac.ae` | `admin123` |
| Teacher | `teacher@mbzuai.ac.ae` | `teacher123` |
| Student 1–5 | `student1@mbzuai.ac.ae` … `student5@mbzuai.ac.ae` | `student123` |
