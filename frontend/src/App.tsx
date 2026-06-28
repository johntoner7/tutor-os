import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MessageCircle, PenLine, CheckSquare } from 'lucide-react'
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

type Mode = 'chat' | 'practice' | 'mark'

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
  const [topicsError, setTopicsError] = useState<string | null>(null)
  const [activeTopic, setActiveTopic] = useState('')
  const [showTopicDrawer, setShowTopicDrawer] = useState(false)
  const [mode, setMode] = useState<Mode>('chat')

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

  function handleAskTutor(message: string) {
    setMode('chat')
    setShowQuestion(false)
    resetQuestion()
    resetQuiz()
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

  function handleSwitchMode(next: Mode, autoStart?: 'question' | 'quiz') {
    setMode(next)
    if (next === 'practice' && activeTopic && !showQuestion && quizPhase === 'idle') {
      if (autoStart === 'quiz') {
        handleStartQuiz()
      } else {
        // default: auto-request a single question
        setShowQuestion(true)
        getQuestion(activeTopic)
      }
    }
  }

  const activeTopicName = topics.find(t => t.slug === activeTopic)?.name ?? ''

  if (!user) {
    return <LoginScreen verifying={verifying} verifyError={verifyError} />
  }

  const tabs: { id: Mode; label: string; shortLabel: string; icon: React.ReactNode }[] = [
    { id: 'chat', label: 'Tutor', shortLabel: 'Tutor', icon: <MessageCircle className="w-3.5 h-3.5" /> },
    { id: 'practice', label: 'Practice', shortLabel: 'Practice', icon: <PenLine className="w-3.5 h-3.5" /> },
    { id: 'mark', label: 'Mark My Answer', shortLabel: 'Mark', icon: <CheckSquare className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header + tabs in one row */}
      <header className="shrink-0 bg-white border-b border-gray-100 flex items-stretch px-4 md:px-6 gap-3 h-12">
        <div className="flex items-center gap-2.5 shrink-0">
          <img src="/pen2paperlogo.png" alt="Pen2Paper" className="w-7 h-7 object-contain" />
          <span className="hidden sm:block text-sm font-bold text-gray-900">CCEA Biology</span>
        </div>

        {/* Tabs */}
        <nav className="flex items-stretch gap-0.5 ml-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleSwitchMode(tab.id)}
              className={`relative flex items-center gap-1.5 text-xs font-medium px-3 transition-colors ${
                mode === tab.id ? 'text-red-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
              {mode === tab.id && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500 rounded-full"
                  transition={{ ease: [0.32, 0.72, 0, 1], duration: 0.2 }}
                />
              )}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden md:block text-xs text-gray-400">{user.email}</span>
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

            {/* Chat mode */}
            <div className={`flex-1 min-h-0 flex flex-col ${mode === 'chat' ? '' : 'hidden'}`}>
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
                  handleSwitchMode('practice')
                }}
              />
            </div>

            {/* Practice mode */}
            <div className={`flex-1 min-h-0 flex flex-col ${mode === 'practice' ? '' : 'hidden'}`}>
              {/* Mobile topic switcher — always visible in practice mode */}
              {mode === 'practice' && (
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
                      className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      Change
                    </button>
                  )}
                </div>
              )}
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

            {/* Mark my answer mode */}
            <div className={`flex-1 min-h-0 flex flex-col ${mode === 'mark' ? '' : 'hidden'}`}>
              <FreeMarkPanel
                sessionId={sessionId}
                topics={topics}
                onClose={() => setMode('chat')}
              />
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
    </div>
  )
}
