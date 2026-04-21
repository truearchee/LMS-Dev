'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth'

interface TopNavProps {
  courseTitle?: string
}

export function TopNav({ courseTitle }: TopNavProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN'
  const isHome = pathname === '/'
  const isDashboard = pathname === '/dashboard'
  const isMyMap = pathname === '/my-map'
  const isUploadPage = pathname === '/teacher/upload'
  const isCoursePage = pathname.startsWith('/courses/')

  return (
    <nav
      className="w-full h-[100px] flex items-center justify-start gap-16 px-6 bg-[#E9E5E5] flex-shrink-0"
      style={{ fontFamily: "'SF Pro', system-ui, -apple-system, sans-serif", boxShadow: '0px 0px 0px 1px rgba(0,0,0,0.23)' }}
    >
      {/* Left: logo + university name */}
      <div className="flex flex-row items-center gap-3">
        <div className="w-20 h-20 bg-zinc-300 rounded-full flex-shrink-0" />
        <span className="text-base text-black leading-5">
          Mohamed bin Zayed<br />University of<br />Artificial Intelligence
        </span>
      </div>

      {/* Center: nav links or breadcrumb */}
      <div className="flex flex-row items-center gap-6">
        {isCoursePage ? (
          <div className="flex items-center gap-2 text-base">
            <Link href="/dashboard">
              <span className="text-black/40 hover:text-black/70 transition-colors duration-150 cursor-pointer">
                Dashboard
              </span>
            </Link>
            <span className="text-black/25">›</span>
            <span className="text-black font-medium">{courseTitle ?? 'Course'}</span>
          </div>
        ) : (
          <>
            <Link href="/">
              <div className={`px-4 py-2 rounded-md text-2xl ${isHome ? 'bg-zinc-300 text-black' : 'text-black/40'}`}>
                Home
              </div>
            </Link>
            <Link href="/dashboard">
              <div className={`px-4 py-2 rounded-md text-2xl ${isDashboard ? 'bg-zinc-300 text-black' : 'text-black/40'}`}>
                Dashboard
              </div>
            </Link>
            <Link href="/my-map">
              <div className={`px-4 py-2 rounded-md text-2xl ${isMyMap ? 'bg-zinc-300 text-black' : 'text-black/40'}`}>
                My Map
              </div>
            </Link>
            {isTeacher && (
              <Link href="/teacher/upload">
                <div className={`px-4 py-2 rounded-md text-2xl ${isUploadPage ? 'bg-zinc-300 text-black' : 'text-black/40'}`}>
                  Upload
                </div>
              </Link>
            )}
          </>
        )}
      </div>

      {/* Right: avatar — click to sign out */}
      <button
        onClick={logout}
        title="Sign out"
        className="ml-auto w-10 h-10 rounded-full bg-zinc-300 flex-shrink-0 cursor-pointer hover:bg-zinc-400 transition-colors duration-150"
      />
    </nav>
  )
}
