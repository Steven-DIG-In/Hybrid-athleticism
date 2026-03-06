/**
 * DB Schema Introspection Script
 * Queries information_schema to reveal the REAL state of the Supabase database.
 * Run with: npx tsx scripts/introspect-db.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kuqgtholljrxnbxtmrnz.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1cWd0aG9sbGpyeG5ieHRtcm56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTEzNjksImV4cCI6MjA4NDY4NzM2OX0.igC97nDDN2JByM9ApaiQQznU9woSwtJlR5TGG9tATUk'

const supabase = createClient(supabaseUrl, supabaseKey)

async function introspect() {
    console.log('🔍 Introspecting real Supabase schema...\n')

    // Get all tables in the public schema
    const { data: tables, error: tablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_type', 'BASE TABLE')
        .order('table_name')

    if (tablesError) {
        // information_schema isn't exposed via PostgREST by default — try RPC fallback
        console.log('⚠️  Cannot read information_schema via PostgREST (expected).')
        console.log('   Falling back to direct table probes...\n')
        await probeTablesDirectly()
        return
    }

    if (!tables || tables.length === 0) {
        console.log('📭 No tables found in public schema.')
        return
    }

    console.log(`📋 Found ${tables.length} tables in public schema:`)
    for (const t of tables) {
        console.log(`\n  ▸ ${t.table_name}`)

        // Get columns for each table
        const { data: cols, error: colsError } = await supabase
            .from('information_schema.columns')
            .select('column_name, data_type, column_default, is_nullable')
            .eq('table_schema', 'public')
            .eq('table_name', t.table_name)
            .order('ordinal_position')

        if (colsError || !cols) {
            console.log(`    (could not read columns: ${colsError?.message})`)
        } else {
            for (const col of cols) {
                const nullable = col.is_nullable === 'YES' ? '?' : ' '
                const def = col.column_default ? ` = ${col.column_default}` : ''
                console.log(`    ${nullable} ${col.column_name}: ${col.data_type}${def}`)
            }
        }
    }
}

async function probeTablesDirectly() {
    const knownTables = [
        // Old schema (should all be gone)
        'planned_sessions', 'planned_exercises',
        'user_lift_maxes', 'lift_max_history', 'user_volume_landmarks',
        // New schema (should all exist + be RLS-secured)
        'profiles', 'mesocycles', 'microcycles', 'workouts', 'exercise_sets',
        'cardio_logs', 'rucking_logs', 'ai_coach_interventions',
    ]

    console.log('📋 Table probe results:\n')

    for (const table of knownTables) {
        // First: check if table exists via SELECT
        const { error: selectErr } = await supabase.from(table).select('id').limit(1)

        if (selectErr?.code === 'PGRST205') {
            console.log(`  ✗ ${table}: DOES NOT EXIST`)
            continue
        }

        // Table exists — now probe RLS by attempting an INSERT with a fake UUID.
        // With RLS active and no auth session, INSERT will be blocked (42501).
        // Without RLS, INSERT would fail on FK constraints (not 42501) or succeed.
        const { error: insertErr } = await supabase
            .from(table)
            .insert({ id: '00000000-0000-0000-0000-000000000000' } as never)

        if (insertErr?.code === '42501' || insertErr?.message?.includes('permission denied') || insertErr?.message?.includes('new row violates row-level security')) {
            console.log(`  🔐 ${table}: EXISTS + RLS active`)
        } else if (!insertErr) {
            console.log(`  ⚠️  ${table}: EXISTS — RLS may not be enabled (insert succeeded!)`)
        } else {
            // FK violation, not-null violation etc — table exists but RLS behaviour unclear
            // A FK error means RLS let the insert through but the data was invalid
            const rlsBlocked = insertErr.code === '23503' || insertErr.code === '23502'
                ? false  // FK/not-null = insert got past RLS
                : true
            const icon = rlsBlocked ? '🔐' : '⚠️ '
            console.log(`  ${icon} ${table}: EXISTS (insert error: ${insertErr.code} — ${insertErr.message.slice(0, 60)})`)
        }
    }

    console.log('\n✨ Done.')
}

introspect().catch(console.error)
