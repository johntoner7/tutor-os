import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { fetchQuizSummary } from '../api/client'
import type { QuizSummaryResponse } from '../types'

interface QuizResult {
  question: string
  marks_awarded: number
  marks_available: number
}

interface Props {
  results: QuizResult[]
  topicName: string
  topicSlug: string
  sessionId: string | null
  onRetry: () => void
  onClose: () => void
}

export function QuizSummary({ results, topicName, topicSlug, sessionId, onRetry, onClose }: Props) {
  const totalAwarded = results.reduce((s, r) => s + r.marks_awarded, 0)
  const totalAvailable = results.reduce((s, r) => s + r.marks_available, 0)
  const pct = totalAvailable > 0 ? Math.round((totalAwarded / totalAvailable) * 100) : 0

  const scoreColor = pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-500' : 'text-red-600'
  const scoreBg = pct >= 80 ? 'bg-green-50 border-green-200' : pct >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
  const headline = pct === 100 ? 'Perfect score!' : pct >= 80 ? 'Great work!' : pct >= 50 ? 'Keep practising' : 'Keep going!'

  const [aiAnalysis, setAiAnalysis] = useState<QuizSummaryResponse | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(true)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  useEffect(() => {
    setAnalysisLoading(true)
    setAnalysisError(null)
    fetchQuizSummary({ session_id: sessionId, topic_slug: topicSlug, topic_name: topicName, results })
      .then(setAiAnalysis)
      .catch(() => setAnalysisError('Could not load AI analysis.'))
      .finally(() => setAnalysisLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ease: [0.32, 0.72, 0, 1], duration: 0.25 }}
      className="flex flex-col h-full bg-gray-50 px-4 py-5 gap-4 overflow-y-auto"
    >
      {/* Score card */}
      <div className={`rounded-2xl border p-5 ${scoreBg}`}>
        <div className="flex items-baseline gap-3 mb-1">
          <span className={`text-4xl font-bold ${scoreColor}`}>{totalAwarded}/{totalAvailable}</span>
          <span className={`text-sm font-medium ${scoreColor}`}>{pct}%</span>
        </div>
        <p className={`text-base font-semibold ${scoreColor}`}>{headline}</p>
        {topicName && <p className="text-xs text-gray-500 mt-0.5">{topicName}</p>}
      </div>

      {/* AI weak-spot analysis */}
      <div className="rounded-2xl border border-gray-100 bg-white px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Tutor feedback</p>
        {analysisLoading ? (
          <div className="flex gap-1 items-center py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-bounce [animation-delay:300ms]" />
          </div>
        ) : analysisError ? (
          <p className="text-xs text-red-500">{analysisError}</p>
        ) : (
          <p className="text-sm text-gray-700 leading-relaxed">{aiAnalysis?.summary}</p>
        )}
      </div>

      {/* Per-question breakdown */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Questions</p>
        {results.map((r, i) => {
          const full = r.marks_awarded === r.marks_available
          return (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${full ? 'bg-green-50 border-green-100' : 'bg-white border-gray-100'}`}
            >
              <span className={`text-sm font-bold shrink-0 mt-0.5 ${full ? 'text-green-600' : 'text-red-500'}`}>
                {full ? '✓' : '✗'}
              </span>
              <p className="text-sm text-gray-700 leading-snug flex-1">{r.question}</p>
              <span className={`text-xs font-semibold shrink-0 mt-0.5 ${full ? 'text-green-600' : 'text-red-500'}`}>
                {r.marks_awarded}/{r.marks_available}
              </span>
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pb-2 shrink-0">
        <button
          onClick={onRetry}
          className="flex-1 rounded-xl bg-red-600 text-white text-sm font-semibold py-2.5 hover:bg-red-700 active:scale-95 transition-all"
        >
          Try again
        </button>
        <button
          onClick={onClose}
          className="flex-1 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-medium py-2.5 hover:border-gray-300 active:scale-95 transition-all"
        >
          Back to chat
        </button>
      </div>
    </motion.div>
  )
}
