import { useEffect, useState } from 'react'
import { fetchSessionStart } from '../api/client'

export interface GreetingData {
  text: string
  suggestedTopicSlug: string | null
  suggestedTopicName: string | null
}

function buildGreetingText(
  isFirstVisit: boolean,
  daysSinceLastActive: number | null,
  suggestedTopicName: string | null,
): string {
  const topicLine = suggestedTopicName ? ` Want to start with ${suggestedTopicName}?` : ''

  if (isFirstVisit) {
    return `Welcome! I'm your CCEA Biology tutor — ask me anything or pick a topic to practise.${topicLine}`
  }

  if (daysSinceLastActive === null || daysSinceLastActive === 0) {
    return `Good to see you back! Ready to continue?${topicLine}`
  }

  if (daysSinceLastActive === 1) {
    return `Good to see you back — it's been a day since your last session.${topicLine}`
  }

  if (daysSinceLastActive <= 7) {
    return `Good to see you back — it's been ${daysSinceLastActive} days since your last session.${topicLine}`
  }

  return `Welcome back — it's been a little while! Let's pick up where you left off.${topicLine}`
}

export function useGreeting(userId: string | undefined): {
  greeting: GreetingData | null
  loading: boolean
} {
  const [greeting, setGreeting] = useState<GreetingData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    fetchSessionStart()
      .then(data => {
        setGreeting({
          text: buildGreetingText(
            data.is_first_visit,
            data.days_since_last_active,
            data.suggested_topic_name,
          ),
          suggestedTopicSlug: data.suggested_topic_slug,
          suggestedTopicName: data.suggested_topic_name,
        })
      })
      .catch(err => {
        console.warn('[useGreeting] failed to fetch greeting:', err)
      })
      .finally(() => setLoading(false))
  }, [userId])

  return { greeting, loading }
}
