const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

const ACCESS_TOKEN_KEY  = 'antigravity_access_token'
const REFRESH_TOKEN_KEY = 'antigravity_refresh_token'

// ─── Token management ────────────────────────────────────────────────────────

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

// ─── Typed error ─────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

// ─── Token refresh (shared promise prevents parallel refresh races) ──────────

let refreshPromise: Promise<void> | null = null

async function doTokenRefresh(): Promise<void> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) throw new ApiError(401, 'No refresh token')

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ refreshToken }),
  })

  if (!res.ok) throw new ApiError(401, 'Refresh failed')

  const { accessToken, refreshToken: newRefresh } = await res.json()
  setTokens(accessToken, newRefresh)
}

function redirectToLogin(): never {
  if (typeof window !== 'undefined') window.location.href = '/login'
  throw new ApiError(401, 'Not authenticated')
}

// ─── Main API function ───────────────────────────────────────────────────────

export async function api<T>(
  path: string,
  options?: RequestInit & { skipAuth?: boolean },
): Promise<T> {
  const { skipAuth, ...fetchOptions } = options ?? {}

  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string>),
  }

  if (!skipAuth) {
    const token = getAccessToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  // Set JSON content type when body is a string (i.e. JSON.stringify output)
  // but NOT for FormData (multipart — browser sets that automatically)
  if (fetchOptions.body && typeof fetchOptions.body === 'string') {
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json'
    }
  }

  const res = await fetch(`${API_URL}${path}`, { ...fetchOptions, headers })

  // ── Happy path ──────────────────────────────────────────────────────────────
  if (res.ok) {
    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  }

  // ── 401 — attempt one token refresh, then retry once ───────────────────────
  if (res.status === 401 && !skipAuth) {
    if (!getRefreshToken()) {
      clearTokens()
      redirectToLogin()
    }

    try {
      // Deduplicate concurrent refresh attempts
      if (!refreshPromise) {
        refreshPromise = doTokenRefresh().finally(() => { refreshPromise = null })
      }
      await refreshPromise
    } catch {
      clearTokens()
      redirectToLogin()
    }

    // Retry the original request with the new token — no further refresh on failure
    const retryHeaders: Record<string, string> = {
      ...(fetchOptions.headers as Record<string, string>),
    }
    const newToken = getAccessToken()
    if (newToken) retryHeaders['Authorization'] = `Bearer ${newToken}`

    const retryRes = await fetch(`${API_URL}${path}`, { ...fetchOptions, headers: retryHeaders })

    if (retryRes.ok) {
      if (retryRes.status === 204) return undefined as T
      return retryRes.json() as Promise<T>
    }

    if (retryRes.status === 401) {
      clearTokens()
      redirectToLogin()
    }

    const retryErr = await retryRes.json().catch(() => ({})) as { error?: string; message?: string }
    throw new ApiError(retryRes.status, retryErr.error ?? retryErr.message ?? 'Request failed')
  }

  // ── Other non-2xx errors ────────────────────────────────────────────────────
  const errBody = await res.json().catch(() => ({})) as { error?: string; message?: string }
  throw new ApiError(res.status, errBody.error ?? errBody.message ?? 'Request failed')
}

import type { Course, CourseDetail, LectureDetail } from '@/types/course'

// Fetch all courses the current user has access to.
// Backend returns { courses: Course[] } — unwrapped here.
export async function getCourses(): Promise<Course[]> {
  const data = await api<{ courses: Course[] }>('/courses')
  return data.courses
}

// Fetch a single course with its lectures.
// Backend returns { course: CourseDetail } — unwrapped here.
export async function getCourse(id: string): Promise<CourseDetail> {
  const data = await api<{ course: CourseDetail }>(`/courses/${id}`)
  return data.course
}

// Fetch a single lecture with its files, transcripts, and AI summaries.
// Backend returns { lecture: LectureDetail } — unwrapped here.
export async function getLecture(id: string): Promise<LectureDetail> {
  const data = await api<{ lecture: LectureDetail }>(`/lectures/${id}`)
  return data.lecture
}

export async function uploadFile(file: File): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'
  const uploadUrl = baseUrl.replace('/api/v1', '') + '/api/upload'

  const token = getAccessToken()
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  if (!response.ok) {
    const body = await response.text().catch(() => 'unknown error')
    throw new Error(`Upload failed (${response.status}): ${body}`)
  }

  const data = await response.json() as Record<string, unknown>
  const url = data.url ?? data.fileUrl ?? data.path
  if (typeof url !== 'string' || !url) {
    throw new Error(`Upload response missing URL. Got: ${JSON.stringify(data)}`)
  }
  return url
}

export async function linkFileToLecture(
  lectureId: string,
  type: string,
  url: string,
  label: string,
  mimeType?: string
): Promise<void> {
  await api<unknown>(`/lectures/${lectureId}/files/register`, {
    method: 'POST',
    body: JSON.stringify({
      type,
      url,
      label,
      ...(mimeType ? { mimeType } : {}),
    }),
  })
}

export async function submitTranscript(
  lectureId: string,
  rawContent: string,
  source: 'ZOOM' | 'MANUAL' | 'UPLOAD'
): Promise<string> {
  const data = await api<{ transcript: { id: string } }>('/transcripts', {
    method: 'POST',
    body: JSON.stringify({ lectureId, rawContent, source }),
  })
  return data.transcript.id
}

export async function generateSummary(
  transcriptId: string,
  summaryType: 'BRIEF' | 'FULL' | 'BULLET_POINTS'
): Promise<string> {
  const data = await api<{ jobId: string }>(`/transcripts/${transcriptId}/process`, {
    method: 'POST',
    body: JSON.stringify({ summaryType }),
  })
  return data.jobId
}

export async function getJobStatus(jobId: string): Promise<{
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED'
  errorMessage?: string | null
}> {
  const data = await api<{ status: string; errorMessage?: string | null }>(`/ai/jobs/${jobId}`)
  return {
    status: data.status as any,
    errorMessage: data.errorMessage ?? null,
  }
}

export async function updateTeacherNote(lectureId: string, note: string): Promise<void> {
  await api(`/lectures/${lectureId}/note`, {
    method: 'PATCH',
    body: JSON.stringify({ teacherNote: note }),
  })
}

export async function deleteLectureFile(
  lectureId: string,
  fileId: string
): Promise<void> {
  await api<void>(`/lectures/${lectureId}/files/${fileId}`, {
    method: 'DELETE',
  })
}

export async function deleteTranscript(transcriptId: string): Promise<void> {
  await api<void>(`/transcripts/${transcriptId}`, {
    method: 'DELETE',
  })
}
