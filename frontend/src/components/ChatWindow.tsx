import { useEffect, useRef, useState } from 'react'
import { Send, X, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChatMessage } from './ChatMessage'
import { useGlossary } from '../hooks/useGlossary'
import type { Message } from '../types'

const TOPIC_SUGGESTIONS = [
  'What is the difference between osmosis and diffusion?',
  'Explain how enzymes work',
  'What happens during aerobic respiration?',
]

interface Greeting {
  text: string
  suggestedTopicSlug: string | null
  suggestedTopicName: string | null
}

interface Props {
  history: Message[]
  loading: boolean
  error: string | null
  activeTopic: string
  activeTopicName: string
  canAskQuestion: boolean
  questionActive: boolean
  greeting: Greeting | null
  greetingLoading: boolean
  onSend: (message: string) => void
  onRequestQuestion: () => void
  onRequestQuiz: () => void
  onOpenTopicPicker: () => void
  onClearTopic: () => void
  onTopicSelect: (slug: string) => void
  onEndSession: () => void
  onSuggestedTopicAccept: (slug: string) => void
}

export function ChatWindow({
  history,
  loading,
  error,
  activeTopic,
  activeTopicName,
  canAskQuestion,
  questionActive,
  greeting,
  greetingLoading,
  onSend,
  onRequestQuestion,
  onRequestQuiz,
  onOpenTopicPicker,
  onClearTopic,
  onTopicSelect,
  onEndSession,
  onSuggestedTopicAccept,
}: Props) {
  const glossary = useGlossary()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hasMessages = history.length > 0

  useEffect(() => {
    if (!hasMessages) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, loading])

  function handleSend() {
    const trimmed = input.trim()
    if (!trimmed || loading) return
    onSend(trimmed)
    setInput('')
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleInput() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  return (
    <div className="flex flex-col h-full relative">

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence initial={false}>
          {!hasMessages && !loading && !questionActive ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col px-5 pt-10 pb-8"
            >
              {/* Welcome / greeting card */}
              {!activeTopic && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-6">
                  {greetingLoading ? (
                    <div className="flex gap-1.5 items-center py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-300 animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-red-300 animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-red-300 animate-bounce [animation-delay:300ms]" />
                    </div>
                  ) : greeting ? (
                    <>
                      <p className="text-sm text-gray-700 leading-relaxed mb-4">{greeting.text}</p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        {greeting.suggestedTopicSlug && greeting.suggestedTopicName && (
                          <button
                            onClick={() => onSuggestedTopicAccept(greeting.suggestedTopicSlug!)}
                            className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            Start with {greeting.suggestedTopicName}
                          </button>
                        )}
                        <button
                          onClick={onOpenTopicPicker}
                          className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-600 transition-colors md:hidden"
                        >
                          Browse all topics
                        </button>
                        <span className="hidden md:inline-flex items-center text-xs text-gray-400 px-1">
                          or pick from the sidebar
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 leading-relaxed">
                      Ask a biology question or pick a topic to practise.
                    </p>
                  )}
                </div>
              )}

              {/* Quick-start questions */}
              {!activeTopic ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Try asking</p>
                  <div className="flex flex-col gap-2">
                    {TOPIC_SUGGESTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => onSend(s)}
                        className="text-left text-sm text-gray-600 bg-white border border-gray-200 rounded-xl px-4 py-2.5 hover:border-red-200 hover:bg-red-50 hover:text-red-700 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Try asking about {activeTopicName}</p>
                  <div className="flex flex-col gap-2">
                    {[
                      `Explain the key concepts in ${activeTopicName}`,
                      `What are the most common exam questions on ${activeTopicName}?`,
                      `What command words might appear in a ${activeTopicName} question?`,
                    ].map(s => (
                      <button
                        key={s}
                        onClick={() => onSend(s)}
                        className="text-left text-sm text-gray-600 bg-white border border-gray-200 rounded-xl px-4 py-2.5 hover:border-red-200 hover:bg-red-50 hover:text-red-700 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="messages"
              className="px-4 py-4 space-y-3 pb-6"
            >
              {history.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChatMessage message={msg} glossary={glossary} onTopicSelect={onTopicSelect} />
                </motion.div>
              ))}

              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start"
                >
                  <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-bounce [animation-delay:300ms]" />
                  </div>
                </motion.div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3"
                >
                  {error}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input bar — hidden while a practice question is active */}
      <div className={`sticky bottom-0 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent pt-6 pb-4 px-4 transition-all ${questionActive ? 'hidden' : ''}`}>
        <div className="max-w-2xl mx-auto">

          {/* Mobile-only topic pill */}
          <div className="md:hidden flex items-center gap-2 mb-2">
            <AnimatePresence mode="wait" initial={false}>
              <motion.button
                key={activeTopic || 'all'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={onOpenTopicPicker}
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  activeTopic
                    ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                    : 'bg-white border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-600'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                {activeTopicName || 'All topics'}
              </motion.button>
            </AnimatePresence>
            {activeTopic && (
              <button
                onClick={onClearTopic}
                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          {/* Input box */}
          <div className="flex items-center gap-2 bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-3 focus-within:border-red-300 focus-within:ring-2 focus-within:ring-red-100 transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              placeholder="Ask a biology question…"
              disabled={loading}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:opacity-50 leading-relaxed"
              style={{ minHeight: '24px', maxHeight: '160px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="shrink-0 w-8 h-8 rounded-xl bg-red-600 flex items-center justify-center text-white hover:bg-red-700 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-400">
              Answers are grounded in the CCEA Biology specification
            </p>
            {history.length > 0 && (
              <button
                onClick={onEndSession}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap ml-3"
              >
                End session ↗
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
