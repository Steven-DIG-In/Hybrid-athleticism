/**
 * Quick diagnostic script to test database connection and table existence
 * Run with: npx tsx test-db-connection.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kuqgtholljrxnbxtmrnz.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1cWd0aG9sbGpyeG5ieHRtcm56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTEzNjksImV4cCI6MjA4NDY4NzM2OX0.igC97nDDN2JByM9ApaiQQznU9woSwtJlR5TGG9tATUk'

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testDatabase() {
    console.log('🔍 Testing Supabase connection...\n')

    // Test 1: Check if tables exist
    console.log('Test 1: Checking if tables exist')
    const tables = ['mesocycles', 'planned_sessions', 'planned_exercises', 'user_lift_maxes', 'lift_max_history', 'user_volume_landmarks']

    for (const table of tables) {
        try {
            const { data, error } = await supabase.from(table).select('id').limit(1)
            if (error) {
                console.log(`  ❌ ${table}: ${error.message}`)
            } else {
                console.log(`  ✅ ${table}: exists (${data?.length || 0} rows found)`)
            }
        } catch (err) {
            console.log(`  ❌ ${table}: ${err}`)
        }
    }

    console.log('\n✨ Diagnostic complete!')
}

testDatabase()
