import React, { useRef, useEffect } from 'react';
import {
  CreditCard,
  Settings,
  HelpCircle,
  LogOut,
  Zap,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ProfileDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProfile: () => void;
  onOpenPricing: () => void;
  onOpenSettings?: () => void;
  anchorClassName?: string;
}

export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({
  isOpen,
  onClose,
  onOpenProfile,
  onOpenPricing,
  onOpenSettings,
  anchorClassName = 'bottom-16 left-3'
}) => {
  const { userProfile, currentUser, signOutUser, userTier, dailyUsage } = useAuth();
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const displayName = userProfile?.fullName || currentUser?.displayName || 'BeamDrop User';
  const displayEmail = userProfile?.email || currentUser?.email || 'user@beamdrop.app';
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = async () => {
    await signOutUser();
    onClose();
  };

  const sends = dailyUsage?.sendOperations || 0;

  return (
    <div
      ref={dropdownRef}
      className={`absolute z-50 w-72 backdrop-blur-2xl bg-white/90 dark:bg-slate-900/90 rounded-3xl p-3 shadow-[0_24px_54px_rgba(0,0,0,0.16)] border border-white/60 dark:border-white/10 animate-fade-in relative overflow-hidden ${anchorClassName}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Specular Top Edge Highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 dark:via-white/20 to-transparent pointer-events-none" />

      {/* Header Profile Identity */}
      <div className="flex items-center justify-between p-2.5 pb-2">
        <div className="min-w-0 pr-2">
          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate tracking-tight">
            {displayName}
          </h4>
          <p className="text-xs text-slate-400 font-medium truncate mt-0.5">
            {displayEmail}
          </p>
        </div>

        {/* Avatar with Specular Rainbow Gradient Ring */}
        <div className="relative shrink-0">
          <div className="w-11 h-11 rounded-full p-[2px] bg-gradient-to-tr from-pink-500 via-amber-400 to-sky-400 shadow-sm">
            <div className="w-full h-full rounded-full bg-sky-500 overflow-hidden flex items-center justify-center text-white font-bold text-sm">
              {userProfile?.photoURL ? (
                <img
                  src={userProfile.photoURL}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>
          </div>
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
        </div>
      </div>

      <div className="h-px bg-slate-100 dark:bg-slate-800/80 my-1" />

      {/* Menu Actions List (Pure SVG icons) */}
      <div className="space-y-0.5 pt-1">
        {/* Profile */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenProfile();
          }}
          className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group text-left"
        >
          <div className="w-5 h-5 rounded-lg flex items-center justify-center text-slate-800 dark:text-slate-200">
            <CheckCircle2 className="w-4 h-4 fill-slate-900 dark:fill-white text-white dark:text-slate-900" />
          </div>
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex-1">
            Profile
          </span>
        </button>

        {/* Subscription with Specular PRO Badge */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenPricing();
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 flex items-center justify-center text-slate-700 dark:text-slate-300">
              <CreditCard className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Subscription
            </span>
          </div>

          {userTier === 'pro' ? (
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-[10px] font-black tracking-wide flex items-center space-x-0.5 border border-emerald-300 dark:border-emerald-700/60 shadow-2xs">
              <Zap className="w-2.5 h-2.5 fill-emerald-700 dark:fill-emerald-400 text-emerald-700 dark:text-emerald-400" />
              <span>PRO</span>
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 text-[10px] font-bold border border-sky-200 dark:border-sky-800/60">
              FREE ({sends}/15)
            </span>
          )}
        </button>

        {/* Settings */}
        <button
          type="button"
          onClick={() => {
            onClose();
            if (onOpenSettings) onOpenSettings();
          }}
          className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors cursor-pointer text-left"
        >
          <div className="w-5 h-5 flex items-center justify-center text-slate-700 dark:text-slate-300">
            <Settings className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Settings &amp; Extensions
          </span>
        </button>
      </div>

      <div className="h-px bg-slate-100 dark:bg-slate-800/80 my-1" />

      {/* Footer Items */}
      <div className="space-y-0.5">
        <a
          href="https://github.com/raouf-djmilo/BeamDrop"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors cursor-pointer text-slate-600 dark:text-slate-400 text-left"
        >
          <HelpCircle className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 flex-1">Help Center</span>
          <ExternalLink className="w-3 h-3 text-slate-400" />
        </a>

        {/* Sign out */}
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer text-left font-medium text-xs"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
};
