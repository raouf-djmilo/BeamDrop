import React, { useEffect, useState } from 'react';
import {
  Zap,
  Globe,
  UserCheck,
  Phone,
  Mail,
  MapPin,
  Download,
  FileText,
  Smartphone,
  ExternalLink,
  ShieldCheck,
  Wifi,
  Copy,
  Check,
  ArrowRight,
  MessageCircle,
  Linkedin,
  Github,
  Instagram,
  Twitter
} from 'lucide-react';

interface DynamicQrLandingPortalProps {
  code: string;
}

export const DynamicQrLandingPortal: React.FC<DynamicQrLandingPortalProps> = ({ code }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrRecord, setQrRecord] = useState<any>(null);
  const [detectedOs, setDetectedOs] = useState<string>('Other');
  const [copiedWifi, setCopiedWifi] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchQrRecord = async () => {
      try {
        setLoading(true);

        // Support instant URL-encoded Digital Profile Cards (?q=vcard-live&fn=...)
        if (code === 'vcard-live' && typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          setQrRecord({
            code: 'vcard',
            type: 'vcard',
            title: params.get('fn') || 'Digital Business Card',
            payload: {
              theme: params.get('theme') || 'titanium-dark',
              fullName: params.get('fn') || 'Contact',
              jobTitle: params.get('title') || '',
              organization: params.get('org') || '',
              phone: params.get('tel') || '',
              whatsapp: params.get('wa') || '',
              email: params.get('email') || '',
              website: params.get('url') || '',
              address: params.get('adr') || ''
            }
          });
          setLoading(false);
          return;
        }

        const res = await fetch(
          `/api/qr-studio?action=resolve&code=${encodeURIComponent(code)}&track=1`
        );
        if (res.ok) {
          const data = await res.json();
          if (!isMounted) return;
          setQrRecord(data.qr);
          setDetectedOs(data.detectedOs || 'Other');

          if (data.qr?.type === 'url' && data.qr?.targetUrl) {
            setTimeout(() => {
              if (isMounted && data.qr.targetUrl) {
                window.location.href = data.qr.targetUrl;
              }
            }, 900);
          }
        } else {
          const localRaw = localStorage.getItem('beamdrop_dynamic_qrs_v1');
          if (localRaw) {
            const list = JSON.parse(localRaw);
            const found = Array.isArray(list)
              ? list.find((item: any) => item.code === code)
              : null;
            if (found && isMounted) {
              setQrRecord(found);
              setLoading(false);
              return;
            }
          }
          if (isMounted)
            setError('This Dynamic QR code was not found or has been deactivated.');
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
      p.bio ? `NOTE:${p.bio}` : '',
      'END:VCARD'
    ]
      .filter(Boolean)
      .join('\r\n');

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
        <p className="text-xs text-slate-400 mt-1 font-mono">
          Resolving dynamic destination /{code}...
        </p>
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
  const cardTheme = p.theme || 'titanium-dark';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col items-center justify-center p-4 sm:p-6">
      <div
        className={`max-w-md w-full rounded-3xl overflow-hidden shadow-2xl border ${
          cardTheme === 'liquid-glass'
            ? 'bg-gradient-to-b from-sky-50 via-white to-blue-50 text-slate-900 border-sky-200'
            : cardTheme === 'swiss-minimal'
            ? 'bg-white text-slate-950 border-slate-300'
            : cardTheme === 'creator-aurora'
            ? 'bg-gradient-to-br from-indigo-950 via-purple-950 to-fuchsia-950 text-white border-pink-500/30'
            : 'bg-slate-900/95 backdrop-blur-xl text-white border-slate-800'
        }`}
      >
        {/* Top Accent Banner */}
        <div
          className={`px-6 py-4 flex items-center justify-between ${
            cardTheme === 'titanium-dark'
              ? 'bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/60 border-b border-amber-500/20 text-white'
              : cardTheme === 'swiss-minimal'
              ? 'bg-slate-950 text-white'
              : 'bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 text-white'
          }`}
        >
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <span className="text-sm font-extrabold tracking-tight">BeamDrop Digital ID</span>
          </div>
          <span className="text-[11px] font-mono text-sky-100 flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            <span>Verified · /{qrRecord.code}</span>
          </span>
        </div>

        <div className="p-6 space-y-5">
          {/* 1. DIGITAL BUSINESS CARD (vCard Plus) */}
          {qrRecord.type === 'vcard' && (
            <div className="space-y-4">
              <div className="text-center pb-3 border-b border-current/10">
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center mx-auto mb-3 text-2xl font-black text-white shadow-lg overflow-hidden border-2 border-white">
                  {p.avatarDataUrl ? (
                    <img
                      src={p.avatarDataUrl}
                      alt={p.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (p.fullName || qrRecord.title || 'B').charAt(0).toUpperCase()
                  )}
                </div>
                <h2 className="text-xl font-extrabold">{p.fullName || qrRecord.title}</h2>
                {(p.jobTitle || p.organization) && (
                  <p
                    className={`text-xs font-semibold mt-1 ${
                      cardTheme === 'titanium-dark' ? 'text-amber-400' : 'text-sky-500'
                    }`}
                  >
                    {[p.jobTitle, p.organization].filter(Boolean).join(' · ')}
                  </p>
                )}
                {p.bio && <p className="text-xs opacity-75 mt-2 leading-relaxed">{p.bio}</p>}
              </div>

              <button
                type="button"
                onClick={handleDownloadVcf}
                className={`w-full py-3 px-4 rounded-xl font-extrabold text-sm flex items-center justify-center space-x-2 shadow-lg cursor-pointer transition-colors ${
                  cardTheme === 'titanium-dark'
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950'
                    : 'bg-sky-600 hover:bg-sky-500 text-white'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>Save to Phone Contacts (.vcf)</span>
              </button>

              <div className="space-y-2 text-xs">
                {p.phone && (
                  <a
                    href={`tel:${p.phone}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-black/10 hover:bg-black/15 border border-current/10 transition-colors"
                  >
                    <span className="flex items-center space-x-2.5">
                      <Phone className="w-4 h-4 text-sky-400" />
                      <span>{p.phone}</span>
                    </span>
                    <span className="text-[11px] font-bold text-sky-400">Call</span>
                  </a>
                )}
                {p.whatsapp && (
                  <a
                    href={`https://wa.me/${String(p.whatsapp).replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 transition-colors"
                  >
                    <span className="flex items-center space-x-2.5">
                      <MessageCircle className="w-4 h-4 text-emerald-400" />
                      <span>WhatsApp Direct Chat</span>
                    </span>
                    <span className="text-[11px] font-bold text-emerald-400">Message</span>
                  </a>
                )}
                {p.email && (
                  <a
                    href={`mailto:${p.email}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-black/10 hover:bg-black/15 border border-current/10 transition-colors"
                  >
                    <span className="flex items-center space-x-2.5 truncate">
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
                    className="flex items-center justify-between p-3 rounded-xl bg-black/10 hover:bg-black/15 border border-current/10 transition-colors"
                  >
                    <span className="flex items-center space-x-2.5 truncate">
                      <Globe className="w-4 h-4 text-sky-400 shrink-0" />
                      <span className="truncate">{p.website}</span>
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-60 shrink-0" />
                  </a>
                )}
                {p.address && (
                  <div className="flex items-center space-x-2.5 p-3 rounded-xl bg-black/5 border border-current/10">
                    <MapPin className="w-4 h-4 text-sky-400 shrink-0" />
                    <span>{p.address}</span>
                  </div>
                )}
              </div>

              {(p.linkedin || p.github || p.instagram || p.twitter) && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  {p.linkedin && (
                    <a
                      href={p.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-black/10 hover:bg-black/20"
                    >
                      <Linkedin className="w-4 h-4" />
                    </a>
                  )}
                  {p.github && (
                    <a
                      href={p.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-black/10 hover:bg-black/20"
                    >
                      <Github className="w-4 h-4" />
                    </a>
                  )}
                  {p.instagram && (
                    <a
                      href={p.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-black/10 hover:bg-black/20"
                    >
                      <Instagram className="w-4 h-4" />
                    </a>
                  )}
                  {p.twitter && (
                    <a
                      href={p.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-black/10 hover:bg-black/20"
                    >
                      <Twitter className="w-4 h-4" />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 2. MULTI-STORE APP LINK */}
          {qrRecord.type === 'applink' && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center mx-auto mb-3">
                  <Smartphone className="w-7 h-7 text-indigo-400" />
                </div>
                <h2 className="text-xl font-extrabold">{p.appName || qrRecord.title}</h2>
                {p.appSubtitle && <p className="text-xs opacity-75 mt-1">{p.appSubtitle}</p>}
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
                <h2 className="text-lg font-extrabold">{p.docTitle || qrRecord.title}</h2>
                {p.docAuthor && <p className="text-xs text-sky-400 mt-0.5">{p.docAuthor}</p>}
                {p.docDescription && (
                  <p className="text-xs opacity-75 mt-2 leading-relaxed">{p.docDescription}</p>
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
                <h2 className="text-lg font-extrabold">{p.ssid || 'Wi-Fi Network'}</h2>
                <p className="text-xs opacity-75 mt-1">Security: {p.encryption || 'WPA/WPA2'}</p>
              </div>
              {p.password && (
                <div className="p-3.5 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">
                      Wi-Fi Password
                    </div>
                    <div className="font-mono text-sm font-bold text-white mt-0.5">
                      {p.password}
                    </div>
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
                    {copiedWifi ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedWifi ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 5. DYNAMIC WEBSITE REDIRECT OR TEXT */}
          {(qrRecord.type === 'url' || qrRecord.type === 'text') && (
            <div className="space-y-4 text-center">
              <h2 className="text-lg font-extrabold">{qrRecord.title}</h2>
              {qrRecord.targetUrl ? (
                <>
                  <p className="text-xs opacity-75 break-all font-mono bg-black/20 p-3 rounded-xl border border-current/10">
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
                <pre className="text-xs text-left bg-black/20 p-4 rounded-xl border border-current/10 whitespace-pre-wrap break-words font-mono">
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
