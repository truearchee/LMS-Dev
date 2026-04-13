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
  type: string
  label: string | null
  url: string
  mimeType: string | null
}

export interface CourseDetail extends Course {
  lectures: Lecture[]
}
