import { BottomNav } from "@/components/ui/bottom-nav"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-[#020202] text-white flex flex-col relative overflow-hidden pb-16">
            {/* Heavy textured background */}
            <div
                className="absolute inset-0 z-0 pointer-events-none"
                style={{
                    background: "radial-gradient(circle at 50% 0%, rgba(13, 185, 242, 0.05) 0%, rgba(2, 2, 2, 1) 100%)"
                }}
            />
            <div className="absolute inset-0 z-0 opacity-[0.02] pointer-events-none mix-blend-overlay" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noiseFilter\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.85\" numOctaves=\"3\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23noiseFilter)\"/%3E%3C/svg%3E')" }}></div>

            {/* Header */}
            <nav className="relative z-10 w-full p-4 flex justify-between items-center border-b border-white/5 bg-[#050505]/80 backdrop-blur-md sticky top-0">
                <div className="inline-flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                    <span className="font-space-grotesk tracking-widest uppercase text-xs font-bold text-neutral-300">Command Center</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 overflow-hidden">
                    {/* Avatar placeholder */}
                    <div className="w-full h-full bg-gradient-to-tr from-cyan-900 to-[#111]"></div>
                </div>
            </nav>

            <main className="flex-1 w-full max-w-7xl mx-auto p-4 relative z-10 flex flex-col gap-6">
                {children}
            </main>

            {/* Global Mobile Navigator */}
            <BottomNav />
        </div>
    )
}
