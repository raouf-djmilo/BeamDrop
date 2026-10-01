import React from 'react';
import {
  Lock,
  Crown,
  Zap,
  Radio,
  Building2,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Wifi,
  Users,
  Code2,
  Layers,
  CheckCircle2
} from 'lucide-react';
import { MainTab } from './Sidebar';

interface LockedFeatureViewProps {
  featureId: 'radar' | 'workspaces' | 'notebook' | MainTab;
  onUpgrade: () => void;
}

interface FeatureMeta {
  title: string;
  badge: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  glowColor: string;
  highlights: Array<{
    title: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
}

const FEATURE_DATA: Record<string, FeatureMeta> = {
  radar: {
    title: 'Autonomous Peer Radar & Spatial Discovery',
    badge: 'PRO EXCLUSIVE FEATURE',
    subtitle:
      'Continuous local area hotspot scanning. Discover nearby phones, laptops and tablets automatically without QR codes, PINs, or pairing steps.',
    icon: Radio,
    accentColor: 'from-blue-600 via-indigo-600 to-cyan-500',
    glowColor: 'bg-indigo-500/20',
    highlights: [
      {
        title: 'Zero-Click Spatial Discovery',
        desc: 'Autonomous background beacons instantly detect devices on your local Wi-Fi or hotspot.',
        icon: Wifi
      },
      {
        title: 'Direct Point-and-Beam',
        desc: 'Select any radar blip to beam unlimited multi-gigabyte files directly at LAN wire speed.',
        icon: Zap
      },
      {
        title: 'Full Offline / Hotspot Support',
        desc: 'Operates 100% locally when no external internet connection or cell service is available.',
        icon: ShieldCheck
      }
    ]
  },
  workspaces: {
    title: 'Multi-Device Collaborative Workspaces',
    badge: 'PRO EXCLUSIVE FEATURE',
    subtitle:
      'Persistent virtual rooms for seamless team sync. Share files, media, and notes across all your devices simultaneously in real time.',
    icon: Building2,
    accentColor: 'from-indigo-600 via-purple-600 to-sky-500',
    glowColor: 'bg-purple-500/20',
    highlights: [
      {
        title: 'Multi-Peer Mesh Swarm',
        desc: 'Every room participant acts as a peer in a decentralized zero-bandwidth mesh network.',
        icon: Users
      },
      {
        title: 'End-to-End Encrypted Rooms',
        desc: 'Military-grade AES-256 room passkeys guarantee that only invited members can read files.',
        icon: ShieldCheck
      },
      {
        title: 'Simultaneous Multi-Drop',
        desc: 'Drop a file once and broadcast it to 10+ connected devices in parallel with zero cloud delay.',
        icon: Layers
      }
    ]
  },
  notebook: {
    title: 'Encrypted Cloud Clipboard & Code Vault',
    badge: 'PRO EXCLUSIVE FEATURE',
    subtitle:
      'Instant cross-device clipboard sync, formatted Markdown documentation, and syntax-highlighted code snippets accessible from anywhere.',
    icon: BookOpen,
    accentColor: 'from-cyan-600 via-sky-600 to-blue-600',
    glowColor: 'bg-cyan-500/20',
    highlights: [
      {
        title: '50+ Language Code Highlighting',
        desc: 'Built-in syntax formatting for TypeScript, Python, JSON, Rust, Go, and more.',
        icon: Code2
      },
      {
        title: 'Instant Cross-Device Clipboard',
        desc: 'Copy text on your desktop and paste it on your mobile phone in under 200 milliseconds.',
        icon: Sparkles
      },
      {
        title: 'Offline Vault Storage',
        desc: 'Your notes and snippets remain securely cached in your browser and Chrome extension.',
        icon: CheckCircle2
      }
    ]
  }
};

export const LockedFeatureView: React.FC<LockedFeatureViewProps> = ({
  featureId,
  onUpgrade
}) => {
  const meta = FEATURE_DATA[featureId] || FEATURE_DATA.radar;
  const FeatureIcon = meta.icon;

  return (
    <div className="relative w-full max-w-4xl mx-auto py-4 sm:py-8 px-2 flex flex-col items-center justify-center">
      {/* Dynamic Specular Background Glow */}
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[360px] ${meta.glowColor} rounded-full blur-3xl pointer-events-none -z-10`}
      />

      {/* Main Apple Liquid Glass Card */}
      <div className="relative w-full backdrop-blur-2xl bg-white/80 dark:bg-slate-900/80 rounded-[32px] p-6 sm:p-10 border border-white/80 dark:border-white/10 shadow-[0_24px_64px_rgba(2,132,199,0.12)] text-center overflow-hidden">
        {/* Specular Top Edge Shimmer */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/80 to-transparent pointer-events-none" />

        {/* Top 3D Metallic Lock Badge */}
        <div className="inline-flex items-center justify-center mb-4 relative">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-slate-900 via-sky-900 to-slate-950 p-[2px] shadow-xl shadow-sky-500/20 relative group">
            {/* Animated Glow Aura */}
            <div className="absolute -inset-1 bg-gradient-to-r from-sky-500 to-indigo-500 rounded-3xl blur-md opacity-40 group-hover:opacity-75 transition-opacity" />
            <div className="relative w-full h-full bg-slate-950 rounded-3xl flex items-center justify-center text-white">
              <Lock className="w-7 h-7 sm:w-8 sm:h-8 text-sky-400 stroke-[2.2]" />
            </div>
          </div>

          <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-tr from-amber-400 to-amber-600 flex items-center justify-center text-white shadow-md">
            <Crown className="w-4 h-4 fill-white" />
          </div>
        </div>

        {/* Micro Pro Badge */}
        <div className="flex items-center justify-center mb-3">
          <span className="px-3 py-1 rounded-full bg-slate-950 dark:bg-white text-white dark:text-slate-950 text-[10px] font-black uppercase tracking-widest shadow-2xs flex items-center space-x-1.5">
            <Sparkles className="w-3 h-3 text-sky-400 fill-sky-400" />
            <span>{meta.badge}</span>
          </span>
        </div>

        {/* Title & Subtitle */}
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight max-w-xl mx-auto">
          {meta.title}
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-lg mx-auto leading-relaxed">
          {meta.subtitle}
        </p>

        {/* 3-Column Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 my-6 sm:my-8 text-left max-w-2xl mx-auto">
          {meta.highlights.map((h, i) => {
            const Icon = h.icon;
            return (
              <div
                key={i}
                className="p-4 rounded-2xl bg-sky-50/60 dark:bg-slate-800/60 border border-sky-100 dark:border-slate-700/60 hover:border-sky-300 transition-colors space-y-1.5"
              >
                <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center text-sky-600 shadow-2xs">
                  <Icon className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                  {h.title}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  {h.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Action Button: Luxury Electric Gradient Pill */}
        <div className="flex flex-col items-center justify-center space-y-3 pt-1">
          <button
            type="button"
            onClick={onUpgrade}
            className={`w-full max-w-sm py-3.5 px-6 rounded-2xl bg-gradient-to-r ${meta.accentColor} hover:opacity-95 text-white font-extrabold text-sm tracking-wide shadow-lg shadow-sky-500/25 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center space-x-2`}
          >
            <Zap className="w-4 h-4 fill-white" />
            <span>Upgrade to PRO to Unlock ($4/mo)</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
            Instant activation • Unlimited transfers • Cancel anytime in 1 click
          </p>
        </div>
      </div>
    </div>
  );
};
