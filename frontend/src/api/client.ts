import type {
  ChatRequest,
  ChatResponse,
  MarkRequest,
  MarkResponse,
  MasteryResponse,
  QuestionRequest,
  QuestionResponse,
  QuizResult,
  QuizSummaryResponse,
  SessionSummary,
  TopicsResponse,
  UserMasteryResponse,
} from '../types'

const BASE_URL = import.meta.env.VITE_API_BASE_URL
const KEY_JWT = 'tutor_jwt'

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(KEY_JWT)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options?.headers as Record<string, string> | undefined),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(text || `Request failed: ${res.status}`)
  }
  return res.json()
}

export function fetchTopics(subject = 'biology'): Promise<TopicsResponse> {
  return request(`/topics?subject=${subject}`)
}

export function sendMessage(payload: ChatRequest): Promise<ChatResponse> {
  return request('/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function fetchQuestion(payload: QuestionRequest): Promise<QuestionResponse> {
  return request('/question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function markAnswer(questionId: string, payload: MarkRequest, subject = 'biology'): Promise<MarkResponse> {
  return request(`/question/${questionId}/mark?subject=${subject}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export interface GlossaryEntry {
  term: string
  definition: string
}

export function fetchGlossary(subject = 'biology'): Promise<GlossaryEntry[]> {
  return request(`/glossary?subject=${subject}`)
}

export function fetchMastery(sessionId: string): Promise<MasteryResponse> {
  return request(`/session/${sessionId}/mastery`)
}

export function fetchSessionSummary(sessionId: string): Promise<SessionSummary> {
  return request(`/session/${sessionId}/summary`)
}

export function fetchUserMastery(): Promise<UserMasteryResponse> {
  return request('/mastery')
}

export interface SessionStartResponse {
  greeting: string
  suggested_topic_slug: string | null
  suggested_topic_name: string | null
}

export function fetchSessionStart(): Promise<SessionStartResponse> {
  return request('/session/start', { method: 'POST' })
}

export function fetchQuizSummary(payload: {
  session_id: string | null
  topic_slug: string
  topic_name: string
  results: QuizResult[]
}): Promise<QuizSummaryResponse> {
  return request('/quiz/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
