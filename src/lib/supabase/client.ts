'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Creates a browser-side Supabase client.
 * Use in: Client Components only.
 * Note: Singleton pattern prevents multiple instances in client-side renders.
 */
export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
}
