"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { LayoutDashboard, PlusSquare, History, BrainCircuit, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"

export function BottomNav() {
    const pathname = usePathname()

    const tabs = [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Log", href: "/log", icon: PlusSquare },
        { name: "History", href: "/history", icon: History },
        { name: "Coach", href: "/coach", icon: BrainCircuit },
    ]

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#050505]/90 backdrop-blur-md border-t border-white/5 pb-safe-area">
            <div className="flex justify-around items-center h-16 max-w-md mx-auto">
                {process.env.NODE_ENV === 'development' && (
                    <Link
                        href="/admin"
                        className={cn(
                            "flex flex-col items-center justify-center w-12 h-full space-y-1 transition-colors",
                            pathname.startsWith('/admin') ? "text-amber-400" : "text-neutral-600 hover:text-neutral-400"
                        )}
                    >
                        <Wrench className="w-4 h-4" strokeWidth={2} />
                        <span className="text-[8px] font-mono uppercase">Dev</span>
                    </Link>
                )}
                {tabs.map((tab) => {
                    const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`)

                    return (
                        <Link
                            key={tab.name}
                            href={tab.href}
                            className={cn(
                                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors relative group",
                                isActive ? "text-cyan-400" : "text-neutral-500 hover:text-neutral-300"
                            )}
                        >
                            {/* Top active border glow */}
                            {isActive && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-cyan-400 shadow-[0_0_10px_rgba(13,185,242,0.5)]"></div>
                            )}

                            <tab.icon className={cn("w-5 h-5", isActive ? "animate-pulse-slow" : "")} strokeWidth={isActive ? 2.5 : 2} />
                            <span className="text-[10px] font-space-grotesk tracking-wide uppercase">{tab.name}</span>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}
