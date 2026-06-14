import { useState } from 'react'
import { motion } from 'framer-motion'
import type { QuestionPart } from '../utils/parseQuestion'

interface Props {
  parts: QuestionPart[]
  disabled: boolean
  onSubmit: (answers: Record<string, string>) => void
  onSwitchToFreeText: () => void
}

export function StructuredAnswerForm({ parts, disabled, onSubmit, onSwitchToFreeText }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>(
    Object.fromEntries(parts.map(p => [p.label, '']))
  )

  const allAnswered = parts.every(p => (answers[p.label] ?? '').trim().length > 0)

  function handleChange(label: string, value: string) {
    setAnswers(prev => ({ ...prev, [label]: value }))
  }

  function handleSubmit() {
    if (!allAnswered || disabled) return
    onSubmit(answers)
  }

  return (
    <div className="space-y-3">
      {parts.map((part, i) => (
        <motion.div
          key={part.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.2 }}
          className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
        >
          {/* Part header */}
          <div className="flex items-baseline gap-2 px-4 pt-3 pb-2 border-b border-gray-50">
            <span className="text-xs font-bold text-red-600 uppercase tracking-widest shrink-0">
              {part.displayLabel}
            </span>
            <span className="text-sm text-gray-700 leading-snug flex-1">{part.text}</span>
            {part.marks !== null && (
              <span className="text-xs text-gray-400 shrink-0">
                {part.marks} {part.marks === 1 ? 'mark' : 'marks'}
              </span>
            )}
          </div>

          {/* Answer textarea */}
          <textarea
            value={answers[part.label] ?? ''}
            onChange={e => handleChange(part.label, e.target.value)}
            disabled={disabled}
            placeholder={`Your answer for ${part.displayLabel}…`}
            rows={part.marks !== null && part.marks >= 3 ? 3 : 2}
            className="w-full resize-none px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:opacity-50 bg-transparent"
          />
        </motion.div>
      ))}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={!allAnswered || disabled}
          className="flex-1 rounded-xl bg-red-600 text-white text-sm font-semibold py-2.5 hover:bg-red-700 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
        >
          {disabled ? 'Marking…' : 'Submit all answers'}
        </button>
        <button
          onClick={onSwitchToFreeText}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap"
        >
          Free text
        </button>
      </div>
    </div>
  )
}
