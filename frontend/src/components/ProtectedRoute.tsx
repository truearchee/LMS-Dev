'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading) {
    return (
      <div className="w-full h-screen bg-[#F2F2F2] flex items-center justify-center">
        <span className="text-black/30 text-lg">Loading...</span>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // redirect handled by useEffect above
  }

  return <>{children}</>
}
