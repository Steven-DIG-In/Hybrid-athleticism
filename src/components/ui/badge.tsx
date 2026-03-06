import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
    "inline-flex items-center rounded-sm border px-2.5 py-0.5 text-xs font-semibold font-space-grotesk tracking-wide uppercase transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-[#050505]",
    {
        variants: {
            variant: {
                default:
                    "border-transparent bg-cyan-500 text-black hover:bg-cyan-400 shadow-[0_0_10px_rgba(13,185,242,0.3)]",
                secondary:
                    "border-transparent bg-[#1a1a1a] text-neutral-300 hover:bg-[#222222]",
                destructive:
                    "border-transparent bg-red-900/50 text-red-400 hover:bg-red-900/80",
                outline: "text-foreground border-[#333333] text-neutral-400 hover:text-white",
                modality_lifting: "border-transparent bg-blue-900/30 text-blue-400 border border-blue-900/50",
                modality_cardio: "border-transparent bg-emerald-900/30 text-emerald-400 border border-emerald-900/50",
                modality_rucking: "border-transparent bg-amber-900/30 text-amber-400 border border-amber-900/50",
                modality_metcon: "border-transparent bg-purple-900/30 text-purple-400 border border-purple-900/50",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    )
}

export { Badge, badgeVariants }
