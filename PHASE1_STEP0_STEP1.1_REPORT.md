# Phase 1 — Step 0 + Step 1.1 Implementation Report

---

## What Was Built

Two parallel workstreams: backend schema/API hardening (Step 0) and a complete frontend authentication system (Step 1.1).

---

## Step 0 — Backend Pre-Flight Fixes

### Schema changes (`schema.prisma`)

Three fields added to the `Lecture` model:
- `contentType String @default("LECTURE")` — distinguishes lectures, labs, and quizzes at the data layer
- `scheduledAt DateTime?` — when the session is scheduled
- `teacherNote String?` — free-text professor annotation

SQLite doesn't support Prisma enums, so all three are `String` fields with values enforced at the application layer, consistent with the rest of the schema. Used `prisma db push` to apply the schema change (non-interactive environment) and `prisma generate` to regenerate the client.

### Courses endpoint (`routes/courses.ts`)

`GET /api/v1/courses` was previously restricted to TEACHER and ADMIN roles only. Changed the guard from `requireRole('TEACHER', 'ADMIN')` to just `requireAuth`, then added role-branching logic inside the handler:
- STUDENT → `findMany` filtered by `enrollments.some({ userId, active: true })` — returns only their enrolled courses
- TEACHER / ADMIN → unchanged behavior, returns all non-deleted courses

Response shape is identical for all roles (`{ courses: [...] }`), so no frontend contract was broken.

### `GET /auth/me` endpoint (`routes/auth.ts`)

Added a new route required by the frontend auth context. It takes a valid JWT (via `requireAuth` preHandler), looks up the user by `userId` from the token payload, and returns `{ id, name, email, role }`. Returns 401 if the user has been soft-deleted. This is a lightweight "is my token still valid?" endpoint called once on page load.

### Upload auth (`routes/upload.ts`)

`POST /api/upload` had no authentication. Added `preHandler: [requireAuth, requireRole('TEACHER', 'ADMIN')]` — unauthenticated requests now get 401, student requests get 403.

### Seed script (`prisma/seed.ts`)

Full rewrite. Previous seed had two students with generic emails, two lectures, and minimal data. New seed creates:
- 7 users: `admin@mbzuai.ac.ae`, `teacher@mbzuai.ac.ae`, `student1–5@mbzuai.ac.ae`
- 1 course: "Calculus and Linear Algebra"
- 5 enrollments (all students enrolled)
- 12 lectures across 4 weeks on an MWF schedule starting 2026-01-05, with correct `contentType` per the spec pattern (LECTURE/LECTURE/LAB, LECTURE/LECTURE/QUIZ, ×2)
- 2 transcripts on Lecture 1 and Lecture 3 — real calculus prose (limits/continuity, implicit differentiation/related rates), not lorem ipsum, so the AI summarization job produces meaningful output
- 2 PENDING AIJobs for those transcripts

---

## Step 1.1 — Frontend Auth System

### `src/types/auth.ts`

Three interfaces: `User`, `LoginResponse`, and `AuthState`. `LoginResponse` was written to match the backend's actual `/auth/login` response shape — verified by reading `routes/auth.ts` before writing — which returns `{ accessToken, refreshToken, user: { id, name, email, role } }`.

### `src/lib/api.ts`

Replaced the trivial `apiFetch` stub with a full auth-aware client. Key design decisions:

- All calls go through a single `api<T>()` function — raw `fetch` to the backend is banned elsewhere in the codebase
- Tokens stored in `localStorage` under `antigravity_access_token` / `antigravity_refresh_token`
- On 401: checks for a refresh token, calls `/auth/refresh`, stores the new token pair, and retries the original request exactly once. The retry does not go through the 401 handler again — this is the infinite-loop prevention.
- Concurrent 401s share a single refresh via a module-level `refreshPromise`. Without this, two parallel requests that each get a 401 would both try to consume the single-use refresh token, causing one to fail and log the user out spuriously.
- `skipAuth: true` option for the login call — skips the Authorization header injection
- All redirect logic (`window.location.href = '/login'`) is guarded with `typeof window !== 'undefined'` for SSR safety, though in practice all callers are client components

### `src/lib/auth.tsx`

React context providing `{ user, isLoading, isAuthenticated, login, logout }` to the entire tree. On mount it calls `GET /auth/me` if a token exists in localStorage — this rehydrates the auth state on page refresh without requiring a new login. If the token is expired, `api()` automatically attempts a refresh before the `/me` call even fails. The `logout` function calls `POST /auth/logout` best-effort (doesn't throw if it fails), then clears tokens and redirects.

### `src/app/layout.tsx`

Added `<AuthProvider>` wrapping `{children}` in the root layout. This is a server component importing a client component, which is the standard Next.js pattern — the client boundary is owned by `AuthProvider` itself, not by layout.

### `src/components/ProtectedRoute.tsx`

Three states:
1. `isLoading` — renders a neutral loading screen (prevents a flash of the login redirect before auth is resolved)
2. `!isAuthenticated` — returns `null` and fires `router.push('/login')` via `useEffect`
3. Authenticated — renders children unchanged

### Pages wrapped

`page.tsx` (homepage), `dashboard/page.tsx`, `courses/[id]/page.tsx`, `my-map/page.tsx`, `graph/page.tsx`. The server-component pages (`my-map`, `graph`) needed `'use client'` added since `ProtectedRoute` is a client component.

### `src/app/login/page.tsx`

MBZUAI-branded login form. Uses a placeholder `div` for the logo (matching TopNav — no actual image asset exists). Handles three submission paths: empty fields (local validation), valid credentials (login + redirect to `/dashboard`), and invalid credentials (error message). Enter key on the password field triggers submit. If the user arrives already authenticated, a `useEffect` redirects immediately and the form renders `null` while `isLoading` is true — no flash.

### `TopNav.tsx`

Avatar `div` replaced with a `<button>` that calls `logout()` on click with a hover state. No other changes to the component.

---

## Verification

- `npx tsc --noEmit` — zero errors in both frontend and backend
- `npx prisma db seed` — clean run, all 7 users, 12 lectures, 5 enrollments created
- All new backend routes and middleware additions are consistent with the existing Fastify patterns in the codebase

---

## Files Changed

### Created
| File | Purpose |
|------|---------|
| `backend/.env.example` | Documented env variable template |
| `frontend/.env.local` | API base URL for local dev |
| `frontend/.env.example` | Documented env variable template |
| `frontend/src/types/auth.ts` | `User`, `LoginResponse`, `AuthState` interfaces |
| `frontend/src/lib/api.ts` | Auth-aware API client with token refresh |
| `frontend/src/lib/auth.tsx` | `AuthProvider` context + `useAuth` hook |
| `frontend/src/components/ProtectedRoute.tsx` | Route guard component |
| `frontend/src/app/login/page.tsx` | Login page |

### Modified
| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Added `contentType`, `scheduledAt`, `teacherNote` to `Lecture` |
| `backend/prisma/seed.ts` | Full rewrite with MBZUAI test data |
| `backend/src/routes/auth.ts` | Added `GET /auth/me` endpoint |
| `backend/src/routes/courses.ts` | Allow students to list enrolled courses |
| `backend/src/routes/upload.ts` | Added auth guard (TEACHER/ADMIN only) |
| `frontend/src/app/layout.tsx` | Wrapped children with `<AuthProvider>` |
| `frontend/src/app/page.tsx` | Wrapped with `<ProtectedRoute>` |
| `frontend/src/app/dashboard/page.tsx` | Added `'use client'`, wrapped with `<ProtectedRoute>` |
| `frontend/src/app/courses/[id]/page.tsx` | Wrapped with `<ProtectedRoute>` |
| `frontend/src/app/my-map/page.tsx` | Added `'use client'`, wrapped with `<ProtectedRoute>` |
| `frontend/src/app/graph/page.tsx` | Added `'use client'`, wrapped with `<ProtectedRoute>` |
| `frontend/src/components/TopNav.tsx` | Avatar button wired to `logout()` |

---

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@mbzuai.ac.ae` | `admin123` |
| Teacher | `teacher@mbzuai.ac.ae` | `teacher123` |
| Student 1–5 | `student1@mbzuai.ac.ae` … `student5@mbzuai.ac.ae` | `student123` |
