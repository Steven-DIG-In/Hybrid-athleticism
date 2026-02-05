import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BottomNav } from '@/components/ui/bottom-nav'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user has completed onboarding (has name and training level set)
  const { data: profileData } = await supabase
    .from('users')
    .select('name, strength_level')
    .eq('auth_id', user.id)
    .single()

  const profile = profileData as { name: string | null; strength_level: string | null } | null

  // If no profile or missing required fields, redirect to onboarding
  if (!profile || !profile.name || !profile.strength_level) {
    redirect('/onboarding')
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-20">
      {children}
      <BottomNav />
    </div>
  )
}
