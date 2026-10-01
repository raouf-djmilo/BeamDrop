import React, { useState } from 'react';
import {
  X,
  Zap,
  Check,
  ShieldCheck,
  Crown,
  Sparkles,
  ArrowRight,
  CreditCard
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerReason?: string;
}

export const PricingModal: React.FC<PricingModalProps> = ({
  isOpen,
  onClose,
  triggerReason
}) => {
  const { userProfile, userTier, activateProSubscription } = useAuth();
  const [billingCycle, setBillingCycle] = useState<'yearly' | 'monthly'>('yearly');
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const price = billingCycle === 'yearly' ? '$4' : '$5';
  const originalPrice = billingCycle === 'yearly' ? '$12' : '$15';

  const handleInstantUnlock = async () => {
    setIsActivating(true);
    try {
      await activateProSubscription();
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsActivating(false);
        onClose();
      }, 1500);
    } catch (_) {
      setIsActivating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
      />

      {/* Modal Dialog (Style matching image_cc438b.png) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm sm:max-w-md bg-white rounded-[28px] p-6 sm:p-7 shadow-2xl border border-slate-100 z-10 animate-fade-in max-h-[92vh] overflow-y-auto"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Reason banner if triggered by quota exceed */}
        {triggerReason && (
          <div className="mb-4 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start space-x-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span className="leading-tight font-medium">{triggerReason}</span>
          </div>
        )}

        {/* Billing Cycle Toggle (Style matching image_cc438b.png) */}
        <div className="flex justify-center mb-5">
          <div className="bg-slate-100/90 p-1 rounded-full flex items-center border border-slate-200/60">
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                billingCycle === 'yearly'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Yearly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                billingCycle === 'monthly'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly
            </button>
          </div>
        </div>

        {/* Card Header & Badge */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 via-amber-400 to-sky-400 p-[2px]">
              <div className="w-full h-full bg-white rounded-2xl flex items-center justify-center">
                <Crown className="w-5 h-5 text-slate-900 fill-slate-900" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none">
                Professional+
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Full high-speed P2P & cloud transit access
              </p>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-full bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider">
            MOST POPULAR
          </span>
        </div>

        {/* Price Display */}
        <div className="py-3 border-b border-slate-100 mb-4">
          <div className="flex items-baseline space-x-2">
            <span className="text-sm font-bold text-slate-400 line-through">
              {originalPrice}
            </span>
            <span className="text-4xl font-black text-slate-900 tracking-tight">
              {price}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              / month*
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {billingCycle === 'yearly'
              ? '* When paid annually, billed upfront $48. Renews automatically. Cancel anytime.'
              : '* Billed monthly. Renews automatically. Cancel anytime.'}
          </p>
        </div>

        {/* Feature List (Style matching image_cc438b.png) */}
        <div className="space-y-2.5 mb-6 text-xs">
          <div className="flex items-center space-x-2 font-medium text-slate-800">
            <span className="font-bold text-sky-600 text-sm leading-none">+</span>
            <span>Unlimited Beams (Send & Receive)</span>
          </div>

          <div className="flex items-center space-x-2 font-medium text-slate-800">
            <span className="font-bold text-sky-600 text-sm leading-none">+</span>
            <span>Unlimited QR Scans & Hotspot Radar</span>
          </div>

          <div className="flex items-center space-x-2 font-medium text-slate-800">
            <span className="font-bold text-sky-600 text-sm leading-none">+</span>
            <span>100MB Cloud Transit Fallback (P2P Unlimited)</span>
          </div>

          <div className="flex items-center space-x-2 font-medium text-slate-800">
            <span className="font-bold text-sky-600 text-sm leading-none">+</span>
            <span>Priority P2P Transfer Bandwidth</span>
          </div>

          <div className="flex items-center space-x-2 font-medium text-slate-800">
            <span className="font-bold text-sky-600 text-sm leading-none">+</span>
            <span>Simple commercial licensing & API sync</span>
          </div>
        </div>

        {/* Actions & Buttons */}
        <div className="space-y-2.5">
          {/* Main Action Button (Style matching image_cc438b.png) */}
          <button
            type="button"
            onClick={handleInstantUnlock}
            disabled={isActivating || isSuccess || userTier === 'pro'}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-600 hover:opacity-95 text-white font-extrabold text-sm shadow-lg shadow-pink-500/25 flex items-center justify-center space-x-2 transition-all cursor-pointer active:scale-[0.99] disabled:opacity-50"
          >
            {isSuccess ? (
              <span className="flex items-center space-x-1.5 text-white">
                <Check className="w-4 h-4 stroke-[3]" />
                <span>PRO Activated Successfully!</span>
              </span>
            ) : userTier === 'pro' ? (
              <span>You are already PRO ⚡</span>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-white" />
                <span>Pay with PayPal / Card ({price}/mo)</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Instant Sandbox / Test Activation Button */}
          {userTier !== 'pro' && (
            <button
              type="button"
              onClick={handleInstantUnlock}
              disabled={isActivating}
              className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 text-[11px] font-semibold border border-slate-200 transition-colors cursor-pointer"
            >
              {isActivating ? 'Activating...' : '⚡ Instant Test Activation (Sandbox Demo)'}
            </button>
          )}

          <p className="text-center text-[10px] text-slate-400">
            Renews automatically. Cancel anytime in 1 click.
          </p>
        </div>
      </div>
    </div>
  );
};
