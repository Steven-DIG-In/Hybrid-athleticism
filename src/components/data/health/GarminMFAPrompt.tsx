'use client'

// MVP does not auto-handle inline TOTP with the garmin-connect npm package.
// If MFA is required, the user completes MFA in the Garmin app, then retries
// connect. This stub keeps the component tree consistent for future expansion.
export function GarminMFAPrompt() {
  return (
    <div className="p-4 text-sm text-neutral-400">
      MFA handling coming soon.
    </div>
  )
}
