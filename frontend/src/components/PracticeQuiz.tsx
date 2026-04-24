'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getNextQuiz,
  submitQuizAnswers,
  getQuizHistory,
  type ClientQuiz,
  type QuizSubmitResponse,
  type QuizAttemptSummary,
} from '@/lib/api'

// ── State machine ─────────────────────────────────────────────────────────────

type QuizPhase =
  | { phase: 'loading' }
  | { phase: 'no-transcript' }
  | { phase: 'taking';     quiz: ClientQuiz; answers: Record<string, string> }
  | { phase: 'submitting'; quiz: ClientQuiz; answers: Record<string, string> }
  | { phase: 'results';    quiz: ClientQuiz; response: QuizSubmitResponse }
  | { phase: 'error';      message: string; prev?: QuizPhase }

// ── Static styles ─────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background:   '#E9E5E6',
  borderRadius: 20,
  padding:      '20px 24px',
  boxShadow:    'var(--shadow-card)',
}

const sectionLabel: React.CSSProperties = {
  fontSize:      10,
  fontWeight:    600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color:         'rgba(0,0,0,0.40)',
  display:       'block',
  marginBottom:  14,
}

// ── Component ─────────────────────────────────────────────────────────────────

interface PracticeQuizProps {
  lectureId: string
}

export function PracticeQuiz({ lectureId }: PracticeQuizProps) {
  const [state, setState]           = useState<QuizPhase>({ phase: 'loading' })
  const [history, setHistory]       = useState<QuizAttemptSummary[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const loadHistory = useCallback(async () => {
    try {
      const { attempts } = await getQuizHistory(lectureId)
      setHistory(attempts)
    } catch {
      // non-critical — history display fails silently
    }
  }, [lectureId])

  const loadQuiz = useCallback(async () => {
    setState({ phase: 'loading' })
    try {
      const { quiz } = await getNextQuiz(lectureId)
      setState({ phase: 'taking', quiz, answers: {} })
    } catch (err: any) {
      const msg: string = err?.message ?? ''
      if (msg.toLowerCase().includes('transcript') || err?.status === 400) {
        setState({ phase: 'no-transcript' })
      } else {
        setState({ phase: 'error', message: msg || 'Failed to load quiz.' })
      }
    }
  }, [lectureId])

  useEffect(() => {
    loadQuiz()
    loadHistory()
  }, [lectureId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAnswer = (questionId: string, answer: string) => {
    setState(prev => {
      if (prev.phase !== 'taking') return prev
      return { ...prev, answers: { ...prev.answers, [questionId]: answer } }
    })
  }

  const handleSubmit = async () => {
    if (state.phase !== 'taking') return
    const { quiz, answers } = state

    const unanswered = quiz.questions.filter(q => !answers[q.id])
    if (unanswered.length > 0) {
      const prev = state
      setState({ phase: 'error', message: `${unanswered.length} question(s) not yet answered.`, prev })
      setTimeout(() => setState(prev), 2000)
      return
    }

    setState({ phase: 'submitting', quiz, answers })
    try {
      const response = await submitQuizAnswers(quiz.id, answers)
      setState({ phase: 'results', quiz, response })
      loadHistory()
    } catch (err: any) {
      const prev: QuizPhase = { phase: 'taking', quiz, answers }
      setState({ phase: 'error', message: err?.message ?? 'Submit failed.', prev })
      setTimeout(() => setState(prev), 2500)
    }
  }

  // ── Render: Loading ────────────────────────────────────────────────────────

  if (state.phase === 'loading') {
    return (
      <div style={card}>
        <span style={sectionLabel}>Practice Quiz</span>
        <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.40)', margin: 0 }}>Loading quiz...</p>
      </div>
    )
  }

  if (state.phase === 'no-transcript') {
    return (
      <div style={card}>
        <span style={sectionLabel}>Practice Quiz</span>
        <p style={{ fontSize: 13, color: 'rgba(0,0,0,0.40)', margin: 0 }}>
          No quiz available yet. A quiz will be generated once a transcript is uploaded for this lecture.
        </p>
      </div>
    )
  }

  if (state.phase === 'error') {
    return (
      <div style={card}>
        <span style={sectionLabel}>Practice Quiz</span>
        <p style={{ fontSize: 13, color: 'rgba(180,0,0,0.70)', margin: 0 }}>{state.message}</p>
      </div>
    )
  }

  // ── Render: Results ────────────────────────────────────────────────────────

  if (state.phase === 'results') {
    const { response } = state
    const pct = Math.round(response.score)
    const scoreColor =
      pct >= 80 ? 'rgba(0,140,0,0.80)' :
      pct >= 60 ? 'rgba(180,120,0,0.80)' :
                  'rgba(180,0,0,0.80)'

    return (
      <div style={card}>
        <span style={sectionLabel}>Practice Quiz — Results</span>

        {/* Score */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 42, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>
            {pct}%
          </div>
          <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.45)', marginTop: 6 }}>
            {response.correctCount} of {response.totalQuestions} correct
          </div>
        </div>

        {/* Per-question breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {response.results.map((r, i) => (
            <div
              key={r.questionId}
              style={{
                padding:    '12px 14px',
                borderRadius: 12,
                background: r.isCorrect ? 'rgba(0,150,0,0.07)' : 'rgba(200,0,0,0.07)',
                border:     `1px solid ${r.isCorrect ? 'rgba(0,130,0,0.15)' : 'rgba(180,0,0,0.15)'}`,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(0,0,0,0.75)', marginBottom: 6 }}>
                {i + 1}. {r.questionText}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.55)', marginBottom: 3 }}>
                Your answer:{' '}
                <span style={{ fontWeight: 500, color: r.isCorrect ? 'rgba(0,130,0,0.80)' : 'rgba(180,0,0,0.80)' }}>
                  {r.studentAnswer || '(not answered)'}
                </span>
              </div>
              {!r.isCorrect && (
                <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.55)', marginBottom: 3 }}>
                  Correct answer:{' '}
                  <span style={{ fontWeight: 500, color: 'rgba(0,130,0,0.80)' }}>
                    {r.correctAnswer}
                  </span>
                </div>
              )}
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.50)', lineHeight: 1.5, fontStyle: 'italic', marginTop: 4 }}>
                {r.explanation}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={loadQuiz}
          style={{
            width:        '100%',
            padding:      '10px',
            borderRadius: 12,
            border:       'none',
            background:   'rgba(0,0,0,0.85)',
            color:        '#fff',
            fontSize:     14,
            fontWeight:   500,
            cursor:       'pointer',
          }}
        >
          Try Another Quiz
        </button>
      </div>
    )
  }

  // ── Render: Taking / Submitting ───────────────────────────────────────────

  const { quiz, answers } = state
  const isSubmitting    = state.phase === 'submitting'
  const answeredCount   = Object.keys(answers).length
  const allAnswered     = answeredCount === quiz.questions.length
  const progressPercent = quiz.questions.length > 0
    ? (answeredCount / quiz.questions.length) * 100
    : 0

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={sectionLabel}>Practice Quiz</span>
        <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.35)' }}>
          {answeredCount}/{quiz.questions.length} answered
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: 'rgba(0,0,0,0.08)', borderRadius: 2, marginBottom: 18 }}>
        <div style={{
          height:     '100%',
          width:      `${progressPercent}%`,
          background: 'rgba(0,0,0,0.50)',
          borderRadius: 2,
          transition: 'width 0.2s ease',
        }} />
      </div>

      {/* Questions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 20 }}>
        {quiz.questions.map((q, i) => (
          <div key={q.id}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(0,0,0,0.80)', marginBottom: 10, lineHeight: 1.45 }}>
              {i + 1}. {q.questionText}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {q.options.map(option => {
                const isSelected = answers[q.id] === option
                return (
                  <button
                    key={option}
                    onClick={() => !isSubmitting && handleAnswer(q.id, option)}
                    disabled={isSubmitting}
                    style={{
                      padding:      '10px 14px',
                      borderRadius: 10,
                      border:       isSelected
                        ? '1.5px solid rgba(0,0,0,0.40)'
                        : '1px solid rgba(0,0,0,0.10)',
                      background:   isSelected ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.03)',
                      fontSize:     13,
                      fontWeight:   isSelected ? 500 : 400,
                      color:        'rgba(0,0,0,0.75)',
                      cursor:       isSubmitting ? 'not-allowed' : 'pointer',
                      textAlign:    'left' as const,
                      transition:   'all 0.15s ease',
                    }}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!allAnswered || isSubmitting}
        style={{
          width:        '100%',
          padding:      '11px',
          borderRadius: 12,
          border:       'none',
          background:   allAnswered && !isSubmitting
            ? 'rgba(0,0,0,0.85)'
            : 'rgba(0,0,0,0.15)',
          color:        allAnswered && !isSubmitting ? '#fff' : 'rgba(0,0,0,0.35)',
          fontSize:     14,
          fontWeight:   500,
          cursor:       allAnswered && !isSubmitting ? 'pointer' : 'not-allowed',
          transition:   'all 0.15s ease',
        }}
      >
        {isSubmitting
          ? 'Submitting...'
          : allAnswered
          ? 'Submit Quiz'
          : `Answer all questions (${answeredCount}/${quiz.questions.length})`}
      </button>

      {/* History */}
      {history.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button
            onClick={() => setShowHistory(h => !h)}
            style={{
              fontSize:   12,
              color:      'rgba(0,0,0,0.40)',
              background: 'none',
              border:     'none',
              cursor:     'pointer',
              padding:    0,
            }}
          >
            {showHistory ? 'Hide history ↑' : `Previous attempts (${history.length}) ↓`}
          </button>

          {showHistory && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {history.map(a => (
                <div
                  key={a.attemptId}
                  style={{
                    display:        'flex',
                    justifyContent: 'space-between',
                    fontSize:       12,
                    color:          'rgba(0,0,0,0.50)',
                    padding:        '4px 8px',
                    borderRadius:   8,
                    background:     'rgba(0,0,0,0.03)',
                  }}
                >
                  <span>
                    {new Date(a.takenAt).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric'
                    })}
                  </span>
                  <span style={{
                    fontWeight: 500,
                    color: a.score >= 80 ? 'rgba(0,130,0,0.70)' : 'rgba(0,0,0,0.55)'
                  }}>
                    {Math.round(a.score)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
