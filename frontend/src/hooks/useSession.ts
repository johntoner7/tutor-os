import { useRef, useState } from 'react'

const KEY_SESSION_ID = 'tutor_session_id'
const KEY_LAST_ACTIVITY = 'tutor_last_activity'
const KEY_PREV_SESSION_ID = 'tutor_prev_session_id'

const INACTIVITY_MS = 30 * 60 * 1000 // 30 minutes

function newId(): string {
  return crypto.randomUUID()
}

function initSession(): { sessionId: string; } {
  const lastActivity = localStorage.getItem(KEY_LAST_ACTIVITY)
  const existingId = localStorage.getItem(KEY_SESSION_ID)

  const isStale =
    !lastActivity ||
    !existingId ||
    Date.now() - Number(lastActivity) > INACTIVITY_MS

  if (isStale && existingId) {
    // The last session has gone stale — rotate it
    const id = newId()
    localStorage.setItem(KEY_PREV_SESSION_ID, existingId)
    localStorage.setItem(KEY_SESSION_ID, id)
    localStorage.setItem(KEY_LAST_ACTIVITY, String(Date.now()))
    return { sessionId: id }
  }

  if (!existingId) {
    // First ever visit — no previous session
    const id = newId()
    localStorage.setItem(KEY_SESSION_ID, id)
    localStorage.setItem(KEY_LAST_ACTIVITY, String(Date.now()))
    return { sessionId: id }
  }

  // Active session still valid
  return { sessionId: existingId }
}

export function useSession() {
  const init = useRef(initSession())
  const [sessionId] = useState(init.current.sessionId)

  function touchActivity() {
    localStorage.setItem(KEY_LAST_ACTIVITY, String(Date.now()))
  }

  return { sessionId, touchActivity }
}
