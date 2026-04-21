'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { connectGarmin } from '@/lib/actions/health/garmin.actions'

export function GarminConnectForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setSubmitting(true)
    setError(null)
    const res = await connectGarmin(email, password)
    setSubmitting(false)
    if (res.ok) {
      router.push('/data/health/garmin')
      return
    }
    if (res.needsMfa) {
      setError(
        'MFA required. Complete MFA in the Garmin Connect app, then retry here — this flow does not yet handle TOTP inline.'
      )
    } else {
      setError(res.error)
    }
  }

  return (
    <div className="max-w-md space-y-3">
      <h1 className="text-xl font-space-grotesk">Connect Garmin</h1>
      <div className="flex items-start gap-2 p-3 border border-neutral-800 bg-neutral-950 rounded text-xs text-neutral-400">
        <AlertCircle className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
        <div>
          This uses an unofficial Garmin Connect API. Not endorsed by Garmin.
          Your credentials are encrypted in Supabase Vault and used only for your
          own syncs. If Garmin changes auth and this stops working, a CSV-import
          fallback will appear here.
        </div>
      </div>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="w-full bg-neutral-900 p-2 rounded text-sm"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="w-full bg-neutral-900 p-2 rounded text-sm"
      />
      {error && <div className="text-xs text-amber-500">{error}</div>}
      <button
        onClick={submit}
        disabled={submitting || !email || !password}
        className="px-3 py-2 text-sm bg-amber-900/50 border border-amber-800 rounded disabled:opacity-50"
      >
        {submitting ? 'Connecting...' : 'Connect'}
      </button>
    </div>
  )
}
