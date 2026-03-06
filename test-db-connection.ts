/**
 * Diagnostic script to test database connection and verify all new tables exist.
 * Run with: npx tsx test-db-connection.ts
 *
 * IMPORTANT: Run both SQL migrations in Supabase SQL Editor first:
 *   1. supabase/migrations/001_initial_schema.sql
 *   2. supabase/migrations/002_rls_policies.sql
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kuqgtholljrxnbxtmrnz.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1cWd0aG9sbGpyeG5ieHRtcm56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTEzNjksImV4cCI6MjA4NDY4NzM2OX0.igC97nDDN2JByM9ApaiQQznU9woSwtJlR5TGG9tATUk'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testDatabase() {
    console.log('🔍 Testing Supabase connection — Hybrid Athleticism Schema v2\n')

    // ─── Core Tables ───────────────────────────────────────────────────────────
    const coreTables = [
        'profiles',
        'mesocycles',
        'microcycles',
        'workouts',
        'exercise_sets',
        'cardio_logs',
        'rucking_logs',
        'ai_coach_interventions',
    ]

    console.log('── Core Hybrid Engine Tables ──────────────────────────────────')
    for (const table of coreTables) {
        try {
            const { data, error } = await supabase.from(table).select('id').limit(1)
            if (error) {
                // RLS "permission denied" means the table EXISTS but is correctly secured
                if (error.message.includes('permission denied') || error.code === '42501') {
                    console.log(`  🔐 ${table}: exists & RLS active (no auth session — expected)`)
                } else if (error.message.includes('does not exist') || error.code === '42P01') {
                    console.log(`  ❌ ${table}: TABLE MISSING — run the migration SQL`)
                } else {
                    console.log(`  ⚠️  ${table}: ${error.message} (code: ${error.code})`)
                }
            } else {
                console.log(`  ✅ ${table}: exists (${data?.length ?? 0} rows visible without auth)`)
            }
        } catch (err) {
            console.log(`  ❌ ${table}: unexpected error — ${err}`)
        }
    }

    // ─── Enum Check (via pg_type) ──────────────────────────────────────────────
    console.log('\n── PostgreSQL Enums ────────────────────────────────────────────')
    const enumNames = ['workout_modality', 'mesocycle_goal', 'equipment_type']
    for (const enumName of enumNames) {
        const { data, error } = await supabase
            .rpc('pg_catalog.pg_type', {})
            .select()
            .limit(0)
            .maybeSingle()
        // Note: Direct enum introspection requires pg_ access.
        // We'll just indicate these need verification in the Supabase dashboard.
        void data; void error
        console.log(`  ℹ️  ${enumName}: verify in Supabase > Database > Types`)
    }

    // ─── Connection Health ─────────────────────────────────────────────────────
    console.log('\n── Connection Health ───────────────────────────────────────────')
    const { data: healthCheck, error: healthError } = await supabase
        .from('profiles')
        .select('count')
        .limit(0)

    if (healthError && !healthError.message.includes('permission denied') && healthError.code !== '42501') {
        console.log(`  ❌ Supabase connection FAILED: ${healthError.message}`)
    } else {
        console.log(`  ✅ Supabase project reachable at ${supabaseUrl}`)
    }

    console.log('\n✨ Diagnostic complete!')
    console.log('\n📋 Next steps if any tables show ❌:')
    console.log('   1. Open https://supabase.com/dashboard/project/kuqgtholljrxnbxtmrnz/sql')
    console.log('   2. Paste & run: supabase/migrations/001_initial_schema.sql')
    console.log('   3. Paste & run: supabase/migrations/002_rls_policies.sql')
    console.log('   4. Re-run: npx tsx test-db-connection.ts\n')
}

testDatabase()
