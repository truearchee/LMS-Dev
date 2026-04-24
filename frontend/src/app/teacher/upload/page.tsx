'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'
import {
  getCourses,
  getCourse,
  getLecture,
  uploadFile,
  linkFileToLecture,
  submitTranscript,
  generateSummary,
  getJobStatus,
  updateTeacherNote,
  deleteLectureFile,
  deleteTranscript,
  generateQuizForLecture,
} from '@/lib/api'
import ProtectedRoute from '@/components/ProtectedRoute'
import { TopNav } from '@/components/TopNav'
import { stripVttTimestamps } from '@/lib/vttParser'
import type { Course, Lecture, LectureDetail } from '@/types/course'

// ── Types ──────────────────────────────────────────────────────────────────

type UploadStatusType = 'uploading' | 'success' | 'partial' | 'error'

interface UploadStatus {
  type: UploadStatusType
  message: string
  details?: string[]
}

// ── Static styles (outside component — not recreated on every render) ──────

const card: React.CSSProperties = {
  background: '#E9E5E6',
  borderRadius: 20,
  padding: '20px 24px',
  boxShadow: 'var(--shadow-card)',
}

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'rgba(0,0,0,0.40)',
  display: 'block',
  marginBottom: 14,
}

const fieldLabel: React.CSSProperties = {
  fontSize: 12,
  color: 'rgba(0,0,0,0.45)',
  marginBottom: 6,
  display: 'block',
}

const inputBase: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid rgba(0,0,0,0.10)',
  background: 'rgba(0,0,0,0.03)',
  fontSize: 14,
  color: 'rgba(0,0,0,0.75)',
  outline: 'none',
  boxSizing: 'border-box',
}

// ── Page component ─────────────────────────────────────────────────────────

export default function TeacherUploadPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  // Role gate — runs after auth resolves
  useEffect(() => {
    if (isLoading) return
    if (!user) { router.push('/login'); return }
    if (user.role === 'STUDENT') { router.push('/dashboard'); return }
  }, [user, isLoading, router])

  // Render nothing while loading or redirecting
  if (isLoading || !user || user.role === 'STUDENT') return null

  return <UploadForm />
}

// ── Upload form (only renders for authenticated teachers/admins) ────────────

function UploadForm() {
  // Step 1: selection
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [selectedLectureId, setSelectedLectureId] = useState('')

  // Step 2: materials
  const [slidesFile, setSlidesFile] = useState<File | null>(null)
  const [exerciseFile, setExerciseFile] = useState<File | null>(null)
  const [zoomUrl, setZoomUrl] = useState('')
  const [transcriptText, setTranscriptText] = useState('')
  const [transcriptFileName, setTranscriptFileName] = useState<string | null>(null)
  const [teacherNote, setTeacherNote] = useState('')

  // Step 3: upload status
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null)

  // Transcript ID set after successful transcript submission
  // Enables the "Generate AI Summary" button
  const [pendingTranscriptId, setPendingTranscriptId] = useState<string | null>(null)

  // AI generation progress message
  const [aiProgress, setAiProgress] = useState<string | null>(null)

  const [existingLecture, setExistingLecture] = useState<LectureDetail | null>(null)
  const [isLoadingLecture, setIsLoadingLecture] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Ref to abort AI polling when component unmounts or user navigates away
  const abortPollingRef = useRef(false)

  // Cleanup on unmount
  useEffect(() => {
    return () => { abortPollingRef.current = true }
  }, [])

  // Load courses on mount
  useEffect(() => {
    getCourses()
      .then(setCourses)
      .catch(() => setUploadStatus({
        type: 'error',
        message: 'Failed to load courses. Is the backend running?',
      }))
  }, [])

  // Load lectures when course changes
  useEffect(() => {
    if (!selectedCourseId) {
      setLectures([])
      setSelectedLectureId('')
      return
    }
    getCourse(selectedCourseId)
      .then(course => {
        const sorted = [...(course.lectures ?? [])].sort((a, b) => a.orderIndex - b.orderIndex)
        setLectures(sorted)
      })
      .catch(() => setUploadStatus({ type: 'error', message: 'Failed to load lectures.' }))
  }, [selectedCourseId])

  // Reset all material fields when lecture changes — prevents uploading stale data
  useEffect(() => {
    // Abort any in-progress AI generation from previous lecture
    abortPollingRef.current = true

    // Reset all fields
    setSlidesFile(null)
    setExerciseFile(null)
    setZoomUrl('')
    setTranscriptText('')
    setTranscriptFileName(null)
    setTeacherNote('')
    setUploadStatus(null)
    setPendingTranscriptId(null)
    setAiProgress(null)
    setExistingLecture(null)

    if (!selectedLectureId) {
      setIsLoadingLecture(false)
      return
    }

    // Reset abort for this lecture's operations
    abortPollingRef.current = false

    setIsLoadingLecture(true)
    getLecture(selectedLectureId)
      .then(data => {
        setExistingLecture(data)
        // If transcript already exists, set pendingTranscriptId
        if (data.transcripts.length > 0) {
          setPendingTranscriptId(data.transcripts[0].id)
        }
      })
      .catch(() => setExistingLecture(null)) // non-critical
      .finally(() => setIsLoadingLecture(false))
  }, [selectedLectureId])

  // Read a transcript file and populate the textarea
  const handleTranscriptFileChange = useCallback(async (file: File) => {
    setTranscriptFileName(file.name)
    const text = await file.text()
    const cleaned = file.name.endsWith('.vtt') ? stripVttTimestamps(text) : text
    setTranscriptText(cleaned)
  }, [])

  const handleDeleteFile = async (fileId: string) => {
    if (!selectedLectureId) return
    if (!window.confirm('Remove this file?')) return

    setDeletingId(fileId)
    try {
      await deleteLectureFile(selectedLectureId, fileId)
      const updated = await getLecture(selectedLectureId)
      setExistingLecture(updated)
    } catch (err) {
      setUploadStatus({
        type: 'error',
        message: `Failed to delete: ${err instanceof Error ? err.message : String(err)}`,
        details: [],
      })
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteTranscript = async (transcriptId: string) => {
    if (!selectedLectureId) return
    if (!window.confirm('Delete this transcript and all its AI summaries? This cannot be undone.')) return

    setDeletingId(transcriptId)
    try {
      await deleteTranscript(transcriptId)
      setPendingTranscriptId(null)
      const updated = await getLecture(selectedLectureId)
      setExistingLecture(updated)
    } catch (err) {
      setUploadStatus({
        type: 'error',
        message: `Failed to delete transcript: ${err instanceof Error ? err.message : String(err)}`,
        details: [],
      })
    } finally {
      setDeletingId(null)
    }
  }

  // Upload handler — each step is independent
  const handleUpload = async () => {
    if (!selectedLectureId) {
      setUploadStatus({ type: 'error', message: 'Please select a course and lecture first.' })
      return
    }
    if (!slidesFile && !zoomUrl.trim() && !transcriptText.trim() && !teacherNote.trim()) {
      setUploadStatus({ type: 'error', message: 'Please add at least one item to upload.' })
      return
    }

    setIsUploading(true)
    setUploadStatus(null)
    setPendingTranscriptId(null)

    const results: string[] = []
    let hasError = false
    let autoTriggerTranscriptId: string | null = null

    // 1. Upload slides PDF/PPTX
    if (slidesFile) {
      try {
        const fileUrl = await uploadFile(slidesFile)
        const mimeType = slidesFile.name.endsWith('.pptx')
          ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
          : 'application/pdf'
        await linkFileToLecture(selectedLectureId, 'SLIDES', fileUrl, slidesFile.name, mimeType)
        results.push(`✓ Slides uploaded: ${slidesFile.name}`)
      } catch (err) {
        results.push(`✗ Slides: ${err instanceof Error ? err.message : String(err)}`)
        hasError = true
      }
    }

    // Exercise sheet upload
    if (exerciseFile) {
      try {
        const fileUrl = await uploadFile(exerciseFile)
        await linkFileToLecture(selectedLectureId, 'REFERENCE', fileUrl, exerciseFile.name, 'application/pdf')
        results.push(`✓ Exercise sheet uploaded: ${exerciseFile.name}`)
      } catch (err) {
        results.push(`✗ Exercise sheet: ${err instanceof Error ? err.message : String(err)}`)
        hasError = true
      }
    }

    // 2. Register Zoom URL
    if (zoomUrl.trim()) {
      try {
        await linkFileToLecture(selectedLectureId, 'RECORDING', zoomUrl.trim(), 'Zoom Recording')
        results.push('✓ Zoom recording URL saved')
      } catch (err) {
        results.push(`✗ Recording URL: ${err instanceof Error ? err.message : String(err)}`)
        hasError = true
      }
    }

    // 3. Submit transcript
    if (transcriptText.trim()) {
      try {
        const source = transcriptFileName?.endsWith('.vtt') ? 'ZOOM' : 'MANUAL'
        const transcriptId = await submitTranscript(
          selectedLectureId,
          transcriptText.trim(),
          source
        )
        setPendingTranscriptId(transcriptId)
        autoTriggerTranscriptId = transcriptId
        const wordCount = transcriptText.trim().split(/\s+/).length
        results.push(`✓ Transcript submitted (${wordCount.toLocaleString()} words)`)
      } catch (err) {
        results.push(`✗ Transcript: ${err instanceof Error ? err.message : String(err)}`)
        hasError = true
      }
    }

    // 4. Submit Teacher Note
    if (teacherNote.trim()) {
      try {
        await updateTeacherNote(selectedLectureId, teacherNote.trim())
        results.push('✓ Professor\'s note saved')
      } catch (err) {
        results.push(`✗ Note: ${err instanceof Error ? err.message : String(err)}`)
        hasError = true
      }
    }

    setIsUploading(false)
    setUploadStatus({
      type: hasError
        ? results.some(r => r.startsWith('✓')) ? 'partial' : 'error'
        : 'success',
      message: hasError
        ? 'Some items failed. See details below.'
        : 'All materials uploaded successfully.',
      details: results,
    })

    if (selectedLectureId) {
      getLecture(selectedLectureId)
        .then(setExistingLecture)
        .catch(() => {})
    }

    // Auto-trigger AI generation if we have a new transcript
    // Call without await — generation runs in background
    // Pass transcriptId directly to avoid stale state closure
    if (autoTriggerTranscriptId && !abortPollingRef.current) {
      handleGenerateSummary(autoTriggerTranscriptId)
    }
  }

  // AI generation handler — sequential, with abort support
  const handleGenerateSummary = async (transcriptId: string) => {

    abortPollingRef.current = false
    const types: Array<'BRIEF' | 'FULL' | 'BULLET_POINTS'> = ['BRIEF', 'FULL', 'BULLET_POINTS']
    const typeLabels: Record<string, string> = {
      BRIEF: 'Brief',
      FULL: 'Full',
      BULLET_POINTS: 'Key Points',
    }

    for (const summaryType of types) {
      if (abortPollingRef.current) return

      setAiProgress(`Generating ${typeLabels[summaryType]} summary...`)

      let jobId: string
      try {
        jobId = await generateSummary(transcriptId, summaryType)
      } catch (err) {
        setAiProgress(`✗ Failed to queue ${typeLabels[summaryType]}: ${err instanceof Error ? err.message : String(err)}`)
        return
      }

      // Poll until DONE or FAILED — max 24 × 5s = 2 minutes per type
      let done = false
      for (let attempt = 0; attempt < 24; attempt++) {
        if (abortPollingRef.current) return
        await new Promise(resolve => setTimeout(resolve, 5000))
        if (abortPollingRef.current) return

        let status: string
        let errorMessage: string | null | undefined
        try {
          const result = await getJobStatus(jobId)
          status = result.status
          errorMessage = result.errorMessage
        } catch (err) {
          setAiProgress(`✗ Polling error: ${err instanceof Error ? err.message : String(err)}`)
          return
        }

        if (status === 'DONE') { done = true; break }
        if (status === 'FAILED') {
          setAiProgress(`✗ ${typeLabels[summaryType]} failed: ${errorMessage ?? 'Unknown error'}`)
          return
        }

        setAiProgress(`Generating ${typeLabels[summaryType]} summary... (${(attempt + 1) * 5}s elapsed)`)
      }

      if (!done) {
        setAiProgress(`✗ ${typeLabels[summaryType]} timed out after 2 minutes`)
        return
      }
    }

    setAiProgress('✓ All three summaries generated (Brief, Full, Key Points). Generating first practice quiz — this may take up to 90 seconds, do not close this tab...')

    try {
      if (selectedLectureId) {
        await generateQuizForLecture(selectedLectureId, 8)
        setAiProgress('✓ All three summaries and practice quiz generated successfully.')
      }
    } catch (err) {
      setAiProgress(`✗ Summaries generated, but quiz failed: ${err instanceof Error ? err.message : String(err)}`)
    }

    if (!abortPollingRef.current && selectedLectureId) {
      getLecture(selectedLectureId)
        .then(setExistingLecture)
        .catch(() => {})
    }
  }

  // Derived: is AI generation in progress?
  const isGenerating = aiProgress?.startsWith('Generating') === true

  // Part H: Warn teacher before leaving while AI generation is running
  useEffect(() => {
    if (!isGenerating) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = 'Quiz generation is in progress. Leaving now may result in an incomplete quiz.'
      return e.returnValue
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isGenerating])

  return (
    <ProtectedRoute>
      <div
        className="w-full bg-[#F2F2F2] flex flex-col overflow-hidden"
        style={{
          height: '100dvh',
          fontFamily: "'SF Pro', system-ui, -apple-system, sans-serif",
        }}
      >
        <TopNav />

        <main
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{ scrollbarWidth: 'none', padding: '32px 48px' }}
        >
          <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Header */}
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 600, color: 'rgba(0,0,0,0.85)', marginBottom: 6 }}>
                Upload Lecture Materials
              </h1>
              <p style={{ fontSize: 14, color: 'rgba(0,0,0,0.45)', margin: 0 }}>
                Select a lecture, upload its materials, then generate AI summaries.
                All fields are optional — upload what you have.
              </p>
            </div>

            {/* Step 1: Select context */}
            <div style={card}>
              <span style={sectionLabel}>Step 1 — Select Context</span>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={fieldLabel}>Course</label>
                  <select
                    value={selectedCourseId}
                    onChange={e => setSelectedCourseId(e.target.value)}
                    style={{ ...inputBase, cursor: 'pointer' }}
                  >
                    <option value="">Select a course...</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={fieldLabel}>Lecture</label>
                  <select
                    value={selectedLectureId}
                    onChange={e => setSelectedLectureId(e.target.value)}
                    disabled={!selectedCourseId || lectures.length === 0}
                    style={{
                      ...inputBase,
                      cursor: !selectedCourseId ? 'not-allowed' : 'pointer',
                      opacity: !selectedCourseId ? 0.5 : 1,
                    }}
                  >
                    <option value="">Select a lecture...</option>
                    {lectures.map(l => {
                      const prefix =
                        l.contentType === 'LAB'  ? '🔬 Lab:' :
                        l.contentType === 'QUIZ' ? '📋 Quiz:' :
                                                   '📖'
                      return (
                        <option key={l.id} value={l.id}>
                          {prefix} {l.title}
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>
            </div>

            {/* Already Uploaded History Panel */}
            {selectedLectureId && (
              <div style={card}>
                <span style={sectionLabel}>Already Uploaded</span>

                {isLoadingLecture ? (
                  <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.35)' }}>Loading...</div>
                ) : !existingLecture ? (
                  <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.35)' }}>Could not load existing content.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

                    {/* Files */}
                    {existingLecture.files.length === 0 ? (
                      <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.35)' }}>No files uploaded yet.</div>
                    ) : existingLecture.files.map(file => {
                      const icon =
                        file.type === 'SLIDES'    ? '📄' :
                        file.type === 'RECORDING' ? '🎬' :
                        file.type === 'REFERENCE' ? '📋' : '📎'
                      
                      const typeLabel =
                        file.type === 'SLIDES'    ? 'Slides' :
                        file.type === 'RECORDING' ? 'Zoom Recording' :
                        file.type === 'REFERENCE' ? 'Exercise Sheet' : 'File'
                      
                      return (
                        <div key={file.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 12px', borderRadius: 10,
                          background: 'rgba(0,160,0,0.06)', border: '1px solid rgba(0,140,0,0.12)',
                        }}>
                          <span style={{ fontSize: 15 }}>{icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(0,0,0,0.70)' }}>
                              {file.label ?? typeLabel}
                            </div>
                            <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {file.url}
                            </div>
                          </div>
                          <span style={{ fontSize: 11, color: 'rgba(0,140,0,0.70)', fontWeight: 600 }}>✓</span>
                          <button
                            onClick={() => handleDeleteFile(file.id)}
                            disabled={deletingId === file.id}
                            title="Remove this file"
                            style={{
                              flexShrink: 0,
                              padding: '2px 6px',
                              fontSize: 12,
                              color: deletingId === file.id ? 'rgba(0,0,0,0.20)' : 'rgba(180,0,0,0.50)',
                              background: 'none',
                              border: 'none',
                              cursor: deletingId === file.id ? 'not-allowed' : 'pointer',
                              borderRadius: 4,
                              lineHeight: 1,
                            }}
                          >
                            {deletingId === file.id ? '…' : '✕'}
                          </button>
                        </div>
                      )
                    })}

                    {/* Transcript */}
                    {existingLecture.transcripts.length === 0 ? (
                      <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.35)' }}>No transcript uploaded yet.</div>
                    ) : (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', borderRadius: 10,
                        background: 'rgba(0,160,0,0.06)', border: '1px solid rgba(0,140,0,0.12)',
                      }}>
                        <span style={{ fontSize: 15 }}>📝</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(0,0,0,0.70)' }}>Transcript</div>
                          <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)' }}>
                            {(() => {
                              const t = existingLecture.transcripts[0]
                              const text = t.processedContent ?? t.rawContent ?? ''
                              const words = text.trim().split(/\s+/).filter(Boolean).length
                              return `${words.toLocaleString()} words${t.processedContent ? ' (processed)' : ''}`
                            })()}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, color: 'rgba(0,140,0,0.70)', fontWeight: 600 }}>✓</span>
                        <button
                          onClick={() => handleDeleteTranscript(existingLecture.transcripts[0].id)}
                          disabled={deletingId === existingLecture.transcripts[0].id}
                          title="Delete transcript and all AI summaries"
                          style={{
                            flexShrink: 0,
                            padding: '2px 6px',
                            fontSize: 12,
                            color: deletingId === existingLecture.transcripts[0].id
                              ? 'rgba(0,0,0,0.20)'
                              : 'rgba(180,0,0,0.50)',
                            background: 'none',
                            border: 'none',
                            cursor: deletingId === existingLecture.transcripts[0].id ? 'not-allowed' : 'pointer',
                            borderRadius: 4,
                            lineHeight: 1,
                          }}
                        >
                          {deletingId === existingLecture.transcripts[0].id ? '…' : '✕'}
                        </button>
                      </div>
                    )}

                    {/* AI Summaries */}
                    {existingLecture.aiSummaries.length > 0 && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', borderRadius: 10,
                        background: 'rgba(0,160,0,0.06)', border: '1px solid rgba(0,140,0,0.12)',
                      }}>
                        <span style={{ fontSize: 15 }}>🤖</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(0,0,0,0.70)' }}>AI Summaries</div>
                          <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)' }}>
                            {existingLecture.aiSummaries.map(s => s.type).join(', ')}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, color: 'rgba(0,140,0,0.70)', fontWeight: 600 }}>✓</span>
                      </div>
                    )}

                  </div>
                )}
              </div>
            )}

            {/* Step 2: Materials — only shown after lecture selected */}
            {selectedLectureId && (
              <div style={card}>
                <span style={sectionLabel}>Step 2 — Upload Materials</span>

                {/* Slides */}
                <div style={{ marginBottom: 20 }}>
                  <label style={fieldLabel}>📄 Lecture Slides (PDF or PPTX)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                    <input
                      type="file"
                      accept=".pdf,.pptx"
                      id="slides-input"
                      style={{ display: 'none' }}
                      onChange={e => setSlidesFile(e.target.files?.[0] ?? null)}
                    />
                    <button
                      type="button"
                      onClick={() => document.getElementById('slides-input')?.click()}
                      style={{
                        display:      'inline-flex',
                        alignItems:   'center',
                        gap:          8,
                        padding:      '9px 16px',
                        borderRadius: 10,
                        border:       '1px solid rgba(0,0,0,0.12)',
                        background:   'rgba(0,0,0,0.04)',
                        fontSize:     13,
                        fontWeight:   500,
                        color:        'rgba(0,0,0,0.65)',
                        cursor:       'pointer',
                        transition:   'background 0.15s ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.08)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
                    >
                      📂 Choose File
                    </button>
                    {slidesFile && (
                      <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginLeft: 10 }}>
                        {slidesFile.name} — {(slidesFile.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                    )}
                  </div>
                </div>

                {/* Exercise Sheet */}
                <div style={{ marginBottom: 20 }}>
                  <label style={fieldLabel}>📋 Exercise Sheet (PDF)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                    <input
                      type="file"
                      accept=".pdf"
                      id="exercise-input"
                      style={{ display: 'none' }}
                      onChange={e => setExerciseFile(e.target.files?.[0] ?? null)}
                    />
                    <button
                      type="button"
                      onClick={() => document.getElementById('exercise-input')?.click()}
                      style={{
                        display:      'inline-flex',
                        alignItems:   'center',
                        gap:          8,
                        padding:      '9px 16px',
                        borderRadius: 10,
                        border:       '1px solid rgba(0,0,0,0.12)',
                        background:   'rgba(0,0,0,0.04)',
                        fontSize:     13,
                        fontWeight:   500,
                        color:        'rgba(0,0,0,0.65)',
                        cursor:       'pointer',
                        transition:   'background 0.15s ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.08)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
                    >
                      📂 Choose File
                    </button>
                    {exerciseFile && (
                      <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginLeft: 10 }}>
                        {exerciseFile.name} — {(exerciseFile.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                    )}
                  </div>
                </div>

                {/* Zoom URL */}
                <div style={{ marginBottom: 20 }}>
                  <label style={fieldLabel}>🎬 Zoom Recording URL</label>
                  <input
                    type="url"
                    value={zoomUrl}
                    onChange={e => setZoomUrl(e.target.value)}
                    placeholder="https://zoom.us/rec/share/..."
                    style={inputBase}
                  />
                </div>

                {/* Teacher Note */}
                <div style={{ marginBottom: 20 }}>
                  <label style={fieldLabel}>💡 Professor's Note (Optional message for students)</label>
                  <textarea
                    value={teacherNote}
                    onChange={e => setTeacherNote(e.target.value)}
                    placeholder="e.g., Pay special attention to the second half of this lecture..."
                    rows={3}
                    style={{
                      ...inputBase,
                      resize: 'vertical',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>

                {/* Transcript */}
                <div>
                  <label style={fieldLabel}>📝 Transcript (.vtt or .txt, or paste text)</label>
                  <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="file"
                      accept=".vtt,.txt"
                      id="transcript-input"
                      style={{ display: 'none' }}
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) handleTranscriptFileChange(file)
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => document.getElementById('transcript-input')?.click()}
                      style={{
                        display:      'inline-flex',
                        alignItems:   'center',
                        gap:          8,
                        padding:      '9px 16px',
                        borderRadius: 10,
                        border:       '1px solid rgba(0,0,0,0.12)',
                        background:   'rgba(0,0,0,0.04)',
                        fontSize:     13,
                        fontWeight:   500,
                        color:        'rgba(0,0,0,0.65)',
                        cursor:       'pointer',
                        transition:   'background 0.15s ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.08)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
                    >
                      📂 Choose File
                    </button>
                    {transcriptFileName && (
                      <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>
                        {transcriptFileName}
                        {transcriptFileName.endsWith('.vtt') && ' (Timestamps stripped)'}
                      </span>
                    )}
                  </div>
                  <textarea
                    value={transcriptText}
                    onChange={e => setTranscriptText(e.target.value)}
                    placeholder="Or paste transcript text here..."
                    rows={6}
                    style={{
                      ...inputBase,
                      resize: 'vertical',
                      fontFamily: 'monospace',
                      fontSize: 12,
                      lineHeight: 1.6,
                    }}
                  />
                  {transcriptText.trim() && (
                    <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)', marginTop: 4 }}>
                      {transcriptText.trim().split(/\s+/).length.toLocaleString()} words
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Actions — only shown after lecture selected */}
            {selectedLectureId && (
              <div style={card}>
                <span style={sectionLabel}>Step 3 — Submit</span>

                <button
                  onClick={handleUpload}
                  disabled={isUploading || isGenerating}
                  style={{
                    padding: '10px 22px', borderRadius: 12, border: 'none',
                    background: (isUploading || isGenerating) ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.85)',
                    color: (isUploading || isGenerating) ? 'rgba(0,0,0,0.35)' : '#FFFFFF',
                    fontSize: 14, fontWeight: 500,
                    cursor: (isUploading || isGenerating) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isUploading ? 'Uploading...' : isGenerating ? 'Generating summaries...' : 'Upload Materials'}
                </button>

                {isGenerating && (
                  <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.40)', marginTop: 8 }}>
                    AI summaries are generating automatically — takes up to 2 minutes.
                  </div>
                )}
              </div>
            )}

            {/* Upload status */}
            {uploadStatus && uploadStatus.type !== 'uploading' && (
              <div style={{
                padding: '14px 16px',
                borderRadius: 12,
                background:
                  uploadStatus.type === 'success' ? 'rgba(0,160,0,0.07)' :
                  uploadStatus.type === 'partial' ? 'rgba(200,130,0,0.07)' :
                                                    'rgba(200,0,0,0.07)',
                border: `1px solid ${
                  uploadStatus.type === 'success' ? 'rgba(0,140,0,0.15)' :
                  uploadStatus.type === 'partial' ? 'rgba(180,110,0,0.15)' :
                                                    'rgba(180,0,0,0.15)'
                }`,
              }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'rgba(0,0,0,0.75)',
                  marginBottom: uploadStatus.details?.length ? 8 : 0,
                }}>
                  {uploadStatus.message}
                </div>
                {uploadStatus.details?.map((detail, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'rgba(0,0,0,0.55)', lineHeight: 1.9 }}>
                    {detail}
                  </div>
                ))}
              </div>
            )}

            {/* AI generation status */}
            {aiProgress && (
              <div style={{
                padding: '14px 16px',
                borderRadius: 12,
                background: 'rgba(0,0,0,0.04)',
                border: '1px solid rgba(0,0,0,0.08)',
                fontSize: 13,
                color: aiProgress.startsWith('✗') ? 'rgba(180,0,0,0.70)' : 'rgba(0,0,0,0.65)',
              }}>
                {aiProgress}
              </div>
            )}

          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}
