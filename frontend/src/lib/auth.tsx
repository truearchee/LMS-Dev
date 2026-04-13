'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { api, setTokens, clearTokens, getAccessToken, getRefreshToken } from './api'
import type { User, AuthState, LoginResponse } from '@/types/auth'

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check existing token on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = getAccessToken()
      if (!token) {
        setIsLoading(false)
        return
      }
      try {
        const userData = await api<User>('/auth/me')
        setUser(userData)
      } catch {
        // Token invalid and refresh failed — api() already cleared tokens + redirected
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }
    checkAuth()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<LoginResponse>('/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
      skipAuth: true,
    })
    setTokens(data.accessToken, data.refreshToken)
    setUser(data.user)
  }, [])

  const logout = useCallback(async () => {
    try {
      const refreshToken = getRefreshToken()
      if (refreshToken) {
        await api('/auth/logout', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ refreshToken }),
        })
      }
    } catch {
      // Best-effort — don't block on failure
    }
    clearTokens()
    setUser(null)
    if (typeof window !== 'undefined') window.location.href = '/login'
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
