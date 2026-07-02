import { useState } from 'react'
import { GraduationCap } from 'lucide-react'

const BASE_URL = import.meta.env.VITE_API_BASE_URL

interface Props {
  verifying: boolean
  verifyError: string | null
}

export function LoginScreen({ verifying, verifyError }: Props) {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [debugLink, setDebugLink] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || sending) return
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch(`${BASE_URL}/auth/magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => 'Something went wrong')
        throw new Error(text)
      }
      const data = await res.json()
      setSubmitted(true)
      if (data.debug_link) setDebugLink(data.debug_link)
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSending(false)
    }
  }

  if (verifying) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Logging you in…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center shrink-0">
            <GraduationCap className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="text-base font-bold text-gray-900">CCEA Biology</span>
        </div>

        {!submitted ? (
          <>
            <h1 className="text-xl font-semibold text-gray-900 mb-1">Sign in</h1>
            <p className="text-sm text-gray-500 mb-6">
              Enter your email and we'll send you a login link.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={sending || !email.trim()}
                className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? 'Sending…' : 'Send login link'}
              </button>
            </form>

            {sendError && (
              <p className="mt-3 text-sm text-red-600">{sendError}</p>
            )}
            {verifyError && (
              <p className="mt-3 text-sm text-red-600">{verifyError}</p>
            )}
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-gray-900 mb-1">Check your email</h1>
            <p className="text-sm text-gray-500 mb-4">
              We sent a login link to <strong>{email}</strong>.
            </p>

            {debugLink && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                <p className="text-xs font-medium text-amber-800 mb-1">Dev mode — magic link:</p>
                <a
                  href={debugLink}
                  className="text-xs text-amber-700 break-all underline"
                >
                  {debugLink}
                </a>
              </div>
            )}

            <button
              onClick={() => { setSubmitted(false); setDebugLink(null) }}
              className="mt-4 text-sm text-gray-400 hover:text-gray-600"
            >
              Use a different email
            </button>
          </>
        )}
      </div>
    </div>
  )
}
