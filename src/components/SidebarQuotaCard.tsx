import React from 'react';
import {
  Zap,
  ArrowRight,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarQuotaCardProps {
  isCollapsed?: boolean;
  onOpenAuthModal?: () => void;
  onOpenPricingModal?: () => void;
  onOpenProfileDropdown?: () => void;
}

// Ultra-Luxurious 3D Specular Metallic Crown (Matching Reference Style)
const SilverCrownIcon = () => (
  <div className="relative inline-flex items-center justify-center p-1">
    <svg
      className="w-11 h-11 drop-shadow-[0_8px_16px_rgba(0,0,0,0.12)] transition-transform hover:scale-105 shrink-0"
      viewBox="0 0 54 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="silverCrownBase" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="25%" stopColor="#f1f5f9" />
          <stop offset="55%" stopColor="#cbd5e1" />
          <stop offset="85%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
        <linearGradient id="silverCrownRim" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="50%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
        <linearGradient id="silverSpecularHighlight" x1="15%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="35%" stopColor="#ffffff" stopOpacity="0.3" />
          <stop offset="70%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <filter id="softGleam" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <path
        d="M7 34L4 14L16 22L27 8L38 22L50 14L47 34H7Z"
        fill="url(#silverCrownBase)"
        stroke="#94a3b8"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M7 34L4 14L16 22L27 8L38 22L50 14L47 34H7Z"
        fill="url(#silverSpecularHighlight)"
        filter="url(#softGleam)"
      />
      <rect
        x="7"
        y="34"
        width="40"
        height="6"
        rx="2"
        fill="url(#silverCrownRim)"
        stroke="#64748b"
        strokeWidth="1"
      />
      <circle cx="4" cy="13" r="3" fill="#ffffff" stroke="#94a3b8" strokeWidth="1" />
      <circle cx="27" cy="7" r="3.5" fill="#ffffff" stroke="#94a3b8" strokeWidth="1" />
      <circle cx="50" cy="13" r="3" fill="#ffffff" stroke="#94a3b8" strokeWidth="1" />
    </svg>
  </div>
);

// Minimalist 8-Petal Star Flower Emblem (Matching Reference Style)
const FlowerEmblem = () => (
  <div className="w-6 h-6 rounded-full bg-slate-100/90 dark:bg-slate-800/90 flex items-center justify-center text-slate-800 dark:text-slate-100 shadow-2xs shrink-0 border border-slate-200/60 dark:border-slate-700/60">
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="4.5" r="2.8" />
      <circle cx="12" cy="19.5" r="2.8" />
      <circle cx="4.5" cy="12" r="2.8" />
      <circle cx="19.5" cy="12" r="2.8" />
      <circle cx="6.7" cy="6.7" r="2.4" />
      <circle cx="17.3" cy="6.7" r="2.4" />
      <circle cx="6.7" cy="17.3" r="2.4" />
      <circle cx="17.3" cy="17.3" r="2.4" />
      <circle cx="12" cy="12" r="2.8" />
    </svg>
  </div>
);

export const SidebarQuotaCard: React.FC<SidebarQuotaCardProps> = ({
  isCollapsed = false,
  onOpenAuthModal,
  onOpenPricingModal,
  onOpenProfileDropdown
}) => {
  const { userTier, dailyUsage } = useAuth();

  const sendsUsed = dailyUsage?.sendOperations || 0;
  const maxQuota = userTier === 'guest' ? 5 : userTier === 'free' ? 15 : Infinity;
  const pctUsed = userTier === 'pro' ? 100 : Math.min(100, Math.round((sendsUsed / maxQuota) * 100));

  // ==========================================
  // CASE 0: COLLAPSED SIDEBAR (w-16)
  // ==========================================
  if (isCollapsed) {
    if (userTier === 'pro') {
      return (
        <button
          type="button"
          onClick={onOpenProfileDropdown || onOpenPricingModal}
          className="w-full flex justify-center p-2.5 rounded-2xl bg-emerald-500 text-white shadow-sm hover:scale-105 transition-all cursor-pointer"
          title="PRO Member (Unlimited Beams Active)"
        >
          <Zap className="w-4 h-4 fill-white" />
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={userTier === 'guest' ? onOpenAuthModal : onOpenPricingModal}
        className="w-full flex flex-col items-center justify-center p-2 rounded-2xl backdrop-blur-2xl bg-white/80 dark:bg-slate-900/80 border border-white/50 dark:border-white/10 shadow-[0_10px_25px_rgba(0,0,0,0.06)] text-slate-800 dark:text-slate-100 hover:shadow-md transition-all cursor-pointer group"
        title={
          userTier === 'guest'
            ? `Guest Quota: ${sendsUsed}/5 used. Click to unlock 15 Beams Free!`
            : `Free Account: ${sendsUsed}/15 used. Click to get Pro $4/mo!`
        }
      >
        <span className="text-[10px] font-mono font-black text-slate-900 dark:text-white">
          {sendsUsed}/{maxQuota}
        </span>
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              sendsUsed >= maxQuota
                ? 'bg-rose-500'
                : userTier === 'guest'
                ? 'bg-slate-900 dark:bg-white'
                : 'bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-500'
            }`}
            style={{ width: `${pctUsed}%` }}
          />
        </div>
      </button>
    );
  }

  // ==========================================
  // CASE D: PRO SUBSCRIBER STATE
  // ==========================================
  if (userTier === 'pro') {
    return (
      <div className="backdrop-blur-2xl bg-white/80 dark:bg-slate-900/80 rounded-3xl p-4 sm:p-5 border border-emerald-200/80 dark:border-emerald-800/60 shadow-[0_20px_48px_rgba(16,185,129,0.08)] transition-all duration-300 relative overflow-hidden">
        {/* Specular Top Edge Highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 dark:via-white/20 to-transparent pointer-events-none" />
        {/* Subtle emerald shimmer background */}
        <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none -mr-8 -mt-8" />

        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-sm shadow-emerald-500/25">
            <Zap className="w-4 h-4 fill-white" />
          </div>
          <span className="bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider rounded-md px-2 py-0.5 shadow-2xs">
            ACTIVE PRO
          </span>
        </div>

        <div className="space-y-1 mb-3 relative z-10">
          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
            <span>BeamDrop PRO</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
            Active Unlimited Membership. Zero daily bandwidth caps.
          </p>
        </div>

        <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100/80 dark:border-emerald-900/50 rounded-2xl p-2.5 mb-3 flex items-center justify-between text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
          <span>Today's Beams</span>
          <span className="font-mono font-bold text-emerald-900 dark:text-emerald-200">
            {sendsUsed} transferred
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenProfileDropdown || onOpenPricingModal}
          className="w-full py-2.5 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-white text-xs font-semibold tracking-wide shadow-sm hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center space-x-1.5"
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Membership Settings</span>
        </button>
      </div>
    );
  }

  // ==========================================
  // CASE C: FREE MEMBER STATE (Pro Upgrade Hook)
  // ==========================================
  if (userTier === 'free') {
    return (
      <div className="backdrop-blur-2xl bg-white/80 dark:bg-slate-900/80 rounded-3xl p-4 sm:p-5 border border-white/60 dark:border-white/10 shadow-[0_20px_48px_rgba(0,0,0,0.07)] transition-all duration-300 relative overflow-hidden">
        {/* Specular Top Edge Highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 dark:via-white/20 to-transparent pointer-events-none" />

        {/* Top Row: Flower Emblem & MOST POPULAR badge */}
        <div className="flex items-center justify-between mb-2.5">
          <FlowerEmblem />
          <span className="bg-slate-950 dark:bg-white text-white dark:text-slate-950 text-[9px] font-black uppercase tracking-wider rounded-md px-2 py-0.5 shadow-2xs">
            MOST POPULAR
          </span>
        </div>

        {/* Heading & Subtitle */}
        <div className="mb-3">
          <h4 className="text-[15px] font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
            Professional+
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-1">
            Get full access to all unlimited transfers &amp; creative tools.
          </p>
        </div>

        {/* Pricing Display */}
        <div className="flex items-baseline space-x-2 mb-3 pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
          <span className="text-sm font-semibold text-slate-400 line-through">
            $12
          </span>
          <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            $4
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            /month*
          </span>
        </div>

        {/* Features List with delicate '+' */}
        <ul className="space-y-1.5 mb-3.5 text-[11px] text-slate-600 dark:text-slate-300 font-medium">
          <li className="flex items-center space-x-1.5">
            <span className="text-slate-900 dark:text-white font-bold text-xs leading-none">+</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">Unlimited Beams &amp; transfers</span>
          </li>
          <li className="flex items-center space-x-1.5">
            <span className="text-slate-900 dark:text-white font-bold text-xs leading-none">+</span>
            <span>Ultra-fast LAN P2P priority</span>
          </li>
          <li className="flex items-center space-x-1.5">
            <span className="text-slate-900 dark:text-white font-bold text-xs leading-none">+</span>
            <span>100MB Cloud transit fallback</span>
          </li>
        </ul>

        {/* Action Button: Pink/Fuchsia SaaS Gradient Pill */}
        <button
          type="button"
          onClick={onOpenPricingModal}
          className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:opacity-95 text-white font-bold text-xs tracking-wide shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center space-x-1.5"
        >
          <Zap className="w-3.5 h-3.5 fill-white text-white shrink-0" />
          <span>Get BeamDrop+ ($4/mo)</span>
        </button>

        {/* Legal micro note */}
        <p className="text-[9px] text-slate-400 dark:text-slate-500 text-center mt-2 font-medium">
          Renews automatically. Cancel anytime.
        </p>
      </div>
    );
  }

  // ==========================================
  // CASE B: GUEST STATE (Free Conversion Hook)
  // ==========================================
  return (
    <div className="backdrop-blur-2xl bg-white/80 dark:bg-slate-900/80 rounded-3xl p-4 sm:p-5 border border-white/60 dark:border-white/10 shadow-[0_20px_48px_rgba(0,0,0,0.07)] transition-all duration-300 relative overflow-hidden flex flex-col items-center text-center">
      {/* Specular Top Edge Highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 dark:via-white/20 to-transparent pointer-events-none" />

      {/* 3D Silver Metallic Crown */}
      <div className="my-0.5">
        <SilverCrownIcon />
      </div>

      {/* Black Micro-badge */}
      <span className="bg-slate-950 dark:bg-white text-white dark:text-slate-950 text-[9px] font-black uppercase tracking-wider rounded-md px-2.5 py-0.5 mt-2 shadow-2xs">
        LIMITED OFFER
      </span>

      {/* Title */}
      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight mt-2.5">
        Get 15 daily beams for free &amp; save up to 75%
      </h4>

      {/* Subtitle */}
      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-1.5 px-0.5">
        Create a free account to triple your daily quota instantly.
      </p>

      {/* Micro Progress Tracker */}
      <div className="w-full mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 text-left">
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="font-semibold text-slate-600 dark:text-slate-400">
            Guest Quota
          </span>
          <span className="font-mono font-bold text-slate-900 dark:text-white">
            {sendsUsed} / 5
          </span>
        </div>
        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              sendsUsed >= 5
                ? 'bg-rose-500'
                : 'bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 dark:from-white dark:to-slate-300'
            }`}
            style={{ width: `${pctUsed}%` }}
          />
        </div>
      </div>

      {/* Action Button: Rounded Pill */}
      <button
        type="button"
        onClick={onOpenAuthModal}
        className="w-full mt-3 py-3 px-4 rounded-2xl bg-slate-950 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 text-white font-semibold text-xs tracking-wide shadow-md hover:scale-[1.01] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center space-x-1.5"
      >
        <span>Unlock 15 Beams Free</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
