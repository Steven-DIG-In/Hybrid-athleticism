import { getUnreviewedInterventions } from "@/lib/actions/ai-coach.actions"
import { BottomNav } from "@/components/ui/bottom-nav"
import { BrainCircuit, CheckCircle2 } from "lucide-react"
import { CoachReviewClient } from "./CoachReviewClient"

export default async function WeeklyReviewPage() {
    // Fetch unreviewed interventions
    const result = await getUnreviewedInterventions()
    const interventions = result.success && result.data ? result.data : []

    return (
        <div className="min-h-screen bg-[#020202] text-white flex flex-col relative pb-24">
            {/* Heavy textured background */}
            <div
                className="absolute inset-0 z-0 pointer-events-none"
                style={{
                    background: "radial-gradient(circle at 50% 0%, rgba(13, 185, 242, 0.05) 0%, rgba(2, 2, 2, 1) 100%)"
                }}
            />
            <div className="absolute inset-0 z-0 opacity-[0.02] pointer-events-none mix-blend-overlay" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noiseFilter\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.85\" numOctaves=\"3\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23noiseFilter)\"/%3E%3C/svg%3E')" }}></div>

            <nav className="relative z-10 w-full p-6 flex justify-between items-center border-b border-white/5 bg-[#050505]/80 backdrop-blur-md sticky top-0">
                <div className="inline-flex items-center gap-2">
                    <BrainCircuit className="w-5 h-5 text-cyan-400" />
                    <span className="font-space-grotesk tracking-widest uppercase text-xs font-bold text-neutral-300">AI Coach /// Anthropic</span>
                </div>
            </nav>

            <main className="flex-1 w-full max-w-2xl mx-auto p-6 relative z-10">
                {interventions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <CheckCircle2 className="w-16 h-16 text-emerald-500/50 mb-4" />
                        <h2 className="text-xl font-space-grotesk text-white mb-2">Systems Nominal</h2>
                        <p className="text-neutral-500 font-inter text-sm">No pending coaching interventions. Your telemetry looks clean.</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {interventions.map(intervention => (
                            <CoachReviewClient key={intervention.id} intervention={intervention} />
                        ))}
                    </div>
                )}
            </main>

            {/* Global Mobile Navigator */}
            <BottomNav />
        </div>
    )
}
