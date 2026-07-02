import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MessageCircle, PenLine, ArrowLeft, ListTree, CheckSquare, GraduationCap } from 'lucide-react'
import { fetchTopics } from './api/client'
import { useAuth } from './hooks/useAuth'
import { useGreeting } from './hooks/useGreeting'
import { useChat } from './hooks/useChat'
import { useMastery } from './hooks/useMastery'
import { useQuestion } from './hooks/useQuestion'
import { useSession } from './hooks/useSession'
import { ChatWindow } from './components/ChatWindow'
import { FreeMarkPanel } from './components/FreeMarkPanel'
import { LoginScreen } from './components/LoginScreen'
import { QuestionPanel } from './components/QuestionPanel'
import { QuizSummary } from './components/QuizSummary'
import { SessionSummaryPanel } from './components/SessionSummaryPanel'
import { TopicDrawer } from './components/TopicDrawer'
import { TopicSidebar } from './components/TopicSidebar'
import { fetchSessionSummary } from './api/client'
import type { SessionSummary, Topic } from './types'

const QUIZ_SIZE = 5

interface QuizResult {
  question: string
  marks_awarded: number
  marks_available: number
}

export default function App() {
  const { user, verifying, verifyError, logout } = useAuth()
  const { sessionId, touchActivity } = useSession()
  const { greeting, loading: greetingLoading } = useGreeting(user?.userId)
  const [masteryVersion, setMasteryVersion] = useState(0)
  const mastery = useMastery(user?.userId, masteryVersion)
  const [topics, setTopics] = useState<Topic[]>([])
  const [topicsLoading, setTopicsLoading] = useState(true)
  const [topicsError, setTopicsError] = useState<string | null>(null)
  const [activeTopic, setActiveTopic] = useState('')
  const [showTopicDrawer, setShowTopicDrawer] = useState(false)
  const [showChatOverlay, setShowChatOverlay] = useState(false)
  const [showMarkOverlay, setShowMarkOverlay] = useState(false)

  // Practice mode state
  const [showQuestion, setShowQuestion] = useState(false)
  const [quizPhase, setQuizPhase] = useState<'idle' | 'in-progress' | 'summary'>('idle')
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizResults, setQuizResults] = useState<QuizResult[]>([])
  const [showSessionSummary, setShowSessionSummary] = useState(false)
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null)
  const [sessionSummaryLoading, setSessionSummaryLoading] = useState(false)
  const [sessionSummaryError, setSessionSummaryError] = useState<string | null>(null)

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
      .finally(() => setTopicsLoading(false))
  }, [user])

  useEffect(() => {
    if (!activeTopic && topics.length > 0) {
      setActiveTopic(topics[0].slug)
    }
  }, [activeTopic, topics])

  useEffect(() => {
    if (activeTopic && !showQuestion && quizPhase === 'idle') {
      setShowQuestion(true)
      getQuestion(activeTopic)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTopic])

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

  function handleAskTutor(message: string) {
    setShowChatOverlay(true)
    setShowSessionSummary(false)
    send(message)
  }

  function handleEndSession() {
    setShowSessionSummary(true)
    setSessionSummary(null)
    setSessionSummaryLoading(true)
    setSessionSummaryError(null)
    fetchSessionSummary(sessionId)
      .then(setSessionSummary)
      .catch(err => setSessionSummaryError(err instanceof Error ? err.message : 'Could not load summary.'))
      .finally(() => setSessionSummaryLoading(false))
  }

  const activeTopicName = topics.find(t => t.slug === activeTopic)?.name ?? ''

  if (!user) {
    return <LoginScreen verifying={verifying} verifyError={verifyError} />
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 bg-white border-b border-gray-100 flex items-center px-4 md:px-6 gap-3 h-12">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-red-600 flex items-center justify-center shrink-0">
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          <span className="hidden sm:block text-sm font-bold text-gray-900">CCEA Biology</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowTopicDrawer(true)}
            className={`md:hidden inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-gray-200 rounded-lg transition-colors ${
              showTopicDrawer ? 'text-red-600 border-red-200' : 'text-gray-600 hover:border-red-200 hover:text-red-600'
            }`}
          >
            <ListTree className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Topics</span>
          </button>
          <button
            onClick={() => setShowChatOverlay(true)}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-gray-200 rounded-lg transition-colors ${
              showChatOverlay ? 'text-red-600 border-red-200' : 'text-gray-600 hover:border-red-200 hover:text-red-600'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ask Tutor</span>
          </button>
          <button
            onClick={() => setShowMarkOverlay(true)}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border border-gray-200 rounded-lg transition-colors ${
              showMarkOverlay ? 'text-red-600 border-red-200' : 'text-gray-600 hover:border-red-200 hover:text-red-600'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mark My Answer</span>
          </button>
          <span className="hidden md:block text-xs text-gray-400 ml-2">{user.email}</span>
          <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Sign out
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex min-h-0 relative">
        <TopicSidebar
          topics={topics}
          topicsError={topicsError}
          mastery={mastery}
          activeTopic={activeTopic}
          onSelect={handleTopicSelect}
        />

        {/* Main content column */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex-1 min-h-0 max-w-3xl w-full mx-auto flex flex-col">

            {/* Practice/question flow — default view */}
            <div className="flex-1 min-h-0 flex flex-col">
              {greeting && !greetingLoading && (
                <p className="shrink-0 px-4 pt-4 pb-1 text-base font-semibold text-gray-900">{greeting.text}</p>
              )}
              {/* Mobile topic switcher */}
              <div className="md:hidden shrink-0 flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-white">
                <button
                  onClick={() => setShowTopicDrawer(true)}
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    activeTopic
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-white border-gray-200 text-gray-500'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                  {activeTopicName || 'Pick a topic'}
                </button>
                {activeTopic && (
                  <button
                    onClick={handleClearTopic}
                    className="ml-auto text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Change
                  </button>
                )}
              </div>
              {showSessionSummary ? (
                <SessionSummaryPanel
                  summary={sessionSummary}
                  loading={sessionSummaryLoading}
                  error={sessionSummaryError}
                  topics={topics}
                  onClose={() => { setShowSessionSummary(false); setShowQuestion(false) }}
                  onTopicSelect={(slug) => {
                    setShowSessionSummary(false)
                    setShowQuestion(false)
                    handleTopicSelect(slug)
                  }}
                />
              ) : quizPhase === 'summary' ? (
                <QuizSummary
                  results={quizResults}
                  topicName={activeTopicName}
                  topicSlug={activeTopic}
                  sessionId={sessionId}
                  onRetry={handleRetryQuiz}
                  onClose={handleQuizClose}
                  onAskTutor={handleAskTutor}
                />
              ) : topicsLoading || (!activeTopic && !topicsError) ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-bounce [animation-delay:300ms]" />
                  </div>
                  <p className="text-xs text-gray-400">Loading…</p>
                </div>
              ) : !activeTopic ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
                    <PenLine className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 mb-1">Pick a topic to practise</p>
                    <p className="text-xs text-gray-500 md:block hidden">Select a topic from the sidebar.</p>
                    <p className="text-xs text-gray-500 md:hidden">Tap the topic pill above to choose a topic.</p>
                  </div>
                </div>
              ) : !showQuestion ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
                    <PenLine className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 mb-1">{activeTopicName}</p>
                    <p className="text-xs text-gray-500">Ready to practise?</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRequestQuestion}
                      className="text-xs font-medium px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-600 transition-colors"
                    >
                      One question
                    </button>
                    <button
                      onClick={handleStartQuiz}
                      className="text-xs font-medium px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                      Quick quiz ({QUIZ_SIZE} questions)
                    </button>
                  </div>
                </div>
              ) : qLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
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
                <AnimatePresence mode="wait">
                  <motion.div
                    key={question.question_id}
                    className="flex-1 min-h-0 overflow-y-auto"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ ease: [0.32, 0.72, 0, 1], duration: 0.22 }}
                  >
                    <QuestionPanel
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
                      onAskTutor={quizPhase !== 'in-progress' ? handleAskTutor : undefined}
                    />
                  </motion.div>
                </AnimatePresence>
              ) : qError ? (
                <div className="border-t border-gray-100 bg-red-50 px-4 py-4 text-sm text-red-700">
                  {qError}
                </div>
              ) : null}
            </div>

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

      {/* Chat overlay */}
      <AnimatePresence>
        {showChatOverlay && (
          <motion.div
            className="absolute inset-0 z-40 bg-white flex flex-col"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ ease: [0.32, 0.72, 0, 1], duration: 0.22 }}
          >
            <div className="shrink-0 h-12 flex items-center px-4 border-b border-gray-100">
              <button
                onClick={() => setShowChatOverlay(false)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-red-600 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to question
              </button>
            </div>
            <div className="flex-1 min-h-0 max-w-3xl w-full mx-auto flex flex-col">
              <ChatWindow
                history={history}
                loading={loading}
                error={chatError}
                activeTopic={activeTopic}
                activeTopicName={activeTopicName}
                questionActive={false}
                greeting={greeting}
                greetingLoading={greetingLoading}
                onSend={send}
                onOpenTopicPicker={() => setShowTopicDrawer(true)}
                onClearTopic={handleClearTopic}
                onTopicSelect={handleTopicSelect}
                onEndSession={handleEndSession}
                onSuggestedTopicAccept={(slug) => {
                  handleTopicSelect(slug)
                  setShowChatOverlay(false)
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mark my answer overlay */}
      <AnimatePresence>
        {showMarkOverlay && (
          <motion.div
            className="absolute inset-0 z-40 bg-white flex flex-col"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ ease: [0.32, 0.72, 0, 1], duration: 0.22 }}
          >
            <div className="shrink-0 h-12 flex items-center px-4 border-b border-gray-100">
              <button
                onClick={() => setShowMarkOverlay(false)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-red-600 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to question
              </button>
            </div>
            <div className="flex-1 min-h-0 max-w-3xl w-full mx-auto flex flex-col">
              <FreeMarkPanel
                sessionId={sessionId}
                topics={topics}
                onClose={() => setShowMarkOverlay(false)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
