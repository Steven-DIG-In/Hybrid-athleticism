import Link from 'next/link'
import { Dumbbell, Mountain, Timer } from 'lucide-react'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-900 to-zinc-950 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">
            Hybrid Athleticism
          </h1>
          <p className="text-xl text-zinc-400 mb-8">
            Periodized training across strength, rucking, and running.
            Built on Renaissance Periodization principles.
          </p>

          <div className="flex justify-center gap-8 mb-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-2">
                <Dumbbell className="w-8 h-8 text-blue-400" />
              </div>
              <span className="text-sm text-zinc-400">Strength</span>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-2">
                <Mountain className="w-8 h-8 text-green-400" />
              </div>
              <span className="text-sm text-zinc-400">Rucking</span>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-2">
                <Timer className="w-8 h-8 text-orange-400" />
              </div>
              <span className="text-sm text-zinc-400">Running</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/login"
              className="px-8 py-3 bg-white text-zinc-900 font-semibold rounded-lg hover:bg-zinc-100 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-8 py-3 bg-zinc-800 text-white font-semibold rounded-lg hover:bg-zinc-700 transition-colors border border-zinc-700"
            >
              Create Account
            </Link>
          </div>
        </div>

        <div className="mt-24 max-w-3xl mx-auto">
          <h2 className="text-2xl font-semibold mb-8 text-center">
            Intelligent Cross-Domain Training
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-zinc-800/50 rounded-lg p-6">
              <h3 className="font-semibold mb-2">Volume Management</h3>
              <p className="text-sm text-zinc-400">
                Track sets per muscle group with MV → MEV → MAV → MRV landmarks.
                Auto-adjust based on recovery.
              </p>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-6">
              <h3 className="font-semibold mb-2">Fatigue Modeling</h3>
              <p className="text-sm text-zinc-400">
                Shared recovery budget across all training domains.
                Prevent overtraining with intelligent scheduling.
              </p>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-6">
              <h3 className="font-semibold mb-2">Garmin Integration</h3>
              <p className="text-sm text-zinc-400">
                Sync activities automatically. Your watch data feeds
                the planning engine.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
