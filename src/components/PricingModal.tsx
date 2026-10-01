import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Zap,
  Check,
  Crown,
  CreditCard,
  LogIn,
  Loader2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerReason?: string;
  onOpenAuthModal?: () => void;
}

export const PricingModal: React.FC<PricingModalProps> = ({
  isOpen,
  onClose,
  triggerReason,
  onOpenAuthModal
}) => {
  const { currentUser, userTier, activateProSubscription } = useAuth();
  const [billingCycle, setBillingCycle] = useState<'yearly' | 'monthly'>('yearly');
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isSdkLoaded, setIsSdkLoaded] = useState<boolean>(false);
  const [sdkError, setSdkError] = useState<string | null>(null);

  const paypalContainerRef = useRef<HTMLDivElement | null>(null);

  const clientId =
    import.meta.env.VITE_PAYPAL_CLIENT_ID ||
    'AZaa0Jw_idNMwP82IGj2BbJpBG4CzvZ5hDnKvlGyRqV3Uh8PS9KG88HlcEnEljXev-Rvv2D4t89SWzX0';

  const monthlyPlanId =
    import.meta.env.VITE_PAYPAL_PLAN_MONTHLY || 'P-9VL26006VM479152TNK7NROA';
  const yearlyPlanId =
    import.meta.env.VITE_PAYPAL_PLAN_YEARLY || 'P-9EF72345U30509931NK7NSTI';

  const price = billingCycle === 'yearly' ? '$4' : '$5';
  const originalPrice = billingCycle === 'yearly' ? '$12' : '$15';

  // 1. Dynamically Load PayPal JavaScript SDK with Vault support
  useEffect(() => {
    if (!isOpen || userTier === 'pro') return;

    const scriptId = 'paypal-sdk-script';
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (existingScript && (window as any).paypal) {
      setIsSdkLoaded(true);
      return;
    }

    if (!existingScript) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&vault=true&intent=subscription`;
      script.async = true;

      script.onload = () => {
        setIsSdkLoaded(true);
        setSdkError(null);
      };

      script.onerror = () => {
        setSdkError('Unable to connect to PayPal. Check ad-blockers or network connection.');
        setIsSdkLoaded(false);
      };

      document.body.appendChild(script);
    } else {
      existingScript.addEventListener('load', () => setIsSdkLoaded(true));
    }
  }, [isOpen, clientId, userTier]);

  // 2. Render PayPal Subscription Buttons
  useEffect(() => {
    if (!isOpen || !isSdkLoaded || userTier === 'pro' || !currentUser) return;
    if (!(window as any).paypal?.Buttons) return;

    const container = paypalContainerRef.current;
    if (!container) return;

    // Reset container for smooth toggle between billing cycles
    container.innerHTML = '';

    const selectedPlanId = billingCycle === 'yearly' ? yearlyPlanId : monthlyPlanId;

    try {
      (window as any).paypal
        .Buttons({
          style: {
            shape: 'pill',
            color: 'gold',
            layout: 'vertical',
            label: 'subscribe',
            height: 40
          },
          createSubscription: function (_data: any, actions: any) {
            if (!selectedPlanId) {
              console.warn(
                `[PayPal] Plan ID for ${billingCycle} is not configured yet in .env. Creating test simulation.`
              );
              // Fallback to instant unlock if plan ID is not set yet in PayPal dashboard
              handleInstantUnlock();
              return;
            }

            return actions.subscription.create({
              plan_id: selectedPlanId,
              custom_id: currentUser.uid
            });
          },
          onApprove: async function (data: any) {
            setIsSuccess(true);
            try {
              await activateProSubscription(data?.subscriptionID, billingCycle);
            } catch (err) {
              console.error('Error activating subscription on client:', err);
            }

            setTimeout(() => {
              setIsSuccess(false);
              onClose();
            }, 2200);
          },
          onError: function (err: any) {
            console.warn('[PayPal Checkout Note]', err);
            // If plan ID is missing in PayPal dashboard, offer instant activation
            if (!selectedPlanId) {
              handleInstantUnlock();
            }
          }
        })
        .render(container);
    } catch (err: any) {
      console.warn('PayPal Buttons render warning:', err);
    }
  }, [isOpen, isSdkLoaded, billingCycle, currentUser, userTier, monthlyPlanId, yearlyPlanId]);

  if (!isOpen) return null;

  // Instant sandbox / demo fallback activation
  const handleInstantUnlock = async () => {
    setIsActivating(true);
    try {
      await activateProSubscription(`sub_instant_${Date.now()}`, billingCycle);
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
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-2xl transition-opacity"
        aria-hidden="true"
      />

      {/* Modal Dialog: ZERO SCROLLBAR, 100% COMPACT APPLE LIQUID GLASS */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm sm:max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-[28px] p-5 sm:p-6 shadow-[0_24px_64px_rgba(0,0,0,0.2)] border border-white/80 dark:border-white/10 z-10 animate-fade-in overflow-hidden"
      >
        {/* Specular Top Edge Highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/60 to-transparent pointer-events-none" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Reason Banner: Sleek Liquid Glass Highlight Badge */}
        {triggerReason && (
          <div className="mb-3 px-3 py-1.5 rounded-full bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-cyan-500/10 border border-sky-200/60 text-slate-800 text-[11px] flex items-center justify-center space-x-1.5 font-medium shadow-2xs">
            <Zap className="w-3.5 h-3.5 text-sky-600 fill-sky-600 shrink-0" />
            <span className="truncate">{triggerReason}</span>
          </div>
        )}

        {/* Plan Header & Badge */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 p-[2px] shadow-sm shadow-blue-500/20">
              <div className="w-full h-full bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center">
                <Crown className="w-4 h-4 text-slate-900 dark:text-white fill-slate-900 dark:fill-white" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight leading-none">
                Professional+
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Unlimited high-speed P2P &amp; cloud transit
              </p>
            </div>
          </div>

          <span className="px-2.5 py-0.5 rounded-md bg-slate-950 dark:bg-white text-white dark:text-slate-950 text-[9px] font-black uppercase tracking-wider shadow-2xs">
            MOST POPULAR
          </span>
        </div>

        {/* Billing Cycle Toggle: Compact Pill */}
        <div className="flex justify-center mb-3">
          <div className="bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-full flex items-center border border-slate-200/60 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                billingCycle === 'yearly'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Yearly (Save 20%)
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                billingCycle === 'monthly'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Monthly ($5)
            </button>
          </div>
        </div>

        {/* Price Display */}
        <div className="py-2 border-y border-slate-100 dark:border-slate-800/80 mb-3 flex items-baseline justify-between">
          <div className="flex items-baseline space-x-1.5">
            <span className="text-xs font-bold text-slate-400 line-through">
              {originalPrice}
            </span>
            <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {price}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              / month*
            </span>
          </div>

          <span className="text-[10px] text-slate-400 font-medium">
            {billingCycle === 'yearly' ? '$48 billed annually' : 'Renews monthly'}
          </span>
        </div>

        {/* Features List: Crisp & Compact */}
        <div className="space-y-1.5 mb-3.5 text-xs">
          <div className="flex items-center space-x-2 font-medium text-slate-800 dark:text-slate-200">
            <Check className="w-3.5 h-3.5 text-sky-600 shrink-0 stroke-[2.5]" />
            <span className="font-semibold text-slate-900 dark:text-white">Unlimited Beams (No 5/15 daily caps)</span>
          </div>

          <div className="flex items-center space-x-2 font-medium text-slate-700 dark:text-slate-300">
            <Check className="w-3.5 h-3.5 text-sky-600 shrink-0 stroke-[2.5]" />
            <span>Ultra-fast LAN P2P priority &amp; 100MB Cloud Fallback</span>
          </div>

          <div className="flex items-center space-x-2 font-medium text-slate-700 dark:text-slate-300">
            <Check className="w-3.5 h-3.5 text-sky-600 shrink-0 stroke-[2.5]" />
            <span>Direct Web &amp; Chrome Extension offline sync</span>
          </div>

          <div className="flex items-center space-x-2 font-medium text-slate-700 dark:text-slate-300">
            <Check className="w-3.5 h-3.5 text-sky-600 shrink-0 stroke-[2.5]" />
            <span>Cancel anytime in 1 click from your PayPal dashboard</span>
          </div>
        </div>

        {/* SUCCESS STATE */}
        {isSuccess ? (
          <div className="py-4 px-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-1 mb-2 animate-fade-in">
            <div className="w-10 h-10 mx-auto rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/25">
              <Check className="w-5 h-5 stroke-[3]" />
            </div>
            <h4 className="text-sm font-extrabold text-emerald-950">
              Payment Approved! PRO Activated!
            </h4>
            <p className="text-[11px] text-emerald-700">
              Unlimited transfers are now live across your web app and extension.
            </p>
          </div>
        ) : userTier === 'pro' ? (
          <div className="py-3 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-0.5 mb-2">
            <div className="flex items-center justify-center space-x-1.5 text-emerald-600 font-extrabold text-xs">
              <Zap className="w-3.5 h-3.5 fill-emerald-600" />
              <span>You are already a PRO Member</span>
            </div>
            <p className="text-[10px] text-slate-500">
              Active Unlimited Membership • Zero bandwidth restrictions
            </p>
          </div>
        ) : !currentUser ? (
          /* REQUIRE SIGN-IN PROMPT */
          <div className="p-3 bg-sky-50/80 border border-sky-200/90 rounded-2xl space-y-2 mb-2">
            <div className="flex items-start space-x-2">
              <LogIn className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-700">
                <span className="font-bold text-slate-900 block text-[11px]">Sign in required to subscribe</span>
                Please sign in so your PRO membership links to your account.
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onOpenAuthModal) onOpenAuthModal();
              }}
              className="w-full py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs tracking-wide shadow-sm transition-all cursor-pointer flex items-center justify-center space-x-1.5"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In / Create Account (1-Click)</span>
            </button>
          </div>
        ) : (
          /* OFFICIAL PAYPAL SUBSCRIPTION BUTTONS CONTAINER */
          <div className="space-y-2 mb-2">
            <div className="flex items-center justify-between text-[11px] px-1 text-slate-500">
              <span className="flex items-center space-x-1">
                <CreditCard className="w-3 h-3 text-slate-400" />
                <span className="font-medium">Checkout via PayPal / Card:</span>
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {billingCycle === 'yearly' ? '$48.00 USD' : '$5.00 USD'}
              </span>
            </div>

            {/* Container for Official PayPal & Debit/Credit Card Buttons */}
            <div className="min-h-[88px] flex flex-col justify-center">
              {!isSdkLoaded && !sdkError && (
                <div className="py-4 flex items-center justify-center space-x-2 text-xs text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                  <span>Loading PayPal secure checkout...</span>
                </div>
              )}
              {sdkError && (
                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-800 text-[11px] text-center">
                  {sdkError}
                </div>
              )}
              <div id="paypal-button-container" ref={paypalContainerRef} />
            </div>
          </div>
        )}

        {/* Footer Guarantee & Instant Sandbox Demo */}
        {userTier !== 'pro' && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 mt-1 flex items-center justify-between text-[10px] text-slate-400">
            <span>SSL Encrypted • Cancel anytime</span>
            <button
              type="button"
              onClick={handleInstantUnlock}
              disabled={isActivating}
              className="text-slate-500 hover:text-sky-600 transition-colors cursor-pointer font-medium underline underline-offset-2"
            >
              {isActivating ? 'Activating...' : 'Sandbox demo mode'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
