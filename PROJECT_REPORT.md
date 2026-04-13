# LMS Project Report
> Generated 2026-04-12

---

## 1. Directory Tree (2 Levels Deep)

```
LMS Dev/
├── backend/
│   ├── dist/                    # compiled output (tsc)
│   ├── prisma/
│   │   ├── schema.prisma        # data model
│   │   ├── seed.ts              # db seeder
│   │   └── prisma/dev.db        # SQLite database file
│   ├── scripts/
│   │   └── ingest-lecture.ts    # CLI tool for seeding lecture data
│   ├── src/
│   │   ├── lib/                 # env config, prisma client
│   │   ├── middleware/          # JWT auth middleware
│   │   ├── routes/              # Fastify route handlers (6 files)
│   │   ├── services/
│   │   │   ├── ai/              # AIService.ts, JobWorker.ts
│   │   │   └── storage/         # StorageService.ts
│   │   └── server.ts            # entry point
│   ├── uploads/                 # local file storage (dev only)
│   ├── .env                     # secrets (not committed)
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── public/                  # static assets
│   ├── src/
│   │   ├── app/                 # Next.js App Router pages
│   │   │   ├── courses/[id]/    # dynamic course page
│   │   │   ├── dashboard/       # dashboard page
│   │   │   ├── graph/           # knowledge graph page
│   │   │   ├── my-map/          # placeholder page
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx         # homepage (/)
│   │   ├── components/          # 9 React components
│   │   ├── lib/                 # widgetRegistry.ts, courses.ts
│   │   └── types/               # widgets.ts
│   ├── AGENTS.md / CLAUDE.md    # AI coding guidelines
│   ├── next.config.ts
│   ├── package.json
│   └── tsconfig.json
├── node_modules/                # root workspace deps
├── package.json                 # monorepo root
└── tsconfig.base.json
```

---

## 2. Tech Stack

### Frontend
| Concern | Choice |
|---------|--------|
| Framework | Next.js 16.2.2 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 (`@import "tailwindcss"`, no config file) |
| Drag-and-drop | @dnd-kit/core + @dnd-kit/sortable |
| Graph visualization | D3.js v7 |
| Icons | lucide-react |
| React version | 19.2.4 |

### Backend
| Concern | Choice |
|---------|--------|
| Framework | Fastify 5 |
| Language | TypeScript 5 (ESM, `"type": "module"`) |
| ORM | Prisma 5 |
| Database | SQLite (dev) — file at `backend/prisma/prisma/dev.db` |
| Auth | JWT via `@fastify/jwt` — access token + refresh token rotation |
| Password hashing | bcryptjs (12 rounds) |
| File upload | `@fastify/multipart` — local disk (`uploads/`) in dev |
| Validation | Zod (available, used selectively) |
| AI abstraction | Custom `AIProvider` interface — pluggable |

### Auth Model
- **Access token**: short-lived JWT (`JWT_EXPIRES_IN` env, default unset — set at runtime)
- **Refresh token**: 7-day, stored in DB, single-use (deleted on use, new one issued)
- **Roles**: `ADMIN`, `TEACHER`, `STUDENT` (enforced as strings; Prisma enums not supported by SQLite)
- **Soft deletes**: `deletedAt` on `User`, `Course`, `Lecture`, `Assignment`

### Hosting
- Not deployed. Dev only: backend on `localhost:3001`, frontend on `localhost:3000`
- CORS is configured: production origin placeholder is `https://yourdomain.com`

---

## 3. API Routes / Endpoints

All backend routes are prefixed with `/api/v1/` except file uploads.

### Auth — `/api/v1/auth`
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth/register` | None | Create new user account (name, email, password) |
| POST | `/auth/login` | None | Authenticate; returns access token + refresh token |
| POST | `/auth/refresh` | None (body token) | Rotate refresh token; returns new access + refresh tokens |
| POST | `/auth/logout` | None (body token) | Invalidate refresh token |

### Courses — `/api/v1/courses`
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/courses` | TEACHER, ADMIN | List all non-deleted courses with teacher info |
| POST | `/courses` | TEACHER, ADMIN | Create a new course |
| GET | `/courses/:id` | Any authenticated | Get course + lectures (students must be enrolled) |
| POST | `/courses/:id/lectures` | TEACHER, ADMIN | Create a lecture under a course |
| POST | `/courses/:id/enroll` | TEACHER, ADMIN | Enroll a user in a course |

### Lectures — `/api/v1/lectures`
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/lectures/:id` | Any authenticated | Get lecture with files, transcript stubs, and latest 3 AI summaries (students must be enrolled) |
| POST | `/lectures/:id/files` | TEACHER, ADMIN | Multipart upload — upload a binary file (PDF, video, etc.) directly to storage |
| POST | `/lectures/:id/files/register` | TEACHER, ADMIN | Register an already-uploaded file URL (JSON body, no upload) |

### Transcripts — `/api/v1/transcripts`
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/transcripts` | TEACHER, ADMIN | Submit raw transcript text, link to a lecture |
| POST | `/transcripts/:id/process` | TEACHER, ADMIN | Queue async AI summarization job; returns 202 + `jobId` + `pollUrl` |

### AI — `/api/v1/ai`
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/ai/jobs/:id` | TEACHER, ADMIN | Poll job status; returns summary payload when `status: DONE` |
| GET | `/ai/summaries/:lectureId` | Any authenticated | Get all AI summaries for a lecture (students must be enrolled) |
| POST | `/ai/analyze-transcript` | None | **Deprecated — returns 410 Gone.** Use `/transcripts/:id/process` |

### File Upload — `/api/upload`
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/upload` | None (no auth check) | Generic multipart upload; stores file, returns URL |

> **Note:** `/api/upload` has no auth middleware — this appears to be an oversight.

### Static Files
- `GET /uploads/:filename` — served by `@fastify/static` from `backend/uploads/`

---

## 4. Database Schema

Provider: SQLite. Enums enforced at application layer (not DB level).

### Models and Relationships

```
User ─────────────────────────────────────────────────────────
  id          cuid (PK)
  name        String
  email       String (unique)
  password    String (bcrypt hash)
  role        String  ADMIN | TEACHER | STUDENT  (default: STUDENT)
  createdAt   DateTime
  updatedAt   DateTime
  deletedAt   DateTime?  (soft delete)

  → enrollments[]       (via Enrollment)
  → teachingCourses[]   (via Course.teacherId)
  → submissions[]       (via Submission)
  → refreshTokens[]     (via RefreshToken)

RefreshToken ─────────────────────────────────────────────────
  id          cuid (PK)
  token       String (unique)
  userId      String → User.id
  expiresAt   DateTime
  createdAt   DateTime

Course ───────────────────────────────────────────────────────
  id          cuid (PK)
  title       String
  description String?
  teacherId   String → User.id
  createdAt   DateTime
  updatedAt   DateTime
  deletedAt   DateTime?  (soft delete)

  → enrollments[]
  → lectures[]

Enrollment ───────────────────────────────────────────────────
  id          cuid (PK)
  userId      String → User.id
  courseId    String → Course.id
  enrolledAt  DateTime
  active      Boolean (default: true)

  @@unique([userId, courseId])  ← one enrollment per student per course

Lecture ──────────────────────────────────────────────────────
  id              cuid (PK)
  courseId        String → Course.id
  title           String
  description     String?
  moduleNumber    Int?     (week/module grouping)
  orderIndex      Int      (display order within course)
  isLocked        Boolean  (default: false)
  durationMinutes Int?
  createdAt       DateTime
  updatedAt       DateTime
  deletedAt       DateTime?  (soft delete)

  → files[]       (LectureFile)
  → transcripts[] (Transcript)
  → assignments[] (Assignment)
  → aiSummaries[] (AISummary)

LectureFile ──────────────────────────────────────────────────
  id        cuid (PK)
  lectureId String → Lecture.id
  type      String   SLIDES | RECORDING | REFERENCE | OTHER
  label     String?
  url       String   (local path or cloud URL — storage-agnostic)
  mimeType  String?
  sizeBytes Int?
  createdAt DateTime

Transcript ───────────────────────────────────────────────────
  id               cuid (PK)
  lectureId        String → Lecture.id
  source           String   ZOOM | MANUAL | UPLOAD  (default: ZOOM)
  rawContent       String   (immutable after creation)
  processedContent String?  (cleaned, for AI)
  status           String   PENDING | PROCESSING | DONE | FAILED
  createdAt        DateTime
  updatedAt        DateTime

  → aiSummaries[]
  → aiJobs[]

AISummary ────────────────────────────────────────────────────
  id            cuid (PK)
  lectureId     String → Lecture.id
  transcriptId  String? → Transcript.id
  type          String   BRIEF | FULL | BULLET_POINTS
  content       String
  modelUsed     String   (e.g. "gpt-4o", "claude-3-5-sonnet", "mock")
  promptVersion String?
  createdAt     DateTime

AIJob ────────────────────────────────────────────────────────
  id           cuid (PK)
  transcriptId String → Transcript.id
  jobType      String   SUMMARIZE | EMBED | QUIZ_GENERATE
  status       String   PENDING | PROCESSING | DONE | FAILED
  errorMessage String?
  startedAt    DateTime?
  completedAt  DateTime?
  createdAt    DateTime
  updatedAt    DateTime

Assignment ───────────────────────────────────────────────────
  id          cuid (PK)
  lectureId   String → Lecture.id
  title       String
  description String?
  fileUrl     String?  (PDF task sheet)
  dueAt       DateTime?
  createdAt   DateTime
  updatedAt   DateTime
  deletedAt   DateTime?  (soft delete)

  → submissions[]

Submission ───────────────────────────────────────────────────
  id           cuid (PK)
  assignmentId String → Assignment.id
  studentId    String → User.id
  fileUrl      String?
  textContent  String?
  grade        Float?
  feedback     String?
  submittedAt  DateTime
  updatedAt    DateTime

  @@unique([assignmentId, studentId])  ← one submission per student per assignment
```

### Relationship Diagram (Text)

```
User ──< Enrollment >── Course ──< Lecture ──< LectureFile
  │                       │           │
  │                       │           ├──< Transcript ──< AISummary
  └──< Submission         │           │             └──< AIJob
        │                 │           ├──< AISummary
        └── Assignment <──┘           └──< Assignment ──< Submission
                                              └──────────────┘
                                               (studentId → User)
User ──< RefreshToken
```

---

## 5. Frontend Page Routes

| Route | File | Type | What It Renders |
|-------|------|------|-----------------|
| `/` | `app/page.tsx` | Client | Homepage: TopNav + widget Sidebar (DnD, edit mode, jiggle) + main area (hero card, 8-card scrollable row with arrow navigation, bottom card) |
| `/dashboard` | `app/dashboard/page.tsx` | Server | Course grid: "My Courses" header + one tile per course from `lib/courses.ts`. Tile navigates to `/courses/:id` |
| `/courses/[id]` | `app/courses/[id]/page.tsx` | Client | Two-panel course layout: left = date spine + lecture timeline (4 weeks, mock data); right = widget placeholder blocks (AI Recap, Course Materials, Assignments, My Notes, Progress, Study Groups) |
| `/my-map` | `app/my-map/page.tsx` | Server | Placeholder: TopNav + "Coming soon" |
| `/graph` | `app/graph/page.tsx` | Client | Full-screen D3 force-directed knowledge graph (`GraphView.tsx`) — fetches from `localhost:3001/api/v1/courses/calc-101/graph` (endpoint not implemented; renders empty) |

### TopNav Behavior
- On `/`, `/dashboard`, `/my-map`: shows Home / Dashboard / My Map links with active-state pill
- On `/courses/:id`: replaces nav links with breadcrumb `Dashboard › [Course Title]` (title resolved from `lib/courses.ts`)

### Shared Data
- `frontend/src/lib/courses.ts` — single source of truth for course IDs/titles. Used by Dashboard, Course Page, and TopNav breadcrumb.

---

## 6. Implemented vs Stubbed / Mocked

### Fully Implemented

**Backend:**
- JWT auth (register, login, refresh, logout with token rotation)
- Course CRUD (list, create, get with enrollment gate)
- Lecture CRUD (get with files/transcripts/summaries, file upload, file URL registration)
- Student enrollment
- Transcript ingestion (POST raw text)
- Async AI job queue (`POST /transcripts/:id/process` → 202 + polling via `/ai/jobs/:id`)
- AI job worker (DB-polling loop, every 10s, processes `SUMMARIZE` jobs)
- Mock AI provider (runs full pipeline end-to-end with fake output)
- Local file storage with `StorageService` abstraction
- Soft deletes on User, Course, Lecture, Assignment

**Frontend:**
- Homepage layout with widget sidebar
- DnD widget system (sort, add from panel, remove)
- Edit mode (jiggle, blur, click-outside-to-exit)
- Horizontally scrollable 8-card row with arrow navigation and snap scrolling
- TopNav with active state per route and breadcrumb on course pages
- Dashboard page with course tiles
- Course page with left timeline + right placeholder panels
- My Map placeholder

### Stubbed / Mocked / Incomplete

| Item | Status |
|------|--------|
| Knowledge graph API endpoint (`GET /courses/:id/graph`) | **Missing** — `GraphView.tsx` fetches it but it doesn't exist. Graph renders empty. |
| OpenAI provider | Stub only — constructor exists, all methods throw `Error('not yet implemented')` |
| Anthropic provider | Stub only — same as OpenAI |
| `/api/upload` auth | No auth middleware — any caller can upload files |
| Course page left panel | Mock data only (4 hardcoded weeks of lectures) — not connected to backend |
| Course page right panel | Placeholder blocks only — no real data |
| Homepage widgets | All widget `component` fields are `null` — slots render empty |
| Dashboard course tiles | Only one hardcoded course in `lib/courses.ts` — not fetched from backend |
| Knowledge graph navigation | "My Map" nav item goes to `/my-map` placeholder, not `/graph` |
| `processedContent` pipeline | Field exists on `Transcript` but no cleaning/processing step is implemented before AI summarization |
| `EMBED` and `QUIZ_GENERATE` job types | Defined in schema and `AIProvider` interface; `JobWorker` throws `Unknown jobType` for them |
| Assignment submission grading | Schema supports `grade` and `feedback` on `Submission`; no grading endpoint exists |
| Frontend auth | No login/register UI; no token storage; no authenticated API calls from frontend |

---

## 7. AI-Related Backend Groundwork

The AI pipeline is architecturally complete and ready to wire up. Key design decisions:

### AIProvider Interface (`src/services/ai/AIService.ts`)
```typescript
interface AIProvider {
  summarize(transcript: string, options?: SummarizeOptions): Promise<string>
  generateQuiz(content: string, questionCount: number): Promise<QuizQuestion[]>
  embed(text: string): Promise<number[]>
}
```
Three concrete classes exist:
- `MockAIProvider` — fully working, returns deterministic fake output. Active by default (no API key needed).
- `OpenAIProvider` — skeleton, all methods throw. Activated by setting `AI_PROVIDER=openai` + `AI_API_KEY` in `.env`.
- `AnthropicProvider` — skeleton, all methods throw. Activated by `AI_PROVIDER=anthropic` + `AI_API_KEY`.

Swapping providers requires only env var changes — zero route code changes.

### JobWorker (`src/services/ai/JobWorker.ts`)
- Polls the DB every 10 seconds for `PENDING` AI jobs
- Processes jobs serially (one at a time) to avoid race conditions
- Full status lifecycle: `PENDING → PROCESSING → DONE | FAILED`
- `processJob()` is designed to be extracted as a BullMQ processor with no logic changes
- Currently handles `SUMMARIZE` jobs only; `EMBED` and `QUIZ_GENERATE` are `TODO`

### Database Schema AI Layer
- `Transcript` — stores raw + processed text, tracks processing status
- `AISummary` — versioned outputs with `modelUsed` and `promptVersion` for auditability
- `AIJob` — async job tracking with timestamps (`startedAt`, `completedAt`, `errorMessage`)
- All AI outputs are linked back to both the `Lecture` and the source `Transcript`

### API Flow (end-to-end, works today with mock provider)
```
POST /transcripts          → create Transcript (status: PENDING)
POST /transcripts/:id/process → create AIJob (status: PENDING), returns 202 + jobId
[worker picks up in ≤10s]  → AIJob: PENDING → PROCESSING → DONE
                           → AISummary created with content + modelUsed
GET  /ai/jobs/:id          → poll status; returns AISummary when DONE
GET  /ai/summaries/:lectureId → retrieve all summaries for a lecture
```

### What's Needed to Activate Real AI
1. Install SDK: `npm install openai` or `npm install @anthropic-ai/sdk` in `backend/`
2. Implement the relevant provider class (`OpenAIProvider` or `AnthropicProvider`)
3. Set env vars: `AI_API_KEY=<key>` and `AI_PROVIDER=openai|anthropic`
4. No route code changes required

### Knowledge Graph (Planned, Not Wired)
- `GraphView.tsx` (991 lines) exists in the frontend — D3 force simulation, fully functional UI
- Expects: `GET /api/v1/courses/:id/graph` → `{ title, nodes: [{ id, title, type, nextNodeIds }] }`
- The backend endpoint does not exist yet
- The `Lecture` model has `orderIndex` and `moduleNumber` fields suitable for constructing graph node data
- `nextNodeIds` would need to be added to the `Lecture` model or computed from `orderIndex` ordering
