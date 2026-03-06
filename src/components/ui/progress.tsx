"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
    value?: number
    indeterminate?: boolean
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
    ({ className, value, indeterminate = false, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    "relative h-1 w-full overflow-hidden rounded-none bg-[#111111]",
                    className
                )}
                {...props}
            >
                <div
                    className={cn(
                        "h-full flex-1 bg-cyan-500 shadow-[0_0_10px_rgba(13,185,242,0.8)] transition-all",
                        indeterminate ? "animate-[progress-indeterminate_1.5s_infinite_linear] w-1/3" : ""
                    )}
                    style={!indeterminate ? { transform: `translateX(-${100 - (value || 0)}%)` } : undefined}
                />
                {/* Glow trail */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent to-cyan-400 opacity-20 pointer-events-none mix-blend-screen"></div>
            </div>
        )
    }
)
Progress.displayName = "Progress"

export { Progress }

// Note: Add this keyframe to your globals.css or tailwind config:
// @keyframes progress-indeterminate {
//   0% { transform: translateX(-100%); }
//   100% { transform: translateX(300%); }
// }
