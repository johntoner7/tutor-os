import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { fetchTopics } from './api/client'
import { useAuth } from './hooks/useAuth'
import { useChat } from './hooks/useChat'
import { useMastery } from './hooks/useMastery'
import { useQuestion } from './hooks/useQuestion'
import { useSession } from './hooks/useSession'
import { ChatWindow } from './components/ChatWindow'
import { LoginScreen } from './components/LoginScreen'
import { QuestionPanel } from './components/QuestionPanel'
import { QuizSummary } from './components/QuizSummary'
import { TopicDrawer } from './components/TopicDrawer'
import { TopicSidebar } from './components/TopicSidebar'
import type { Topic } from './types'

const QUIZ_SIZE = 5

interface QuizResult {
  question: string
  marks_awarded: number
  marks_available: number
}

export default function App() {
  const { user, verifying, verifyError, logout } = useAuth()
  const { sessionId, touchActivity } = useSession()
  const [masteryVersion, setMasteryVersion] = useState(0)
  const mastery = useMastery(user?.userId, masteryVersion)
  const [topics, setTopics] = useState<Topic[]>([])
  const [topicsError, setTopicsError] = useState<string | null>(null)
  const [activeTopic, setActiveTopic] = useState('')
  const [showTopicDrawer, setShowTopicDrawer] = useState(false)
  const [showQuestion, setShowQuestion] = useState(false)
  const [quizPhase, setQuizPhase] = useState<'idle' | 'in-progress' | 'summary'>('idle')
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizResults, setQuizResults] = useState<QuizResult[]>([])

  const { history, loading, error: chatError, send, clearHistory } = useChat(activeTopic, sessionId, touchActivity)
  const {
    question,
    feedback,
    loading: qLoading,
    marking,
    error: qError,
    getQuestion,
    submitAnswer,
    reset: resetQuestion,
  } = useQuestion(sessionId, touchActivity, () => setMasteryVersion(v => v + 1))

  useEffect(() => {
    if (!user) return
    fetchTopics()
      .then(data => setTopics(data.topics))
      .catch(err => setTopicsError(err instanceof Error ? err.message : 'Failed to load topics.'))
  }, [user])

  function resetQuiz() {
    setQuizPhase('idle')
    setQuizIndex(0)
    setQuizResults([])
  }

  function handleTopicSelect(slug: string) {
    if (slug === activeTopic) {
      setActiveTopic('')
      clearHistory()
      setShowQuestion(false)
      resetQuestion()
      resetQuiz()
      return
    }
    if (history.length > 0) {
      if (!confirm('Changing topic will clear your chat history. Continue?')) return
    }
    setActiveTopic(slug)
    clearHistory()
    setShowQuestion(false)
    resetQuestion()
    resetQuiz()
  }

  function handleClearTopic() {
    if (history.length > 0) {
      if (!confirm('Clearing the topic will clear your chat history. Continue?')) return
    }
    setActiveTopic('')
    clearHistory()
    setShowQuestion(false)
    resetQuestion()
    resetQuiz()
  }

  function handleRequestQuestion() {
    setShowQuestion(true)
    getQuestion(activeTopic)
  }

  function handleNewQuestion() {
    resetQuestion()
    getQuestion(activeTopic)
  }

  function handleStartQuiz() {
    resetQuiz()
    setQuizPhase('in-progress')
    setQuizIndex(0)
    setQuizResults([])
    setShowQuestion(true)
    getQuestion(activeTopic)
  }

  function handleQuizNext(capturedFeedback: { marks_awarded: number; marks_available: number } | null) {
    const newResults = capturedFeedback && question
      ? [...quizResults, { question: question.question, marks_awarded: capturedFeedback.marks_awarded, marks_available: capturedFeedback.marks_available }]
      : quizResults
    setQuizResults(newResults)

    const nextIndex = quizIndex + 1
    if (nextIndex >= QUIZ_SIZE) {
      setQuizPhase('summary')
      resetQuestion()
    } else {
      setQuizIndex(nextIndex)
      resetQuestion()
      getQuestion(activeTopic)
    }
  }

  function handleQuizClose() {
    resetQuiz()
    setShowQuestion(false)
    resetQuestion()
  }

  function handleRetryQuiz() {
    handleStartQuiz()
  }

  const activeTopicName = topics.find(t => t.slug === activeTopic)?.name ?? ''

  if (!user) {
    return <LoginScreen verifying={verifying} verifyError={verifyError} />
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 bg-white border-b border-gray-100 h-13 flex items-center px-4 md:px-6 gap-3">
        <div className="flex items-center gap-2.5">
          <img src="/pen2paperlogo.png" alt="Pen2Paper" className="w-8 h-8 object-contain" />
          <span className="text-sm font-bold text-gray-900">CCEA Biology</span>
        </div>
        {/* Active topic shown in header on mobile only */}
        {activeTopicName && (
          <span className="md:hidden text-xs text-gray-400 truncate">{activeTopicName}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden md:block text-xs text-gray-400">{user.email}</span>
          <button
            onClick={logout}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Body — sidebar + chat side by side on desktop */}
      <div className="flex-1 flex min-h-0">
        <TopicSidebar
          topics={topics}
          topicsError={topicsError}
          mastery={mastery}
          activeTopic={activeTopic}
          onSelect={handleTopicSelect}
        />

        {/* Chat column */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex-1 min-h-0 max-w-3xl w-full mx-auto flex flex-col">
            <div className={showQuestion ? 'shrink-0' : 'flex-1 min-h-0'}>
              <ChatWindow
                history={history}
                loading={loading}
                error={chatError}
                activeTopic={activeTopic}
                activeTopicName={activeTopicName}
                canAskQuestion={!!activeTopic}
                questionActive={showQuestion}
                onSend={send}
                onRequestQuestion={handleRequestQuestion}
                onRequestQuiz={handleStartQuiz}
                onOpenTopicPicker={() => setShowTopicDrawer(true)}
                onClearTopic={handleClearTopic}
                onTopicSelect={handleTopicSelect}
              />
            </div>

            <AnimatePresence>
              {showQuestion && (
                <motion.div
                  key="question-panel"
                  className="flex-1 min-h-0 overflow-y-auto"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ ease: [0.32, 0.72, 0, 1], duration: 0.28 }}
                >
                  {quizPhase === 'summary' ? (
                    <QuizSummary
                      results={quizResults}
                      topicName={activeTopicName}
                      onRetry={handleRetryQuiz}
                      onClose={handleQuizClose}
                    />
                  ) : qLoading ? (
                    <div className="bg-gray-50 h-full flex flex-col items-center justify-center gap-3 py-16">
                      <div className="flex gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-400 animate-bounce [animation-delay:0ms]" />
                        <span className="w-2 h-2 rounded-full bg-red-400 animate-bounce [animation-delay:150ms]" />
                        <span className="w-2 h-2 rounded-full bg-red-400 animate-bounce [animation-delay:300ms]" />
                      </div>
                      <p className="text-xs text-gray-400">
                        {quizPhase === 'in-progress' ? `Question ${quizIndex + 1} of ${QUIZ_SIZE}…` : 'Generating question…'}
                      </p>
                    </div>
                  ) : question ? (
                    <QuestionPanel
                      key={question.question_id}
                      question={question}
                      feedback={feedback}
                      marking={marking}
                      error={qError}
                      onSubmit={submitAnswer}
                      quiz={quizPhase === 'in-progress' ? { current: quizIndex + 1, total: QUIZ_SIZE } : undefined}
                      onNewQuestion={quizPhase === 'in-progress'
                        ? () => handleQuizNext(feedback)
                        : handleNewQuestion}
                      onClose={quizPhase === 'in-progress'
                        ? handleQuizClose
                        : () => { setShowQuestion(false); resetQuestion() }}
                    />
                  ) : qError ? (
                    <div className="border-t border-gray-100 bg-red-50 px-4 py-4 text-sm text-red-700">
                      {qError}
                    </div>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Topic drawer — mobile only */}
      <TopicDrawer
        open={showTopicDrawer}
        topics={topics}
        topicsError={topicsError}
        mastery={mastery}
        activeTopic={activeTopic}
        onSelect={handleTopicSelect}
        onClose={() => setShowTopicDrawer(false)}
      />
    </div>
  )
}
