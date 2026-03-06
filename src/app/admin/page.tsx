'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
    RefreshCw, Trash2, AlertTriangle, CheckCircle2,
    Loader2, Database, User, ArrowLeft, Skull,
    ExternalLink, RotateCcw,
} from 'lucide-react'
import {
    getAdminUserInfo,
    resetTrainingData,
    resetOnboarding,
    deleteAllUserData,
    type AdminUserInfo,
    type ResetResult,
} from '@/lib/actions/admin.actions'

// ─── Dev-only gate ─────────────────────────────────────────────────────────

if (process.env.NODE_ENV !== 'development') {
    notFound()
}

// ─── Confirmation Dialog ───────────────────────────────────────────────────

function ConfirmDialog({
    title,
    description,
    confirmText,
    variant,
    onConfirm,
    onCancel,
    isPending,
}: {
    title: string
    description: string
    confirmText: string
    variant: 'warning' | 'danger' | 'nuclear'
    onConfirm: () => void
    onCancel: () => void
    isPending: boolean
}) {
    const [typed, setTyped] = useState('')
    const isReady = typed.toUpperCase() === 'RESET'

    const variantStyles = {
        warning: { border: 'border-amber-500/30', bg: 'bg-amber-500/5', btn: 'bg-amber-600 hover:bg-amber-500', text: 'text-amber-400' },
        danger: { border: 'border-red-500/30', bg: 'bg-red-500/5', btn: 'bg-red-600 hover:bg-red-500', text: 'text-red-400' },
        nuclear: { border: 'border-red-600/40', bg: 'bg-red-900/10', btn: 'bg-red-700 hover:bg-red-600', text: 'text-red-300' },
    }
    const s = variantStyles[variant]

    return (
        <div className={`p-4 border ${s.border} ${s.bg} space-y-3`}>
            <div className="flex items-start gap-2">
                <AlertTriangle className={`w-5 h-5 ${s.text} shrink-0 mt-0.5`} />
                <div>
                    <p className={`text-sm font-space-grotesk font-bold ${s.text}`}>{title}</p>
                    <p className="text-xs text-neutral-400 font-inter mt-1">{description}</p>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
                    Type RESET to confirm
                </label>
                <input
                    type="text"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    placeholder="RESET"
                    disabled={isPending}
                    className="w-full px-3 py-2 bg-[#111] border border-[#333] text-white text-sm font-mono placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500"
                />
            </div>

            <div className="flex gap-2">
                <button
                    onClick={onCancel}
                    disabled={isPending}
                    className="flex-1 px-3 py-2 text-xs font-space-grotesk font-bold text-neutral-400 border border-[#333] hover:border-[#555] transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={onConfirm}
                    disabled={!isReady || isPending}
                    className={`flex-1 px-3 py-2 text-xs font-space-grotesk font-bold text-white transition-all flex items-center justify-center gap-2 ${
                        isReady && !isPending ? s.btn : 'bg-[#222] text-neutral-600 cursor-not-allowed'
                    }`}
                >
                    {isPending ? (
                        <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {confirmText}...
                        </>
                    ) : (
                        confirmText
                    )}
                </button>
            </div>
        </div>
    )
}

// ─── Main Admin Page ───────────────────────────────────────────────────────

export default function AdminPage() {
    const router = useRouter()
    const [userInfo, setUserInfo] = useState<AdminUserInfo | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [activeAction, setActiveAction] = useState<'training' | 'onboarding' | 'nuclear' | null>(null)
    const [result, setResult] = useState<ResetResult | null>(null)
    const [isPending, startTransition] = useTransition()

    const loadUserInfo = async () => {
        setLoading(true)
        setError(null)
        const res = await getAdminUserInfo()
        if (res.success) {
            setUserInfo(res.data)
        } else {
            setError(res.error)
        }
        setLoading(false)
    }

    useEffect(() => {
        loadUserInfo()
    }, [])

    const handleAction = (action: 'training' | 'onboarding' | 'nuclear') => {
        setActiveAction(action)
        setResult(null)
    }

    const handleConfirm = () => {
        if (!activeAction) return

        startTransition(async () => {
            let res: { success: boolean; data?: ResetResult; error?: string }

            switch (activeAction) {
                case 'training':
                    res = await resetTrainingData()
                    break
                case 'onboarding':
                    res = await resetOnboarding()
                    break
                case 'nuclear':
                    res = await deleteAllUserData()
                    break
            }

            if (res.success && res.data) {
                setResult(res.data)
                setActiveAction(null)

                if (activeAction === 'nuclear') {
                    // User is signed out — redirect to login
                    setTimeout(() => router.push('/login'), 2000)
                } else if (activeAction === 'onboarding') {
                    // User needs to re-onboard
                    setTimeout(() => router.push('/onboarding'), 2000)
                } else {
                    // Refresh data counts
                    await loadUserInfo()
                }
            } else {
                setError(res.error ?? 'Unknown error')
                setActiveAction(null)
            }
        })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseDashboard = supabaseUrl
        ? `https://supabase.com/dashboard/project/${supabaseUrl.replace('https://', '').split('.')[0]}`
        : null

    return (
        <div className="min-h-screen bg-[#050505] text-white">
            {/* Header */}
            <div className="border-b border-white/10 bg-[#0a0a0a]">
                <div className="max-w-lg mx-auto px-5 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Link href="/dashboard" className="text-neutral-400 hover:text-white transition-colors">
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <div>
                                <h1 className="text-base font-space-grotesk font-bold">Dev Admin Panel</h1>
                                <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">development only</p>
                            </div>
                        </div>
                        <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            DEV
                        </span>
                    </div>
                </div>
            </div>

            <div className="max-w-lg mx-auto px-5 py-6 space-y-5">
                {/* Warning Banner */}
                <div className="p-3 border border-amber-500/20 bg-amber-500/5 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-300 font-inter leading-relaxed">
                        Actions here directly modify the database. Training resets are recoverable by re-generating.
                        Onboarding and nuclear resets are permanent.
                    </p>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="p-3 border border-red-500/20 bg-red-500/5">
                        <p className="text-xs text-red-400 font-mono">{error}</p>
                    </div>
                )}

                {/* User Info Card */}
                {userInfo && !loading && (
                    <div className="border border-[#222] bg-[#0a0a0a] p-4 space-y-4">
                        <div className="flex items-center gap-2 mb-3">
                            <User className="w-4 h-4 text-cyan-400" />
                            <h2 className="text-sm font-space-grotesk font-bold">Current User</h2>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                                <span className="text-neutral-500 font-mono text-[10px] uppercase tracking-wider">Email</span>
                                <p className="text-white font-inter mt-0.5 truncate">{userInfo.email ?? '—'}</p>
                            </div>
                            <div>
                                <span className="text-neutral-500 font-mono text-[10px] uppercase tracking-wider">Name</span>
                                <p className="text-white font-inter mt-0.5">{userInfo.displayName ?? '—'}</p>
                            </div>
                            <div>
                                <span className="text-neutral-500 font-mono text-[10px] uppercase tracking-wider">Onboarded</span>
                                <p className={`font-inter mt-0.5 ${userInfo.onboardingCompletedAt ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {userInfo.onboardingCompletedAt ? 'Yes' : 'No'}
                                </p>
                            </div>
                            <div>
                                <span className="text-neutral-500 font-mono text-[10px] uppercase tracking-wider">Goal</span>
                                <p className="text-white font-inter mt-0.5">{userInfo.goalArchetype ?? '—'}</p>
                            </div>
                            <div className="col-span-2">
                                <span className="text-neutral-500 font-mono text-[10px] uppercase tracking-wider">Benchmarks</span>
                                <p className="text-white font-inter mt-0.5">{userInfo.benchmarkDiscoveryStatus ?? '—'}</p>
                            </div>
                            <div className="col-span-2">
                                <span className="text-neutral-500 font-mono text-[10px] uppercase tracking-wider">User ID</span>
                                <p className="text-neutral-400 font-mono text-[10px] mt-0.5 break-all">{userInfo.userId}</p>
                            </div>
                        </div>

                        {/* Data Counts */}
                        <div className="border-t border-[#222] pt-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Database className="w-3 h-3 text-neutral-500" />
                                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Data Counts</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {Object.entries(userInfo.counts).map(([key, value]) => (
                                    <div key={key} className="px-2 py-1.5 bg-[#111] border border-[#1a1a1a]">
                                        <p className="text-[10px] font-mono text-neutral-500 truncate">
                                            {key.replace(/([A-Z])/g, ' $1').trim()}
                                        </p>
                                        <p className={`text-sm font-space-grotesk font-bold ${value > 0 ? 'text-white' : 'text-neutral-600'}`}>
                                            {value}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Result Display */}
                {result && (
                    <div className="p-4 border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            <p className="text-sm font-space-grotesk font-bold text-emerald-300">Reset Complete</p>
                        </div>
                        <p className="text-xs text-neutral-300 font-inter">{result.message}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                            {Object.entries(result.deletedCounts)
                                .filter(([, v]) => v > 0)
                                .map(([table, count]) => (
                                    <span key={table} className="px-2 py-0.5 text-[9px] font-mono bg-[#111] border border-[#222] text-neutral-400">
                                        {table}: {count}
                                    </span>
                                ))}
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                {userInfo && !loading && (
                    <div className="space-y-3">
                        <h3 className="text-xs font-mono text-neutral-500 uppercase tracking-wider">Actions</h3>

                        {/* Reset Training Data */}
                        {activeAction === 'training' ? (
                            <ConfirmDialog
                                title="Reset Training Data"
                                description="Deletes all workouts, sessions, exercise sets, microcycles, and mesocycles. Preserves your profile, injuries, benchmarks, and onboarding data."
                                confirmText="Reset Training"
                                variant="warning"
                                onConfirm={handleConfirm}
                                onCancel={() => setActiveAction(null)}
                                isPending={isPending}
                            />
                        ) : (
                            <button
                                onClick={() => handleAction('training')}
                                disabled={isPending}
                                className="w-full flex items-center gap-3 p-3 border border-[#222] bg-[#0a0a0a] hover:border-amber-500/30 hover:bg-amber-500/5 transition-all text-left group"
                            >
                                <RefreshCw className="w-5 h-5 text-amber-400 group-hover:rotate-180 transition-transform duration-500" />
                                <div>
                                    <p className="text-sm font-space-grotesk font-bold text-white">Reset Training Data</p>
                                    <p className="text-[10px] font-mono text-neutral-500">Clears workouts, mesocycles, microcycles — keeps profile & onboarding</p>
                                </div>
                            </button>
                        )}

                        {/* Reset Onboarding */}
                        {activeAction === 'onboarding' ? (
                            <ConfirmDialog
                                title="Reset Onboarding"
                                description="Deletes ALL data including training, injuries, benchmarks, and recent training. Resets profile to defaults. You will be redirected to onboarding."
                                confirmText="Reset Onboarding"
                                variant="danger"
                                onConfirm={handleConfirm}
                                onCancel={() => setActiveAction(null)}
                                isPending={isPending}
                            />
                        ) : (
                            <button
                                onClick={() => handleAction('onboarding')}
                                disabled={isPending}
                                className="w-full flex items-center gap-3 p-3 border border-[#222] bg-[#0a0a0a] hover:border-red-500/30 hover:bg-red-500/5 transition-all text-left group"
                            >
                                <RotateCcw className="w-5 h-5 text-red-400" />
                                <div>
                                    <p className="text-sm font-space-grotesk font-bold text-white">Reset Onboarding</p>
                                    <p className="text-[10px] font-mono text-neutral-500">Full reset back to fresh user — redirects to /onboarding</p>
                                </div>
                            </button>
                        )}

                        {/* Nuclear Reset */}
                        {activeAction === 'nuclear' ? (
                            <ConfirmDialog
                                title="Nuclear Reset — Delete Everything"
                                description="Deletes ALL data AND your profile row. You will be signed out. The auth.users row cannot be deleted from here — use the Supabase dashboard for that."
                                confirmText="Delete Everything"
                                variant="nuclear"
                                onConfirm={handleConfirm}
                                onCancel={() => setActiveAction(null)}
                                isPending={isPending}
                            />
                        ) : (
                            <button
                                onClick={() => handleAction('nuclear')}
                                disabled={isPending}
                                className="w-full flex items-center gap-3 p-3 border border-[#222] bg-[#0a0a0a] hover:border-red-600/30 hover:bg-red-900/5 transition-all text-left group"
                            >
                                <Skull className="w-5 h-5 text-red-500" />
                                <div>
                                    <p className="text-sm font-space-grotesk font-bold text-white">Nuclear Reset</p>
                                    <p className="text-[10px] font-mono text-neutral-500">Delete everything including profile — signs you out</p>
                                </div>
                            </button>
                        )}
                    </div>
                )}

                {/* Quick Links */}
                <div className="space-y-2 pt-2">
                    <h3 className="text-xs font-mono text-neutral-500 uppercase tracking-wider">Quick Links</h3>
                    <div className="flex flex-wrap gap-2">
                        <Link
                            href="/dashboard"
                            className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider border border-[#222] text-neutral-400 hover:text-white hover:border-[#444] transition-colors"
                        >
                            Dashboard
                        </Link>
                        <Link
                            href="/onboarding"
                            className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider border border-[#222] text-neutral-400 hover:text-white hover:border-[#444] transition-colors"
                        >
                            Onboarding
                        </Link>
                        {supabaseDashboard && (
                            <a
                                href={supabaseDashboard}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider border border-[#222] text-neutral-400 hover:text-white hover:border-[#444] transition-colors"
                            >
                                Supabase <ExternalLink className="w-3 h-3" />
                            </a>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="pt-4 pb-8 border-t border-[#111]">
                    <p className="text-[9px] font-mono text-neutral-600 text-center">
                        This page is only available in development mode and will not exist in production builds.
                    </p>
                </div>
            </div>
        </div>
    )
}
