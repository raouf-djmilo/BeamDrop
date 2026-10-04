import React, { useState } from 'react';
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
  Sparkles,
  CreditCard,
  ExternalLink,
  Key,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Smartphone
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatBytes } from '../utils/formatters';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { userProfile, currentUser, signOutUser, transfersHistory, dailyUsage, plan, updateUserPassword } = useAuth();

  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  if (!isOpen || !currentUser) return null;

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match. Please re-enter.');
      return;
    }

    try {
      setPasswordLoading(true);
      await updateUserPassword(newPassword);
      setPasswordSuccess('Password saved! You can now log into iOS Shortcuts (BDrop), Chrome Extension, and Web App using this password and your username or email.');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(''), 7000);
    } catch (err: any) {
      if (err.message && err.message.includes('requires-recent-login')) {
        setPasswordError('For security reasons, please sign out and sign in again before changing your password.');
      } else {
        setPasswordError(err.message || 'Failed to update password.');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

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
        className="relative w-full max-w-lg bg-white/95 backdrop-blur-2xl rounded-3xl p-6 sm:p-7 shadow-2xl border border-sky-200/90 z-10 animate-fade-in max-h-[90vh] flex flex-col overflow-y-auto"
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

        {/* Manage PayPal Subscription (for PRO members) */}
        {plan === 'pro' && (
          <a
            href="https://www.paypal.com/myaccount/autopay/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 text-xs font-semibold text-emerald-900 hover:bg-emerald-100/70 transition-colors my-1"
          >
            <div className="flex items-center space-x-2.5">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>Manage or Cancel PayPal Subscription</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
          </a>
        )}

        {/* Multi-Device Password Management Card */}
        <div className="my-2 rounded-2xl border border-sky-200/90 bg-gradient-to-br from-sky-50/70 via-white to-blue-50/50 p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>Multi-Device Password</span>
                  <span className="text-[9px] font-semibold bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded-full">
                    Shortcuts &amp; Extension
                  </span>
                </h4>
                <p className="text-[10px] text-slate-500">
                  Set or change password to login via Username (@{userProfile?.username || 'user'}) or Gmail
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowPasswordSection(!showPasswordSection);
                setPasswordError('');
                setPasswordSuccess('');
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-sky-50 border border-sky-200 text-sky-700 text-[11px] font-bold transition-colors flex items-center space-x-1 cursor-pointer"
            >
              <span>{showPasswordSection ? 'Close' : 'Change Password'}</span>
              {showPasswordSection ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {showPasswordSection && (
            <form onSubmit={handleUpdatePassword} className="mt-3 pt-3 border-t border-sky-100 space-y-2.5 animate-fade-in">
              <div className="p-2.5 rounded-xl bg-sky-100/50 border border-sky-200/70 text-[10.5px] text-sky-900 flex items-start space-x-2">
                <Smartphone className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                <span>
                  After saving, you can enter <strong>@{userProfile?.username || 'username'}</strong> or <strong>{userProfile?.email || currentUser.email}</strong> with this password in your <strong>iOS Shortcut</strong>, <strong>Chrome Extension</strong>, and <strong>Web App</strong>.
                </span>
              </div>

              {passwordError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-center space-x-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswordText ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      required
                      minLength={6}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500 pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordText(!showPasswordText)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPasswordText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type={showPasswordText ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    required
                    minLength={6}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-xs transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{passwordLoading ? 'Saving Password...' : 'Save & Update Password'}</span>
                </button>
              </div>
            </form>
          )}
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
