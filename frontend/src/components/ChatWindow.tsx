import { useEffect, useRef, useState } from 'react'
import { Send, BookOpen, X, MessageCircle, PenLine, Zap } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChatMessage } from './ChatMessage'
import { useGlossary } from '../hooks/useGlossary'
import type { Message } from '../types'

const TOPIC_SUGGESTIONS = [
  'What is the difference between osmosis and diffusion?',
  'Explain how enzymes work',
  'What happens during aerobic respiration?',
]

interface Props {
  history: Message[]
  loading: boolean
  error: string | null
  activeTopic: string
  activeTopicName: string
  canAskQuestion: boolean
  questionActive: boolean
  onSend: (message: string) => void
  onRequestQuestion: () => void
  onRequestQuiz: () => void
  onOpenTopicPicker: () => void
  onClearTopic: () => void
  onTopicSelect: (slug: string) => void
}

export function ChatWindow({
  history,
  loading,
  error,
  activeTopic,
  activeTopicName,
  canAskQuestion,
  questionActive,
  onSend,
  onRequestQuestion,
  onRequestQuiz,
  onOpenTopicPicker,
  onClearTopic,
  onTopicSelect,
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
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                Ask a biology question or pick a topic to practise.
              </p>

              {/* Two mode cards */}
              <div className="flex flex-col gap-3 mb-8">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3.5 flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
                    <MessageCircle className="w-4 h-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-0.5">Ask the tutor</p>
                    <p className="text-xs text-gray-500 leading-relaxed">Get clear explanations of any biology concept, grounded in the CCEA spec.</p>
                  </div>
                </div>
                <div className={`bg-white rounded-2xl border shadow-sm px-4 py-3.5 flex gap-3 items-start transition-colors ${activeTopic ? 'border-gray-100' : 'border-dashed border-gray-200'}`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${activeTopic ? 'bg-red-50' : 'bg-gray-50'}`}>
                    <PenLine className={`w-4 h-4 ${activeTopic ? 'text-red-600' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-0.5">Practise questions</p>
                    {activeTopic ? (
                      <p className="text-xs text-gray-500 leading-relaxed">Topic set to <span className="font-medium text-gray-700">{activeTopicName}</span>. Use the button below to get a question.</p>
                    ) : (
                      <p className="text-xs text-gray-500 leading-relaxed">
                        Pick a topic first —{' '}
                        <button onClick={onOpenTopicPicker} className="text-red-600 font-medium underline underline-offset-2 md:hidden">select one now</button>
                        <span className="hidden md:inline">use the sidebar on the left</span>.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick-start questions — hidden once a topic is selected */}
              {!activeTopic && (
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

          {/* Topic + question pill row — topic pill hidden on desktop (sidebar handles it) */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {/* Topic pill — mobile only; desktop uses sidebar */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.button
                key={activeTopic || 'all'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={onOpenTopicPicker}
                className={`md:hidden inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
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
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={onClearTopic}
                className="md:hidden inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-3 h-3" /> Clear topic
              </motion.button>
            )}

            {canAskQuestion && (
              <div className="flex items-center gap-1.5 ml-auto">
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={onRequestQuestion}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border bg-white border-gray-200 text-gray-500 hover:border-red-200 hover:text-red-600 transition-colors"
                >
                  <BookOpen className="w-3 h-3" />
                  Question
                </motion.button>
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={onRequestQuiz}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border bg-red-600 border-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  <Zap className="w-3 h-3" />
                  Quick quiz
                </motion.button>
              </div>
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

          <p className="text-center text-xs text-gray-300 mt-2">
            Answers are grounded in the CCEA Biology specification
          </p>
        </div>
      </div>
    </div>
  )
}
