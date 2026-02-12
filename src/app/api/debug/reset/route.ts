import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// WARNING: This deletes ALL user data. Only for development use.
export async function DELETE() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const results: Record<string, string> = {}

  // Delete in order due to foreign key constraints
  const tables = [
    'actual_session_exercises',
    'actual_sessions',
    'planned_exercises',
    'planned_sessions',
    'mesocycles',
    'user_lift_maxes',
    'volume_landmarks',
    'users'
  ]

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    results[table] = error ? `Error: ${error.message}` : 'Deleted'
  }

  return NextResponse.json({
    message: 'Database reset complete',
    results
  }, { status: 200 })
}
