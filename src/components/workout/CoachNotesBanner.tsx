"use client"

import { useEffect, useState } from "react"
import { X, MessageSquare } from "lucide-react"

interface CoachNotesBannerProps {
    note: string | null
    onDismiss: () => void
}

export function CoachNotesBanner({ note, onDismiss }: CoachNotesBannerProps) {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        if (note) {
            // Small delay for slide-up animation
            setTimeout(() => setIsVisible(true), 100)
        } else {
            setIsVisible(false)
        }
    }, [note])

    if (!note) return null

    const handleDismiss = () => {
        setIsVisible(false)
        setTimeout(onDismiss, 300) // Wait for slide-down animation
    }

    return (
        <div
            className={`fixed bottom-24 left-0 right-0 z-40 px-4 transition-transform duration-300 ease-out ${
                isVisible ? 'translate-y-0' : 'translate-y-full'
            }`}
        >
            <div className="max-w-2xl mx-auto bg-gradient-to-br from-cyan-950 to-cyan-900/50 border-2 border-cyan-500/50 rounded-lg shadow-[0_0_30px_rgba(13,185,242,0.3)] p-4 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                        <MessageSquare className="w-5 h-5 text-cyan-300" />
                    </div>
                    <div className="flex-1">
                        <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-300 mb-1">
                            Coach's Note
                        </p>
                        <p className="text-sm font-inter text-white leading-relaxed">
                            {note}
                        </p>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-cyan-800/50 transition-colors"
                        aria-label="Dismiss"
                    >
                        <X className="w-4 h-4 text-cyan-200" />
                    </button>
                </div>
            </div>
        </div>
    )
}
