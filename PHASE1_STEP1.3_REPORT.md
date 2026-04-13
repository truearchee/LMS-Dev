# Phase 1 — Step 1.3 Implementation Report

---

## What Was Built

Two workstreams: backend pre-flight corrections (Part A) and frontend dashboard wired to the live API (Part B).

---

## Part A — Pre-Flight Corrections

### A.1 — Migration history fix

The previous session used `prisma db push` to apply schema changes, which bypassed the migration system entirely. This left the database in sync with the schema but with no migration history — a problem for any environment that isn't the local dev machine.

Fix: deleted the SQLite database at `backend/prisma/prisma/dev.db` (throwaway dev data), then ran `npx prisma migrate dev --name "foundation"` from the `backend/` directory. With a clean database, `migrate dev` ran without interactive prompts — it created the migration file, applied it, and automatically ran `prisma generate` and `prisma db seed` in sequence.

Results:
- Migration folder created: `backend/prisma/migrations/20260413100240_foundation/`
- Database re-created at `backend/prisma/prisma/dev.db` (the path `file:./prisma/dev.db` in `DATABASE_URL` is relative to `schema.prisma`'s location, so it resolves to the nested `prisma/prisma/` path)
- Seed ran cleanly: 7 users, 12 lectures, 5 enrollments, 2 transcripts, 2 AI jobs

### A.2 — JWT expiry confirmation

Checked `backend/src/lib/env.ts` and `backend/.env`. Both already correct:
- `env.ts`: `JWT_EXPIRES_IN: z.string().default('15m')`
- `.env`: `JWT_EXPIRES_IN="15m"`

No changes needed.

### A.3 — Live endpoint verification

Started the backend (`npm run dev`) and ran 5 curl tests. All passed:

| Test | Expected | Result |
|------|----------|--------|
| Student `GET /courses` | 200, Calculus course | ✓ 200 |
| `POST /api/upload` without auth | 401 | ✓ 401 |
| `POST /api/upload` with student token | 403 | ✓ 403 |
| `GET /auth/me` with valid token | 200, `{ id, name, email, role }` | ✓ 200, no password field |
| `GET /auth/me` without token | 401 | ✓ 401 |

**Critical finding from Test 1** — response shape confirmed as `{ courses: [...] }` (wrapped object, not a plain array). Both the STUDENT branch and the TEACHER/ADMIN branch of `GET /courses` return `reply.send({ courses })`. This determined the implementation of `getCourses()` in Part B.

Also confirmed from reading the detail route: `GET /courses/:id` includes `lectures` in its Prisma query but does **not** include `teacher` or lecture `files`. This shaped the type definitions.

---

## Part B — Dashboard Fetches Real Courses

### B.1 — `frontend/src/types/course.ts`

Created with five interfaces verified against the actual backend route handlers — not assumed from the spec:

- `CourseTeacher` — `{ id, name, email }` matching the `teacher: { select: { id, name, email } }` include in the list endpoint
- `Course` — list view shape; `teacher` is **optional** because the detail endpoint does not include it (its Prisma query has no `teacher` in the `include` block)
- `Lecture` — detail view shape; no `files` array because `GET /courses/:id` does not include `files` on lectures
- `LectureFile` — defined for future use when the endpoint is extended to include files
- `CourseDetail extends Course` — adds `lectures: Lecture[]` for the detail view

Making `teacher` optional was a deliberate deviation from the spec template. The spec said "verify against the backend and use the backend's shape." The list endpoint always returns `teacher`; the detail endpoint never does. Optional accurately represents both without lying to TypeScript.

### B.2 — API functions in `api.ts`

Added `getCourses()` and `getCourse(id)` at the bottom of `api.ts`. Both unwrap the server's envelope:

```typescript
// GET /api/v1/courses → { courses: Course[] }
export async function getCourses(): Promise<Course[]> {
  const data = await api<{ courses: Course[] }>('/courses')
  return data.courses
}

// GET /api/v1/courses/:id → { course: CourseDetail }
export async function getCourse(id: string): Promise<CourseDetail> {
  const data = await api<{ course: CourseDetail }>(`/courses/${id}`)
  return data.course
}
```

The `api()` function (token injection, 401 refresh, deduplication) is unchanged — these functions sit on top of it.

### B.3 — Dashboard page rewrite

Replaced the hardcoded `courses` array import with a `useEffect` that calls `getCourses()` on mount. Three render states:

1. **Loading** — "Loading courses..." centered while the fetch is in flight
2. **Error** — error message if `getCourses()` throws (network down, 401 after refresh failure, etc.)
3. **Loaded** — course tiles with real database IDs in the `href` and teacher name displayed above the course title

The existing `<ProtectedRoute>` wrapper was kept — not doubled.

### B.4 — TopNav prop

Removed the `getCourseById` import from `lib/courses`. Added a `courseTitle?: string` prop. The breadcrumb on course pages now shows `{courseTitle ?? 'Course'}` — the prop is not yet passed from the courses page (that's Step 1.4), so it falls back to `'Course'` as a placeholder.

### B.5 — `lib/courses.ts` removal

Three files imported from it:
- `components/TopNav.tsx` — fixed in B.4
- `app/dashboard/page.tsx` — fixed in B.3 (import replaced with `getCourses` from `api.ts`)
- `app/courses/[id]/page.tsx` — removed import, removed `useParams` and `getCourseById` call, removed the not-found guard (which was checking against the hardcoded course ID — meaningless once the data is dynamic)

Deleted the file. Verified with grep: zero imports remain.

---

## Verification Checklist

### Part A
- [x] `backend/prisma/migrations/` exists — folder: `20260413100240_foundation`
- [x] Database re-seeded successfully after migration reset
- [x] `JWT_EXPIRES_IN` has `.default('15m')` in `env.ts` — already correct
- [x] `JWT_EXPIRES_IN=15m` in `backend/.env` — already correct
- [x] Test 1: Student `GET /courses` → 200, Calculus course, shape `{ courses: [...] }`
- [x] Test 2: Upload without auth → 401
- [x] Test 3: Upload with student token → 403
- [x] Test 4: `GET /auth/me` with token → 200, no password field
- [x] Test 5: `GET /auth/me` without token → 401

### Part B
- [x] `frontend/src/types/course.ts` created
- [x] Types verified against actual backend responses
- [x] `getCourses()` unwraps `{ courses }` — matches Test 1 shape
- [x] `getCourse(id)` unwraps `{ course }`
- [x] Dashboard: loading, error, empty, and courses states implemented
- [x] Course tile `href` uses real database ID from API response
- [x] `ProtectedRoute` wraps page exactly once
- [x] `lib/courses.ts` deleted
- [x] Zero imports of `lib/courses.ts` anywhere in codebase
- [x] TopNav accepts `courseTitle` prop, falls back to `'Course'`
- [x] No hardcoded `localhost` URLs in component or page files
- [x] `npx tsc --noEmit` frontend — **0 errors**
- [x] `npx tsc --noEmit` backend — **0 errors**

---

## Files Changed

### Created
| File | Purpose |
|------|---------|
| `frontend/src/types/course.ts` | `Course`, `CourseDetail`, `Lecture`, `LectureFile`, `CourseTeacher` interfaces |

### Modified
| File | Change |
|------|--------|
| `frontend/src/lib/api.ts` | Added `getCourses()` and `getCourse(id)` functions |
| `frontend/src/app/dashboard/page.tsx` | Replaced hardcoded course list with real API fetch; loading/error/empty states |
| `frontend/src/components/TopNav.tsx` | Removed `lib/courses` import; added `courseTitle?: string` prop |
| `frontend/src/app/courses/[id]/page.tsx` | Removed `lib/courses` import and dependent code |

### Deleted
| File | Reason |
|------|--------|
| `frontend/src/lib/courses.ts` | Replaced by real API data |

### Backend (no code changes — data layer only)
| Action | Result |
|--------|--------|
| Deleted `backend/prisma/prisma/dev.db` | Clean slate for proper migration |
| `npx prisma migrate dev --name "foundation"` | Created `20260413100240_foundation` migration |
| `npx prisma db seed` (auto-run by migrate) | 7 users, 12 lectures, 5 enrollments re-created |

---

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@mbzuai.ac.ae` | `admin123` |
| Teacher | `teacher@mbzuai.ac.ae` | `teacher123` |
| Student 1–5 | `student1@mbzuai.ac.ae` … `student5@mbzuai.ac.ae` | `student123` |
