import { GarminConnect } from 'garmin-connect'
import type { SupabaseClient } from '@supabase/supabase-js'

export function diffVo2(args: {
  previous: number | null
  current: number
}): boolean {
  if (args.previous == null) return true
  return args.previous !== args.current
}

type NestedSleep = {
  dailySleepDTO?: {
    sleepTimeSeconds?: number | null
    deepSleepSeconds?: number | null
    remSleepSeconds?: number | null
    lightSleepSeconds?: number | null
    awakeSleepSeconds?: number | null
    avgOvernightHrv?: number | null
    hrvStatus?: string | null
    restingHeartRate?: number | null
    avgSleepStress?: number | null
    sleepScores?: { overall?: { value?: number | null } | null } | null
  } | null
}

export interface DailyPayload {
  sleep?: NestedSleep | null
  steps?: number | null
  // Reserved for future expansion (direct endpoint calls not yet wired):
  bodyBattery?: {
    startOfDay?: number | null
    endOfDay?: number | null
    min?: number | null
    max?: number | null
  } | null
  activeKilocalories?: number | null
}

function secToMin(s: number | null | undefined): number | null {
  return s == null ? null : Math.round(s / 60)
}

export function dailyRowShape(args: {
  date: string
  userId: string
  payload: DailyPayload
}) {
  const dto = args.payload.sleep?.dailySleepDTO ?? null
  const bb = args.payload.bodyBattery ?? null

  return {
    user_id: args.userId,
    date: args.date,
    sleep_total_min: secToMin(dto?.sleepTimeSeconds ?? null),
    sleep_deep_min: secToMin(dto?.deepSleepSeconds ?? null),
    sleep_rem_min: secToMin(dto?.remSleepSeconds ?? null),
    sleep_light_min: secToMin(dto?.lightSleepSeconds ?? null),
    sleep_awake_min: secToMin(dto?.awakeSleepSeconds ?? null),
    sleep_score: dto?.sleepScores?.overall?.value ?? null,
    hrv_overnight_avg: dto?.avgOvernightHrv ?? null,
    hrv_morning_status: dto?.hrvStatus ?? null,
    resting_hr: dto?.restingHeartRate ?? null,
    body_battery_start: bb?.startOfDay ?? null,
    body_battery_end: bb?.endOfDay ?? null,
    body_battery_min: bb?.min ?? null,
    body_battery_max: bb?.max ?? null,
    stress_avg: dto?.avgSleepStress ?? null,
    steps: args.payload.steps ?? null,
    active_kcal: args.payload.activeKilocalories ?? null,
  }
}

interface GarminCredentials {
  email: string
  password: string
}

async function readVaultCredentials(
  supabase: SupabaseClient,
  userId: string
): Promise<GarminCredentials | null> {
  const { data: row } = await supabase
    .from('garmin_credentials')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (!row || !row.vault_secret_id_email || !row.vault_secret_id_password)
    return null
  const { data: emailRow } = await supabase.rpc('read_secret', {
    secret_id: row.vault_secret_id_email,
  })
  const { data: passRow } = await supabase.rpc('read_secret', {
    secret_id: row.vault_secret_id_password,
  })
  if (!emailRow || !passRow) return null
  return { email: emailRow as unknown as string, password: passRow as unknown as string }
}

type SyncResult = { ok: true; days: number } | { ok: false; error: string }

export async function syncUser(
  userId: string,
  supabase: SupabaseClient
): Promise<SyncResult> {
  const creds = await readVaultCredentials(supabase, userId)
  if (!creds) return { ok: false, error: 'no_credentials' }

  const gc = new GarminConnect({ username: creds.email, password: creds.password })
  try {
    await gc.login()
  } catch {
    await supabase
      .from('garmin_credentials')
      .update({
        last_sync_status: 'auth_failed',
        last_sync_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
    return { ok: false, error: 'auth_failed' }
  }

  const y = new Date(Date.now() - 24 * 3600 * 1000)
  const date = y.toISOString().slice(0, 10)
  const dateObj = new Date(date)

  const payload: DailyPayload = {}
  try {
    payload.sleep = (await gc.getSleepData(dateObj).catch(() => null)) as NestedSleep | null
  } catch {
    payload.sleep = null
  }
  try {
    payload.steps = (await gc.getSteps(dateObj).catch(() => null)) as number | null
  } catch {
    payload.steps = null
  }

  const row = dailyRowShape({ date, userId, payload })
  const { error: upErr } = await supabase
    .from('garmin_daily')
    .upsert(row, { onConflict: 'user_id,date' })
  if (upErr) {
    await supabase
      .from('garmin_credentials')
      .update({
        last_sync_status: `db_error: ${upErr.message}`,
        last_sync_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
    return { ok: false, error: upErr.message }
  }

  await supabase
    .from('garmin_credentials')
    .update({
      last_sync_status: 'ok',
      last_sync_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  return { ok: true, days: 1 }
}
