import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Radio,
  Info,
  X,
  FileArchive,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Code,
  FileSpreadsheet,
  Presentation,
  Send,
  Sparkles,
  Zap
} from 'lucide-react';
import { useNotification, NotificationItem } from '../context/NotificationContext';
import { formatBytes, formatSpeed, getFileCategory, getFileTypeMeta } from '../utils/formatters';

const getFileIcon = (mime?: string, name?: string) => {
  if (!name && !mime) return <Zap className="w-4 h-4 text-sky-500" />;
  const cat = getFileCategory(mime || '', name || '');
  switch (cat) {
    case 'excel':
      return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
    case 'powerpoint':
      return <Presentation className="w-4 h-4 text-amber-500" />;
    case 'word':
      return <FileText className="w-4 h-4 text-blue-500" />;
    case 'pdf':
      return <FileText className="w-4 h-4 text-rose-500" />;
    case 'archive':
    case 'apk':
    case 'ipa':
      return <FileArchive className="w-4 h-4 text-indigo-500" />;
    case 'image':
      return <ImageIcon className="w-4 h-4 text-teal-500" />;
    case 'video':
      return <Film className="w-4 h-4 text-purple-500" />;
    case 'audio':
      return <Music className="w-4 h-4 text-pink-500" />;
    case 'code':
      return <Code className="w-4 h-4 text-cyan-500" />;
    default:
      return <FileText className="w-4 h-4 text-slate-500" />;
  }
};

const SingleNotificationCard: React.FC<{ item: NotificationItem; onDismiss: (id: string) => void }> = ({
  item,
  onDismiss
}) => {
  const [progressWidth, setProgressWidth] = useState(100);

  // Auto countdown bar animation
  useEffect(() => {
    if (!item.duration || item.duration <= 0) return;
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remainingPct = Math.max(0, 100 - (elapsed / item.duration!) * 100);
      setProgressWidth(remainingPct);
      if (remainingPct <= 0) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, [item.duration]);

  const fileMeta = item.fileMeta?.name
    ? getFileTypeMeta(item.fileMeta.mime || '', item.fileMeta.name)
    : null;

  // Visual Theme mapping based on state
  const typeThemes = {
    pending: {
      border: 'border-sky-300/80',
      badgeBg: 'bg-sky-50 text-sky-800 border-sky-200',
      accentGlow: 'from-sky-500/20 via-blue-500/10 to-indigo-500/10',
      progressBar: 'bg-gradient-to-r from-sky-400 to-blue-600',
      statusPill: 'bg-sky-100 text-sky-800 border-sky-300',
      statusText: 'Streaming'
    },
    success: {
      border: 'border-emerald-300/80',
      badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      accentGlow: 'from-emerald-500/20 via-teal-500/10 to-cyan-500/10',
      progressBar: 'bg-gradient-to-r from-emerald-400 to-teal-500',
      statusPill: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      statusText: 'Completed'
    },
    error: {
      border: 'border-rose-300/80',
      badgeBg: 'bg-rose-50 text-rose-800 border-rose-200',
      accentGlow: 'from-rose-500/20 via-pink-500/10 to-orange-500/10',
      progressBar: 'bg-gradient-to-r from-rose-400 to-red-600',
      statusPill: 'bg-rose-100 text-rose-800 border-rose-300',
      statusText: 'Failed'
    },
    info: {
      border: 'border-slate-300/80',
      badgeBg: 'bg-slate-50 text-slate-800 border-slate-200',
      accentGlow: 'from-slate-500/20 via-sky-500/10 to-blue-500/10',
      progressBar: 'bg-gradient-to-r from-sky-400 to-blue-500',
      statusPill: 'bg-slate-100 text-slate-800 border-slate-300',
      statusText: 'Notice'
    }
  }[item.type];

  return (
    <div
      className={`pointer-events-auto relative w-full overflow-hidden rounded-2xl bg-white/90 backdrop-blur-2xl border ${typeThemes.border} shadow-[0_16px_40px_rgba(2,132,199,0.14),0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-xl`}
      role="alert"
    >
      {/* Soft Ambient Light Gradient on Card Header */}
      <div className={`absolute -top-12 -right-12 w-32 h-32 bg-gradient-to-br ${typeThemes.accentGlow} rounded-full blur-2xl pointer-events-none`} />

      <div className="p-3 sm:p-3.5 flex items-start space-x-3">
        {/* Left Status Icon or File Category Badge */}
        <div className="shrink-0 pt-0.5">
          {item.type === 'pending' ? (
            <div className="relative w-8 h-8 rounded-xl bg-sky-100 border border-sky-300 flex items-center justify-center text-sky-600 shadow-2xs">
              <Radio className="w-4 h-4 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-sky-500 border-2 border-white animate-ping" />
            </div>
          ) : item.type === 'success' ? (
            <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shadow-2xs">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
          ) : item.type === 'error' ? (
            <div className="w-8 h-8 rounded-xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700 shadow-2xs">
              <AlertCircle className="w-4.5 h-4.5" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-700 shadow-2xs">
              <Info className="w-4.5 h-4.5" />
            </div>
          )}
        </div>

        {/* Center Content */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center space-x-2">
            <span className={`text-[9px] font-mono uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md border ${typeThemes.statusPill}`}>
              {typeThemes.statusText}
            </span>

            {fileMeta && (
              <span className={`text-[9px] font-mono uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md border ${fileMeta.bgColor} ${fileMeta.textColor} ${fileMeta.borderColor}`}>
                {fileMeta.badgeLabel}
              </span>
            )}

            <h4 className="text-xs font-bold text-slate-900 truncate">
              {item.title}
            </h4>
          </div>

          {/* Subtitle / File Name / Size */}
          <div className="mt-1 flex items-center space-x-2 text-[11px] text-slate-600">
            {item.fileMeta && (
              <span className="inline-flex items-center space-x-1 font-semibold text-slate-800 truncate max-w-[200px] sm:max-w-[260px]">
                {getFileIcon(item.fileMeta.mime, item.fileMeta.name)}
                <span className="truncate">{item.fileMeta.name}</span>
              </span>
            )}

            {item.fileMeta?.size ? (
              <span className="shrink-0 text-slate-500 font-mono text-[10px]">
                ({formatBytes(item.fileMeta.size)})
              </span>
            ) : null}

            {item.message && !item.fileMeta && (
              <p className="text-[11px] text-slate-600 leading-snug break-words">
                {item.message}
              </p>
            )}
          </div>

          {item.message && item.fileMeta && (
            <p className="mt-0.5 text-[10px] text-slate-500 leading-tight truncate">
              {item.message}
            </p>
          )}

          {/* Real-time Streaming Transfer Progress Bar for In-Progress Transmissions */}
          {item.type === 'pending' && item.progress !== undefined && (
            <div className="mt-2 space-y-1">
              <div className="w-full bg-sky-100 rounded-full h-2 overflow-hidden border border-sky-200">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-blue-600 transition-all duration-150 rounded-full"
                  style={{ width: `${item.progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span className="font-semibold text-sky-700">{item.progress}%</span>
                {item.speed ? (
                  <span>{formatSpeed(item.speed)}</span>
                ) : null}
              </div>
            </div>
          )}

          {/* Optional Action Button (e.g. Retry) */}
          {item.action && (
            <div className="mt-2">
              <button
                type="button"
                onClick={item.action.onClick}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold tracking-wide transition-all shadow-2xs cursor-pointer active:scale-95"
              >
                {item.action.label}
              </button>
            </div>
          )}
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={() => onDismiss(item.id)}
          className="shrink-0 p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Auto-Dismiss Countdown Progress Line */}
      {item.duration && item.duration > 0 && item.type !== 'pending' && (
        <div className="w-full h-1 bg-slate-100 overflow-hidden">
          <div
            className={`h-full ${typeThemes.progressBar} transition-all duration-75`}
            style={{ width: `${progressWidth}%` }}
          />
        </div>
      )}
    </div>
  );
};

export const NotificationBar: React.FC = () => {
  const { notifications, dismissNotification } = useNotification();

  if (notifications.length === 0) return null;

  return (
    <div
      className="fixed top-3 sm:top-4 inset-x-0 mx-auto z-[9999] max-w-md w-[92%] sm:w-[88%] pointer-events-none flex flex-col items-center space-y-2.5 transition-all duration-300"
      aria-live="polite"
    >
      {notifications.map((item) => (
        <SingleNotificationCard
          key={item.id}
          item={item}
          onDismiss={dismissNotification}
        />
      ))}
    </div>
  );
};
