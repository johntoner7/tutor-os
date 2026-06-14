import type { MasteryStatus } from '../types'
import type { Topic } from '../types'
import type { MasteryMap } from '../hooks/useMastery'

interface Props {
  topics: Topic[]
  mastery: MasteryMap
  activeTopic?: string
  onSelect: (slug: string) => void
}

function masteryLabel(status: MasteryStatus | undefined, avgScore: number | null | undefined): { color: string; label: string } {
  if (!status || status === 'untouched') return { color: 'bg-gray-200', label: '' }
  if (status === 'green') return { color: 'bg-green-500', label: avgScore != null ? `${avgScore}%` : 'Mastered' }
  if (status === 'amber') return { color: 'bg-amber-400', label: avgScore != null ? `${avgScore}%` : 'In progress' }
  return { color: 'bg-gray-200', label: '' }
}

function TopicCard({
  topic,
  mastery,
  isActive,
  onSelect,
}: {
  topic: Topic
  mastery: MasteryMap
  isActive: boolean
  onSelect: (slug: string) => void
}) {
  const entry = mastery.get(topic.slug)
  const { color, label } = masteryLabel(entry?.status, entry?.avg_score_percent)

  return (
    <button
      onClick={() => onSelect(topic.slug)}
      className={`w-full text-left rounded-xl border px-4 py-3 flex items-start gap-3 transition-all duration-150 active:scale-[0.98] ${
        isActive
          ? 'bg-red-50 border-red-300 shadow-sm'
          : 'bg-white border-gray-100 hover:border-red-200 hover:bg-red-50/40 shadow-sm'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${color} shrink-0 mt-1.5`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${isActive ? 'text-red-700' : 'text-gray-900'}`}>{topic.name}</p>
        {label && <p className="text-xs text-gray-400 mt-0.5">{label} avg</p>}
      </div>
    </button>
  )
}

export function TopicPicker({ topics, mastery, activeTopic = '', onSelect }: Props) {
  const unit1 = topics.filter(t => t.unit === 1)
  const unit2 = topics.filter(t => t.unit === 2)

  return (
    <div className="px-4 md:px-5 py-4">
      <div className="space-y-5">
        {unit1.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2.5">Unit 1</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {unit1.map(t => (
                <TopicCard key={t.slug} topic={t} mastery={mastery} isActive={t.slug === activeTopic} onSelect={onSelect} />
              ))}
            </div>
          </div>
        )}
        {unit2.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2.5">Unit 2</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {unit2.map(t => (
                <TopicCard key={t.slug} topic={t} mastery={mastery} isActive={t.slug === activeTopic} onSelect={onSelect} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
