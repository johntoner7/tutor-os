import { motion } from 'framer-motion'
import type { MarkResponse } from '../types'

interface Props {
  feedback: MarkResponse
}

export function MarkFeedback({ feedback }: Props) {
  const { marks_awarded, marks_available, awarded_points, missed_points, model_answer_hint } = feedback
  const ratio = marks_available > 0 ? marks_awarded / marks_available : 0

  const scoreBg =
    ratio === 1
      ? 'bg-green-50 border-green-200'
      : ratio > 0
      ? 'bg-amber-50 border-amber-200'
      : 'bg-red-50 border-red-200'

  const scoreText =
    ratio === 1 ? 'text-green-700' : ratio > 0 ? 'text-amber-700' : 'text-red-700'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 space-y-3 ${scoreBg}`}
    >
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold ${scoreText}`}>
          {marks_awarded}/{marks_available}
        </span>
        <span className={`text-sm font-medium ${scoreText}`}>marks</span>
      </div>

      {awarded_points.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700 mb-1">What you got right</p>
          <ul className="space-y-1">
            {awarded_points.map((point, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-800">
                <span className="text-green-600 font-bold shrink-0">✓</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {missed_points.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700 mb-1">What you missed</p>
          <ul className="space-y-1">
            {missed_points.map((point, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-800">
                <span className="text-red-500 font-bold shrink-0">✗</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {model_answer_hint && (
        <p className="text-sm text-gray-600 italic border-t border-gray-200 pt-3">
          {model_answer_hint}
        </p>
      )}
    </motion.div>
  )
}
