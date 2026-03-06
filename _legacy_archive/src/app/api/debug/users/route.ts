import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Get ALL user records for this auth_id (there should only be 1)
  const { data: users, error } = await supabase
    .from('users')
    .select('id, auth_id, name, email, created_at')
    .eq('auth_id', user.id)

  // Get mesocycles for each user record
  const userDetails = await Promise.all(
    (users || []).map(async (u: { id: string; auth_id: string; name: string; email: string; created_at: string }) => {
      const { data: mesocycles } = await supabase
        .from('mesocycles')
        .select('id, name, status, created_at')
        .eq('user_id', u.id)

      const { count: sessionCount } = await supabase
        .from('planned_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', u.id)

      return {
        ...u,
        mesocycles: mesocycles || [],
        session_count: sessionCount || 0
      }
    })
  )

  return NextResponse.json({
    auth_id: user.id,
    auth_email: user.email,
    user_records_count: users?.length || 0,
    DUPLICATE_USERS: (users?.length || 0) > 1,
    users: userDetails
  }, { status: 200 })
}
