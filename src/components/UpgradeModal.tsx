import React from 'react';
import {
  X,
  Zap,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Crown,
  FileCheck,
  Send,
  Download,
  QrCode,
  Radio
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerReason?: string;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  triggerReason
}) => {
  const { userProfile, dailyUsage, currentUser } = useAuth();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-white/95 backdrop-blur-2xl rounded-3xl p-6 sm:p-7 shadow-2xl border border-amber-200/90 z-10 animate-fade-in max-h-[92vh] overflow-y-auto"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Crown & Title */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 via-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25 shrink-0 text-white">
            <Crown className="w-5 h-5 fill-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-black text-slate-900 tracking-tight leading-none">
                BeamDrop PRO
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                $5 / Month
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              Unlimited high-velocity P2P beams & maximum cloud bandwidth
            </p>
          </div>
        </div>

        {/* Reason banner if triggered by quota exceed */}
        {triggerReason && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start space-x-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span className="leading-tight font-medium">{triggerReason}</span>
          </div>
        )}

        {/* Today's Usage Snapshot */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 mb-5 text-center">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Sends Today</span>
            <span className="text-sm font-black text-slate-800">
              {dailyUsage.sendOperations} / 5
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Receives Today</span>
            <span className="text-sm font-black text-slate-800">
              {dailyUsage.receiveOperations} / 5
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">QR Scans</span>
            <span className="text-sm font-black text-slate-800">
              {dailyUsage.qrScansCount} / 10
            </span>
          </div>
        </div>

        {/* Plan Comparison Table */}
        <div className="border border-sky-100 rounded-2xl overflow-hidden mb-5 text-xs shadow-2xs">
          <div className="grid grid-cols-3 bg-sky-50/80 p-2.5 font-bold text-slate-700 border-b border-sky-100">
            <div>Feature</div>
            <div className="text-center">Free Tier</div>
            <div className="text-center text-amber-700 flex items-center justify-center space-x-1">
              <Crown className="w-3 h-3 fill-amber-500 text-amber-500" />
              <span>PRO Plan</span>
            </div>
          </div>

          <div className="divide-y divide-slate-100 text-[11px]">
            <div className="grid grid-cols-3 p-2.5 items-center hover:bg-slate-50/70">
              <div className="flex items-center space-x-1.5 font-medium text-slate-800">
                <Send className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>Daily Sends</span>
              </div>
              <div className="text-center text-slate-500">5 / day</div>
              <div className="text-center font-bold text-emerald-600">Unlimited ⚡</div>
            </div>

            <div className="grid grid-cols-3 p-2.5 items-center hover:bg-slate-50/70">
              <div className="flex items-center space-x-1.5 font-medium text-slate-800">
                <Download className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Daily Receives</span>
              </div>
              <div className="text-center text-slate-500">5 / day</div>
              <div className="text-center font-bold text-emerald-600">Unlimited ⚡</div>
            </div>

            <div className="grid grid-cols-3 p-2.5 items-center hover:bg-slate-50/70">
              <div className="flex items-center space-x-1.5 font-medium text-slate-800">
                <QrCode className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>QR Scans / Links</span>
              </div>
              <div className="text-center text-slate-500">10 / day</div>
              <div className="text-center font-bold text-emerald-600">Unlimited ⚡</div>
            </div>

            <div className="grid grid-cols-3 p-2.5 items-center hover:bg-slate-50/70">
              <div className="flex items-center space-x-1.5 font-medium text-slate-800">
                <FileCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Transit Cloud Limit</span>
              </div>
              <div className="text-center text-slate-500">25 MB</div>
              <div className="text-center font-bold text-amber-700">100 MB (P2P ∞)</div>
            </div>

            <div className="grid grid-cols-3 p-2.5 items-center hover:bg-slate-50/70">
              <div className="flex items-center space-x-1.5 font-medium text-slate-800">
                <Radio className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span>Local Radar & Mesh</span>
              </div>
              <div className="text-center text-slate-500">Standard</div>
              <div className="text-center font-bold text-purple-700">Ultra Priority</div>
            </div>
          </div>
        </div>

        {/* Upgrade Action CTA */}
        <div className="space-y-2">
          <a
            href="https://lemonsqueezy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs shadow-lg shadow-amber-500/25 flex items-center justify-center space-x-2 transition-all cursor-pointer active:scale-[0.99]"
          >
            <Crown className="w-4 h-4 fill-white" />
            <span>Upgrade to PRO - $5 / Month</span>
            <ArrowRight className="w-4 h-4" />
          </a>

          <p className="text-center text-[10px] text-slate-400">
            Cancel anytime • Instant activation across Web & Extension
          </p>
        </div>
      </div>
    </div>
  );
};
