import { useEffect, useMemo, useRef, useState } from 'react'
import { StructuredAnswerForm } from './StructuredAnswerForm'
import { parseQuestion, combineAnswers } from '../utils/parseQuestion'
import { motion, AnimatePresence } from 'framer-motion'
import type { MarkResponse, QuestionResponse } from '../types'

interface Props {
  question: QuestionResponse
  feedback: MarkResponse | null
  marking: boolean
  error: string | null
  quiz?: { current: number; total: number }
  onSubmit: (answer: string) => void
  onNewQuestion: () => void
  onClose?: () => void
  onAskTutor?: (message: string) => void
}

type Phase = 'answering' | 'result'

export function QuestionPanel({ question, feedback, marking, error, quiz, onSubmit, onNewQuestion, onClose, onAskTutor }: Props) {
  const parsed = useMemo(() => parseQuestion(question.question), [question.question])
  const hasStructure = parsed.parts.length > 1
  const [phase, setPhase] = useState<Phase>('answering')
  const [mode, setMode] = useState<'structured' | 'freetext'>(hasStructure ? 'structured' : 'freetext')
  const [freeAnswer, setFreeAnswer] = useState('')
  const [showAllMissed, setShowAllMissed] = useState(false)

  const resultRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (feedback) setPhase('result')
  }, [feedback])

  useEffect(() => {
    if (phase === 'result') {
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }
  }, [phase])

  function handleStructuredSubmit(answers: Record<string, string>) {
    const combined = combineAnswers(parsed.parts, answers)
    if (combined.trim()) onSubmit(combined)
  }

  function handleFreeSubmit() {
    const trimmed = freeAnswer.trim()
    if (!trimmed || marking) return
    onSubmit(trimmed)
  }

  const topBar = (
    <div className="flex flex-col gap-2 shrink-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {quiz ? (
            <span className="text-xs font-semibold uppercase tracking-widest text-red-600">
              Quiz · {quiz.current}/{quiz.total}
            </span>
          ) : (
            <span className="text-xs font-semibold uppercase tracking-widest text-red-600">Practice Question</span>
          )}
          <span className="text-xs text-gray-400">{question.marks} {question.marks === 1 ? 'mark' : 'marks'}</span>
        </div>
        <div className="flex items-center gap-3">
          {!quiz && <button onClick={onNewQuestion} className="text-xs text-gray-400 hover:text-red-600 transition-colors">New</button>}
          {onClose && (
            <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              {quiz ? 'Quit' : '✕'}
            </button>
          )}
        </div>
      </div>
      {quiz && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 rounded-full transition-all duration-500"
              style={{ width: `${((quiz.current - 1) / quiz.total) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="bg-gray-50 h-full flex flex-col">
      <AnimatePresence mode="wait" initial={false}>

        {/* ── Answering ── */}
        {phase === 'answering' && (
          <motion.div
            key="answering"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ ease: [0.32, 0.72, 0, 1], duration: 0.22 }}
            className="flex flex-col h-full px-4 py-4 gap-3"
          >
            {topBar}

            <div className="shrink-0 px-1 pt-1">
              <p className="text-base font-medium text-gray-900 leading-snug">
                {parsed.preamble || question.question}
              </p>
            </div>

            <div className="flex flex-col flex-1 gap-2">
              {mode === 'structured' && hasStructure ? (
                <StructuredAnswerForm
                  parts={parsed.parts}
                  disabled={marking}
                  onSubmit={handleStructuredSubmit}
                  onSwitchToFreeText={() => setMode('freetext')}
                />
              ) : (
                <>
                  <textarea
                    value={freeAnswer}
                    onChange={e => setFreeAnswer(e.target.value)}
                    placeholder="Write your answer here…"
                    disabled={marking}
                    autoFocus
                    className="flex-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100 resize-none disabled:opacity-50"
                  />
                  <div className="flex items-center gap-3 pb-2">
                    <button
                      onClick={handleFreeSubmit}
                      disabled={!freeAnswer.trim() || marking}
                      className="flex-1 rounded-xl bg-red-600 text-white text-sm font-semibold py-2.5 hover:bg-red-700 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {marking ? 'Marking…' : 'Submit Answer'}
                    </button>
                    {hasStructure && (
                      <button
                        onClick={() => setMode('structured')}
                        className="text-xs text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap"
                      >
                        Structured
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 shrink-0">
                {error}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Result ── */}
        {phase === 'result' && feedback && (
          <motion.div
            key="result"
            ref={resultRef}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ ease: [0.32, 0.72, 0, 1], duration: 0.22 }}
            className="flex flex-col h-full px-4 py-4 gap-3"
          >
            {(() => {
              const ratio = feedback.marks_available > 0 ? feedback.marks_awarded / feedback.marks_available : 0
              const full = ratio === 1
              const partial = ratio > 0
              const scoreBg = full ? 'bg-green-50 border-green-200' : partial ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
              const scoreText = full ? 'text-green-700' : partial ? 'text-amber-700' : 'text-red-700'
              const label = full ? 'Full marks!' : partial ? 'Partial marks' : 'No marks awarded'

              return (
                <div className={`rounded-xl border p-4 space-y-3 ${scoreBg}`}>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-bold ${scoreText}`}>{feedback.marks_awarded}/{feedback.marks_available}</span>
                    <span className={`text-sm font-medium ${scoreText}`}>{label}</span>
                  </div>

                  {feedback.awarded_points.length > 0 && (
                    <ul className="space-y-1">
                      {feedback.awarded_points.map((point, i) => (
                        <li key={i} className="flex gap-2 text-sm text-gray-800">
                          <span className="text-green-600 font-bold shrink-0">✓</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  )}

                  {feedback.missed_points.length > 0 && (
                    <ul className="space-y-1">
                      {feedback.missed_points.map((point, i) => (
                        <li key={i} className="flex gap-2 text-sm text-gray-800">
                          <span className="text-red-500 font-bold shrink-0">✗</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  )}

                  {feedback.model_answer_hint && (
                    <p className="text-sm text-gray-600 italic border-t border-current/10 pt-3">
                      {feedback.model_answer_hint}
                    </p>
                  )}
                </div>
              )
            })()}

            {!quiz && onAskTutor && feedback.missed_points.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Ask tutor about what you missed</p>
                {(showAllMissed ? feedback.missed_points : feedback.missed_points.slice(0, 2)).map((point, i) => (
                  <button
                    key={i}
                    onClick={() => onAskTutor(`I answered a question on "${question.topic}" and missed this mark: "${point}". Can you explain it?`)}
                    className="w-full text-left rounded-xl border border-gray-200 bg-white text-gray-600 text-sm px-3 py-2 hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Explain: <span className="font-medium">{point}</span> →
                  </button>
                ))}
                {feedback.missed_points.length > 2 && !showAllMissed && (
                  <button
                    onClick={() => setShowAllMissed(true)}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-1"
                  >
                    + {feedback.missed_points.length - 2} more
                  </button>
                )}
              </div>
            )}

            <div className="mt-auto flex gap-2 pb-2 shrink-0">
              {!quiz && (
                <button
                  onClick={() => { setPhase('answering'); setFreeAnswer(''); setShowAllMissed(false) }}
                  className="rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-medium py-2.5 px-4 hover:border-gray-300 active:scale-95 transition-all"
                  title="Try this question again"
                >
                  ↩ Retry
                </button>
              )}
              <button
                onClick={onNewQuestion}
                className="flex-1 rounded-xl bg-red-600 text-white text-sm font-semibold py-2.5 hover:bg-red-700 active:scale-95 transition-all"
              >
                {quiz
                  ? quiz.current < quiz.total ? `Next →` : 'See results'
                  : 'Next question'}
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
