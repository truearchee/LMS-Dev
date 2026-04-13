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

// ─── Course API functions ─────────────────────────────────────────────────────
// Import types inline to avoid circular-dependency issues with bundlers.
import type { Course, CourseDetail } from '@/types/course'

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
