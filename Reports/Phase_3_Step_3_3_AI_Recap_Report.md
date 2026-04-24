# Implementation Report: Phase 3 — Step 3.3 (AI Recap / Multi-Lecture Summary)
## Study Guide Generation System

This report details the implementation of the AI-powered Multi-Lecture Summary feature, enabling teachers to generate comprehensive study guides across 2 to 20 lectures.

---

### 1. Database Schema
- **New Model**: Added `CourseRecap` to `backend/prisma/schema.prisma` using Prisma's implicit Many-to-Many relation with the `Lecture` model.
- **Relations**: Updated `Course` and `Lecture` models with inverse `recaps CourseRecap[]` relations.
- **Migration**: Applied schema changes and regenerated the Prisma Client (`npx prisma db push` and `npx prisma generate`).

### 2. AI Infrastructure
- **Prompt Engineering**: Created `recap-generate.v1.txt` with strict instructions prioritizing standard markdown headers and bullets while explicitly forbidding bold, italics, and numbered lists.
- **Provider Interface**: Added `LectureSummaryInput` interface and `generateRecap` method to `AIProvider` and all its implementations.
- **K2Provider Implementation**: Configured `K2Provider` to sort input summaries by `orderIndex`, cap at 20 lectures, and inject the content properly into the new prompt template.

### 3. Backend Endpoints (`courses.ts`)
- **Refactoring**: Updated `coursesRoutes` to use a factory function (`makeCoursesRoutes`) to inject the `AIProvider`.
- **`generateRecapTitle`**: Implemented a helper to generate descriptive titles based on scheduled dates or lecture count.
- **POST `/courses/:id/generate-recap`**: 
  - Verifies course access and fetches requested lectures along with their `BRIEF` summaries.
  - Returns clear errors if `lectureIds` is invalid or summaries are missing.
  - Implements a **90-second timeout** via `Promise.race` for the AI call.
  - Creates the `CourseRecap` and connects it to `Lecture` entities securely.
- **GET & DELETE Endpoints**: Implemented list, detail, and teacher-only deletion endpoints.

### 4. Frontend Components
- **Architecture**: Separated the UI into four distinct, focused components under `frontend/src/components/recap/`:
  - `RecapWidget`: Manages view state, API interactions, and error handling. Uses JWT to identify teacher role.
  - `RecapList`: Displays generated study guides and handles the empty state.
  - `RecapSelection`: Renders checkboxes for lecture selection and visually disables lectures missing AI summaries.
  - `RecapReader`: Parses the strict markdown output using `split('\n')` and renders standard semantic tags.
- **Integration**: Replaced the placeholder Progress block in `CoursePage` with the new `<RecapWidget />`.

---

### Verification Checklist
- [x] Schema migrated and `CourseRecap` mapped via implicit many-to-many.
- [x] No `JSON.parse` or stringification used for `lectureIds`.
- [x] AI prompt explicitly forbids bold/italics/numbered lists.
- [x] Timeout wrapper (90s) active on the POST endpoint.
- [x] Frontend strictly separated into 4 isolated component files.
- [x] `npx tsc --noEmit` passes cleanly for both `backend/` and `frontend/`.
