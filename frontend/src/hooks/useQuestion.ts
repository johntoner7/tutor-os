import { useState } from 'react'
import { fetchQuestion, markAnswer } from '../api/client'
import type { MarkResponse, QuestionResponse } from '../types'

export function useQuestion(sessionId: string, touchActivity: () => void, onMarked?: () => void) {
  const [question, setQuestion] = useState<QuestionResponse | null>(null)
  const [feedback, setFeedback] = useState<MarkResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [marking, setMarking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function getQuestion(topicSlug: string, difficulty?: string, subject = 'biology') {
    setLoading(true)
    setError(null)
    setFeedback(null)
    setQuestion(null)
    try {
      const q = await fetchQuestion({ subject, topic_slug: topicSlug, difficulty, session_id: sessionId })
      setQuestion(q)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load question.')
    } finally {
      setLoading(false)
    }
  }

  async function submitAnswer(studentAnswer: string) {
    if (!question) return
    setMarking(true)
    setError(null)
    try {
      const result = await markAnswer(question.question_id, { student_answer: studentAnswer, session_id: sessionId })
      setFeedback(result)
      touchActivity()
      onMarked?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark answer.')
    } finally {
      setMarking(false)
    }
  }

  function reset() {
    setQuestion(null)
    setFeedback(null)
    setError(null)
  }

  return { question, feedback, loading, marking, error, getQuestion, submitAnswer, reset }
}
