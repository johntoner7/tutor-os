export interface Message {
  role: 'user' | 'assistant'
  content: string
  // Optional chip rendered below the message — stripped before sending to API
  suggestedTopicSlug?: string
  suggestedTopicName?: string
}

export interface ChatRequest {
  message: string
  subject: string
  topic_slug: string | null
  history: Message[]
  session_id: string | null
}

export interface ChatResponse {
  response: string
  sources: string[]
  cache_hit: boolean
}

export interface Topic {
  name: string
  slug: string
  unit: number
}

export interface TopicsResponse {
  topics: Topic[]
}

export interface QuestionRequest {
  subject: string
  topic_slug: string
  session_id?: string | null
}

export interface QuestionResponse {
  question_id: string
  question: string
  marks: number
  topic: string
  difficulty: string
}

export interface MarkRequest {
  student_answer: string
  session_id?: string | null
}

export interface MarkResponse {
  marks_awarded: number
  marks_available: number
  awarded_points: string[]
  missed_points: string[]
  model_answer_hint: string
}

export interface TopicMastery {
  topic_slug: string
  questions_attempted: number
  score_percent: number | null
  last_active: string
}

export interface MasteryResponse {
  session_id: string
  topics: TopicMastery[]
}

export type MasteryStatus = 'green' | 'amber' | 'red' | 'untouched'

export interface UserTopicMastery {
  topic_slug: string
  status: MasteryStatus
  questions_attempted: number
  avg_score_percent: number | null
  last_active: string | null
}

export interface UserMasteryResponse {
  topics: UserTopicMastery[]
}

export interface SessionSummary {
  session_id: string
  summary: string
  topics_covered: string[]
  questions_attempted: number
  average_score_percent: number | null
}

export interface QuizResult {
  question: string
  marks_awarded: number
  marks_available: number
}

export interface QuizSummaryResponse {
  summary: string
  questions_attempted: number
  total_awarded: number
  total_available: number
  average_score_percent: number | null
}
