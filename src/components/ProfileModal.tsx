import React from 'react';
import {
  X,
  User,
  LogOut,
  Mail,
  Calendar,
  AtSign,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  ShieldCheck,
  HardDrive,
  Crown,
  Zap,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatBytes } from '../utils/formatters';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { userProfile, currentUser, signOutUser, transfersHistory, dailyUsage, plan } = useAuth();

  if (!isOpen || !currentUser) return null;

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleSignOut = async () => {
    await signOutUser();
    onClose();
  };

  const memberSince = userProfile?.createdAt
    ? new Date(userProfile.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : 'Active';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-white/95 backdrop-blur-2xl rounded-3xl p-6 sm:p-7 shadow-2xl border border-sky-200/90 z-10 animate-fade-in max-h-[90vh] flex flex-col"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-sky-50 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Profile Header */}
        <div className="flex items-center space-x-4 pb-5 border-b border-sky-100">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-sky-500/25 shrink-0 border-2 border-white">
            {userProfile?.photoURL ? (
              <img
                src={userProfile.photoURL}
                alt={userProfile.fullName}
                className="w-full h-full rounded-2xl object-cover"
              />
            ) : (
              <span>{getInitials(userProfile?.fullName || currentUser.displayName || '')}</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-black text-slate-900 truncate">
                {userProfile?.fullName || currentUser.displayName || 'BeamDrop User'}
              </h3>
              {plan === 'pro' ? (
                <span className="shrink-0 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 shadow-xs">
                  <Crown className="w-3 h-3 fill-white" />
                  <span>PRO</span>
                </span>
              ) : (
                <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold uppercase tracking-wider">
                  FREE
                </span>
              )}
            </div>

            <p className="text-xs text-sky-700 font-mono font-medium truncate">
              @{userProfile?.username || 'user'}
            </p>

            <div className="flex items-center space-x-3 mt-1 text-[11px] text-slate-500 truncate">
              <span className="flex items-center space-x-1 truncate">
                <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{userProfile?.email || currentUser.email}</span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1 shrink-0">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>Joined {memberSince}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Daily Quota / Usage Breakdown */}
        <div className="p-3.5 my-3 rounded-2xl bg-sky-50/70 border border-sky-200/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-700 flex items-center space-x-1">
              <Zap className="w-3.5 h-3.5 text-sky-600" />
              <span>Today's Activity & Limits</span>
            </span>
            {plan === 'pro' ? (
              <span className="text-[10px] font-bold text-amber-700">Unlimited Access</span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('beamdrop:quota_exceeded', {
                    detail: { quota: { reason: 'Upgrade to PRO ($5/month) for unlimited beams and instant priority!' } }
                  }));
                }}
                className="text-[10px] font-bold text-amber-600 hover:text-amber-700 underline cursor-pointer"
              >
                Upgrade to PRO
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 rounded-xl bg-white border border-sky-100 shadow-2xs">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Sends</span>
              <span className="text-xs font-black text-slate-800 flex items-center justify-center gap-1">
                <span>{dailyUsage.sendOperations}</span>
                {plan === 'pro' ? <Zap className="w-3 h-3 fill-emerald-500 text-emerald-500" /> : <span className="text-slate-400 font-normal">/ 15</span>}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-white border border-sky-100 shadow-2xs">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Receives</span>
              <span className="text-xs font-black text-slate-800 flex items-center justify-center gap-1">
                <span>{dailyUsage.receiveOperations}</span>
                {plan === 'pro' ? <Zap className="w-3 h-3 fill-emerald-500 text-emerald-500" /> : <span className="text-slate-400 font-normal">/ 15</span>}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-white border border-sky-100 shadow-2xs">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">QR Scans</span>
              <span className="text-xs font-black text-slate-800 flex items-center justify-center gap-1">
                <span>{dailyUsage.qrScansCount}</span>
                {plan === 'pro' ? <Zap className="w-3 h-3 fill-emerald-500 text-emerald-500" /> : <span className="text-slate-400 font-normal">/ 15</span>}
              </span>
            </div>
          </div>
        </div>

        {/* Aggregate Stats Row */}
        <div className="grid grid-cols-2 gap-3 pb-3">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Transfers
            </span>
            <div className="flex items-center space-x-2 mt-0.5">
              <span className="text-lg font-black text-slate-900">
                {userProfile?.transfersCount || transfersHistory.length || 0}
              </span>
              <span className="text-[9px] text-sky-700 font-semibold bg-sky-50 px-1.5 py-0.5 rounded-full border border-sky-200">
                Beamed
              </span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Data Volume
            </span>
            <div className="flex items-center space-x-2 mt-0.5">
              <span className="text-lg font-black text-slate-900">
                {formatBytes(userProfile?.bytesTransferred || 0)}
              </span>
              <HardDrive className="w-3.5 h-3.5 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Transfers History Section */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-[140px] pt-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700">Recent Account Transfers</span>
            <span className="text-[10px] text-slate-400 font-mono">
              {transfersHistory.length} Recorded
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar">
            {transfersHistory.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200">
                <FileText className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                <p className="text-xs text-slate-500 font-medium">No transfer history yet</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Files you send or receive will appear here automatically.
                </p>
              </div>
            ) : (
              transfersHistory.slice(0, 10).map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-sky-50/60 border border-slate-200/80 transition-colors text-xs"
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                        t.direction === 'sent'
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {t.direction === 'sent' ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="truncate">
                      <p className="font-semibold text-slate-900 truncate leading-tight">
                        {t.fileName}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-[11px] font-semibold text-slate-600 shrink-0 ml-2">
                    {formatBytes(t.fileSize)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 mt-3 border-t border-sky-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
