import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { TopicPicker } from './TopicPicker'
import type { Topic } from '../types'
import type { MasteryMap } from '../hooks/useMastery'

interface Props {
  open: boolean
  topics: Topic[]
  topicsError: string | null
  mastery: MasteryMap
  activeTopic: string
  onSelect: (slug: string) => void
  onClose: () => void
}

export function TopicDrawer({ open, topics, topicsError, mastery, activeTopic, onSelect, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/25"
            onClick={onClose}
          />

          <motion.div
            key="drawer"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ ease: [0.32, 0.72, 0, 1], duration: 0.35 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[82vh] flex flex-col md:max-w-2xl md:left-1/2 md:-translate-x-1/2"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            <div className="flex items-center justify-between px-5 pt-2 pb-3 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-base font-bold text-gray-900">Choose a topic</h2>
                <p className="text-xs text-gray-400 mt-0.5">Focuses your chat and unlocks practice questions</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {topicsError ? (
                <div className="px-5 py-6 text-sm text-red-700 bg-red-50 mx-4 my-4 rounded-xl border border-red-200">
                  Could not load topics: {topicsError}
                </div>
              ) : (
                <TopicPicker
                  topics={topics}
                  mastery={mastery}
                  activeTopic={activeTopic}
                  onSelect={slug => { onSelect(slug); onClose() }}
                />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
