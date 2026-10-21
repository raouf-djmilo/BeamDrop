import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  Globe,
  UserCheck,
  Wifi,
  FileText,
  Smartphone,
  BarChart3,
  Download,
  Copy,
  Check,
  Palette,
  Frame,
  Image as ImageIcon,
  Shapes,
  RefreshCw,
  ExternalLink,
  Trash2,
  Edit3,
  Upload,
  Zap,
  Eye,
  EyeOff,
  CheckCircle2,
  QrCode as QrIcon,
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  CreditCard,
  Sparkles,
  Linkedin,
  Github,
  Instagram,
  Twitter
} from 'lucide-react';
import { useNotification } from '../context/NotificationContext';
import { formatBytes } from '../utils/formatters';

export type QrEngineType = 'url' | 'vcard' | 'wifi' | 'pdf' | 'applink' | 'analytics';
export type QrBodyShape = 'square' | 'rounded' | 'dots' | 'classy';
export type QrOuterEyeShape = 'square' | 'rounded' | 'circle' | 'leaf';
export type QrInnerEyeShape = 'square' | 'rounded' | 'circle' | 'diamond' | 'leaf';
export type QrGradientMode = 'none' | 'linear-diag' | 'linear-horiz' | 'linear-vert' | 'radial';
export type QrFrameStyle = 'none' | 'bottom-banner' | 'top-banner' | 'wifi-badge' | 'menu-badge';
export type QrLogoPreset = 'beamdrop' | 'globe' | 'vcard' | 'wifi' | 'pdf' | 'app' | 'custom' | 'none';
export type QrLogoMask = 'circle' | 'rounded' | 'square';
export type VcardThemeId = 'liquid-glass' | 'titanium-dark' | 'creator-aurora' | 'swiss-minimal';

interface DynamicQrItem {
  code: string;
  type: string;
  title: string;
  targetUrl: string;
  payload: any;
  createdAt: number;
  updatedAt?: number;
  scans: number;
  lastScannedAt?: number | null;
  osBreakdown?: {
    iOS: number;
    Android: number;
    Desktop: number;
  };
}

interface QrStudioViewProps {
  receiverBaseUrl: string;
}

interface DesignerPreset {
  id: string;
  name: string;
  badge: string;
  fgColor: string;
  fgColor2: string;
  gradientMode: QrGradientMode;
  bgColor: string;
  bodyShape: QrBodyShape;
  outerEyeShape: QrOuterEyeShape;
  innerEyeShape: QrInnerEyeShape;
  customEyeColor: boolean;
  outerEyeColor: string;
  innerEyeColor: string;
  frameStyle: QrFrameStyle;
  frameColor: string;
}

const DESIGNER_PRESETS: DesignerPreset[] = [
  {
    id: 'liquid-cyan',
    name: 'BeamDrop Liquid Cyan',
    badge: 'Signature',
    fgColor: '#0284c7',
    fgColor2: '#2563eb',
    gradientMode: 'linear-diag',
    bgColor: '#ffffff',
    bodyShape: 'rounded',
    outerEyeShape: 'rounded',
    innerEyeShape: 'circle',
    customEyeColor: true,
    outerEyeColor: '#0369a1',
    innerEyeColor: '#0284c7',
    frameStyle: 'bottom-banner',
    frameColor: '#0284c7'
  },
  {
    id: 'obsidian-gold',
    name: 'Obsidian Gold',
    badge: 'VIP Luxury',
    fgColor: '#0f172a',
    fgColor2: '#b45309',
    gradientMode: 'linear-diag',
    bgColor: '#ffffff',
    bodyShape: 'dots',
    outerEyeShape: 'circle',
    innerEyeShape: 'diamond',
    customEyeColor: true,
    outerEyeColor: '#0f172a',
    innerEyeColor: '#d97706',
    frameStyle: 'bottom-banner',
    frameColor: '#0f172a'
  },
  {
    id: 'executive-slate',
    name: 'Executive Corporate',
    badge: 'Business',
    fgColor: '#0f172a',
    fgColor2: '#334155',
    gradientMode: 'linear-vert',
    bgColor: '#ffffff',
    bodyShape: 'square',
    outerEyeShape: 'rounded',
    innerEyeShape: 'rounded',
    customEyeColor: false,
    outerEyeColor: '#0f172a',
    innerEyeColor: '#0f172a',
    frameStyle: 'bottom-banner',
    frameColor: '#1e293b'
  },
  {
    id: 'emerald-matrix',
    name: 'Emerald Matrix',
    badge: 'WiFi & Tech',
    fgColor: '#059669',
    fgColor2: '#0d9488',
    gradientMode: 'radial',
    bgColor: '#ffffff',
    bodyShape: 'rounded',
    outerEyeShape: 'leaf',
    innerEyeShape: 'circle',
    customEyeColor: true,
    outerEyeColor: '#065f46',
    innerEyeColor: '#10b981',
    frameStyle: 'bottom-banner',
    frameColor: '#059669'
  },
  {
    id: 'neon-cyber',
    name: 'Neon Cyber',
    badge: 'Creator',
    fgColor: '#6d28d9',
    fgColor2: '#db2777',
    gradientMode: 'linear-diag',
    bgColor: '#ffffff',
    bodyShape: 'dots',
    outerEyeShape: 'leaf',
    innerEyeShape: 'leaf',
    customEyeColor: true,
    outerEyeColor: '#5b21b6',
    innerEyeColor: '#ec4899',
    frameStyle: 'bottom-banner',
    frameColor: '#6d28d9'
  },
  {
    id: 'sunset-gradient',
    name: 'Sunset Gradient',
    badge: 'Hospitality',
    fgColor: '#ea580c',
    fgColor2: '#e11d48',
    gradientMode: 'radial',
    bgColor: '#ffffff',
    bodyShape: 'classy',
    outerEyeShape: 'circle',
    innerEyeShape: 'circle',
    customEyeColor: true,
    outerEyeColor: '#c2410c',
    innerEyeColor: '#e11d48',
    frameStyle: 'bottom-banner',
    frameColor: '#e11d48'
  }
];

const VCARD_THEMES: Array<{
  id: VcardThemeId;
  name: string;
  subtitle: string;
  swatch: string;
}> = [
  {
    id: 'liquid-glass',
    name: 'Liquid Glass (Light)',
    subtitle: 'Frosted translucent layers',
    swatch: 'linear-gradient(135deg, #e0f2fe 0%, #38bdf8 50%, #2563eb 100%)'
  },
  {
    id: 'titanium-dark',
    name: 'Titanium Executive (Dark)',
    subtitle: 'Matte obsidian & gold accents',
    swatch: 'linear-gradient(135deg, #090d16 0%, #1e293b 60%, #d97706 100%)'
  },
  {
    id: 'creator-aurora',
    name: 'Creator Aurora',
    subtitle: 'Vibrant mesh gradient header',
    swatch: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 50%, #ec4899 100%)'
  },
  {
    id: 'swiss-minimal',
    name: 'Swiss Minimal',
    subtitle: 'High-contrast architectural grid',
    swatch: 'linear-gradient(135deg, #0f172a 0%, #475569 50%, #f8fafc 100%)'
  }
];

export const QrStudioView: React.FC<QrStudioViewProps> = ({ receiverBaseUrl }) => {
  const { notifyInfo, notifySuccess, notifyError } = useNotification();

  // Active Engine Mode
  const [engineType, setEngineType] = useState<QrEngineType>('url');

  // Preview Mode in Right Sticky Dock ('qr' vs 'iphone' for vCard Plus)
  const [previewTab, setPreviewTab] = useState<'qr' | 'iphone'>('qr');

  // 1. Website URL State
  const [websiteUrl, setWebsiteUrl] = useState<string>('https://beam-drop-mu.vercel.app');
  const [websiteTitle, setWebsiteTitle] = useState<string>('BeamDrop Official Website');
  const [activeDynamicCode, setActiveDynamicCode] = useState<string>('');

  // 2. Digital Business Card (vCard Plus) State
  const [vcardOutputMode, setVcardOutputMode] = useState<'offline' | 'dynamic'>('offline');
  const [vcardTheme, setVcardTheme] = useState<VcardThemeId>('titanium-dark');
  const [vcardAvatarDataUrl, setVcardAvatarDataUrl] = useState<string | null>(null);
  const [vcardFullName, setVcardFullName] = useState<string>('Abderraouf Djemel');
  const [vcardJobTitle, setVcardJobTitle] = useState<string>('Founder & Principal Architect');
  const [vcardOrg, setVcardOrg] = useState<string>('BeamDrop Universal OS');
  const [vcardBio, setVcardBio] = useState<string>('Building zero-latency P2P file streaming & cloud identity infrastructure.');
  const [vcardPhone, setVcardPhone] = useState<string>('+213 555 12 34 56');
  const [vcardWhatsapp, setVcardWhatsapp] = useState<string>('+213555123456');
  const [vcardEmail, setVcardEmail] = useState<string>('raouf@beamdrop.io');
  const [vcardWebsite, setVcardWebsite] = useState<string>('https://beam-drop-mu.vercel.app');
  const [vcardAddress, setVcardAddress] = useState<string>('Algiers · Paris · Global');
  const [vcardLinkedin, setVcardLinkedin] = useState<string>('https://linkedin.com/in/beamdrop');
  const [vcardGithub, setVcardGithub] = useState<string>('https://github.com/raouf-djmilo');
  const [vcardInstagram, setVcardInstagram] = useState<string>('');
  const [vcardTwitter, setVcardTwitter] = useState<string>('');
  const vcardAvatarInputRef = useRef<HTMLInputElement | null>(null);

  // 3. WiFi Direct Connect State
  const [wifiSsid, setWifiSsid] = useState<string>('BeamDrop_5G_Fiber');
  const [wifiPassword, setWifiPassword] = useState<string>('BeamDrop2026!');
  const [wifiEncryption, setWifiEncryption] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');
  const [wifiHidden, setWifiHidden] = useState<boolean>(false);
  const [showWifiPassword, setShowWifiPassword] = useState<boolean>(false);

  // 4. PDF & Document Showcase State (Integrated with 24h Cloud Drop)
  const [pdfTitle, setPdfTitle] = useState<string>('Product Architecture Whitepaper.pdf');
  const [pdfAuthor, setPdfAuthor] = useState<string>('BeamDrop Engineering');
  const [pdfDescription, setPdfDescription] = useState<string>(
    'Scan to view or download the verified PDF document directly on your phone.'
  );
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [isUploadingPdf, setIsUploadingPdf] = useState<boolean>(false);
  const [uploadedPdfMeta, setUploadedPdfMeta] = useState<{
    id: string;
    name: string;
    size: number;
    sha256: string;
    shareUrl: string;
  } | null>(null);
  const pdfFileInputRef = useRef<HTMLInputElement | null>(null);

  // 5. Multi-Store App Link State
  const [appName, setAppName] = useState<string>('BeamDrop Mobile Companion');
  const [appSubtitle, setAppSubtitle] = useState<string>('Universal P2P Transfer & QR Scanner');
  const [appIosUrl, setAppIosUrl] = useState<string>('https://apps.apple.com/app/id123456789');
  const [appAndroidUrl, setAppAndroidUrl] = useState<string>(
    'https://play.google.com/store/apps/details?id=io.beamdrop.app'
  );
  const [appFallbackUrl, setAppFallbackUrl] = useState<string>('https://beam-drop-mu.vercel.app');

  // 6. Dynamic QR Manager & Analytics State
  const [dynamicQrs, setDynamicQrs] = useState<DynamicQrItem[]>(() => {
    try {
      const saved = localStorage.getItem('beamdrop_dynamic_qrs_v1');
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editingTargetUrl, setEditingTargetUrl] = useState<string>('');
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [isCreatingDynamic, setIsCreatingDynamic] = useState<boolean>(false);
  const [isRefreshingAnalytics, setIsRefreshingAnalytics] = useState<boolean>(false);

  // Next-Gen Visual Studio Customization State
  const [activePresetId, setActivePresetId] = useState<string>('liquid-cyan');
  const [activeCustTab, setActiveCustTab] = useState<'shapes' | 'colors' | 'frame' | 'logo'>('shapes');
  const [bodyShape, setBodyShape] = useState<QrBodyShape>('rounded');
  const [outerEyeShape, setOuterEyeShape] = useState<QrOuterEyeShape>('rounded');
  const [innerEyeShape, setInnerEyeShape] = useState<QrInnerEyeShape>('circle');
  const [fgColor, setFgColor] = useState<string>('#0284c7');
  const [fgColor2, setFgColor2] = useState<string>('#2563eb');
  const [gradientMode, setGradientMode] = useState<QrGradientMode>('linear-diag');
  const [bgColor, setBgColor] = useState<string>('#ffffff');
  const [customEyeColor, setCustomEyeColor] = useState<boolean>(true);
  const [outerEyeColor, setOuterEyeColor] = useState<string>('#0369a1');
  const [innerEyeColor, setInnerEyeColor] = useState<string>('#0284c7');
  const [frameStyle, setFrameStyle] = useState<QrFrameStyle>('bottom-banner');
  const [frameText, setFrameText] = useState<string>('SCAN ME');
  const [frameColor, setFrameColor] = useState<string>('#0284c7');

  // Logo & Masking State
  const [logoPreset, setLogoPreset] = useState<QrLogoPreset>('beamdrop');
  const [customLogoDataUrl, setCustomLogoDataUrl] = useState<string | null>(null);
  const [logoMask, setLogoMask] = useState<QrLogoMask>('circle');
  const [logoQuietZonePad, setLogoQuietZonePad] = useState<number>(8);
  const [logoShadow, setLogoShadow] = useState<boolean>(true);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const miniMockupQrRef = useRef<HTMLCanvasElement | null>(null);
  const [copiedQrImage, setCopiedQrImage] = useState<boolean>(false);
  const [copiedPayloadText, setCopiedPayloadText] = useState<boolean>(false);

  // Apply 1-Click Designer Preset
  const applyDesignerPreset = (preset: DesignerPreset) => {
    setActivePresetId(preset.id);
    setFgColor(preset.fgColor);
    setFgColor2(preset.fgColor2);
    setGradientMode(preset.gradientMode);
    setBgColor(preset.bgColor);
    setBodyShape(preset.bodyShape);
    setOuterEyeShape(preset.outerEyeShape);
    setInnerEyeShape(preset.innerEyeShape);
    setCustomEyeColor(preset.customEyeColor);
    setOuterEyeColor(preset.outerEyeColor);
    setInnerEyeColor(preset.innerEyeColor);
    setFrameStyle(preset.frameStyle);
    setFrameColor(preset.frameColor);
  };

  // Auto-update default CTA Frame Text & Logo when switching engines
  useEffect(() => {
    if (engineType === 'url') {
      setFrameText('SCAN ME');
      setPreviewTab('qr');
      if (logoPreset !== 'custom' && logoPreset !== 'none') setLogoPreset('globe');
    } else if (engineType === 'vcard') {
      setFrameText('SAVE CONTACT');
      if (logoPreset !== 'custom' && logoPreset !== 'none') setLogoPreset('vcard');
    } else if (engineType === 'wifi') {
      setFrameText(`WIFI: ${wifiSsid.slice(0, 14) || 'JOIN'}`);
      setPreviewTab('qr');
      if (logoPreset !== 'custom' && logoPreset !== 'none') setLogoPreset('wifi');
    } else if (engineType === 'pdf') {
      setFrameText('SCAN FOR PDF');
      setPreviewTab('qr');
      if (logoPreset !== 'custom' && logoPreset !== 'none') setLogoPreset('pdf');
    } else if (engineType === 'applink') {
      setFrameText('GET THE APP');
      setPreviewTab('qr');
      if (logoPreset !== 'custom' && logoPreset !== 'none') setLogoPreset('app');
    } else {
      setPreviewTab('qr');
    }
  }, [engineType]);

  // Save dynamicQrs to localStorage whenever updated
  useEffect(() => {
    try {
      localStorage.setItem('beamdrop_dynamic_qrs_v1', JSON.stringify(dynamicQrs));
    } catch (_) {}
  }, [dynamicQrs]);

  // Compute the effective QR payload string for the active engine
  const qrPayload = useMemo(() => {
    const cleanBase = receiverBaseUrl.replace(/\/$/, '');

    if (activeDynamicCode) {
      return `${cleanBase}/q/${activeDynamicCode}`;
    }

    if (engineType === 'url') {
      return websiteUrl.trim() || cleanBase;
    }

    if (engineType === 'vcard') {
      if (vcardOutputMode === 'dynamic') {
        // Encode lightweight interactive digital card URL parameters if not yet registered as shortlink
        const params = new URLSearchParams();
        params.set('q', 'vcard-live');
        if (vcardFullName) params.set('fn', vcardFullName);
        if (vcardJobTitle) params.set('title', vcardJobTitle);
        if (vcardOrg) params.set('org', vcardOrg);
        if (vcardPhone) params.set('tel', vcardPhone);
        if (vcardWhatsapp) params.set('wa', vcardWhatsapp);
        if (vcardEmail) params.set('email', vcardEmail);
        if (vcardWebsite) params.set('url', vcardWebsite);
        if (vcardAddress) params.set('adr', vcardAddress);
        params.set('theme', vcardTheme);
        return `${cleanBase}/?${params.toString()}`;
      }

      const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${vcardFullName.trim() || 'Contact'}`,
        vcardOrg.trim() ? `ORG:${vcardOrg.trim()}` : '',
        vcardJobTitle.trim() ? `TITLE:${vcardJobTitle.trim()}` : '',
        vcardPhone.trim() ? `TEL;TYPE=CELL:${vcardPhone.trim()}` : '',
        vcardEmail.trim() ? `EMAIL;TYPE=INTERNET:${vcardEmail.trim()}` : '',
        vcardWebsite.trim() ? `URL:${vcardWebsite.trim()}` : '',
        vcardAddress.trim() ? `ADR;TYPE=WORK:;;${vcardAddress.trim()};;;;` : '',
        vcardBio.trim() ? `NOTE:${vcardBio.trim()}` : '',
        'END:VCARD'
      ].filter(Boolean);
      return lines.join('\n');
    }

    if (engineType === 'wifi') {
      const escapeWifi = (str: string) => str.replace(/([\\;,:])/g, '\\$1');
      const s = escapeWifi(wifiSsid.trim() || 'Network');
      const p = wifiEncryption === 'nopass' ? '' : escapeWifi(wifiPassword);
      const h = wifiHidden ? 'true' : 'false';
      return `WIFI:T:${wifiEncryption};S:${s};P:${p};H:${h};;`;
    }

    if (engineType === 'pdf') {
      if (uploadedPdfMeta?.shareUrl) return uploadedPdfMeta.shareUrl;
      if (pdfUrl.trim()) return pdfUrl.trim();
      return `${cleanBase}/?tab=qrstudio`;
    }

    if (engineType === 'applink') {
      return appIosUrl.trim() || appAndroidUrl.trim() || appFallbackUrl.trim() || cleanBase;
    }

    return cleanBase;
  }, [
    receiverBaseUrl,
    activeDynamicCode,
    engineType,
    websiteUrl,
    vcardOutputMode,
    vcardTheme,
    vcardFullName,
    vcardOrg,
    vcardJobTitle,
    vcardBio,
    vcardPhone,
    vcardWhatsapp,
    vcardEmail,
    vcardWebsite,
    vcardAddress,
    wifiSsid,
    wifiPassword,
    wifiEncryption,
    wifiHidden,
    uploadedPdfMeta,
    pdfUrl,
    appIosUrl,
    appAndroidUrl,
    appFallbackUrl
  ]);

  // Helper: Check if module (r, c) belongs to one of the 3 7x7 finder patterns
  const isFinderModule = (r: number, c: number, count: number): boolean => {
    if (r < 7 && c < 7) return true;
    if (r < 7 && c >= count - 7) return true;
    if (r >= count - 7 && c < 7) return true;
    return false;
  };

  // Helper: Draw a custom eye shape (square, rounded, circle, diamond, leaf/tear-drop)
  const traceEyeShapePath = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    shape: QrOuterEyeShape | QrInnerEyeShape,
    radiusBase: number
  ) => {
    ctx.beginPath();
    if (shape === 'circle') {
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    } else if (shape === 'rounded') {
      ctx.roundRect(x, y, size, size, radiusBase);
    } else if (shape === 'leaf') {
      // Asymmetric tear-drop / leaf corners
      ctx.roundRect(x, y, size, size, [radiusBase * 1.6, radiusBase * 0.25, radiusBase * 1.6, radiusBase * 0.25]);
    } else if (shape === 'diamond') {
      const half = size / 2;
      ctx.moveTo(x + half, y);
      ctx.lineTo(x + size, y + half);
      ctx.lineTo(x + half, y + size);
      ctx.lineTo(x, y + half);
      ctx.closePath();
    } else {
      ctx.rect(x, y, size, size);
    }
  };

  // Draw custom QRCG-style QR Canvas (supports high-res export scale)
  const renderStyledQrCanvas = useCallback(
    async (targetCanvas: HTMLCanvasElement, scaleFactor = 1) => {
      const payloadToDraw = qrPayload || 'https://beam-drop-mu.vercel.app';
      const qrObj = QRCode.create(payloadToDraw, { errorCorrectionLevel: 'H' });
      const modules = qrObj.modules;
      const count = modules.size;

      const baseWidth = 340 * scaleFactor;
      const hasBottomFrame =
        frameStyle === 'bottom-banner' || frameStyle === 'wifi-badge' || frameStyle === 'menu-badge';
      const hasTopFrame = frameStyle === 'top-banner';
      const extraHeight = (hasBottomFrame || hasTopFrame ? 62 : 0) * scaleFactor;
      const baseHeight = baseWidth + extraHeight;

      targetCanvas.width = baseWidth;
      targetCanvas.height = baseHeight;
      const ctx = targetCanvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, baseWidth, baseHeight);

      // 1. Draw Outer Frame Background if active
      const qrOffsetY = hasTopFrame ? 56 * scaleFactor : 0;
      if (frameStyle !== 'none') {
        const frameGrad = ctx.createLinearGradient(0, 0, baseWidth, baseHeight);
        frameGrad.addColorStop(0, frameColor);
        frameGrad.addColorStop(1, gradientMode !== 'none' ? fgColor2 : frameColor);
        ctx.fillStyle = frameGrad;
        ctx.beginPath();
        ctx.roundRect(0, 0, baseWidth, baseHeight, 26 * scaleFactor);
        ctx.fill();

        // Inner white card for QR
        const pad = 11 * scaleFactor;
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        ctx.roundRect(
          pad,
          qrOffsetY + pad,
          baseWidth - pad * 2,
          baseWidth - pad * 2,
          18 * scaleFactor
        );
        ctx.fill();

        // Frame CTA Text Badge
        ctx.fillStyle = '#ffffff';
        ctx.font = `800 ${16 * scaleFactor}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const ctaText =
          frameStyle === 'wifi-badge'
            ? `WI-FI: ${(wifiSsid || 'JOIN NETWORK').toUpperCase()}`
            : frameStyle === 'menu-badge'
            ? 'SCAN FOR DIGITAL MENU'
            : (frameText || 'SCAN ME').toUpperCase();

        if (hasTopFrame) {
          ctx.fillText(ctaText, baseWidth / 2, 29 * scaleFactor);
        } else {
          ctx.fillText(ctaText, baseWidth / 2, baseWidth + 29 * scaleFactor);
        }
      } else {
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        ctx.roundRect(0, 0, baseWidth, baseHeight, 24 * scaleFactor);
        ctx.fill();
      }

      // 2. Setup QR Foreground Fill (Solid, Linear, or Radial Gradient)
      const qrPadding = 28 * scaleFactor;
      const qrDrawArea = baseWidth - qrPadding * 2;
      const cellSize = qrDrawArea / count;
      const startX = qrPadding;
      const startY = qrOffsetY + qrPadding;

      let mainFill: string | CanvasGradient = fgColor;
      if (gradientMode === 'linear-diag') {
        const grad = ctx.createLinearGradient(startX, startY, startX + qrDrawArea, startY + qrDrawArea);
        grad.addColorStop(0, fgColor);
        grad.addColorStop(1, fgColor2);
        mainFill = grad;
      } else if (gradientMode === 'linear-horiz') {
        const grad = ctx.createLinearGradient(startX, startY, startX + qrDrawArea, startY);
        grad.addColorStop(0, fgColor);
        grad.addColorStop(1, fgColor2);
        mainFill = grad;
      } else if (gradientMode === 'linear-vert') {
        const grad = ctx.createLinearGradient(startX, startY, startX, startY + qrDrawArea);
        grad.addColorStop(0, fgColor);
        grad.addColorStop(1, fgColor2);
        mainFill = grad;
      } else if (gradientMode === 'radial') {
        const cx = startX + qrDrawArea / 2;
        const cy = startY + qrDrawArea / 2;
        const grad = ctx.createRadialGradient(cx, cy, qrDrawArea * 0.05, cx, cy, qrDrawArea * 0.65);
        grad.addColorStop(0, fgColor);
        grad.addColorStop(1, fgColor2);
        mainFill = grad;
      }

      // Center logo exclusion zone (dynamically sized to include Quiet Zone padding so modules never touch logo)
      const hasLogo = logoPreset !== 'none';
      const logoBoxSize = 58 * scaleFactor;
      const quietPadPx = logoQuietZonePad * scaleFactor;
      const totalLogoRadiusPx = logoBoxSize / 2 + quietPadPx + cellSize * 0.45;
      const centerCoordX = startX + qrDrawArea / 2;
      const centerCoordY = startY + qrDrawArea / 2;

      // 3. Draw Data Modules
      ctx.fillStyle = mainFill;
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (!modules.get(r, c)) continue;
          if (isFinderModule(r, c, count)) continue;

          const x = startX + c * cellSize;
          const y = startY + r * cellSize;
          const modCenterX = x + cellSize / 2;
          const modCenterY = y + cellSize / 2;

          if (hasLogo) {
            if (logoMask === 'circle') {
              const dist = Math.hypot(modCenterX - centerCoordX, modCenterY - centerCoordY);
              if (dist < totalLogoRadiusPx) continue;
            } else {
              if (
                Math.abs(modCenterX - centerCoordX) < totalLogoRadiusPx &&
                Math.abs(modCenterY - centerCoordY) < totalLogoRadiusPx
              ) {
                continue;
              }
            }
          }

          if (bodyShape === 'dots') {
            ctx.beginPath();
            ctx.arc(modCenterX, modCenterY, (cellSize / 2) * 0.86, 0, Math.PI * 2);
            ctx.fill();
          } else if (bodyShape === 'rounded') {
            ctx.beginPath();
            ctx.roundRect(
              x + cellSize * 0.05,
              y + cellSize * 0.05,
              cellSize * 0.9,
              cellSize * 0.9,
              cellSize * 0.35
            );
            ctx.fill();
          } else if (bodyShape === 'classy') {
            ctx.beginPath();
            ctx.roundRect(x, y, cellSize * 0.94, cellSize * 0.94, [
              cellSize * 0.45,
              0,
              cellSize * 0.45,
              0
            ]);
            ctx.fill();
          } else {
            ctx.fillRect(x, y, Math.ceil(cellSize), Math.ceil(cellSize));
          }
        }
      }

      // 4. Draw Independent 3 Corner Finder Eyes (7x7 outer ring + 3x3 inner ball)
      const drawFinderEye = (rowOffset: number, colOffset: number) => {
        const ex = startX + colOffset * cellSize;
        const ey = startY + rowOffset * cellSize;
        const outerSize = 7 * cellSize;
        const innerWhiteSize = 5 * cellSize;
        const ballSize = 3 * cellSize;

        // Outer Frame
        ctx.fillStyle = customEyeColor ? outerEyeColor : mainFill;
        traceEyeShapePath(ctx, ex, ey, outerSize, outerEyeShape, cellSize * 1.8);
        ctx.fill();

        // Inner White Cutout
        ctx.fillStyle = bgColor;
        traceEyeShapePath(ctx, ex + cellSize, ey + cellSize, innerWhiteSize, outerEyeShape, cellSize * 1.25);
        ctx.fill();

        // Inner Eye Ball
        ctx.fillStyle = customEyeColor ? innerEyeColor : mainFill;
        traceEyeShapePath(ctx, ex + cellSize * 2, ey + cellSize * 2, ballSize, innerEyeShape, cellSize * 0.85);
        ctx.fill();
      };

      drawFinderEye(0, 0);
      drawFinderEye(0, count - 7);
      drawFinderEye(count - 7, 0);

      // 5. Draw Center Logo Emblem with Quiet-Zone Border & Shape Mask (Circle / Rounded / Square)
      if (hasLogo) {
        const cx = centerCoordX;
        const cy = centerCoordY;
        const outerBadgeSize = logoBoxSize + quietPadPx * 2;
        const maskRadius =
          logoMask === 'circle'
            ? logoBoxSize / 2
            : logoMask === 'rounded'
            ? 14 * scaleFactor
            : 4 * scaleFactor;
        const outerRadius =
          logoMask === 'circle'
            ? outerBadgeSize / 2
            : logoMask === 'rounded'
            ? (14 + logoQuietZonePad * 0.6) * scaleFactor
            : 6 * scaleFactor;

        ctx.save();
        if (logoShadow) {
          ctx.shadowColor = 'rgba(15, 23, 42, 0.18)';
          ctx.shadowBlur = 14 * scaleFactor;
          ctx.shadowOffsetY = 3 * scaleFactor;
        }

        // Draw Quiet-Zone White Cushion Pad
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        if (logoMask === 'circle') {
          ctx.arc(cx, cy, outerBadgeSize / 2, 0, Math.PI * 2);
        } else {
          ctx.roundRect(
            cx - outerBadgeSize / 2,
            cy - outerBadgeSize / 2,
            outerBadgeSize,
            outerBadgeSize,
            outerRadius
          );
        }
        ctx.fill();
        ctx.restore();

        // Clip inner logo to selected mask (Circle Avatar Mask or Smooth Rounded Square)
        ctx.save();
        ctx.beginPath();
        if (logoMask === 'circle') {
          ctx.arc(cx, cy, logoBoxSize / 2, 0, Math.PI * 2);
        } else {
          ctx.roundRect(
            cx - logoBoxSize / 2,
            cy - logoBoxSize / 2,
            logoBoxSize,
            logoBoxSize,
            maskRadius
          );
        }
        ctx.clip();

        const activeCustomImg =
          logoPreset === 'custom' && customLogoDataUrl
            ? customLogoDataUrl
            : engineType === 'vcard' && vcardAvatarDataUrl && logoPreset === 'vcard'
            ? vcardAvatarDataUrl
            : null;

        if (activeCustomImg) {
          await new Promise<void>((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              // Cover center crop so rectangular photos fit cleanly inside circle/rounded mask
              const minDim = Math.min(img.width, img.height);
              const sx = (img.width - minDim) / 2;
              const sy = (img.height - minDim) / 2;
              ctx.drawImage(
                img,
                sx,
                sy,
                minDim,
                minDim,
                cx - logoBoxSize / 2,
                cy - logoBoxSize / 2,
                logoBoxSize,
                logoBoxSize
              );
              resolve();
            };
            img.onerror = () => resolve();
            img.src = activeCustomImg;
          });
        } else {
          ctx.fillStyle = mainFill;
          ctx.fillRect(cx - logoBoxSize / 2, cy - logoBoxSize / 2, logoBoxSize, logoBoxSize);

          ctx.fillStyle = '#ffffff';
          ctx.font = `900 ${17 * scaleFactor}px system-ui, -apple-system, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const badgeLabel =
            logoPreset === 'wifi'
              ? 'WiFi'
              : logoPreset === 'vcard'
              ? 'vCard'
              : logoPreset === 'pdf'
              ? 'PDF'
              : logoPreset === 'app'
              ? 'APP'
              : logoPreset === 'globe'
              ? 'WWW'
              : 'BD';
          ctx.fillText(badgeLabel, cx, cy);
        }
        ctx.restore();
      }
    },
    [
      qrPayload,
      bodyShape,
      outerEyeShape,
      innerEyeShape,
      fgColor,
      fgColor2,
      gradientMode,
      bgColor,
      customEyeColor,
      outerEyeColor,
      innerEyeColor,
      frameStyle,
      frameText,
      frameColor,
      wifiSsid,
      logoPreset,
      customLogoDataUrl,
      vcardAvatarDataUrl,
      engineType,
      logoMask,
      logoQuietZonePad,
      logoShadow
    ]
  );

  // Re-render live preview canvas and mini iPhone mockup QR canvas
  useEffect(() => {
    if (previewCanvasRef.current && previewTab === 'qr') {
      renderStyledQrCanvas(previewCanvasRef.current, 1);
    }
    if (miniMockupQrRef.current && previewTab === 'iphone') {
      renderStyledQrCanvas(miniMockupQrRef.current, 0.5);
    }
  }, [renderStyledQrCanvas, previewTab]);

  // Export High-Resolution Print PNG (4x Retina — 1360px+)
  const handleDownloadPng = async () => {
    try {
      const offscreen = document.createElement('canvas');
      await renderStyledQrCanvas(offscreen, 4);
      const dataUrl = offscreen.toDataURL('image/png', 1.0);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `beamdrop-qr-${engineType}-${Date.now().toString(36)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      notifySuccess('High-Res PNG Exported', 'Downloaded 4x print-ready QR code PNG.');
    } catch (_) {
      notifyError('Export Failed', 'Could not generate PNG file.');
    }
  };

  // Export Printable Horizontal Physical / NFC Business Card (1050x600px — 85mm x 55mm Standard)
  const handleDownloadPrintableBusinessCard = async () => {
    try {
      const canvas = document.createElement('canvas');
      const W = 1050;
      const H = 600;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Background based on selected vCard Theme
      if (vcardTheme === 'titanium-dark') {
        const bg = ctx.createLinearGradient(0, 0, W, H);
        bg.addColorStop(0, '#090d16');
        bg.addColorStop(0.6, '#111827');
        bg.addColorStop(1, '#1e293b');
        ctx.fillStyle = bg;
      } else if (vcardTheme === 'creator-aurora') {
        const bg = ctx.createLinearGradient(0, 0, W, H);
        bg.addColorStop(0, '#1e1b4b');
        bg.addColorStop(0.5, '#3b0764');
        bg.addColorStop(1, '#500724');
        ctx.fillStyle = bg;
      } else if (vcardTheme === 'swiss-minimal') {
        ctx.fillStyle = '#ffffff';
      } else {
        const bg = ctx.createLinearGradient(0, 0, W, H);
        bg.addColorStop(0, '#f0f9ff');
        bg.addColorStop(0.5, '#ffffff');
        bg.addColorStop(1, '#e0f2fe');
        ctx.fillStyle = bg;
      }
      ctx.beginPath();
      ctx.roundRect(0, 0, W, H, 32);
      ctx.fill();

      const isDarkCard = vcardTheme === 'titanium-dark' || vcardTheme === 'creator-aurora';
      const primaryText = isDarkCard ? '#ffffff' : '#0f172a';
      const secondaryText = isDarkCard ? '#38bdf8' : '#0284c7';
      const mutedText = isDarkCard ? '#94a3b8' : '#475569';

      // Subtle decorative accent bar on left edge
      ctx.fillStyle = vcardTheme === 'titanium-dark' ? '#d97706' : '#0284c7';
      ctx.fillRect(0, 0, 14, H);

      // 2. Left Column: Avatar + Identity + Contact Info
      let textStartX = 64;
      if (vcardAvatarDataUrl) {
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            ctx.save();
            ctx.beginPath();
            ctx.arc(114, 130, 52, 0, Math.PI * 2);
            ctx.clip();
            const minDim = Math.min(img.width, img.height);
            ctx.drawImage(
              img,
              (img.width - minDim) / 2,
              (img.height - minDim) / 2,
              minDim,
              minDim,
              62,
              78,
              104,
              104
            );
            ctx.restore();
            resolve();
          };
          img.onerror = () => resolve();
          img.src = vcardAvatarDataUrl;
        });
        textStartX = 190;
      }

      ctx.fillStyle = primaryText;
      ctx.font = '800 38px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(vcardFullName || 'Full Name', textStartX, 118);

      ctx.fillStyle = vcardTheme === 'titanium-dark' ? '#fbbf24' : secondaryText;
      ctx.font = '700 21px system-ui, -apple-system, sans-serif';
      ctx.fillText(vcardJobTitle || 'Executive Title', textStartX, 152);

      ctx.fillStyle = mutedText;
      ctx.font = '600 18px system-ui, -apple-system, sans-serif';
      ctx.fillText(vcardOrg || 'Organization', textStartX, 182);

      // Contact Details List
      const detailsYStart = 265;
      const details = [
        vcardPhone ? `TEL   ${vcardPhone}` : '',
        vcardEmail ? `MAIL  ${vcardEmail}` : '',
        vcardWebsite ? `WEB   ${vcardWebsite.replace(/^https?:\/\//, '')}` : '',
        vcardAddress ? `LOC   ${vcardAddress}` : ''
      ].filter(Boolean);

      ctx.font = '600 19px ui-monospace, monospace';
      details.forEach((line, idx) => {
        ctx.fillStyle = isDarkCard ? '#e2e8f0' : '#1e293b';
        ctx.fillText(line, 64, detailsYStart + idx * 46);
      });

      // Bottom NFC / Digital Identity Footer
      ctx.fillStyle = mutedText;
      ctx.font = '700 14px system-ui, -apple-system, sans-serif';
      ctx.fillText('SCAN QR TO SAVE CONTACT TO PHONE · BEAMDROP DIGITAL ID', 64, H - 48);

      // 3. Right Column: Custom Styled QR Code
      const qrOffscreen = document.createElement('canvas');
      await renderStyledQrCanvas(qrOffscreen, 1.25);
      const qrW = 360;
      const qrH = (qrOffscreen.height / qrOffscreen.width) * qrW;
      ctx.drawImage(qrOffscreen, W - qrW - 60, (H - qrH) / 2, qrW, qrH);

      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `beamdrop-business-card-${(vcardFullName || 'card').replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      notifySuccess('Printable Business Card Ready', 'Downloaded 1050x600px print-ready business card PNG.');
    } catch (_) {
      notifyError('Card Export Failed', 'Could not render printable business card.');
    }
  };

  // Export Pure Vector SVG for Print & Graphic Design
  const handleDownloadSvg = () => {
    try {
      const payloadToDraw = qrPayload || 'https://beam-drop-mu.vercel.app';
      const qrObj = QRCode.create(payloadToDraw, { errorCorrectionLevel: 'H' });
      const modules = qrObj.modules;
      const count = modules.size;
      const size = 400;
      const pad = 32;
      const cell = (size - pad * 2) / count;

      const rects: string[] = [];
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (!modules.get(r, c)) continue;
          const x = (pad + c * cell).toFixed(2);
          const y = (pad + r * cell).toFixed(2);
          const w = cell.toFixed(2);
          const rx =
            bodyShape === 'dots'
              ? (cell / 2).toFixed(2)
              : bodyShape === 'rounded'
              ? (cell * 0.32).toFixed(2)
              : '0';
          rects.push(
            `<rect x="${x}" y="${y}" width="${w}" height="${w}" rx="${rx}" fill="url(#qrGrad)" />`
          );
        }
      }

      const stop2 = gradientMode !== 'none' ? fgColor2 : fgColor;
      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="1200" height="1200">
  <defs>
    <linearGradient id="qrGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${fgColor}" />
      <stop offset="100%" stop-color="${stop2}" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="24" fill="${bgColor}" />
  ${rects.join('\n  ')}
</svg>`;

      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `beamdrop-qr-${engineType}-vector.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      notifySuccess('Vector SVG Exported', 'Downloaded scalable vector SVG QR code.');
    } catch (_) {
      notifyError('SVG Export Failed', 'Could not generate vector SVG.');
    }
  };

  // Copy QR Image to Clipboard
  const handleCopyQrImage = async () => {
    try {
      const offscreen = document.createElement('canvas');
      await renderStyledQrCanvas(offscreen, 2);
      offscreen.toBlob(async (blob) => {
        if (!blob) return;
        if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          setCopiedQrImage(true);
          notifyInfo('QR Image Copied', 'Copied customized QR card to clipboard.');
          setTimeout(() => setCopiedQrImage(false), 2000);
        }
      }, 'image/png');
    } catch (_) {
      navigator.clipboard.writeText(qrPayload);
      notifyInfo('Link Copied', 'Copied QR payload to clipboard.');
    }
  };

  // Upload PDF/Document via 24h Cloud Drop API for PDF Showcase QR
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPdf(true);
    try {
      setPdfTitle(file.name);
      const arrayBuf = await file.arrayBuffer();
      const hashBuf = await crypto.subtle.digest('SHA-256', arrayBuf);
      const sha256Hex = Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const createRes = await fetch('/api/cloud-drop?action=create_upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          mime: file.type || 'application/pdf',
          sha256: sha256Hex
        })
      });

      if (!createRes.ok) throw new Error('Cloud Drop upload session failed');
      const sessionData = await createRes.json();
      const dropId = sessionData.id;

      if (sessionData.mode === 'gdrive' && sessionData.uploadUrl) {
        const putRes = await fetch(sessionData.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/pdf' },
          body: file
        });
        const gdriveJson = await putRes.json();
        await fetch('/api/cloud-drop?action=finalize_upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: dropId,
            driveFileId: gdriveJson.id,
            sha256: sha256Hex
          })
        });
      } else {
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = String(reader.result || '');
            resolve(res.includes(',') ? res.split(',')[1] : res);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        await fetch('/api/cloud-drop?action=upload_hybrid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: dropId,
            name: file.name,
            size: file.size,
            mime: file.type || 'application/pdf',
            sha256: sha256Hex,
            base64Data
          })
        });
      }

      const cleanBase = receiverBaseUrl.replace(/\/$/, '');
      const shareUrl = `${cleanBase}/download?drop=${dropId}`;
      setUploadedPdfMeta({
        id: dropId,
        name: file.name,
        size: file.size,
        sha256: sha256Hex,
        shareUrl
      });
      setPdfUrl(shareUrl);
      notifySuccess(
        'PDF Uploaded to 24h Cloud Vault',
        'QR code now links directly to your verified PDF showcase.'
      );
    } catch (err: any) {
      notifyError('PDF Upload Error', err?.message || 'Could not upload PDF.');
    } finally {
      setIsUploadingPdf(false);
    }
  };

  // Create Dynamic QR (Trackable & Editable Anytime)
  const handleCreateDynamicQr = async () => {
    setIsCreatingDynamic(true);
    try {
      let title = websiteTitle || 'BeamDrop Dynamic QR';
      let targetUrl = websiteUrl;
      let payload: any = {};

      if (engineType === 'vcard') {
        title = `${vcardFullName} (vCard Plus)`;
        targetUrl = vcardWebsite;
        payload = {
          theme: vcardTheme,
          avatarDataUrl: vcardAvatarDataUrl,
          fullName: vcardFullName,
          jobTitle: vcardJobTitle,
          organization: vcardOrg,
          bio: vcardBio,
          phone: vcardPhone,
          whatsapp: vcardWhatsapp,
          email: vcardEmail,
          website: vcardWebsite,
          address: vcardAddress,
          linkedin: vcardLinkedin,
          github: vcardGithub,
          instagram: vcardInstagram,
          twitter: vcardTwitter
        };
      } else if (engineType === 'applink') {
        title = `${appName} (Multi-Store Link)`;
        targetUrl = appFallbackUrl || appIosUrl || appAndroidUrl;
        payload = {
          appName,
          appSubtitle,
          iosUrl: appIosUrl,
          androidUrl: appAndroidUrl,
          fallbackUrl: appFallbackUrl
        };
      } else if (engineType === 'pdf') {
        title = pdfTitle || 'PDF Document Showcase';
        targetUrl = uploadedPdfMeta?.shareUrl || pdfUrl;
        payload = {
          docTitle: pdfTitle,
          docAuthor: pdfAuthor,
          docDescription: pdfDescription
        };
      } else if (engineType === 'wifi') {
        title = `${wifiSsid} (Wi-Fi Card)`;
        payload = {
          ssid: wifiSsid,
          password: wifiPassword,
          encryption: wifiEncryption
        };
      }

      const res = await fetch('/api/qr-studio?action=create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: engineType === 'analytics' ? 'url' : engineType,
          title,
          targetUrl,
          payload
        })
      });

      if (!res.ok) throw new Error('Failed to register Dynamic QR');
      const data = await res.json();
      if (data.qr) {
        setActiveDynamicCode(data.qr.code);
        setDynamicQrs((prev) => [data.qr, ...prev.filter((i) => i.code !== data.qr.code)]);
        notifySuccess(
          'Dynamic QR Activated',
          `Shortlink /q/${data.qr.code} is live. You can edit its destination anytime!`
        );
      }
    } catch (err: any) {
      notifyError('Dynamic QR Error', err?.message || 'Could not create Dynamic QR.');
    } finally {
      setIsCreatingDynamic(false);
    }
  };

  // Refresh Dynamic QR Scan Analytics from Server
  const handleRefreshAnalytics = async () => {
    if (dynamicQrs.length === 0) return;
    setIsRefreshingAnalytics(true);
    try {
      const codes = dynamicQrs.map((q) => q.code).join(',');
      const res = await fetch(`/api/qr-studio?action=list&codes=${encodeURIComponent(codes)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items) && data.items.length > 0) {
          const map = new Map(data.items.map((i: DynamicQrItem) => [i.code, i]));
          setDynamicQrs((prev) =>
            prev.map((item) => (map.has(item.code) ? (map.get(item.code) as DynamicQrItem) : item))
          );
        }
      }
    } catch (_) {
    } finally {
      setIsRefreshingAnalytics(false);
    }
  };

  // Save edited destination URL on an existing Dynamic QR without changing its QR code
  const handleSaveDynamicEdit = async (code: string) => {
    try {
      const res = await fetch('/api/qr-studio?action=update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          title: editingTitle,
          targetUrl: editingTargetUrl
        })
      });

      setDynamicQrs((prev) =>
        prev.map((item) =>
          item.code === code
            ? {
                ...item,
                title: editingTitle || item.title,
                targetUrl: editingTargetUrl,
                updatedAt: Date.now()
              }
            : item
        )
      );

      if (res.ok) {
        notifySuccess(
          'Dynamic Destination Updated',
          `QR /q/${code} now redirects to the new link without re-printing!`
        );
      } else {
        notifyInfo('Updated Locally', `Saved new destination for /q/${code}.`);
      }
      setEditingCode(null);
    } catch (_) {
      setEditingCode(null);
    }
  };

  const handleDeleteDynamicQr = async (code: string) => {
    setDynamicQrs((prev) => prev.filter((i) => i.code !== code));
    if (activeDynamicCode === code) {
      setActiveDynamicCode('');
    }
    try {
      await fetch(`/api/qr-studio?action=delete&code=${encodeURIComponent(code)}`, {
        method: 'POST'
      });
    } catch (_) {}
    notifyInfo('Dynamic QR Removed', `Deleted /q/${code}.`);
  };

  // Direct .vcf download helper for the Live iPhone Mockup preview
  const handleTriggerMockupVcfDownload = () => {
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${vcardFullName || 'Contact'}`,
      vcardOrg ? `ORG:${vcardOrg}` : '',
      vcardJobTitle ? `TITLE:${vcardJobTitle}` : '',
      vcardPhone ? `TEL;TYPE=CELL:${vcardPhone}` : '',
      vcardEmail ? `EMAIL;TYPE=INTERNET:${vcardEmail}` : '',
      vcardWebsite ? `URL:${vcardWebsite}` : '',
      vcardAddress ? `ADR;TYPE=WORK:;;${vcardAddress};;;;` : '',
      'END:VCARD'
    ].filter(Boolean);
    const blob = new Blob([lines.join('\r\n')], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(vcardFullName || 'contact').replace(/[^a-zA-Z0-9_-]/g, '_')}.vcf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    notifySuccess('vCard Downloaded', 'Saved .vcf contact file.');
  };

  const ENGINE_TABS: Array<{
    id: QrEngineType;
    label: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'url', label: 'Website Link', subtitle: 'Static or Dynamic URL', icon: Globe },
    { id: 'vcard', label: 'vCard Plus', subtitle: 'Digital Business Card', icon: UserCheck },
    { id: 'wifi', label: 'Wi-Fi Direct', subtitle: '1-Scan Network Join', icon: Wifi },
    { id: 'pdf', label: 'PDF Showcase', subtitle: '24h Cloud Document', icon: FileText },
    { id: 'applink', label: 'App Store Link', subtitle: 'iOS & Android Routing', icon: Smartphone },
    {
      id: 'analytics',
      label: 'Dynamic QRs',
      subtitle: `Analytics (${dynamicQrs.length})`,
      icon: BarChart3
    }
  ];

  return (
    <div className="space-y-5 relative">
      {/* Studio Header Bar */}
      <div className="bg-white/90 backdrop-blur-xl border border-sky-200/80 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2 text-xs text-sky-700 font-semibold">
            <span>BeamDrop Universal OS</span>
            <span aria-hidden="true">·</span>
            <span>Core 2: QR Studio</span>
            <span aria-hidden="true">·</span>
            <span>Brand Identity &amp; Dynamic Analytics</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            QR Code Generator &amp; Digital Business Card Studio
          </h1>
        </div>

        {/* Dynamic QR Quick Status / Create Button */}
        <div className="flex items-center gap-2">
          {activeDynamicCode ? (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-mono font-bold text-emerald-900">/q/{activeDynamicCode}</span>
              <button
                type="button"
                onClick={() => setActiveDynamicCode('')}
                className="text-slate-500 hover:text-rose-600 font-semibold ml-1 cursor-pointer"
              >
                Reset to Static
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleCreateDynamicQr}
              disabled={isCreatingDynamic}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center space-x-2 shadow-sm transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-sky-400" />
              <span>
                {isCreatingDynamic ? 'Creating Shortlink...' : 'Make Dynamic QR (/q/shortlink)'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 6 QR Generator Engine Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {ENGINE_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = engineType === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setEngineType(tab.id);
                setActiveDynamicCode('');
              }}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                isActive
                  ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-500/15'
                  : 'bg-white/85 hover:bg-white text-slate-700 border-sky-100 hover:border-sky-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-sky-600'}`} />
                {tab.id === 'analytics' && dynamicQrs.length > 0 && (
                  <span
                    className={`text-[10px] font-mono font-bold ${
                      isActive ? 'text-sky-100' : 'text-sky-600'
                    }`}
                  >
                    {dynamicQrs.length} active
                  </span>
                )}
              </div>
              <div className="mt-2">
                <div className="text-xs font-bold leading-tight">{tab.label}</div>
                <div
                  className={`text-[10px] mt-0.5 truncate ${
                    isActive ? 'text-sky-100' : 'text-slate-400'
                  }`}
                >
                  {tab.subtitle}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main 2-Column QRCG Studio Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (7 Cols): Content Input + Next-Gen Visual Customizer */}
        <div className="lg:col-span-7 space-y-5">
          {/* ENGINE 1: WEBSITE LINK */}
          {engineType === 'url' && (
            <div className="bg-white/90 backdrop-blur-xl border border-sky-200/80 rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  1. Enter Website or Destination URL
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Generate a direct QR code for any link, or activate Dynamic QR to track scans and update the destination anytime.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Website URL</label>
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-sky-500 focus:outline-none text-sm font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Campaign / Label Title (For Dynamic Tracking)
                  </label>
                  <input
                    type="text"
                    value={websiteTitle}
                    onChange={(e) => setWebsiteTitle(e.target.value)}
                    placeholder="e.g. Summer Product Launch Menu"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-sky-500 focus:outline-none text-sm text-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ENGINE 2: INTERACTIVE DIGITAL BUSINESS CARD STUDIO (vCard Plus) */}
          {engineType === 'vcard' && (
            <div className="bg-white/90 backdrop-blur-xl border border-sky-200/80 rounded-2xl p-5 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    1. Interactive Digital Business Card Studio (vCard Plus)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Design a themed mobile profile card or direct offline .vcf contact QR, plus export printable NFC business cards.
                  </p>
                </div>

                {/* Output Mode Selector: Offline .vcf vs Hosted Digital Profile */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setVcardOutputMode('offline');
                      setPreviewTab('qr');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      vcardOutputMode === 'offline'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Offline .vcf QR
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVcardOutputMode('dynamic');
                      setPreviewTab('iphone');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      vcardOutputMode === 'dynamic'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Digital Profile Page
                  </button>
                </div>
              </div>

              {/* 4 Luxury Digital Card Themes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Select Digital Card Theme (Live iPhone Mockup &amp; Printable Card)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {VCARD_THEMES.map((theme) => {
                    const active = vcardTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => {
                          setVcardTheme(theme.id);
                          setPreviewTab('iphone');
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          active
                            ? 'border-sky-600 bg-sky-50/70 ring-2 ring-sky-500/20'
                            : 'border-slate-200 hover:border-sky-300 bg-white'
                        }`}
                      >
                        <div
                          className="w-full h-5 rounded-lg mb-2 border border-black/10"
                          style={{ background: theme.swatch }}
                        />
                        <div className="text-xs font-extrabold text-slate-900 truncate">
                          {theme.name}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          {theme.subtitle}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Avatar Upload + Executive Identity Fields */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <input
                  ref={vcardAvatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const dataUrl = String(reader.result || '');
                      setVcardAvatarDataUrl(dataUrl);
                      setCustomLogoDataUrl(dataUrl);
                      setLogoPreset('custom');
                      setLogoMask('circle');
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center font-black text-lg overflow-hidden shrink-0 border-2 border-white shadow-md">
                  {vcardAvatarDataUrl ? (
                    <img
                      src={vcardAvatarDataUrl}
                      alt="Profile Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (vcardFullName || 'B').charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-900">
                    Profile Photo &amp; Circular QR Center Avatar
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Automatically masked into a circle with a white quiet-zone border inside the QR code and iPhone profile.
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => vcardAvatarInputRef.current?.click()}
                    className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Photo</span>
                  </button>
                  {vcardAvatarDataUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setVcardAvatarDataUrl(null);
                        setCustomLogoDataUrl(null);
                        setLogoPreset('vcard');
                      }}
                      className="px-2.5 py-2 rounded-xl border border-slate-200 hover:bg-rose-50 text-xs font-bold text-rose-600 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={vcardFullName}
                    onChange={(e) => setVcardFullName(e.target.value)}
                    placeholder="Abderraouf Djemel"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Job Title / Role
                  </label>
                  <input
                    type="text"
                    value={vcardJobTitle}
                    onChange={(e) => setVcardJobTitle(e.target.value)}
                    placeholder="Founder & Principal Architect"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Company / Organization
                  </label>
                  <input
                    type="text"
                    value={vcardOrg}
                    onChange={(e) => setVcardOrg(e.target.value)}
                    placeholder="BeamDrop Inc."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={vcardPhone}
                    onChange={(e) => setVcardPhone(e.target.value)}
                    placeholder="+1 555 234 5678"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    WhatsApp Direct Number
                  </label>
                  <input
                    type="tel"
                    value={vcardWhatsapp}
                    onChange={(e) => setVcardWhatsapp(e.target.value)}
                    placeholder="+213555123456"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={vcardEmail}
                    onChange={(e) => setVcardEmail(e.target.value)}
                    placeholder="contact@company.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Website / Portfolio
                  </label>
                  <input
                    type="url"
                    value={vcardWebsite}
                    onChange={(e) => setVcardWebsite(e.target.value)}
                    placeholder="https://beam-drop-mu.vercel.app"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Location / Office City
                  </label>
                  <input
                    type="text"
                    value={vcardAddress}
                    onChange={(e) => setVcardAddress(e.target.value)}
                    placeholder="Algiers · Paris"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Executive Bio / Tagline
                  </label>
                  <input
                    type="text"
                    value={vcardBio}
                    onChange={(e) => setVcardBio(e.target.value)}
                    placeholder="Short headline displayed on your digital card..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Social Links Row */}
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Social &amp; Creator Profiles (Optional)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="url"
                    value={vcardLinkedin}
                    onChange={(e) => setVcardLinkedin(e.target.value)}
                    placeholder="LinkedIn URL (https://linkedin.com/in/...)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-xs text-slate-900"
                  />
                  <input
                    type="url"
                    value={vcardGithub}
                    onChange={(e) => setVcardGithub(e.target.value)}
                    placeholder="GitHub URL (https://github.com/...)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-xs text-slate-900"
                  />
                  <input
                    type="url"
                    value={vcardInstagram}
                    onChange={(e) => setVcardInstagram(e.target.value)}
                    placeholder="Instagram URL (https://instagram.com/...)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-xs text-slate-900"
                  />
                  <input
                    type="url"
                    value={vcardTwitter}
                    onChange={(e) => setVcardTwitter(e.target.value)}
                    placeholder="X / Twitter URL (https://x.com/...)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-xs text-slate-900"
                  />
                </div>
              </div>

              {/* Printable Business Card Export Banner */}
              <div className="p-3.5 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                    <CreditCard className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <div className="text-xs font-extrabold">
                      Printable NFC &amp; Executive Business Card (1050×600px)
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Exports your themed horizontal card with contact details + custom QR code ready for print.
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadPrintableBusinessCard}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center space-x-1.5 shrink-0 cursor-pointer transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Printable Card (PNG)</span>
                </button>
              </div>
            </div>
          )}

          {/* ENGINE 3: WI-FI DIRECT CONNECT */}
          {engineType === 'wifi' && (
            <div className="bg-white/90 backdrop-blur-xl border border-sky-200/80 rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  1. Wi-Fi Direct Connect Credentials
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Guests, cafés, and offices can join your Wi-Fi network with a single camera scan—no typing required.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Network Name (SSID)
                  </label>
                  <input
                    type="text"
                    value={wifiSsid}
                    onChange={(e) => setWifiSsid(e.target.value)}
                    placeholder="Office_5G_WiFi"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Security / Encryption
                  </label>
                  <select
                    value={wifiEncryption}
                    onChange={(e) =>
                      setWifiEncryption(e.target.value as 'WPA' | 'WEP' | 'nopass')
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  >
                    <option value="WPA">WPA / WPA2 / WPA3</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">None (Open Network)</option>
                  </select>
                </div>

                {wifiEncryption !== 'nopass' && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Wi-Fi Password
                    </label>
                    <div className="relative">
                      <input
                        type={showWifiPassword ? 'text' : 'password'}
                        value={wifiPassword}
                        onChange={(e) => setWifiPassword(e.target.value)}
                        placeholder="Enter Wi-Fi password"
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 bg-slate-50/70 text-sm font-mono text-slate-900 focus:border-sky-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowWifiPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {showWifiPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <div className="sm:col-span-2 flex items-center space-x-2 pt-1">
                  <input
                    id="wifiHiddenCheck"
                    type="checkbox"
                    checked={wifiHidden}
                    onChange={(e) => setWifiHidden(e.target.checked)}
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <label htmlFor="wifiHiddenCheck" className="text-xs font-medium text-slate-700">
                    This is a hidden SSID network
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ENGINE 4: PDF & DOCUMENT SHOWCASE */}
          {engineType === 'pdf' && (
            <div className="bg-white/90 backdrop-blur-xl border border-sky-200/80 rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  1. PDF &amp; Document Showcase (Powered by 24h Cloud Drop)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upload any PDF, restaurant menu, brochure, or catalog to generate a verified SHA-256 download QR code.
                </p>
              </div>

              <input
                ref={pdfFileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,application/pdf"
                onChange={handlePdfUpload}
                className="hidden"
              />

              <div className="p-4 rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      {uploadedPdfMeta
                        ? uploadedPdfMeta.name
                        : 'Upload PDF or Document to 24h Cloud Drop'}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {uploadedPdfMeta
                        ? `${formatBytes(uploadedPdfMeta.size)} · SHA-256 Verified · Ready to Scan`
                        : 'Direct Google Drive / Hybrid Cloud Vault with 24-hour auto-expiry'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => pdfFileInputRef.current?.click()}
                  disabled={isUploadingPdf}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center space-x-1.5 shrink-0 cursor-pointer transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>
                    {isUploadingPdf
                      ? 'Uploading...'
                      : uploadedPdfMeta
                      ? 'Replace PDF'
                      : 'Select PDF File'}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Document Title
                  </label>
                  <input
                    type="text"
                    value={pdfTitle}
                    onChange={(e) => setPdfTitle(e.target.value)}
                    placeholder="Product Catalog 2026.pdf"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Company / Author
                  </label>
                  <input
                    type="text"
                    value={pdfAuthor}
                    onChange={(e) => setPdfAuthor(e.target.value)}
                    placeholder="BeamDrop Labs"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Direct Document URL (Auto-filled when uploading above)
                  </label>
                  <input
                    type="url"
                    value={pdfUrl}
                    onChange={(e) => setPdfUrl(e.target.value)}
                    placeholder="https://beam-drop-mu.vercel.app/download?drop=..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-mono text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ENGINE 5: MULTI-STORE APP LINK */}
          {engineType === 'applink' && (
            <div className="bg-white/90 backdrop-blur-xl border border-sky-200/80 rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  1. Multi-Store Smart App QR (iOS &amp; Android)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  One unified QR code that routes iPhone users to the Apple App Store and Android users to Google Play.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">App Name</label>
                  <input
                    type="text"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Developer / Tagline
                  </label>
                  <input
                    type="text"
                    value={appSubtitle}
                    onChange={(e) => setAppSubtitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Apple App Store URL (iOS / iPadOS)
                  </label>
                  <input
                    type="url"
                    value={appIosUrl}
                    onChange={(e) => setAppIosUrl(e.target.value)}
                    placeholder="https://apps.apple.com/app/..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-mono text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Google Play Store URL (Android)
                  </label>
                  <input
                    type="url"
                    value={appAndroidUrl}
                    onChange={(e) => setAppAndroidUrl(e.target.value)}
                    placeholder="https://play.google.com/store/apps/details?id=..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-mono text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleCreateDynamicQr}
                  disabled={isCreatingDynamic}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center space-x-2 cursor-pointer transition-colors"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Generate Smart OS-Routing QR (/q/shortlink)</span>
                </button>
              </div>
            </div>
          )}

          {/* ENGINE 6: DYNAMIC QR MANAGER & REAL-TIME SCAN ANALYTICS */}
          {engineType === 'analytics' && (
            <div className="bg-white/90 backdrop-blur-xl border border-sky-200/80 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Dynamic QR Campaigns &amp; Live Scan Telemetry
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Update any Dynamic QR destination URL in real time without re-printing the physical QR code.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRefreshAnalytics}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center space-x-1.5 cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      isRefreshingAnalytics ? 'animate-spin text-sky-600' : ''
                    }`}
                  />
                  <span>Sync Scans</span>
                </button>
              </div>

              {dynamicQrs.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
                  <BarChart3 className="w-8 h-8 text-slate-400 mx-auto" />
                  <div className="text-sm font-bold text-slate-700">
                    No Dynamic QR Codes Created Yet
                  </div>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Click &ldquo;Make Dynamic QR (/q/shortlink)&rdquo; on any Website, vCard, PDF, or App Link to track scans and edit destinations anytime.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {dynamicQrs.map((item) => {
                    const shortUrl = `${receiverBaseUrl.replace(/\/$/, '')}/q/${item.code}`;
                    const isEditing = editingCode === item.code;
                    return (
                      <div
                        key={item.code}
                        className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-white transition-colors space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-extrabold text-slate-900">
                                {item.title}
                              </span>
                              <span className="text-xs text-slate-400" aria-hidden="true">
                                ·
                              </span>
                              <span className="text-xs font-mono font-bold text-sky-600">
                                /q/{item.code}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono truncate max-w-md mt-0.5">
                              Target: {item.targetUrl || 'Interactive Digital Card'}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-xs">
                            <div className="text-right">
                              <div className="font-extrabold text-slate-900">
                                {item.scans || 0} Scans
                              </div>
                              <div className="text-[10px] text-slate-500">
                                iOS {item.osBreakdown?.iOS || 0} · Android{' '}
                                {item.osBreakdown?.Android || 0} · Web{' '}
                                {item.osBreakdown?.Desktop || 0}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveDynamicCode(item.code);
                                notifyInfo(
                                  'Loaded in Preview',
                                  `Previewing Dynamic QR /q/${item.code}`
                                );
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold cursor-pointer"
                            >
                              Load QR
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCode(isEditing ? null : item.code);
                                setEditingTitle(item.title);
                                setEditingTargetUrl(item.targetUrl || '');
                              }}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
                              title="Edit Destination URL Live"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <a
                              href={shortUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                              title="Test Dynamic Shortlink"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteDynamicQr(item.code)}
                              className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 cursor-pointer"
                              title="Delete Dynamic QR"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {isEditing && (
                          <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                            <div className="sm:col-span-4">
                              <label className="block text-[10px] font-bold text-slate-600 mb-1">
                                Campaign Title
                              </label>
                              <input
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                              />
                            </div>
                            <div className="sm:col-span-6">
                              <label className="block text-[10px] font-bold text-slate-600 mb-1">
                                New Destination URL (Updates live without changing QR)
                              </label>
                              <input
                                type="url"
                                value={editingTargetUrl}
                                onChange={(e) => setEditingTargetUrl(e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <button
                                type="button"
                                onClick={() => handleSaveDynamicEdit(item.code)}
                                className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: NEXT-GEN VISUAL DESIGN STUDIO */}
          <div className="bg-white/90 backdrop-blur-xl border border-sky-200/80 rounded-2xl p-5 shadow-sm space-y-5">
            {/* 1-Click Designer Presets Bar */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  1-Click Designer Presets
                </span>
                <span className="text-[11px] text-slate-500">
                  Instant Color, Eye &amp; Pattern Harmony
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {DESIGNER_PRESETS.map((preset) => {
                  const isSelected = activePresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyDesignerPreset(preset)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center space-x-2.5 ${
                        isSelected
                          ? 'border-sky-600 bg-sky-50/80 ring-2 ring-sky-500/20'
                          : 'border-slate-200 hover:border-sky-300 bg-white'
                      }`}
                    >
                      <span
                        className="w-7 h-7 rounded-lg shrink-0 shadow-xs border border-black/10"
                        style={{
                          background: `linear-gradient(135deg, ${preset.fgColor}, ${preset.fgColor2})`
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-extrabold text-slate-900 truncate">
                          {preset.name}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">{preset.badge}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-y border-slate-100 py-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  2. Fine-Tune Shapes, Eyes, Gradients &amp; Logo Mask
                </h2>
                <p className="text-xs text-slate-500">
                  Level H (30% error redundancy) guarantees instant scanning with custom logos.
                </p>
              </div>

              {/* Segmented Customizer Tabs */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl shrink-0">
                {[
                  { id: 'shapes', label: 'Shapes & Eyes', icon: Shapes },
                  { id: 'colors', label: 'Gradients', icon: Palette },
                  { id: 'frame', label: '3D Frame', icon: Frame },
                  { id: 'logo', label: 'Logo Mask', icon: ImageIcon }
                ].map((t) => {
                  const Icon = t.icon;
                  const active = activeCustTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActiveCustTab(t.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                        active
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TAB 1: MODULE & INDEPENDENT EYE SHAPES */}
            {activeCustTab === 'shapes' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Data Pattern Module Style
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(
                      [
                        { id: 'square', label: 'Classic Square' },
                        { id: 'rounded', label: 'Smooth Rounded' },
                        { id: 'dots', label: 'Modern Dots' },
                        { id: 'classy', label: 'Classy Leaf' }
                      ] as const
                    ).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setBodyShape(s.id)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                          bodyShape === s.id
                            ? 'bg-sky-50 border-sky-500 text-sky-900'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      Outer Eye Frame Shape
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { id: 'square', label: 'Sharp Square' },
                          { id: 'rounded', label: 'Soft Rounded' },
                          { id: 'circle', label: 'Circle Ring' },
                          { id: 'leaf', label: 'Tear-Drop Leaf' }
                        ] as const
                      ).map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => setOuterEyeShape(e.id)}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                            outerEyeShape === e.id
                              ? 'bg-sky-50 border-sky-500 text-sky-900'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {e.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      Inner Eye Center Ball Shape
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { id: 'square', label: 'Square Dot' },
                          { id: 'rounded', label: 'Rounded Dot' },
                          { id: 'circle', label: 'Circle Dot' },
                          { id: 'diamond', label: 'Diamond Core' },
                          { id: 'leaf', label: 'Leaf Core' }
                        ] as const
                      ).map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => setInnerEyeShape(e.id)}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                            innerEyeShape === e.id
                              ? 'bg-sky-50 border-sky-500 text-sky-900'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {e.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: DUAL-TONE & RADIAL GRADIENTS + INDEPENDENT EYE COLORS */}
            {activeCustTab === 'colors' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Gradient Direction &amp; Mode
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {(
                      [
                        { id: 'linear-diag', label: 'Diagonal 135°' },
                        { id: 'linear-horiz', label: 'Horizontal' },
                        { id: 'linear-vert', label: 'Vertical' },
                        { id: 'radial', label: 'Radial Center' },
                        { id: 'none', label: 'Solid Color' }
                      ] as const
                    ).map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setGradientMode(g.id)}
                        className={`py-2 px-2.5 rounded-xl border text-xs font-bold cursor-pointer ${
                          gradientMode === g.id
                            ? 'bg-sky-50 border-sky-500 text-sky-900'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Start Color
                    </label>
                    <input
                      type="color"
                      value={fgColor}
                      onChange={(e) => setFgColor(e.target.value)}
                      className="w-full h-9 rounded-lg cursor-pointer border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      End Color (Gradient)
                    </label>
                    <input
                      type="color"
                      value={fgColor2}
                      onChange={(e) => setFgColor2(e.target.value)}
                      disabled={gradientMode === 'none'}
                      className="w-full h-9 rounded-lg cursor-pointer border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      QR Background
                    </label>
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="w-full h-9 rounded-lg cursor-pointer border border-slate-200"
                    />
                  </div>
                </div>

                {/* Independent Corner Eye Colors */}
                <div className="pt-2 border-t border-slate-100 space-y-2.5">
                  <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customEyeColor}
                      onChange={(e) => setCustomEyeColor(e.target.checked)}
                      className="rounded text-sky-600"
                    />
                    <span>Use Independent Corner Eye Colors (Outer Frame vs Inner Dot)</span>
                  </label>

                  {customEyeColor && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Outer Eye Frame Color
                        </label>
                        <input
                          type="color"
                          value={outerEyeColor}
                          onChange={(e) => setOuterEyeColor(e.target.value)}
                          className="w-full h-9 rounded-lg cursor-pointer border border-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Inner Eye Ball Color
                        </label>
                        <input
                          type="color"
                          value={innerEyeColor}
                          onChange={(e) => setInnerEyeColor(e.target.value)}
                          className="w-full h-9 rounded-lg cursor-pointer border border-slate-200"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: FRAMES & PRINT BADGES */}
            {activeCustTab === 'frame' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Print Badge / Frame Layout
                  </label>
                  <select
                    value={frameStyle}
                    onChange={(e) => setFrameStyle(e.target.value as QrFrameStyle)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800"
                  >
                    <option value="bottom-banner">Bottom CTA Banner</option>
                    <option value="top-banner">Top Header Banner</option>
                    <option value="wifi-badge">Wi-Fi Auto-SSID Frame</option>
                    <option value="menu-badge">Restaurant Menu Badge</option>
                    <option value="none">Minimal Borderless</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Call-To-Action Text
                  </label>
                  <input
                    type="text"
                    maxLength={24}
                    value={frameText}
                    onChange={(e) => setFrameText(e.target.value)}
                    placeholder="SCAN ME"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Frame Accent Color
                  </label>
                  <input
                    type="color"
                    value={frameColor}
                    onChange={(e) => setFrameColor(e.target.value)}
                    className="w-full h-9 rounded-xl cursor-pointer border border-slate-200"
                  />
                </div>
              </div>
            )}

            {/* TAB 4: CENTER BRAND LOGO WITH AVATAR MASK & QUIET-ZONE BORDER */}
            {activeCustTab === 'logo' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Center Emblem or Custom Photo
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { id: 'beamdrop', label: 'BeamDrop Bolt' },
                        { id: 'globe', label: 'WWW Globe' },
                        { id: 'vcard', label: 'vCard Badge' },
                        { id: 'wifi', label: 'Wi-Fi Emblem' },
                        { id: 'pdf', label: 'PDF Badge' },
                        { id: 'app', label: 'App Badge' },
                        { id: 'none', label: 'No Center Logo' }
                      ] as const
                    ).map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setLogoPreset(l.id)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer ${
                          logoPreset === l.id
                            ? 'bg-sky-50 border-sky-500 text-sky-900'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Logo Shape Mask & Quiet Zone Padding Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      Logo Shape Mask (Prevents Sharp Photo Corners)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { id: 'circle', label: 'Circle Mask' },
                          { id: 'rounded', label: 'Smooth Square' },
                          { id: 'square', label: 'Full Square' }
                        ] as const
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setLogoMask(m.id)}
                          className={`py-2 px-2.5 rounded-xl border text-xs font-bold cursor-pointer ${
                            logoMask === m.id
                              ? 'bg-sky-50 border-sky-500 text-sky-900'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">
                        Quiet-Zone White Border Pad
                      </label>
                      <span className="text-xs font-mono font-bold text-sky-600">
                        {logoQuietZonePad}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={16}
                      value={logoQuietZonePad}
                      onChange={(e) => setLogoQuietZonePad(Number(e.target.value))}
                      className="w-full accent-sky-600 cursor-pointer"
                    />
                    <label className="flex items-center space-x-2 text-xs text-slate-600 mt-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={logoShadow}
                        onChange={(e) => setLogoShadow(e.target.checked)}
                        className="rounded text-sky-600"
                      />
                      <span>Soft Depth Shadow around Logo</span>
                    </label>
                  </div>
                </div>

                <div className="pt-1 flex items-center gap-3">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        setCustomLogoDataUrl(String(reader.result || ''));
                        setLogoPreset('custom');
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Custom Logo / Avatar</span>
                  </button>
                  {customLogoDataUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomLogoDataUrl(null);
                        setLogoPreset('beamdrop');
                      }}
                      className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      Remove Custom Logo
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT STICKY COLUMN (5 Cols): Sticky Live Studio Preview & Interactive iPhone Mockup */}
        <div className="lg:col-span-5 lg:sticky lg:top-6 self-start z-20">
          <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-800 space-y-5">
            {/* Top Preview Header + Toggle between QR Matrix & Live iPhone Mockup */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 gap-2">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-sky-400 font-bold">
                  Live Studio Preview
                </span>
                <h3 className="text-sm font-extrabold text-white mt-0.5">
                  {previewTab === 'iphone'
                    ? 'Interactive Mobile Profile Card'
                    : activeDynamicCode
                    ? `Dynamic QR (/q/${activeDynamicCode})`
                    : 'High-Density Vector Matrix'}
                </h3>
              </div>

              {/* Dual Preview Mode Switcher */}
              <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewTab('qr')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center space-x-1 transition-all cursor-pointer ${
                    previewTab === 'qr'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <QrIcon className="w-3 h-3" />
                  <span>QR Code</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('iphone')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center space-x-1 transition-all cursor-pointer ${
                    previewTab === 'iphone'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3 h-3" />
                  <span>Mobile Card</span>
                </button>
              </div>
            </div>

            {/* VIEW A: HIGH-RES CUSTOM QR CANVAS */}
            {previewTab === 'qr' && (
              <div className="flex flex-col items-center justify-center bg-slate-950/70 rounded-2xl p-4 border border-slate-800/80">
                <canvas
                  ref={previewCanvasRef}
                  className="max-w-full h-auto rounded-2xl shadow-2xl"
                  style={{ maxHeight: '340px' }}
                />
              </div>
            )}

            {/* VIEW B: LIVE INTERACTIVE IPHONE MOCKUP FOR VCARD PLUS / DIGITAL IDENTITY */}
            {previewTab === 'iphone' && (
              <div className="flex justify-center">
                <div className="w-[292px] rounded-[38px] p-2.5 bg-slate-950 border-[3px] border-slate-700 shadow-2xl relative">
                  {/* iPhone Dynamic Island Notch */}
                  <div className="w-24 h-4 bg-black rounded-full mx-auto mb-2 flex items-center justify-end px-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500/80" />
                  </div>

                  {/* Screen Content Styled by Selected Luxury Theme */}
                  <div
                    className={`rounded-[28px] overflow-hidden p-4 space-y-3.5 transition-all ${
                      vcardTheme === 'titanium-dark'
                        ? 'bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white border border-amber-500/30'
                        : vcardTheme === 'creator-aurora'
                        ? 'bg-gradient-to-br from-indigo-950 via-purple-950 to-fuchsia-950 text-white border border-pink-500/30'
                        : vcardTheme === 'swiss-minimal'
                        ? 'bg-white text-slate-950 border border-slate-300'
                        : 'bg-gradient-to-b from-sky-50 via-white to-blue-50 text-slate-900 border border-sky-200'
                    }`}
                  >
                    {/* Header Banner & Circular Avatar */}
                    <div className="text-center pt-1">
                      <div
                        className={`w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center font-black text-xl overflow-hidden border-2 shadow-lg ${
                          vcardTheme === 'titanium-dark'
                            ? 'border-amber-400 bg-slate-800 text-amber-400'
                            : 'border-white bg-gradient-to-tr from-sky-500 to-indigo-600 text-white'
                        }`}
                      >
                        {vcardAvatarDataUrl ? (
                          <img
                            src={vcardAvatarDataUrl}
                            alt={vcardFullName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          (vcardFullName || 'B').charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="font-extrabold text-sm leading-tight truncate">
                        {vcardFullName || 'Your Name'}
                      </div>
                      <div
                        className={`text-[11px] font-semibold mt-0.5 truncate ${
                          vcardTheme === 'titanium-dark'
                            ? 'text-amber-400'
                            : vcardTheme === 'creator-aurora'
                            ? 'text-pink-300'
                            : 'text-sky-600'
                        }`}
                      >
                        {vcardJobTitle}
                      </div>
                      <div className="text-[10px] opacity-75 truncate">{vcardOrg}</div>
                      {vcardBio && (
                        <p className="text-[10px] opacity-75 mt-1.5 line-clamp-2 leading-relaxed">
                          {vcardBio}
                        </p>
                      )}
                    </div>

                    {/* Primary CTA: Save to Contacts (.vcf) */}
                    <button
                      type="button"
                      onClick={handleTriggerMockupVcfDownload}
                      className={`w-full py-2 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center space-x-1.5 shadow-md cursor-pointer ${
                        vcardTheme === 'titanium-dark'
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950'
                          : vcardTheme === 'creator-aurora'
                          ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                          : vcardTheme === 'swiss-minimal'
                          ? 'bg-slate-950 text-white'
                          : 'bg-sky-600 text-white'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Save to Contacts (.vcf)</span>
                    </button>

                    {/* Quick Action Grid: Call, WhatsApp, Email, Website */}
                    <div className="grid grid-cols-2 gap-1.5 text-[10px] font-bold">
                      {vcardPhone && (
                        <a
                          href={`tel:${vcardPhone}`}
                          className={`p-2 rounded-xl flex items-center space-x-1.5 truncate ${
                            vcardTheme === 'titanium-dark' || vcardTheme === 'creator-aurora'
                              ? 'bg-white/10 text-white'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          <Phone className="w-3 h-3 shrink-0 text-sky-400" />
                          <span className="truncate">Call</span>
                        </a>
                      )}
                      {vcardWhatsapp && (
                        <a
                          href={`https://wa.me/${vcardWhatsapp.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`p-2 rounded-xl flex items-center space-x-1.5 truncate ${
                            vcardTheme === 'titanium-dark' || vcardTheme === 'creator-aurora'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-emerald-50 text-emerald-800'
                          }`}
                        >
                          <MessageCircle className="w-3 h-3 shrink-0" />
                          <span className="truncate">WhatsApp</span>
                        </a>
                      )}
                      {vcardEmail && (
                        <a
                          href={`mailto:${vcardEmail}`}
                          className={`p-2 rounded-xl flex items-center space-x-1.5 truncate ${
                            vcardTheme === 'titanium-dark' || vcardTheme === 'creator-aurora'
                              ? 'bg-white/10 text-white'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          <Mail className="w-3 h-3 shrink-0 text-sky-400" />
                          <span className="truncate">Email</span>
                        </a>
                      )}
                      {vcardWebsite && (
                        <a
                          href={vcardWebsite}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`p-2 rounded-xl flex items-center space-x-1.5 truncate ${
                            vcardTheme === 'titanium-dark' || vcardTheme === 'creator-aurora'
                              ? 'bg-white/10 text-white'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          <Globe className="w-3 h-3 shrink-0 text-sky-400" />
                          <span className="truncate">Website</span>
                        </a>
                      )}
                    </div>

                    {/* Social Icons Row */}
                    {(vcardLinkedin || vcardGithub || vcardInstagram || vcardTwitter) && (
                      <div className="flex items-center justify-center gap-2 pt-0.5">
                        {vcardLinkedin && (
                          <a
                            href={vcardLinkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-black/10 hover:bg-black/20"
                          >
                            <Linkedin className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {vcardGithub && (
                          <a
                            href={vcardGithub}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-black/10 hover:bg-black/20"
                          >
                            <Github className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {vcardInstagram && (
                          <a
                            href={vcardInstagram}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-black/10 hover:bg-black/20"
                          >
                            <Instagram className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {vcardTwitter && (
                          <a
                            href={vcardTwitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-black/10 hover:bg-black/20"
                          >
                            <Twitter className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    )}

                    {/* Mini Embedded QR Badge at bottom of iPhone Card */}
                    <div className="pt-2 border-t border-current/10 flex items-center justify-between gap-2">
                      <div className="text-left">
                        <div className="text-[9px] font-bold uppercase tracking-wider opacity-75">
                          BeamDrop Digital ID
                        </div>
                        <div className="text-[10px] font-semibold">Scan to share contact</div>
                      </div>
                      <canvas
                        ref={miniMockupQrRef}
                        className="w-14 h-14 rounded-lg bg-white p-0.5 shadow-sm shrink-0"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Encoded Payload Inspector */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Encoded Target Payload
                </div>
                <div className="text-xs font-mono text-sky-300 truncate mt-0.5">
                  {qrPayload.replace(/\n/g, ' · ')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(qrPayload);
                  setCopiedPayloadText(true);
                  setTimeout(() => setCopiedPayloadText(false), 2000);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1 shrink-0 cursor-pointer"
              >
                {copiedPayloadText ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedPayloadText ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Primary Export Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleDownloadPng}
                className="py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-sky-600/20 cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download PNG (4x)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadSvg}
                className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center space-x-2 border border-slate-700 cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4 text-sky-400" />
                <span>Vector SVG</span>
              </button>
            </div>

            {engineType === 'vcard' && (
              <button
                type="button"
                onClick={handleDownloadPrintableBusinessCard}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center space-x-2 shadow-md cursor-pointer transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                <span>Download Printable Business Card (1050×600 PNG)</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyQrImage}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-slate-200 font-bold text-xs flex items-center justify-center space-x-2 border border-slate-700/80 cursor-pointer transition-colors"
            >
              {copiedQrImage ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4 text-sky-400" />
              )}
              <span>
                {copiedQrImage
                  ? 'QR Card Copied to Clipboard!'
                  : 'Copy QR Card Image to Clipboard'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
