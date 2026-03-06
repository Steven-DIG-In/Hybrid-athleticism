"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowRight, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function LoginPage() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [authError, setAuthError] = useState<string | null>(null)

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const error = params.get('error')
        if (error) {
            setAuthError(error === 'auth-code-exchange-failed'
                ? 'Magic link expired or was opened in a different browser. Please try again.'
                : error)
        }
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            const supabase = createClient()
            let authResult;

            // If a password is provided, use standard email/password login (great for local test accounts)
            if (password) {
                authResult = await supabase.auth.signInWithPassword({
                    email,
                    password,
                })
            } else {
                // Fallback to Magic Link
                authResult = await supabase.auth.signInWithOtp({
                    email,
                    options: {
                        emailRedirectTo: `${window.location.origin}/auth/callback`,
                    },
                })
            }

            if (authResult.error) {
                console.error("Authentication error:", authResult.error.message)
                // In a real app we'd toast an error here
            } else if (password && authResult.data?.user) {
                // If password login succeeded, we don't need to show the "Check email" screen.
                // We can just rely on the router or middleware to redirect us.
                window.location.reload()
            } else {
                setSubmitted(true)
            }
        } catch (error) {
            console.error("Critical Auth failure", error)
        } finally {
            setIsLoading(false)
        }
    }

    if (submitted) {
        return (
            <div className="flex flex-col items-center justify-center space-y-6 text-center animate-in fade-in duration-700">
                <div className="w-16 h-16 rounded-full border border-cyan-500/30 flex items-center justify-center bg-cyan-500/10">
                    <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span>
                </div>
                <div>
                    <h1 className="text-2xl font-space-grotesk font-bold mb-2">Check your comms.</h1>
                    <p className="text-neutral-400 font-inter text-sm">We sent a secure transmission to <span className="text-white">{email}</span>. Click the link to initialize your session.</p>
                </div>
                <Button variant="ghost" onClick={() => setSubmitted(false)} className="text-xs mt-4">
                    Return
                </Button>
            </div>
        )
    }

    return (
        <div className="flex flex-col space-y-8 animate-in slide-in-from-bottom-4 fade-in duration-500">
            <div className="space-y-2">
                <h1 className="text-3xl font-space-grotesk font-bold tracking-tight">Access Terminal.</h1>
                <p className="text-neutral-400 text-sm font-inter">Enter your credentials to access the command center.</p>
            </div>

            {authError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-inter">
                    {authError}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2 block">
                    <label htmlFor="email" className="text-xs font-mono uppercase tracking-widest text-neutral-500">Identity (Email)</label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="operative@domain.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                        className="h-14 bg-[#0a0a0a]"
                    />
                </div>

                <div className="space-y-2 block">
                    <div className="flex justify-between">
                        <label htmlFor="password" className="text-xs font-mono uppercase tracking-widest text-neutral-500">Access Code (Optional)</label>
                    </div>
                    <Input
                        id="password"
                        type="password"
                        placeholder="Leave blank for Magic Link"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        className="h-14 bg-[#0a0a0a]"
                    />
                </div>

                <Button
                    type="submit"
                    className="w-full h-14 mt-4"
                    disabled={isLoading || !email}
                >
                    {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
                    ) : (
                        <>
                            <span className="font-space-grotesk tracking-wide uppercase text-sm">Initialize Session</span>
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                    )}
                </Button>
            </form>

            <div className="text-center">
                <p className="text-xs text-neutral-600 font-mono">SECURE CONNECTION // END-TO-END ENCRYPTED</p>
            </div>
        </div>
    )
}
