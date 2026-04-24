export interface CourseTeacher {
  id: string
  name: string
  email: string
}

// Matches GET /api/v1/courses response shape (list view).
// teacher is optional because GET /api/v1/courses/:id does not include it.
export interface Course {
  id: string
  title: string
  description: string | null
  teacherId: string
  teacher?: CourseTeacher
  createdAt: string
  updatedAt: string
}

// Matches GET /api/v1/courses/:id response shape (detail view).
// Lectures are included; LectureFile[] is NOT — the endpoint does not include files.
export interface Lecture {
  id: string
  courseId: string
  title: string
  description: string | null
  moduleNumber: number | null
  orderIndex: number
  contentType: string        // "LECTURE" | "LAB" | "QUIZ"
  scheduledAt: string | null
  teacherNote: string | null
  isLocked: boolean
  durationMinutes: number | null
  createdAt: string
  updatedAt: string
}

// Defined for future use when endpoint includes lecture files.
export interface LectureFile {
  id: string
  type: string // "SLIDES" | "RECORDING" | "REFERENCE" | "OTHER"
  label: string | null
  url: string
  mimeType: string | null
  sizeBytes?: number | null
  createdAt: string
}

export interface AISummary {
  id: string
  type: string // "BRIEF" | "FULL" | "BULLET_POINTS"
  content: string
  modelUsed: string
  promptVersion: string | null
  createdAt: string
}

export interface LectureTranscript {
  id: string
  source: string
  rawContent: string
  processedContent: string | null
  status: string
  createdAt: string
}

export interface LectureDetail extends Lecture {
  files: LectureFile[]
  transcripts: LectureTranscript[]
  aiSummaries: AISummary[]
}

export interface CourseDetail extends Course {
  lectures: Lecture[]
}

export interface CourseRecap {
  id:            string
  courseId:      string
  title:         string
  lectureCount:  number
  modelUsed:     string
  promptVersion: string | null
  createdAt:     string
  lectures:      { id: string }[]
}

export interface CourseRecapDetail extends CourseRecap {
  content: string
}
