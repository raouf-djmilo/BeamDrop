import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Sparkles, Share, PlusSquare } from 'lucide-react';

export const PWAInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);
  const [showIosInstructions, setShowIosInstructions] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if dismissed previously in this session
    const isDismissed = sessionStorage.getItem('beamdrop_pwa_dismissed') === 'true';
    if (isDismissed) return;

    // Check if already in standalone PWA mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) return;

    // Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !/crios|fxios|opios/.test(userAgent);
    setIsIos(isIosDevice);

    if (isIosDevice) {
      // Show iOS banner after a brief 3s delay
      const timer = setTimeout(() => setIsVisible(true), 3000);
      return () => clearTimeout(timer);
    }

    // Standard beforeinstallprompt event for Android, Windows, macOS Chrome/Edge
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosInstructions(true);
      return;
    }

    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsVisible(false);
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.warn('PWA install prompt notice:', err);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('beamdrop_pwa_dismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <>
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-50 animate-fade-in">
        <div className="bg-slate-900/95 backdrop-blur-2xl border border-sky-500/40 rounded-2xl p-3.5 sm:p-4 text-white shadow-2xl shadow-sky-950/50 flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shrink-0 shadow-md shadow-sky-500/30">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-bold text-white truncate">Install BeamDrop App</p>
                <span className="text-[9px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30 px-1.5 py-0.2 rounded-md">
                  PWA
                </span>
              </div>
              <p className="text-[11px] text-slate-300 truncate">
                Lightning instant offline transfer &amp; native share sheet
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs transition-all shadow-md shadow-sky-500/25 active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install</span>
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Instructions Modal */}
      {showIosInstructions && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 border border-sky-500/40 rounded-3xl p-6 max-w-sm w-full space-y-4 text-white shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold">Install on iPhone / iPad</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIosInstructions(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Apple Safari lets you install BeamDrop directly to your home screen for instant camera pairing:
            </p>

            <div className="space-y-2.5 text-xs text-slate-200">
              <div className="flex items-center space-x-3 p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="w-5 h-5 rounded-full bg-sky-500/30 text-sky-300 flex items-center justify-center font-bold text-[10px]">
                  1
                </span>
                <span className="flex items-center gap-1.5">
                  Tap the Safari <Share className="w-3.5 h-3.5 text-sky-400 inline" /> Share button in the bottom bar
                </span>
              </div>
              <div className="flex items-center space-x-3 p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="w-5 h-5 rounded-full bg-sky-500/30 text-sky-300 flex items-center justify-center font-bold text-[10px]">
                  2
                </span>
                <span className="flex items-center gap-1.5">
                  Scroll down and tap <PlusSquare className="w-3.5 h-3.5 text-sky-400 inline" /> "Add to Home Screen"
                </span>
              </div>
              <div className="flex items-center space-x-3 p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="w-5 h-5 rounded-full bg-sky-500/30 text-sky-300 flex items-center justify-center font-bold text-[10px]">
                  3
                </span>
                <span>Tap "Add" in the top right corner. Done!</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowIosInstructions(false);
                setIsVisible(false);
              }}
              className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
