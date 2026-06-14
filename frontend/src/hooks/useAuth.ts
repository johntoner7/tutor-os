import { useCallback, useEffect, useState } from 'react'

const KEY_JWT = 'tutor_jwt'

interface JwtPayload {
  sub: string
  email: string
  exp: number
}

interface AuthUser {
  userId: string
  email: string
}

function parseJwt(token: string): JwtPayload | null {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

function isTokenValid(token: string): boolean {
  const payload = parseJwt(token)
  if (!payload) return false
  return payload.exp * 1000 > Date.now()
}

function getStoredUser(): { token: string; user: AuthUser } | null {
  const token = localStorage.getItem(KEY_JWT)
  if (!token || !isTokenValid(token)) {
    localStorage.removeItem(KEY_JWT)
    return null
  }
  const payload = parseJwt(token)!
  return { token, user: { userId: payload.sub, email: payload.email } }
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  // On mount: restore from storage or consume magic link token in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const magicToken = params.get('token')

    if (magicToken) {
      // Clean the URL immediately so refresh doesn't re-trigger
      const clean = window.location.pathname
      window.history.replaceState({}, '', clean)
      verifyToken(magicToken)
      return
    }

    const stored = getStoredUser()
    if (stored) {
      setToken(stored.token)
      setUser(stored.user)
    }
  }, [])

  async function verifyToken(magicToken: string) {
    setVerifying(true)
    setVerifyError(null)
    try {
      const base = import.meta.env.VITE_API_BASE_URL
      const res = await fetch(`${base}/auth/verify?token=${encodeURIComponent(magicToken)}`)
      if (!res.ok) {
        const text = await res.text().catch(() => 'Login failed')
        throw new Error(text)
      }
      const data: { token: string; user_id: string; email: string } = await res.json()
      localStorage.setItem(KEY_JWT, data.token)
      const payload = parseJwt(data.token)!
      setToken(data.token)
      setUser({ userId: payload.sub, email: payload.email })
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Login failed. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

  const logout = useCallback(() => {
    localStorage.removeItem(KEY_JWT)
    setToken(null)
    setUser(null)
  }, [])

  return { token, user, verifying, verifyError, logout }
}
