# Codebase Health Audit Report

## 1. Orphaned Files and Dead Code

**File:** `frontend/src/components/*`
**Location:** All component files
**Notes:** All 13 component files in `frontend/src/components/` were audited. Every component is actively imported and used within pages or other components.

**File:** `frontend/src/app/*`
**Location:** All page files
**Notes:** All pages (dashboard, login, my-map, courses/[id], graph, teacher/upload) are reachable and actively part of the routing structure.

**File:** `frontend/src/lib/api.ts`
**Location:** All exported functions
**Notes:** All exported functions (`getCourses`, `getCourse`, `getLecture`, `uploadFile`, `linkFileToLecture`, `submitTranscript`, `generateSummary`, `getJobStatus`, `updateTeacherNote`, `deleteLectureFile`, `deleteTranscript`, `getAccessToken`, `getRefreshToken`, `setTokens`, `clearTokens`, `api`, `ApiError`) are actively imported and used.

**File:** `frontend/src/lib/*`
**Location:** Utility files (`auth.tsx`, `vttParser.ts`, `widgetRegistry.ts`)
**Notes:** All utility files are imported and used throughout the application.

**File:** `backend/src/routes/ai.ts`
**Location:** `POST /analyze-transcript` endpoint
**Notes:** This endpoint is explicitly marked as Deprecated and returns a 410 Gone status.

**File:** `backend/src/routes/*`
**Location:** All other endpoints
**Notes:** All other registered endpoints in `ai.ts`, `auth.ts`, `courses.ts`, `lectures.ts`, `transcripts.ts`, and `upload.ts` are actively called by the frontend or serve as necessary standard API routes.

**File:** `backend/src/services/ai/AIService.ts`
**Location:** Lines 123-124
**Notes:** Contains a large block of commented-out code for an old OpenAI SDK integration: `// const openai = new OpenAI({ apiKey: this.apiKey }); ...`.

**File:** `frontend/src/app/page.tsx`, `frontend/src/components/LectureDetailPanel.tsx`, `frontend/src/components/GraphView.tsx`
**Location:** Inline JSX structure
**Notes:** Contains many structural block comments describing layout (e.g., `{/* 1. Header Card */}`). These appear to be intentional documentation rather than dead code.

## 2. Types and Interfaces

**File:** `frontend/src/types/*`
**Location:** `course.ts`, `widgets.ts`, `auth.ts`
**Notes:** All type interfaces and aliases are actively imported and utilized across the frontend.

**File:** `frontend/src/types/course.ts`
**Location:** `LectureTranscript` interface
**Notes:** The interface defines `rawContent` and `processedContent` fields. However, the backend API endpoint (`GET /api/v1/lectures/:id`) does not return these fields in its select query, meaning they are missing from the actual backend response.

**File:** `backend/prisma/schema.prisma`
**Location:** `Assignment` and `Submission` models
**Notes:** These models exist in the database schema but have no corresponding backend routes, no data being written to them, and no references in the frontend.

## 3. CSS and Hardcoded Data

**File:** `frontend/src/app/globals.css`
**Location:** All custom classes (`widget-jiggle`, `scrollbar-none`, `scroll-snap-x`, `lecture-panel-enter`, etc.)
**Notes:** Every custom class defined in the CSS file was verified to be actively used within the frontend components.

**File:** `frontend/src/app/login/page.tsx`
**Location:** Email input placeholder
**Notes:** Contains a hardcoded university placeholder: `your.email@mbzuai.ac.ae`.

**File:** `frontend/src/components/UpcomingWidget.tsx`
**Location:** `UpcomingWidget` component
**Notes:** The component appears to still rely on hardcoded academic calendar rules and mock schedule generation logic rather than purely rendering real backend data.

**File:** `frontend/src/lib/courses.ts`
**Location:** Entire project
**Notes:** No remaining references to this deleted file were found.

## 4. Console Logs and Debug Statements

**File:** `frontend/src/app/dashboard/page.tsx`
**Location:** `getCourses()` catch block
**Notes:** Intentional error logging: `console.error('Failed to load courses:', err)`

**File:** `frontend/src/app/courses/[id]/page.tsx`
**Location:** `getCourse()` catch block
**Notes:** Intentional error logging: `console.error('Failed to load course:', err)`

**File:** `frontend/src/components/GraphView.tsx`
**Location:** Data fetch catch block
**Notes:** Intentional error logging: `console.error("Error fetching graph data:", err)`

**File:** `backend/src/services/ai/AIService.ts`
**Location:** Multiple methods
**Notes:** `console.warn` is used multiple times for network retries, rate limits, and "not yet implemented" stubs (e.g., `generateQuiz`, `embed`).

**File:** `backend/src/server.ts`
**Location:** Server startup
**Notes:** `console.log` is used for startup information and to warn when the Mock AI Provider is being used.

**File:** `backend/src/services/ai/JobWorker.ts`
**Location:** Polling loop
**Notes:** `console.log` and `console.error` are used extensively to trace the job worker polling lifecycle and catch tick errors.

**File:** `backend/src/services/transcript/transcriptProcessor.ts`
**Location:** Processing pipeline
**Notes:** `console.warn` and `console.error` are used to log parsing failures and fallbacks.

**File:** `backend/src/services/transcript/vttParser.test.ts`
**Location:** Test suite
**Notes:** `console.log` and `console.error` are used intentionally to output unit test results.

## 5. Dependencies

**File:** `frontend/package.json`
**Location:** All listed dependencies
**Notes:** All packages (including `@dnd-kit/*`, `d3`, `lucide-react`) are imported and actively used.

**File:** `backend/package.json`
**Location:** All listed dependencies
**Notes:** All packages (including `@fastify/*`, `@prisma/client`, `bcryptjs`, `zod`, `dotenv`) are imported and actively used.

## 6. Seed Data and Test Credentials

**File:** `backend/prisma/seed.ts`
**Location:** Database seeding script
**Notes:** Contains hardcoded test credentials:
- Admin: `admin@mbzuai.ac.ae` (password: `admin123`)
- Teacher: `teacher@mbzuai.ac.ae` (password: `teacher123`)
- Students: `student1@mbzuai.ac.ae` to `student5@mbzuai.ac.ae` (password: `student123`)
Also contains hardcoded IDs for courses (`calculus-linear-algebra`), lectures (`lec-01`, etc.), and transcripts (`transcript-lec-01`).

---

## Summary

- Components scanned: 13
- Exported API functions scanned: 17
- Console statements found (frontend): 3
- Console statements found (backend): 18
- Packages scanned (frontend): 8
- Packages scanned (backend): 9
