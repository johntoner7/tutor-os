import { useEffect, useState } from 'react'
import { fetchSessionStart } from '../api/client'

interface Greeting {
  text: string
  suggestedTopicSlug: string | null
  suggestedTopicName: string | null
}

export function useGreeting(userId: string | undefined): {
  greeting: Greeting | null
  loading: boolean
} {
  const [greeting, setGreeting] = useState<Greeting | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    fetchSessionStart()
      .then(data => {
        setGreeting({
          text: data.greeting,
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
