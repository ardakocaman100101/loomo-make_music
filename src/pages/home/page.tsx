import { Sizer, UploadMidi } from '@/components'
import { Github, Logo } from '@/icons'
import {
  Activity,
  BarChart2,
  Cloud,
  Home as HomeIcon,
  Library,
  Piano,
  Play,
  Search,
  Settings,
  Upload,
  User,
} from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'

export default function Home() {
  return (
    <div className="min-h-screen bg-[#16182c] text-[#e5e2e1] selection:bg-[#6c79f0]/30">
      <Navbar />

      <main className="relative flex min-h-screen flex-col items-center overflow-visible px-6 pt-48 pb-20">
        {/* Volumetric Expanded Ambient Lighting Glows */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* Main expanded periwinkle glow */}
          <div className="absolute top-[-100px] left-1/2 h-[900px] w-[1400px] -translate-x-1/2 rounded-full bg-[#6c79f0]/12 blur-[180px]" />
          {/* Inner soft secondary indigo glow */}
          <div className="absolute top-[50px] left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-[#9ba4ff]/8 blur-[120px]" />
        </div>

        <Hero />

        <BentoGrid />
      </main>

      <MobileNav />
    </div>
  )
}

function Navbar() {
  return (
    <nav className="fixed top-0 z-50 w-full border-b border-white/[0.03] bg-[#16182c]/85 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] backdrop-blur-xl">
      <div className="relative mx-auto flex h-24 w-full max-w-7xl items-center justify-between px-6">
        {/* Empty left side to balance */}
        <div className="h-10 w-10" />

        {/* Centered Logo + Title */}
        <div className="absolute left-1/2 flex -translate-x-1/2 items-center justify-center">
          <Link to="/" className="flex items-center gap-3 transition hover:opacity-85">
            <Logo
              height={32}
              width={64}
              className="h-8 w-16 shadow-[0_0_20px_rgba(108,121,240,0.25)]"
            />
            <span className="text-3xl font-black tracking-tighter text-[#e5e2e1] sm:text-4xl">
              loomo
            </span>
          </Link>
        </div>

        {/* Right Side: GitHub Icon */}
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/ardakocaman100101/loophesia"
            target="_blank"
            rel="noreferrer"
            className="rounded-full p-2 text-[#cbc3d7] transition-all duration-300 hover:bg-[#3a3939] hover:text-[#6c79f0] active:scale-95"
            title="GitHub Repository"
          >
            <Github size={24} />
          </a>
        </div>
      </div>
    </nav>
  )
}

function NavLink({
  href,
  children,
  active = false,
}: {
  href: string
  children: React.ReactNode
  active?: boolean
}) {
  return (
    <Link
      to={href}
      className={`py-1 font-medium transition-all ${active ? 'border-b-2 border-[#6c79f0] text-[#6c79f0]' : 'text-[#e5e2e1]/60 hover:text-[#6c79f0]'}`}
    >
      {children}
    </Link>
  )
}

const VERBS = ['make', 'play', 'learn']

function Hero() {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % VERBS.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative z-10 w-full max-w-5xl space-y-12 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="space-y-6"
      >
        <div className="mb-4 flex w-full items-center justify-center gap-[0.35em] text-lg font-medium tracking-[0.35em] text-white/70 uppercase select-none md:text-xl">
          <motion.span layout>just</motion.span>
          <motion.span
            layout
            className="relative inline-flex h-[1.5em] items-center justify-center overflow-visible font-bold text-[#6c79f0]"
            style={{ perspective: '1000px' }}
          >
            {/* Invisible mirror to hold the layout width of the current word */}
            <span className="pointer-events-none invisible whitespace-nowrap select-none">
              {VERBS[index]}
            </span>

            <AnimatePresence mode="popLayout">
              <motion.span
                key={index}
                initial={{ y: '80%', rotateX: 90, z: -40, opacity: 0 }}
                animate={{ y: '0%', rotateX: 0, z: 0, opacity: 1 }}
                exit={{ y: '-80%', rotateX: -90, z: -40, opacity: 0 }}
                transition={{
                  y: { type: 'spring', stiffness: 220, damping: 20 },
                  rotateX: { type: 'spring', stiffness: 220, damping: 20 },
                  z: { type: 'spring', stiffness: 220, damping: 20 },
                  opacity: { duration: 0.15 },
                }}
                className="absolute flex transform-gpu items-center justify-center whitespace-nowrap"
                style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
              >
                {VERBS[index]}
              </motion.span>
            </AnimatePresence>
          </motion.span>
          <motion.span layout>music</motion.span>
        </div>
        <h1 className="mt-2 bg-gradient-to-b from-white to-[#cbc3d5] bg-clip-text text-6xl leading-none font-black tracking-tight text-transparent md:text-8xl">
          loomo
        </h1>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.8 }}
        className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row"
      >
        <UploadMidi
          onUpload={(id) => navigate(`/studio?id=${id}&source=upload`)}
          className="group relative flex w-full items-center justify-center gap-3 rounded-xl bg-[#6c79f0] px-8 py-4 text-xl font-bold text-black shadow-[0_0_30px_rgba(108,121,240,0.45)] transition-all hover:bg-[#8591ff] hover:shadow-[0_0_40px_rgba(108,121,240,0.65)] active:scale-95 sm:w-auto"
        >
          <Upload className="h-5 w-5" />
          <span>Upload</span>
        </UploadMidi>
        <Link
          to="/songs"
          className="block w-full rounded-xl border border-white/10 bg-transparent px-8 py-4 text-center text-xl font-bold text-[#e5e2e1] transition-all hover:border-white/20 hover:bg-white/5 hover:backdrop-blur-md active:scale-95 sm:w-auto"
        >
          Library
        </Link>
        <Link
          to="/freeplay"
          className="block w-full rounded-xl border border-white/10 bg-transparent px-8 py-4 text-center text-xl font-bold text-[#e5e2e1] transition-all hover:border-white/20 hover:bg-white/5 hover:backdrop-blur-md active:scale-95 sm:w-auto"
        >
          Practice
        </Link>
      </motion.div>
    </div>
  )
}

function BentoGrid() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-7xl px-6 py-24">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="flex flex-col items-center justify-center gap-6 rounded-3xl border border-white/10 bg-white/[0.05] p-8 text-center shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] backdrop-blur-2xl"
        >
          <BarChart2 className="h-16 w-16 text-white" strokeWidth={2} />
          <h3 className="text-3xl font-bold text-white">MIDI Processing</h3>
          <p className="text-lg leading-relaxed text-white">
            loomo splits MIDI music files into manageable layers
          </p>
        </motion.div>
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="flex flex-col items-center justify-center gap-6 rounded-3xl border border-white/10 bg-white/[0.05] p-8 text-center shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] backdrop-blur-2xl"
        >
          <Activity className="h-16 w-16 text-white" strokeWidth={2} />
          <h3 className="text-3xl font-bold text-white">Play</h3>
          <p className="text-lg leading-relaxed text-white">
            Plug your instrument and start playing
          </p>
        </motion.div>
        <Link to="/studio" className="block group">
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex flex-col items-center justify-center gap-6 rounded-3xl border border-white/10 bg-white/[0.05] p-8 text-center shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] backdrop-blur-2xl cursor-pointer transition-all hover:border-[#6c79f0]/40 hover:bg-white/[0.08]"
          >
            <Cloud className="h-16 w-16 text-white transition-colors group-hover:text-[#6c79f0]" strokeWidth={2} />
            <h3 className="text-3xl font-bold text-white">Studio</h3>
            <p className="text-lg leading-relaxed text-white">
              Edit, quantize and mix in loomo's simplified native DAW
            </p>
          </motion.div>
        </Link>
      </div>
    </section>
  )
}

function MobileNav() {
  return (
    <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around rounded-t-3xl border-t border-[#e5e2e1]/10 bg-[#131313]/40 px-4 pt-2 pb-6 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:hidden">
      <MobileNavItem icon={<HomeIcon className="h-6 w-6" />} label="Home" active href="/" />
      <MobileNavItem icon={<Library className="h-6 w-6" />} label="Library" href="/songs" />
      <MobileNavItem icon={<Piano className="h-6 w-6" />} label="Practice" href="/freeplay" />
      <MobileNavItem icon={<Settings className="h-6 w-6" />} label="Settings" href="#" />
    </nav>
  )
}

function MobileNavItem({
  icon,
  label,
  active = false,
  href,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  href: string
}) {
  return (
    <Link
      to={href}
      className={`flex flex-col items-center justify-center px-5 py-2 transition-all active:scale-90 ${active ? 'rounded-2xl bg-gradient-to-tr from-[#9ba4ff]/20 to-[#6c79f0]/20 text-[#9ba4ff] shadow-[0_0_15px_rgba(155,164,255,0.3)]' : 'text-[#e5e2e1]/40 hover:text-[#9ba4ff]'}`}
    >
      {icon}
      <span className="mt-1 text-[10px] font-medium tracking-widest uppercase">{label}</span>
    </Link>
  )
}
