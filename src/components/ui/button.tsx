import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-none text-sm font-space-grotesk font-semibold uppercase tracking-wide transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500 disabled:pointer-events-none disabled:opacity-50 relative overflow-hidden group active:scale-95",
    {
        variants: {
            variant: {
                default:
                    "bg-white text-black hover:bg-neutral-200 border border-transparent shadow-[0_0_15px_rgba(13,185,242,0.1)]",
                destructive:
                    "bg-red-950/50 text-red-500 border border-red-900/50 hover:bg-red-900/40 hover:text-red-400",
                outline:
                    "border border-white/10 bg-transparent hover:bg-white/5 text-neutral-300 hover:text-white",
                secondary:
                    "bg-[#111111] text-white hover:bg-[#1a1a1a] border border-[#222222]",
                ghost: "hover:bg-white/5 hover:text-white text-neutral-400",
                link: "text-cyan-400 underline-offset-4 hover:underline",
                chrome: "bg-transparent text-white border border-[#333333] hover:border-cyan-500/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]",
            },
            size: {
                default: "h-12 px-8 py-4",
                sm: "h-9 px-4 text-xs",
                lg: "h-14 px-10 text-base",
                icon: "h-12 w-12",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            >
                {/* Glow effect for default/chrome buttons */}
                {(variant === "default" || variant === "chrome") && (
                    <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-cyan-400 to-blue-500 opacity-0 group-hover:opacity-10 transition-opacity duration-500 ease-out pointer-events-none"></span>
                )}
                <span className="relative z-10">{props.children}</span>
            </Comp>
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
