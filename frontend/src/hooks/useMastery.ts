import { useEffect, useState } from 'react'
import { fetchUserMastery } from '../api/client'
import type { MasteryStatus } from '../types'

export type MasteryEntry = {
  status: MasteryStatus
  questions_attempted: number
  avg_score_percent: number | null
  last_active: string | null
  objectives_covered: number
  objectives_total: number
}

export type MasteryMap = Map<string, MasteryEntry>

export function useMastery(userId: string | undefined, version = 0): MasteryMap {
  const [mastery, setMastery] = useState<MasteryMap>(new Map())

  useEffect(() => {
    if (!userId) return
    fetchUserMastery()
      .then(data => {
        const map: MasteryMap = new Map()
        for (const t of data.topics) {
          map.set(t.topic_slug, {
            status: t.status,
            questions_attempted: t.questions_attempted,
            avg_score_percent: t.avg_score_percent,
            last_active: t.last_active,
            objectives_covered: t.objectives_covered,
            objectives_total: t.objectives_total,
          })
        }
        setMastery(map)
      })
      .catch(err => {
        if (err instanceof Error && !err.message.includes('404')) {
          console.warn('[useMastery] unexpected error:', err)
        }
      })
  }, [userId, version])

  return mastery
}
