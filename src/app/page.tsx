"use client"

import { motion } from "framer-motion"
import { ArrowRight, Activity, BrainCircuit, Dumbbell } from "lucide-react"
import Link from "next/link"

export default function MarketingPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#020202]">
      {/* 
        Atmospheric Background Layer 
      */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background: "radial-gradient(circle at 50% -20%, rgba(13, 185, 242, 0.08) 0%, rgba(2, 2, 2, 1) 70%)"
        }}
      />
      <div className="fixed inset-0 z-0 opacity-[0.03] pointer-events-none mix-blend-overlay" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cfilter id=\"noiseFilter\"%3E%3CfeTurbulence type=\"fractalNoise\" baseFrequency=\"0.85\" numOctaves=\"3\" stitchTiles=\"stitch\"/%3E%3C/filter%3E%3Crect width=\"100%25\" height=\"100%25\" filter=\"url(%23noiseFilter)\"/%3E%3C/svg%3E')" }}></div>

      {/* --- HERO SECTION --- */}
      <section className="relative z-10 container mx-auto px-6 h-screen min-h-[800px] flex flex-col justify-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm text-xs font-mono tracking-wider text-cyan-400 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
            Apex OS // Calibration Available
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight font-space-grotesk text-white leading-[1.1] mb-8">
            Engineered for the <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">Extremes.</span>
          </h1>

          <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto mb-12 font-inter leading-relaxed">
            The most advanced hybrid-athleticism protocol ever designed. Stop tracking random workouts. Start training for life with Anthropic-powered granular volume calibration.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login" className="group relative inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-none overflow-hidden transition-transform active:scale-95">
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-cyan-400 to-blue-500 opacity-0 group-hover:opacity-10 transition-opacity"></span>
              <span className="font-space-grotesk tracking-wide uppercase text-sm">Begin Protocol</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <button className="inline-flex items-center justify-center px-8 py-4 font-space-grotesk tracking-wide uppercase text-sm text-neutral-300 border border-white/10 hover:bg-white/5 transition-colors">
              Read the Manifesto
            </button>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 2, delay: 0.5 }}
          className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-[#020202] to-transparent pointer-events-none z-20"
        />
      </section>

      {/* --- OVERVIEW SECTION --- */}
      <section className="relative z-10 container mx-auto px-6 py-32 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="mb-20">
            <h2 className="text-3xl md:text-5xl font-space-grotesk font-bold text-white mb-6">
              Three Pillars of <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Mastery.</span>
            </h2>
            <p className="text-neutral-400 text-lg max-w-2xl">
              We do not rely on guesswork. The engine is built on a foundation of scientific progression, cardiovascular adaptations, and ruthless artificial intelligence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Dumbbell className="w-6 h-6 text-cyan-400" />}
              title="Hypertrophy OS"
              description="Granular tracking of tonnage, RIR drop-offs, and muscular fatigue. Every set feeds the algorithm."
            />
            <FeatureCard
              icon={<Activity className="w-6 h-6 text-cyan-400" />}
              title="Conditioning Engine"
              description="Seamless integration of Zone 2 and VO2 Max protocols that do not interfere with your strength curves."
            />
            <FeatureCard
              icon={<BrainCircuit className="w-6 h-6 text-cyan-400" />}
              title="Anthropic Coach"
              description="Weekly programmatic reviews. The AI analyzes your RPE degradation and strips or adds volume dynamically."
            />
          </div>
        </div>
      </section>

      {/* --- THE DATA PROMISE SECTION --- */}
      <section className="relative z-10 w-full bg-[#050505] border-y border-white/5 py-32">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 text-center md:text-left divide-y md:divide-y-0 md:divide-x divide-white/5">
            <StatBlock value="14.2M" label="Tons Moved" />
            <StatBlock value="340K" label="Sets Calibrated" />
            <StatBlock value="< 0.1s" label="Action Latency" />
            <div className="flex flex-col justify-center items-center md:items-start pl-0 md:pl-12 pt-12 md:pt-0">
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest mb-2">Intelligence</span>
              <span className="text-2xl font-space-grotesk text-white">Powered by Anthropic.</span>
            </div>
          </div>
        </div>
      </section>

      {/* --- FOOTER CTA --- */}
      <section className="relative z-10 container mx-auto px-6 py-40 text-center">
        <h2 className="text-4xl md:text-6xl font-space-grotesk font-bold text-white mb-8">
          The Abyss Awaits.
        </h2>
        <Link href="/login" className="group relative inline-flex items-center justify-center gap-2 px-10 py-5 bg-white text-black font-semibold rounded-none overflow-hidden transition-transform hover:scale-105 active:scale-95">
          <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-cyan-400 to-blue-500 opacity-0 group-hover:opacity-10 transition-opacity"></span>
          <span className="font-space-grotesk tracking-wide uppercase text-sm">Initialize Calibration</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </section>
    </main>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="group p-8 bg-[#080808] border border-white/5 hover:border-cyan-500/30 transition-colors relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/0 to-transparent group-hover:via-cyan-500/50 transition-all duration-500"></div>
      <div className="mb-6 p-3 bg-white/5 inline-flex rounded-sm">
        {icon}
      </div>
      <h3 className="text-xl font-space-grotesk text-white mb-3">{title}</h3>
      <p className="text-neutral-500 text-sm leading-relaxed font-inter">
        {description}
      </p>
    </div>
  )
}

function StatBlock({ value, label }: { value: string, label: string }) {
  return (
    <div className="flex flex-col justify-center pl-0 md:pl-12 pt-12 md:pt-0 first:pl-0 first:pt-0">
      <span className="text-5xl md:text-6xl font-bold font-space-grotesk text-white mb-2">{value}</span>
      <span className="text-sm font-mono text-neutral-500 uppercase tracking-widest">{label}</span>
    </div>
  )
}
