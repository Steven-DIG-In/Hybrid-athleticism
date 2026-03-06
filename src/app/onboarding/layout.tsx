export default function OnboardingLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-[#050505] text-white">
            {/* Heavy obsidian background */}
            <div className="absolute inset-0 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMDcwNzA3Ij48L3JlY3Q+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiMwMDAwMDAiPjwvcmVjdD4KPC9zdmc+')] opacity-20 mix-blend-overlay z-0"></div>

            <main className="relative z-10 container mx-auto px-6 h-screen flex flex-col justify-center max-w-2xl">
                {children}
            </main>
        </div>
    )
}
