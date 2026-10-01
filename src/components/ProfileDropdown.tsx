import React, { useRef, useEffect } from 'react';
import {
  User,
  CreditCard,
  Settings,
  HelpCircle,
  LogOut,
  Zap,
  CheckCircle2,
  ChevronRight,
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
      className={`absolute z-50 w-72 bg-white rounded-[22px] p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.14)] border border-slate-100 animate-fade-in ${anchorClassName}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header Profile Identity (Matching image_cc38fb.png) */}
      <div className="flex items-center justify-between p-3 pb-2.5">
        <div className="min-w-0 pr-2">
          <h4 className="text-sm font-extrabold text-slate-900 truncate tracking-tight">
            {displayName}
          </h4>
          <p className="text-xs text-slate-400 font-medium truncate mt-0.5">
            {displayEmail}
          </p>
        </div>

        {/* Avatar with Rainbow Gradient Ring */}
        <div className="relative shrink-0">
          <div className="w-11 h-11 rounded-full p-[2px] bg-gradient-to-tr from-pink-500 via-amber-400 to-sky-400">
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
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
        </div>
      </div>

      <div className="h-[1px] bg-slate-100 my-1" />

      {/* Menu Actions List */}
      <div className="space-y-0.5 pt-1">
        {/* Profile */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenProfile();
          }}
          className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group text-left"
        >
          <div className="w-5 h-5 rounded-lg flex items-center justify-center text-slate-800">
            <CheckCircle2 className="w-4 h-4 fill-slate-900 text-white" />
          </div>
          <span className="text-xs font-semibold text-slate-800 flex-1">
            Profile
          </span>
        </button>

        {/* Subscription with Green PRO Badge */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenPricing();
          }}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 flex items-center justify-center text-slate-700">
              <CreditCard className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-800">
              Subscription
            </span>
          </div>

          {userTier === 'pro' ? (
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black tracking-wide flex items-center space-x-0.5 border border-emerald-300">
              <Zap className="w-2.5 h-2.5 fill-emerald-700 text-emerald-700" />
              <span>PRO</span>
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 text-[10px] font-bold border border-sky-200">
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
          className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer text-left"
        >
          <div className="w-5 h-5 flex items-center justify-center text-slate-700">
            <Settings className="w-4 h-4" />
          </div>
          <span className="text-xs font-semibold text-slate-800">
            Settings & Extensions
          </span>
        </button>
      </div>

      <div className="h-[1px] bg-slate-100 my-1.5" />

      {/* Footer Items */}
      <div className="space-y-0.5">
        <a
          href="https://github.com/raouf-djmilo/BeamDrop"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer text-slate-600 text-left"
        >
          <HelpCircle className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-medium text-slate-700 flex-1">Help Center</span>
          <ExternalLink className="w-3 h-3 text-slate-300" />
        </a>

        {/* Sign out */}
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer text-left font-medium text-xs"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
};
