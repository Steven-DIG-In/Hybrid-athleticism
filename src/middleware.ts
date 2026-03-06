import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware for session refresh, route protection, and onboarding enforcement.
 *
 * Protected routes: /dashboard/*, /onboarding/*, /workout/*, /coach/*, /profile/*
 * Public routes:    /, /login, /signup, /about, /pricing, etc.
 *
 * Onboarding gate:
 *   - Authenticated users who have NOT completed onboarding (onboarding_completed_at IS NULL)
 *     are hard-redirected to /onboarding from any other protected route.
 *   - Users who HAVE completed onboarding are redirected away from /onboarding to /dashboard.
 */
export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    )
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // CRITICAL: DO NOT add logic between createServerClient and getUser()
    // A bug in this area can lead to hard-to-debug auth issues.
    // See: https://supabase.com/docs/guides/auth/server-side/nextjs
    const {
        data: { user },
    } = await supabase.auth.getUser()

    const { pathname } = request.nextUrl

    // Protected route prefixes — must be authenticated to access
    const protectedPrefixes = ['/dashboard', '/onboarding', '/workout', '/coach', '/profile', '/admin']
    const isProtectedRoute = protectedPrefixes.some((prefix) =>
        pathname.startsWith(prefix)
    )

    // Auth routes — redirect to dashboard if already logged in
    const isAuthRoute = pathname === '/login' || pathname === '/signup'

    // ─── Unauthenticated on protected route → kick to /login ─────────────────
    // This also catches deleted users whose session cookie is stale.
    if (isProtectedRoute && !user) {
        // Clear any stale auth cookies so the browser doesn't keep retrying
        await supabase.auth.signOut()
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/login'
        redirectUrl.searchParams.set('redirectTo', pathname)
        return NextResponse.redirect(redirectUrl)
    }

    // ─── Already authenticated on auth route → send to /dashboard ────────────
    if (isAuthRoute && user) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/dashboard'
        redirectUrl.searchParams.delete('redirectTo')
        return NextResponse.redirect(redirectUrl)
    }

    // ─── Onboarding gate (only for authenticated users on protected routes) ──
    if (isProtectedRoute && user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('onboarding_completed_at')
            .eq('id', user.id)
            .maybeSingle()

        // If profile row is missing (e.g. user was partially deleted), treat as not onboarded
        const isOnboarded = profile != null && profile.onboarding_completed_at != null
        const isOnboardingRoute = pathname.startsWith('/onboarding')

        const isAdminRoute = pathname.startsWith('/admin')

        if (!isOnboarded && !isOnboardingRoute && !isAdminRoute) {
            // User hasn't completed onboarding → force them to /onboarding
            const redirectUrl = request.nextUrl.clone()
            redirectUrl.pathname = '/onboarding'
            return NextResponse.redirect(redirectUrl)
        }

        if (isOnboarded && isOnboardingRoute) {
            // User already completed onboarding → no reason to be here
            const redirectUrl = request.nextUrl.clone()
            redirectUrl.pathname = '/dashboard'
            return NextResponse.redirect(redirectUrl)
        }
    }

    return supabaseResponse
}

export const config = {
    matcher: [
        /*
         * Match all request paths EXCEPT:
         * - _next/static (static files)
         * - _next/image (image optimization)
         * - favicon.ico, sitemap.xml, robots.txt (metadata files)
         * - public assets
         */
        '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
