import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import {
  Bus,
  ArrowRight,
  Sun,
  Moon,
  Radio,
  MapPin,
  Clock,
  Navigation,
  Bell,
  Sparkles,
  Zap,
  Activity,
  Layers,
  ShieldCheck
} from 'lucide-react';

export const LandingPage = () => {
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <div className="min-h-screen w-full overflow-hidden bg-gradient-to-br from-slate-50 via-sky-50/50 to-blue-100/60 dark:from-navy-950 dark:via-slate-950 dark:to-blue-950/50 text-slate-900 dark:text-white flex flex-col justify-between p-5 sm:p-8 relative transition-colors duration-500 select-none">
      {/* =====================================================================
          ENHANCED ANIMATED BACKGROUND: RADAR SWEEP, MOVING SHUTTLES & GLOWS
          (HIGH CONTRAST & BEAUTIFULLY TUNED FOR BOTH LIGHT AND DARK MODES)
         ===================================================================== */}

      {/* 1. Radar Dot Matrix Coordinates Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#2563eb_1.2px,transparent_1.2px)] dark:bg-[radial-gradient(#38bdf8_1.2px,transparent_1.2px)] [background-size:32px_32px] opacity-25 dark:opacity-20 pointer-events-none" />

      {/* 2. Color-Shifting Ambient Glowing Orbs */}
      <div className="absolute -top-28 -left-28 w-[450px] h-[450px] rounded-full bg-blue-500/25 dark:bg-blue-600/20 blur-[120px] animate-pulse-glow pointer-events-none" />
      <div className="absolute -bottom-28 -right-28 w-[450px] h-[450px] rounded-full bg-emerald-500/20 dark:bg-emerald-500/15 blur-[120px] animate-pulse-glow pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-sky-400/20 dark:bg-brand-500/15 blur-[140px] pointer-events-none" />

      {/* 3. Rotating Radar Sonar Sweep Cone & Concentric Waves */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
        {/* Sonar Concentric Ripple Rings */}
        <div className="w-[320px] h-[320px] sm:w-[480px] sm:h-[480px] rounded-full border border-blue-500/35 dark:border-blue-400/25 animate-radar-ripple absolute" />
        <div className="w-[320px] h-[320px] sm:w-[480px] sm:h-[480px] rounded-full border border-sky-400/30 dark:border-sky-400/20 animate-radar-ripple-delayed absolute" />
        <div className="w-[500px] h-[500px] sm:w-[700px] sm:h-[700px] rounded-full border border-dashed border-blue-400/30 dark:border-slate-800/80 absolute" />
        <div className="w-[720px] h-[720px] sm:w-[940px] sm:h-[940px] rounded-full border border-slate-300/40 dark:border-slate-800/40 absolute" />

        {/* 360° Rotating Sonar Sweep Beam */}
        <div className="w-[420px] h-[420px] sm:w-[580px] sm:h-[580px] rounded-full animate-radar-sweep opacity-35 dark:opacity-30 absolute pointer-events-none"
             style={{
               background: 'conic-gradient(from 0deg, rgba(37, 99, 235, 0.45) 0deg, rgba(56, 189, 248, 0.2) 45deg, transparent 90deg, transparent 360deg)'
             }}
        />
      </div>

      {/* 4. Animated SVG Transit Corridors with Multiple Moving Shuttles */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-50 dark:opacity-45"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="transitRoute1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#2563EB" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="transitRoute2" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#10B981" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="transitRoute3" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#EC4899" stopOpacity="0.1" />
          </linearGradient>
          <filter id="neonGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Dynamic Route Corridor 1 (Primary Loop) */}
        <path
          d="M-100,720 C280,620 420,180 760,340 C1100,500 1240,160 1540,120"
          fill="none"
          stroke="url(#transitRoute1)"
          strokeWidth="3.5"
          strokeDasharray="14 12"
          className="animate-route-dash"
        />

        {/* Dynamic Route Corridor 2 (Cross-City Link) */}
        <path
          d="M-80,180 C320,340 540,760 940,580 C1200,460 1340,680 1540,640"
          fill="none"
          stroke="url(#transitRoute2)"
          strokeWidth="2.8"
          strokeDasharray="10 10"
          className="animate-route-dash-reverse"
        />

        {/* Dynamic Route Corridor 3 (Express Shuttle Line) */}
        <path
          d="M100,920 C350,550 650,750 950,250 C1150,150 1300,320 1550,220"
          fill="none"
          stroke="url(#transitRoute3)"
          strokeWidth="2.2"
          strokeDasharray="8 8"
          className="animate-route-dash-fast"
        />

        {/* MOVING SHUTTLE 1 (Blue Rapid Transit Vehicle S01) */}
        <g filter="url(#neonGlow)">
          <circle r="7" fill="#2563EB">
            <animateMotion dur="12s" repeatCount="indefinite" path="M-100,720 C280,620 420,180 760,340 C1100,500 1240,160 1540,120" />
          </circle>
          <circle r="18" fill="#38BDF8" opacity="0.35">
            <animateMotion dur="12s" repeatCount="indefinite" path="M-100,720 C280,620 420,180 760,340 C1100,500 1240,160 1540,120" />
          </circle>
        </g>

        {/* MOVING SHUTTLE 2 (Emerald Express Line S02) */}
        <g filter="url(#neonGlow)">
          <circle r="6.5" fill="#10B981">
            <animateMotion dur="16s" repeatCount="indefinite" path="M-80,180 C320,340 540,760 940,580 C1200,460 1340,680 1540,640" />
          </circle>
          <circle r="15" fill="#10B981" opacity="0.3">
            <animateMotion dur="16s" repeatCount="indefinite" path="M-80,180 C320,340 540,760 940,580 C1200,460 1340,680 1540,640" />
          </circle>
        </g>

        {/* MOVING SHUTTLE 3 (Purple Executive Link S03) */}
        <g filter="url(#neonGlow)">
          <circle r="6" fill="#8B5CF6">
            <animateMotion dur="14s" repeatCount="indefinite" path="M100,920 C350,550 650,750 950,250 C1150,150 1300,320 1550,220" />
          </circle>
          <circle r="14" fill="#8B5CF6" opacity="0.35">
            <animateMotion dur="14s" repeatCount="indefinite" path="M100,920 C350,550 650,750 950,250 C1150,150 1300,320 1550,220" />
          </circle>
        </g>

        {/* Hub Waypoints & Transit Stations */}
        <g>
          {/* Station 1: Central Terminal */}
          <circle cx="310" cy="445" r="7" fill="#2563EB" />
          <circle cx="310" cy="445" r="18" fill="none" stroke="#2563EB" strokeWidth="2.5" opacity="0.5" className="animate-ping" style={{ transformOrigin: '310px 445px' }} />

          {/* Station 2: Business Park Station */}
          <circle cx="1115" cy="315" r="7" fill="#10B981" />
          <circle cx="1115" cy="315" r="18" fill="none" stroke="#10B981" strokeWidth="2.5" opacity="0.5" className="animate-ping" style={{ transformOrigin: '1115px 315px' }} />

          {/* Station 3: Metro Interchange */}
          <circle cx="940" cy="580" r="6" fill="#0EA5E9" />
          <circle cx="760" cy="340" r="6" fill="#8B5CF6" />
        </g>
      </svg>

      {/* 5. Floating Modern Transit Telemetry Cards in Background (Desktop) */}
      {/* Top-Left Floating Card */}
      <div className="hidden lg:flex absolute top-20 left-10 items-center gap-3.5 p-3.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-2xl animate-float-slow pointer-events-none">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-blue-500 text-white flex items-center justify-center font-black text-xs shadow-md">
          S01
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-navy-900 dark:text-white">Rapid Transit Shuttle</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              ● Active
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Express Corridor • <strong className="text-brand-500">ETA 4 mins</strong>
          </p>
        </div>
      </div>

      {/* Bottom-Left Floating Card */}
      <div className="hidden lg:flex absolute bottom-20 left-12 items-center gap-3 p-3.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-2xl animate-float-delayed pointer-events-none">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-sm">
          <Radio className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <p className="text-xs font-bold text-navy-900 dark:text-white">Live GPS Telemetry</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Sub-second WebSocket sync</p>
        </div>
      </div>

      {/* Top-Right Floating Card */}
      <div className="hidden lg:flex absolute top-24 right-12 items-center gap-3 p-3.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-2xl animate-float-alt pointer-events-none">
        <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-brand-500 flex items-center justify-center shadow-sm">
          <MapPin className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-bold text-navy-900 dark:text-white">Multi-Zone Network</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Central Hub ➔ Business Park ➔ Station</p>
        </div>
      </div>

      {/* Bottom-Right Floating Card */}
      <div className="hidden lg:flex absolute bottom-20 right-10 items-center gap-3 p-3.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 shadow-2xl animate-float-slow pointer-events-none">
        <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-sm">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-bold text-navy-900 dark:text-white">Predictive Arrival Engine</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">99.8% precision transit intelligence</p>
        </div>
      </div>

      {/* =====================================================================
          TOP HEADER BAR (BRAND EMBLEM + THEME TOGGLE)
         ===================================================================== */}
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-blue-500 text-white flex items-center justify-center shadow-md shadow-brand-500/25">
            <Bus className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-black tracking-tight text-navy-900 dark:text-white leading-tight">
              Shuttle <span className="text-brand-500">Tracker</span>
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Smart Transit OS
            </span>
          </div>
        </div>

        {/* Dark / Light Mode Switcher */}
        <button
          onClick={toggleDarkMode}
          className="px-3.5 py-2 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-brand-500 shadow-sm transition-all flex items-center gap-2 text-xs font-bold"
          title="Toggle Dark / Light Theme"
        >
          {darkMode ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-brand-600" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
      </header>

      {/* =====================================================================
          MAIN CENTERPIECE: SHUTTLE TRACKER LOGO + INDUSTRY TEXT + GET STARTED
         ===================================================================== */}
      <main className="max-w-2xl w-full mx-auto my-auto text-center space-y-7 relative z-10 px-4">
        {/* Animated Shuttle Tracker Logo Emblem */}
        <div className="inline-flex flex-col items-center">
          <div className="relative group cursor-pointer">
            {/* Glowing Aura Ring */}
            <div className="absolute -inset-3 rounded-3xl bg-gradient-to-r from-brand-600 via-sky-400 to-emerald-400 opacity-40 blur-xl group-hover:opacity-75 transition duration-500" />

            <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-brand-600 via-blue-500 to-sky-400 p-[2.5px] shadow-2xl shadow-brand-500/35">
              <div className="w-full h-full bg-white dark:bg-slate-900 rounded-[21px] flex items-center justify-center">
                <Bus className="w-10 h-10 text-brand-500 stroke-[2.2]" />
              </div>
            </div>

            {/* Live Pulsing Beacon Status */}
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white dark:border-slate-900" />
            </span>
          </div>

          {/* Industry Platform Badge */}
          <div className="mt-5 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 shadow-sm text-xs font-bold text-brand-600 dark:text-accent-blue">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Universal Fleet Mobility Platform</span>
          </div>
        </div>

        {/* Hero Title & Universal Transit Headline */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-navy-900 dark:text-white leading-[1.1]">
            Shuttle{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 via-blue-500 to-sky-400">
              Tracker
            </span>
          </h1>

          <p className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-300 max-w-xl mx-auto leading-relaxed font-medium">
            Real-time fleet tracking and passenger mobility system engineered for corporate facilities, airports, tech corridors, healthcare networks, and industrial transit operations.
          </p>
        </div>

        {/* Universal Transit Capabilities */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/85 dark:bg-slate-900/85 border border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-sm">
            <Navigation className="w-3.5 h-3.5 text-brand-500" />
            <span>Live GPS Radar</span>
          </div>
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/85 dark:bg-slate-900/85 border border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-sm">
            <Clock className="w-3.5 h-3.5 text-emerald-500" />
            <span>Dynamic Stop ETAs</span>
          </div>
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/85 dark:bg-slate-900/85 border border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-sm">
            <Bell className="w-3.5 h-3.5 text-amber-500" />
            <span>Instant Transit Alerts</span>
          </div>
        </div>

        {/* GET STARTED CTA BUTTON -> GOES TO /login */}
        <div className="pt-3">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-brand-600 via-blue-600 to-sky-500 text-white font-black text-base shadow-xl shadow-brand-500/30 hover:shadow-2xl hover:shadow-brand-500/45 hover:scale-[1.03] active:scale-[0.98] transition-all duration-200"
          >
            <span>Get Started</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
          </button>
        </div>
      </main>

      {/* =====================================================================
          MINIMAL FOOTER
         ===================================================================== */}
      <footer className="w-full max-w-6xl mx-auto flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 relative z-10">
        <span>© Shuttle Tracker • Universal Fleet Mobility System</span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live Telemetry Connected
        </span>
      </footer>
    </div>
  );
};

export default LandingPage;
