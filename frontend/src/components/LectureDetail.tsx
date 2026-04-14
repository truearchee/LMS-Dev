'use client'

import { useEffect, useState, useCallback } from 'react'
import { getLecture } from '@/lib/api'
import type { LectureDetail as LectureDetailType, LectureFile, TranscriptSummary, AISummary } from '@/types/course'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month:   'short',
    day:     'numeric',
  })
}

function fileIcon(mimeType: string | null, type: string): string {
  if (mimeType?.startsWith('video/') || type === 'RECORDING') return '🎥'
  if (mimeType === 'application/pdf')                          return '📄'
  if (type === 'SLIDES')                                       return '📑'
  return '🔗'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'rgba(0,0,0,0.35)',
      userSelect: 'none',
    }}>
      {children}
    </span>
  )
}

function FileRow({ file }: { file: LectureFile }) {
  const isExternal = file.url.startsWith('http')
  return (
    <a
      href={file.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            10,
        padding:        '8px 12px',
        borderRadius:   10,
        background:     'rgba(0,0,0,0.04)',
        textDecoration: 'none',
        transition:     'background 0.15s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.07)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
    >
      <span style={{ fontSize: 16 }}>{fileIcon(file.mimeType, file.type)}</span>
      <span style={{ flex: 1, fontSize: 13, color: 'rgba(0,0,0,0.75)', lineHeight: 1.3 }}>
        {file.label ?? file.url.split('/').pop()}
      </span>
      <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.30)' }}>
        {isExternal ? '↗' : '↓'}
      </span>
    </a>
  )
}

function Collapsible({ label, children, defaultOpen = false }: {
  label: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            6,
          background:     'none',
          border:         'none',
          padding:        0,
          cursor:         'pointer',
          marginBottom:   open ? 8 : 0,
          width:          '100%',
          textAlign:      'left',
        }}
      >
        <SectionLabel>{label}</SectionLabel>
        <span style={{ fontSize: 10, color: 'rgba(0,0,0,0.30)', marginLeft: 'auto' }}>
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && children}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface LectureDetailProps {
  lectureId: string
  onClose: () => void
}

export function LectureDetail({ lectureId, onClose }: LectureDetailProps) {
  const [lecture, setLecture]   = useState<LectureDetailType | null>(null)
  const [isLoading, setLoading] = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const fetchLecture = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getLecture(lectureId)
      setLecture(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load lecture.')
    } finally {
      setLoading(false)
    }
  }, [lectureId])

  useEffect(() => { fetchLecture() }, [fetchLecture])

  // ── Shared container ──────────────────────────────────────────────────────
  const Container = ({ children }: { children: React.ReactNode }) => (
    <div style={{
      width:      '100%',
      height:     '100%',
      display:    'flex',
      flexDirection: 'column',
      overflowY:  'auto',
      scrollbarWidth: 'none',
      fontFamily: "'SF Pro', system-ui, -apple-system, sans-serif",
    }}>
      {children}
    </div>
  )

  if (isLoading) {
    return (
      <Container>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 13, color: 'rgba(0,0,0,0.30)' }}>Loading lecture…</span>
        </div>
      </Container>
    )
  }

  if (error || !lecture) {
    return (
      <Container>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'rgba(0,0,0,0.40)' }}>{error ?? 'Lecture not found.'}</span>
          <button onClick={onClose} style={backBtnStyle}>← Back</button>
        </div>
      </Container>
    )
  }

  const bestSummary: AISummary | undefined =
    lecture.aiSummaries.find(s => s.type === 'BULLET_POINTS') ??
    lecture.aiSummaries.find(s => s.type === 'FULL')           ??
    lecture.aiSummaries[0]

  const transcript: TranscriptSummary | undefined = lecture.transcripts[0]

  return (
    <Container>
      <div style={{ padding: '20px 20px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Back button + Header ─────────────────────────────────────── */}
        <div>
          <button onClick={onClose} style={backBtnStyle}>← Back</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {lecture.moduleNumber != null && (
            <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Week {lecture.moduleNumber}
              {lecture.scheduledAt ? ` · ${formatDate(lecture.scheduledAt)}` : ''}
            </span>
          )}
          <h2 style={{ fontSize: 22, fontWeight: 600, color: 'rgba(0,0,0,0.88)', lineHeight: 1.25, margin: 0 }}>
            {lecture.title}
          </h2>
          {lecture.description && (
            <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.45)', lineHeight: 1.5, margin: 0 }}>
              {lecture.description}
            </p>
          )}
        </div>

        <Divider />

        {/* ── Professor's Note ─────────────────────────────────────────── */}
        {lecture.teacherNote && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SectionLabel>Professor's Note</SectionLabel>
              <div style={{
                padding:      '12px 14px',
                borderRadius: 10,
                background:   'rgba(0,0,0,0.04)',
                fontSize:     13,
                color:        'rgba(0,0,0,0.72)',
                lineHeight:   1.55,
              }}>
                {lecture.teacherNote}
              </div>
            </div>
            <Divider />
          </>
        )}

        {/* ── Materials ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SectionLabel>Materials</SectionLabel>
          {lecture.files.length === 0 ? (
            <EmptyState>No materials uploaded yet.</EmptyState>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {lecture.files.map(f => <FileRow key={f.id} file={f} />)}
            </div>
          )}
        </div>

        <Divider />

        {/* ── Transcript ───────────────────────────────────────────────── */}
        {transcript ? (
          <Collapsible label="Transcript">
            <div style={{
              maxHeight:    220,
              overflowY:    'auto',
              fontSize:     12,
              color:        'rgba(0,0,0,0.55)',
              lineHeight:   1.65,
              whiteSpace:   'pre-wrap',
              padding:      '10px 12px',
              borderRadius: 10,
              background:   'rgba(0,0,0,0.03)',
              scrollbarWidth: 'thin',
            }}>
              {transcript.rawContent}
            </div>
          </Collapsible>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SectionLabel>Transcript</SectionLabel>
            <EmptyState>No transcript yet.</EmptyState>
          </div>
        )}

        <Divider />

        {/* ── AI Summary ───────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SectionLabel>AI Summary</SectionLabel>
          {bestSummary ? (
            <div style={{
              padding:      '12px 14px',
              borderRadius: 10,
              background:   'rgba(0,0,0,0.04)',
              fontSize:     13,
              color:        'rgba(0,0,0,0.72)',
              lineHeight:   1.6,
              whiteSpace:   'pre-wrap',
            }}>
              {bestSummary.content}
            </div>
          ) : (
            <EmptyState>No summary yet.{transcript ? ' Trigger AI processing to generate one.' : ''}</EmptyState>
          )}
        </div>

      </div>
    </Container>
  )
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function Divider() {
  return <div style={{ height: 1, background: 'rgba(0,0,0,0.07)', flexShrink: 0 }} />
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.30)', fontStyle: 'italic' }}>
      {children}
    </span>
  )
}

const backBtnStyle: React.CSSProperties = {
  fontSize:     12,
  color:        'rgba(0,0,0,0.40)',
  background:   'none',
  border:       'none',
  padding:      0,
  cursor:       'pointer',
  letterSpacing: '0.02em',
}
