import React, { useEffect, useState } from 'react';
import {
  Zap,
  Globe,
  UserCheck,
  Phone,
  Mail,
  Building2,
  MapPin,
  Download,
  FileText,
  Smartphone,
  ExternalLink,
  ShieldCheck,
  Wifi,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight
} from 'lucide-react';

interface DynamicQrLandingPortalProps {
  code: string;
}

export const DynamicQrLandingPortal: React.FC<DynamicQrLandingPortalProps> = ({ code }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrRecord, setQrRecord] = useState<any>(null);
  const [detectedOs, setDetectedOs] = useState<string>('Other');
  const [resolvedRedirectUrl, setResolvedRedirectUrl] = useState<string>('');
  const [copiedWifi, setCopiedWifi] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchQrRecord = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/qr-studio?action=resolve&code=${encodeURIComponent(code)}&track=1`);
        if (res.ok) {
          const data = await res.json();
          if (!isMounted) return;
          setQrRecord(data.qr);
          setDetectedOs(data.detectedOs || 'Other');
          setResolvedRedirectUrl(data.resolvedRedirectUrl || data.qr?.targetUrl || '');

          // If it's a direct dynamic URL, redirect automatically after brief verification
          if (data.qr?.type === 'url' && data.qr?.targetUrl) {
            setTimeout(() => {
              if (isMounted && data.qr.targetUrl) {
                window.location.href = data.qr.targetUrl;
              }
            }, 900);
          }
        } else {
          // Check local fallback cache if created on same device
          const localRaw = localStorage.getItem('beamdrop_dynamic_qrs_v1');
          if (localRaw) {
            const list = JSON.parse(localRaw);
            const found = Array.isArray(list) ? list.find((item: any) => item.code === code) : null;
            if (found && isMounted) {
              setQrRecord(found);
              setResolvedRedirectUrl(found.targetUrl || '');
              setLoading(false);
              return;
            }
          }
          if (isMounted) setError('This Dynamic QR code was not found or has been deactivated.');
        }
      } catch (err: any) {
        if (isMounted) setError(err?.message || 'Failed to resolve Dynamic QR code.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchQrRecord();
    return () => {
      isMounted = false;
    };
  }, [code]);

  const handleDownloadVcf = () => {
    if (!qrRecord?.payload) return;
    const p = qrRecord.payload;
    const fullName = p.fullName || qrRecord.title || 'Contact';
    const vcardLines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${fullName}`,
      p.organization ? `ORG:${p.organization}` : '',
      p.jobTitle ? `TITLE:${p.jobTitle}` : '',
      p.phone ? `TEL;TYPE=CELL:${p.phone}` : '',
      p.email ? `EMAIL;TYPE=INTERNET:${p.email}` : '',
      p.website ? `URL:${p.website}` : '',
      p.address ? `ADR;TYPE=WORK:;;${p.address};;;;` : '',
      'END:VCARD'
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([vcardLines], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fullName.replace(/[^a-zA-Z0-9_-]/g, '_')}.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center mb-4 animate-pulse">
          <Zap className="w-6 h-6 text-sky-400" />
        </div>
        <h1 className="text-lg font-bold tracking-tight">BeamDrop Smart QR Gateway</h1>
        <p className="text-xs text-slate-400 mt-1 font-mono">Resolving dynamic destination /{code}...</p>
      </div>
    );
  }

  if (error || !qrRecord) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-6 h-6 text-rose-400" />
          </div>
          <h1 className="text-lg font-bold text-white">Dynamic QR Unavailable</h1>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">{error}</p>
          <a
            href="/"
            className="mt-5 inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors"
          >
            <span>Open BeamDrop QR Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    );
  }

  const p = qrRecord.payload || {};

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {/* Top Accent Banner */}
        <div className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <span className="text-sm font-extrabold tracking-tight">BeamDrop Dynamic QR</span>
          </div>
          <span className="text-[11px] font-mono text-sky-100 flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            <span>Verified · /{qrRecord.code}</span>
          </span>
        </div>

        <div className="p-6 space-y-5">
          {/* 1. DIGITAL BUSINESS CARD (vCard) */}
          {qrRecord.type === 'vcard' && (
            <div className="space-y-4">
              <div className="text-center pb-3 border-b border-slate-800">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center mx-auto mb-3 text-xl font-black shadow-lg shadow-sky-500/20">
                  {(p.fullName || qrRecord.title || 'B').charAt(0).toUpperCase()}
                </div>
                <h2 className="text-xl font-extrabold text-white">{p.fullName || qrRecord.title}</h2>
                {(p.jobTitle || p.organization) && (
                  <p className="text-xs text-sky-400 font-medium mt-1">
                    {[p.jobTitle, p.organization].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>

              <div className="space-y-2.5 text-xs">
                {p.phone && (
                  <a
                    href={`tel:${p.phone}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 transition-colors"
                  >
                    <span className="flex items-center space-x-2.5 text-slate-300">
                      <Phone className="w-4 h-4 text-sky-400" />
                      <span>{p.phone}</span>
                    </span>
                    <span className="text-[11px] font-bold text-sky-400">Call</span>
                  </a>
                )}
                {p.email && (
                  <a
                    href={`mailto:${p.email}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 transition-colors"
                  >
                    <span className="flex items-center space-x-2.5 text-slate-300 truncate">
                      <Mail className="w-4 h-4 text-sky-400 shrink-0" />
                      <span className="truncate">{p.email}</span>
                    </span>
                    <span className="text-[11px] font-bold text-sky-400 shrink-0 ml-2">Email</span>
                  </a>
                )}
                {p.website && (
                  <a
                    href={p.website.startsWith('http') ? p.website : `https://${p.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 transition-colors"
                  >
                    <span className="flex items-center space-x-2.5 text-slate-300 truncate">
                      <Globe className="w-4 h-4 text-sky-400 shrink-0" />
                      <span className="truncate">{p.website}</span>
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </a>
                )}
                {p.address && (
                  <div className="flex items-center space-x-2.5 p-3 rounded-xl bg-slate-800/40 border border-slate-800 text-slate-300">
                    <MapPin className="w-4 h-4 text-sky-400 shrink-0" />
                    <span>{p.address}</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleDownloadVcf}
                className="w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-sky-600/25 cursor-pointer transition-colors"
              >
                <UserCheck className="w-4 h-4" />
                <span>Save to Phone Contacts (.vcf)</span>
              </button>
            </div>
          )}

          {/* 2. MULTI-STORE APP LINK */}
          {qrRecord.type === 'applink' && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center mx-auto mb-3">
                  <Smartphone className="w-7 h-7 text-indigo-400" />
                </div>
                <h2 className="text-xl font-extrabold text-white">{p.appName || qrRecord.title}</h2>
                {p.appSubtitle && <p className="text-xs text-slate-400 mt-1">{p.appSubtitle}</p>}
                <p className="text-[11px] text-emerald-400 font-mono mt-2">
                  Detected Device: {detectedOs}
                </p>
              </div>

              <div className="space-y-2.5">
                {p.iosUrl && (
                  <a
                    href={p.iosUrl}
                    className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-between transition-all ${
                      detectedOs === 'iOS'
                        ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/25'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    }`}
                  >
                    <span>Apple App Store (iOS / iPadOS)</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                {p.androidUrl && (
                  <a
                    href={p.androidUrl}
                    className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-between transition-all ${
                      detectedOs === 'Android'
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    }`}
                  >
                    <span>Google Play Store (Android)</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                {p.fallbackUrl && (
                  <a
                    href={p.fallbackUrl}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 font-semibold text-xs flex items-center justify-between border border-slate-800"
                  >
                    <span>Official Website / Desktop Version</span>
                    <Globe className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* 3. PDF & DOCUMENT SHOWCASE */}
          {qrRecord.type === 'pdf' && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-7 h-7 text-sky-400" />
                </div>
                <h2 className="text-lg font-extrabold text-white">{p.docTitle || qrRecord.title}</h2>
                {p.docAuthor && <p className="text-xs text-sky-400 mt-0.5">{p.docAuthor}</p>}
                {p.docDescription && (
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">{p.docDescription}</p>
                )}
              </div>

              {qrRecord.targetUrl && (
                <a
                  href={qrRecord.targetUrl}
                  className="w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-sky-600/25 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Open / Download Document</span>
                </a>
              )}
            </div>
          )}

          {/* 4. WIFI DIRECT CARD */}
          {qrRecord.type === 'wifi' && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto mb-3">
                  <Wifi className="w-7 h-7 text-emerald-400" />
                </div>
                <h2 className="text-lg font-extrabold text-white">{p.ssid || 'Wi-Fi Network'}</h2>
                <p className="text-xs text-slate-400 mt-1">Security: {p.encryption || 'WPA/WPA2'}</p>
              </div>
              {p.password && (
                <div className="p-3.5 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">Wi-Fi Password</div>
                    <div className="font-mono text-sm font-bold text-white mt-0.5">{p.password}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(p.password);
                      setCopiedWifi(true);
                      setTimeout(() => setCopiedWifi(false), 2000);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    {copiedWifi ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedWifi ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 5. DYNAMIC WEBSITE REDIRECT OR TEXT */}
          {(qrRecord.type === 'url' || qrRecord.type === 'text') && (
            <div className="space-y-4 text-center">
              <h2 className="text-lg font-extrabold text-white">{qrRecord.title}</h2>
              {qrRecord.targetUrl ? (
                <>
                  <p className="text-xs text-slate-400 break-all font-mono bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                    {qrRecord.targetUrl}
                  </p>
                  <a
                    href={qrRecord.targetUrl}
                    className="w-full py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-sky-600/25 transition-colors"
                  >
                    <span>Continue to Destination</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </>
              ) : (
                <pre className="text-xs text-left text-slate-200 bg-slate-800/80 p-4 rounded-xl border border-slate-700 whitespace-pre-wrap break-words font-mono">
                  {p.text || qrRecord.title}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
