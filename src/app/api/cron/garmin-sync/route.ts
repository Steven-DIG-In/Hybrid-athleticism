import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/admin'
import { syncUser } from '@/lib/ingestion/garmin-sync'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createClient()
  const { data: users, error } = await admin
    .from('garmin_credentials')
    .select('user_id')
    .not('vault_secret_id_email', 'is', null)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results: Array<{ userId: string; status: string }> = []
  for (const row of users ?? []) {
    const r = await syncUser(row.user_id, admin)
    results.push({ userId: row.user_id, status: r.ok ? 'ok' : r.error })
  }
  return NextResponse.json({ synced: results.length, results })
}
