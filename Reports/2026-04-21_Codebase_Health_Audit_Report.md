# Codebase Health Audit Report
**Date:** April 21, 2026

## 1. Orphaned Files and Dead Code

### Frontend Components
**File:** `frontend/src/components/*.tsx`
**Location:** Component definitions
**Notes:** All 13 component files in `frontend/src/components/` are currently imported and active in the application.

### Frontend Pages
**File:** `frontend/src/app/graph/page.tsx`
**Location:** Page component
**Notes:** This page is present in the file system and reachable, but is not currently linked in the `TopNav` or any visible site navigation. It appears to be an experimental view.

### API Foundations
**File:** `frontend/src/lib/auth.tsx`
**Location:** AuthProvider
**Notes:** Previously confused with `auth.ts` in some audits, `auth.tsx` is the primary React Context provider for authentication and is correctly imported in `layout.tsx`.

### Backend Routes registration
**File:** `backend/src/server.ts`
**Location:** Routes registration block (Lines 71-77)
**Notes:** All route modules (`ai`, `auth`, `courses`, `lectures`, `transcripts`, `upload`) are correctly registered and mapped to appropriate API version prefixes.

---

## 2. Types and Interfaces

### Type Alignment (Lectures)
**File:** `frontend/src/types/course.ts`
**Location:** `LectureDetail` interface
**Notes:** Corrected to align with the backend's `include` strategy. It now properly maps `files`, `transcripts`, and `aiSummaries` which are returned by `GET /api/v1/lectures/:id`.

**File:** `backend/prisma/schema.prisma`
**Location:** `Assignment` and `Submission` models (Lines 187-217)
**Notes:** These models exist in the database schema but have no corresponding handlers in `backend/src/routes/`. They are currently unreachable via the API.

---

## 3. CSS and Hardcoded Data

### Orphaned CSS Modules
**File:** `frontend/src/app/globals.css`
**Location:** Animation and utility classes
**Notes:** The following classes are defined but not referenced in any `.tsx` file:
- `.15s`, `.25s`, `.35s` (Animation delays)
- `.4deg` (Rotation utility)
- `.dnd-over` (Leftover from early DnD experiments)
- `.widget-jiggle`, `.widget-jiggle-offset` (Planned but unused UI effects)

### Mock Data Remains
**File:** `frontend/src/components/CourseTimeline.tsx`
**Location:** `generateCourseData()` helper
**Notes:** While the component now maps to DB IDs, it still contains a fallback generation logic for 14 weeks that produces mock titles if the database lecture count is lower than 42.

**File:** `frontend/src/lib/widgetRegistry.ts`
**Location:** `defaultWidgets` and `availableWidgetTiles`
**Notes:** Contains hardcoded metadata for widgets (Grades, AI Recap, Notes) that are defined in the registry but do not yet have corresponding implementation components.

---

## 4. Console Logs and Debug Statements

### Frontend Logs (Diagnostic)
**File:** `frontend/src/app/dashboard/page.tsx`, `frontend/src/app/courses/[id]/page.tsx`
**Notes:** Use `console.error` for failed data fetching. These are intentional for initial error reporting in development.

### Backend Logs (Systemic)
**File:** `backend/src/services/ai/JobWorker.ts`
**Location:** `JobWorker.start()`, `processJob()`
**Notes:** Heavy use of `console.log` for worker polling and job lifecycle. These are currently the primary way to monitor the AI pipeline status.

**File:** `backend/src/services/ai/AIService.ts`
**Location:** `K2Provider` retries
**Notes:** Uses `console.warn` for network retries and rate limit handling.

---

## 5. Dependencies

### Frontend Packages
**File:** `frontend/package.json`
**Notes:** All listed dependencies are in use:
- `@dnd-kit/*`: Powering the Sidebar widget layout.
- `d3`: Powering the Knowledge Graph visualization.
- `lucide-react`: Powering all UI icons.

### Backend Packages
**File:** `backend/package.json`
**Notes:** `bcryptjs` and `jwt` are actively securing routes; `zod` is used for runtime validation across all POST/PATCH endpoints.

---

## 6. Seed Data and Test Credentials

### Test Identity Audit
**File:** `backend/prisma/seed.ts`
**Location:** Identity creation block
**Notes:** Contains the following hardcoded test credentials:
- **Admin:** `admin@mbzuai.ac.ae` / `admin123`
- **Teacher:** `teacher@mbzuai.ac.ae` / `teacher123`
- **Student:** `student1@mbzuai.ac.ae` (up to `student5`) / `student123`

---

## Summary

- Components scanned: 13
- Exported API functions scanned: 16
- Console statements found (frontend): 3
- Console statements found (backend): 20+ (primarily AI Worker logs)
- Packages scanned (frontend): 8
- Packages scanned (backend): 9
