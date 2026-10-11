import React, { useState, useEffect } from 'react';
import { Clipboard, Check, X, ArrowUpRight, Copy } from 'lucide-react';
import { listenToClipboardSync, ClipboardSyncEvent, writeToSystemClipboard } from '../utils/engine/clipboardSync';

export const ClipboardSyncToast: React.FC = () => {
  const [activeEvent, setActiveEvent] = useState<ClipboardSyncEvent | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    const unsub = listenToClipboardSync((evt) => {
      setActiveEvent(evt);
      setCopied(evt.autoCopied);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!activeEvent) return;
    const timer = setTimeout(() => {
      setActiveEvent(null);
    }, 5500);
    return () => clearTimeout(timer);
  }, [activeEvent]);

  if (!activeEvent) return null;

  const handleManualCopy = async () => {
    const ok = await writeToSystemClipboard(activeEvent.text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setActiveEvent(null), 1200);
    }
  };

  const isUrl = /^https?:\/\//i.test(activeEvent.text.trim());
  const snippet = activeEvent.text.length > 50 ? activeEvent.text.slice(0, 47) + '...' : activeEvent.text;

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 max-w-sm w-full animate-in slide-in-from-bottom-5 duration-200">
      <div className="bg-slate-900/95 backdrop-blur-xl border border-sky-500/40 rounded-2xl p-3.5 shadow-2xl text-white flex items-center justify-between gap-3 shadow-sky-950/40">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center shrink-0 shadow-md shadow-sky-500/20">
            <Clipboard className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-bold text-sky-300">
                {activeEvent.senderName}
              </span>
              <span className="text-[10px] text-slate-400">• Universal Clipboard</span>
            </div>
            <p className="text-xs text-slate-200 font-mono truncate mt-0.5" title={activeEvent.text}>
              {snippet}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          {isUrl && (
            <a
              href={activeEvent.text.trim()}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 transition-colors"
              title="Open Link"
            >
              <ArrowUpRight className="w-4 h-4" />
            </a>
          )}
          <button
            type="button"
            onClick={handleManualCopy}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer ${
              copied
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                : 'bg-sky-500 hover:bg-sky-400 text-white shadow-xs'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveEvent(null)}
            className="p-1 text-slate-400 hover:text-white cursor-pointer ml-0.5"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
