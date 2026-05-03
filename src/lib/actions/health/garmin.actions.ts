'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { GarminConnect } from 'garmin-connect'
import { syncUser } from '@/lib/ingestion/garmin-sync'

type ConnectResult =
  | { ok: true }
  | { ok: false; error: string; needsMfa?: boolean }

export async function connectGarmin(
  email: string,
  password: string
): Promise<ConnectResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated' }

  // Probe with a real login before storing, so bad credentials fail fast.
  try {
    const gc = new GarminConnect({ username: email, password })
    await gc.login()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[garmin-connect] login probe failed. raw error:', err)
    // Only treat as definite MFA when the message clearly indicates it,
    // not when the lib hedges with "Ticket not found OR MFA" (ambiguous SSO failure).
    const definiteMfa = /\b(mfa\s+required|two[- ]?factor|2fa\s+required|enter\s+(a\s+)?(otp|code))\b/i.test(msg)
    if (definiteMfa) {
      return { ok: false, error: 'MFA required', needsMfa: true }
    }
    return { ok: false, error: `Garmin login failed: ${msg}` }
  }

  const { error } = await supabase.rpc('store_garmin_credentials', {
    p_email: email,
    p_password: password,
  })
  if (error) return { ok: false, error: error.message }

  // Initial sync — best-effort; doesn't block the connect success.
  await syncUser(user.id, supabase).catch(() => null)

  revalidatePath('/data/health/garmin')
  revalidatePath('/data/health')
  revalidatePath('/data')
  return { ok: true }
}

export async function resyncNow(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated' }

  const res = await syncUser(user.id, supabase)
  revalidatePath('/data/health/garmin')
  revalidatePath('/data/health')
  revalidatePath('/data')
  return res.ok ? { ok: true } : { ok: false, error: res.error }
}

export async function disconnectGarmin(): Promise<{
  ok: boolean
  error?: string
}> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('disconnect_garmin')
  if (error) return { ok: false, error: error.message }
  revalidatePath('/data/health/garmin')
  return { ok: true }
}
