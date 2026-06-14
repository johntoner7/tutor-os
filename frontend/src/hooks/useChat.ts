import { useState } from 'react'
import { sendMessage } from '../api/client'
import type { Message } from '../types'

function toApiMessages(msgs: Message[]) {
  // Strip greeting metadata and only include real conversational turns
  return msgs
    .filter(m => !m.suggestedTopicSlug || m.role === 'user') // keep user msgs always; keep assistant msgs that aren't pure greeting chips
    .map(({ role, content }) => ({ role, content }))
}

export function useChat(topicSlug: string, sessionId: string, touchActivity: () => void, subject = 'biology') {
  const [history, setHistory] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(message: string) {
    if (loading) return
    setLoading(true)
    setError(null)

    const userMessage: Message = { role: 'user', content: message }
    const updatedHistory = [...history, userMessage]
    setHistory(updatedHistory)

    try {
      const response = await sendMessage({
        message,
        subject,
        topic_slug: topicSlug || null,
        history: toApiMessages(updatedHistory).slice(-8),
        session_id: sessionId,
      })
      setHistory(prev => [...prev, { role: 'assistant', content: response.response }])
      touchActivity()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setHistory(prev => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  function clearHistory() {
    setHistory([])
    setError(null)
  }

  function initHistory(msgs: Message[]) {
    setHistory(msgs)
    setError(null)
  }

  return { history, loading, error, send, clearHistory, initHistory }
}
