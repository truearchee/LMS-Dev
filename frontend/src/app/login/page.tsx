'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

export default function LoginPage() {
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [error, setError]           = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { login, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  // Already authenticated — skip the login screen
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, isLoading, router])

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('Please enter your email and password')
      return
    }
    setError('')
    setIsSubmitting(true)
    try {
      await login(email, password)
      router.push('/dashboard')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid email or password'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Show nothing while auth state is being resolved (avoids flash)
  if (isLoading) return null

  return (
    <div
      className="w-full min-h-screen bg-[#F2F2F2] flex items-center justify-center"
      style={{ fontFamily: "'SF Pro', system-ui, -apple-system, sans-serif" }}
    >
      <div className="w-full max-w-md bg-white rounded-[20px] p-8" style={{ boxShadow: '0px 0px 0px 1px rgba(0,0,0,0.08), 0px 8px 32px rgba(0,0,0,0.08)' }}>

        {/* Logo + university name */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-zinc-300 rounded-full mb-3 flex-shrink-0" />
          <span className="text-sm text-black/40 text-center leading-snug">
            Mohamed bin Zayed University<br />of Artificial Intelligence
          </span>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 text-sm text-red-500 text-center">{error}</div>
        )}

        {/* Email */}
        <div className="mb-3">
          <label className="block text-xs text-black/40 mb-1 uppercase tracking-wider">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your.email@mbzuai.ac.ae"
            className="w-full px-4 py-3 rounded-[12px] bg-[#F2F2F2] border border-black/10 text-sm text-black placeholder-black/30 focus:outline-none focus:border-black/30 transition-colors duration-150"
          />
        </div>

        {/* Password */}
        <div className="mb-6">
          <label className="block text-xs text-black/40 mb-1 uppercase tracking-wider">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            className="w-full px-4 py-3 rounded-[12px] bg-[#F2F2F2] border border-black/10 text-sm text-black placeholder-black/30 focus:outline-none focus:border-black/30 transition-colors duration-150"
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full px-4 py-3 rounded-[12px] bg-black text-white text-sm font-medium hover:bg-black/85 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Signing in…' : 'Sign In'}
        </button>

      </div>
    </div>
  )
}
