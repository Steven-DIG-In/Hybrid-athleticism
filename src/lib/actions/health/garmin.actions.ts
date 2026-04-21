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
    if (/mfa|two-?factor|2fa/i.test(msg)) {
      return { ok: false, error: 'MFA required', needsMfa: true }
    }
    return { ok: false, error: `auth_failed: ${msg}` }
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
