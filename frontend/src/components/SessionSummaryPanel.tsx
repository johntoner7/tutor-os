import { motion } from 'framer-motion'
import type { SessionSummary } from '../types'

interface Props {
  summary: SessionSummary | null
  loading: boolean
  error: string | null
  onClose: () => void
}

export function SessionSummaryPanel({ summary, loading, error, onClose }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ ease: [0.32, 0.72, 0, 1], duration: 0.28 }}
      className="flex flex-col h-full bg-gray-50 px-4 py-5 gap-4"
    >
      <div className="flex items-center justify-between shrink-0">
        <p className="text-sm font-semibold text-gray-900">Session summary</p>
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700 transition-colors">✕</button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3">
          <div className="flex gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-400 animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 rounded-full bg-red-400 animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-red-400 animate-bounce [animation-delay:300ms]" />
          </div>
          <p className="text-xs text-gray-500">Generating your summary…</p>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {summary && !loading && (
        <>
          {/* Stats row */}
          {summary.questions_attempted > 0 && (
            <div className="flex gap-3">
              <div className="flex-1 rounded-xl border border-gray-100 bg-white px-3 py-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{summary.questions_attempted}</p>
                <p className="text-xs text-gray-500 mt-0.5">questions</p>
              </div>
              {summary.average_score_percent !== null && (
                <div className="flex-1 rounded-xl border border-gray-100 bg-white px-3 py-3 text-center">
                  <p className={`text-2xl font-bold ${
                    summary.average_score_percent >= 80 ? 'text-green-600'
                    : summary.average_score_percent >= 50 ? 'text-amber-500'
                    : 'text-red-600'
                  }`}>{summary.average_score_percent}%</p>
                  <p className="text-xs text-gray-500 mt-0.5">avg score</p>
                </div>
              )}
            </div>
          )}

          {/* AI summary */}
          <div className="rounded-2xl border border-gray-100 bg-white px-4 py-4 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Tutor feedback</p>
            <p className="text-sm text-gray-700 leading-relaxed">{summary.summary}</p>
          </div>

          {/* Topics covered */}
          {summary.topics_covered.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Topics covered</p>
              <div className="flex flex-wrap gap-1.5">
                {summary.topics_covered.map(t => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-600">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <button
        onClick={onClose}
        className="shrink-0 w-full rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-medium py-2.5 hover:border-gray-300 active:scale-95 transition-all"
      >
        Back to chat
      </button>
    </motion.div>
  )
}
