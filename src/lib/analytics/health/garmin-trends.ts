import { createClient } from '@/lib/supabase/server'

export type Trend = 'up' | 'down' | 'flat'

export interface GarminTrends {
  last_synced: string | null
  sleep_trend: Trend
  hrv_trend: Trend
  rhr_trend: Trend
}

function classifyTrend(series: number[], flatThreshold = 0.05): Trend {
  if (series.length < 4) return 'flat'
  const mid = Math.floor(series.length / 2)
  const firstHalfAvg = series.slice(0, mid).reduce((a, b) => a + b, 0) / mid
  const secondHalfAvg = series.slice(mid).reduce((a, b) => a + b, 0) / (series.length - mid)
  if (firstHalfAvg === 0) return 'flat'
  const pct = (secondHalfAvg - firstHalfAvg) / firstHalfAvg
  if (pct > flatThreshold) return 'up'
  if (pct < -flatThreshold) return 'down'
  return 'flat'
}

function invertTrend(t: Trend): Trend {
  return t === 'up' ? 'down' : t === 'down' ? 'up' : 'flat'
}

export async function garminSevenDayTrends(userId: string): Promise<GarminTrends> {
  const supabase = await createClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const { data } = await supabase
    .from('garmin_daily')
    .select('date, sleep_total_min, hrv_overnight_avg, resting_hr')
    .eq('user_id', userId).gte('date', sevenDaysAgo)
    .order('date', { ascending: true })
  if (!data || data.length === 0) {
    return { last_synced: null, sleep_trend: 'flat', hrv_trend: 'flat', rhr_trend: 'flat' }
  }
  const sleep = data.map(d => d.sleep_total_min ?? 0)
  const hrv = data.map(d => d.hrv_overnight_avg ?? 0)
  const rhr = data.map(d => d.resting_hr ?? 0)
  return {
    last_synced: data[data.length - 1].date,
    sleep_trend: classifyTrend(sleep),
    hrv_trend: classifyTrend(hrv),
    // lower RHR is good — invert so "up" arrow always means positive
    rhr_trend: invertTrend(classifyTrend(rhr)),
  }
}
