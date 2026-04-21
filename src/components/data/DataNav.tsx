'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const tabs = [
    { name: 'Overview', href: '/data' },
    { name: 'Strength', href: '/data/strength' },
    { name: 'Endurance', href: '/data/endurance' },
    { name: 'Conditioning', href: '/data/conditioning' },
    { name: 'Recovery', href: '/data/recovery' },
    { name: 'Health', href: '/data/health' },
]

export function DataNav() {
    const pathname = usePathname()

    return (
        <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
            {tabs.map(tab => {
                const isActive = tab.href === '/data'
                    ? pathname === '/data'
                    : pathname.startsWith(tab.href)

                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        className={cn(
                            'px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-widest whitespace-nowrap transition-colors',
                            isActive
                                ? 'bg-cyan-400/10 text-cyan-400 border border-cyan-400/20'
                                : 'text-neutral-500 border border-transparent hover:text-neutral-300 hover:border-white/5'
                        )}
                    >
                        {tab.name}
                    </Link>
                )
            })}
        </div>
    )
}
