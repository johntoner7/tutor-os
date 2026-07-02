import type { MasteryStatus } from '../types'
import type { Topic } from '../types'
import type { MasteryEntry, MasteryMap } from '../hooks/useMastery'

interface Props {
  topics: Topic[]
  topicsError: string | null
  mastery: MasteryMap
  activeTopic: string
  onSelect: (slug: string) => void
}

const STATUS_DOT: Record<MasteryStatus, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-400',
  red: 'bg-red-400',
  untouched: 'bg-gray-300',
}

function MasteryDot({ status }: { status: MasteryStatus | undefined }) {
  const color = status ? STATUS_DOT[status] : STATUS_DOT.untouched
  return <span className={`w-1.5 h-1.5 rounded-full ${color} shrink-0`} />
}

function TopicButton({
  topic,
  isActive,
  entry,
  onSelect,
}: {
  topic: Topic
  isActive: boolean
  entry: MasteryEntry | undefined
  onSelect: (slug: string) => void
}) {
  const showCoverage = entry && entry.questions_attempted > 0 && entry.objectives_total > 0
  return (
    <button
      onClick={() => onSelect(topic.slug)}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
        isActive
          ? 'bg-red-50 text-red-700 font-medium'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <MasteryDot status={entry?.status} />
      <span className="leading-snug flex-1 min-w-0 truncate">{topic.name}</span>
      {showCoverage && (
        <span className="shrink-0 text-[11px] tabular-nums text-gray-400">
          {entry.objectives_covered}/{entry.objectives_total}
        </span>
      )}
    </button>
  )
}

export function TopicSidebar({ topics, topicsError, mastery, activeTopic, onSelect }: Props) {
  const unit1 = topics.filter(t => t.unit === 1)
  const unit2 = topics.filter(t => t.unit === 2)

  return (
    <aside className="hidden md:flex flex-col w-60 lg:w-64 shrink-0 border-r border-gray-100 bg-white overflow-y-auto">
      <div className="px-3 pt-4 pb-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 px-3 mb-2">Topics</p>

        {topicsError ? (
          <p className="text-xs text-red-600 px-3 py-2">{topicsError}</p>
        ) : (
          <div className="space-y-4">
            {unit1.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 px-3 mb-1">Unit 1</p>
                <div className="space-y-0.5">
                  {unit1.map(t => (
                    <TopicButton
                      key={t.slug}
                      topic={t}
                      isActive={t.slug === activeTopic}
                      entry={mastery.get(t.slug)}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              </div>
            )}
            {unit2.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 px-3 mb-1">Unit 2</p>
                <div className="space-y-0.5">
                  {unit2.map(t => (
                    <TopicButton
                      key={t.slug}
                      topic={t}
                      isActive={t.slug === activeTopic}
                      entry={mastery.get(t.slug)}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-auto px-6 py-4 border-t border-gray-50">
        <p className="text-xs font-medium text-gray-400 mb-2">Mastery</p>
        <div className="space-y-1">
          {[
            { color: 'bg-green-500', label: 'Mastered' },
            { color: 'bg-amber-400', label: 'In progress' },
            { color: 'bg-gray-300', label: 'Not started' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${color} shrink-0`} />
              <span className="text-xs text-gray-400">{label}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-300 mt-2 leading-snug">
          Numbers show spec objectives covered — a high score doesn't always mean full coverage.
        </p>
      </div>
    </aside>
  )
}
