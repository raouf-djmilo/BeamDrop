import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
  Globe,
  Type,
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
  MessageCircle,
  CreditCard,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Crown,
  X
} from 'lucide-react';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { formatBytes } from '../utils/formatters';

/**
 * Bullet-proof QR Code matrix generator with automatic Error Correction fallback ('H' -> 'Q' -> 'M' -> 'L')
 * and safe payload truncation so QRCode.create NEVER throws on long text, UTF-8, or vCard payloads.
 */
function safeCreateQrCode(rawPayload: string, preferHighEcc = true): any {
  const cleanPayload = (rawPayload || '').trim() || 'https://beam-drop-mu.vercel.app';
  const eccOrder: Array<'H' | 'Q' | 'M' | 'L'> = preferHighEcc
    ? ['H', 'Q', 'M', 'L']
    : ['M', 'L'];

  for (const level of eccOrder) {
    try {
      return QRCode.create(cleanPayload, { errorCorrectionLevel: level });
    } catch (_) {
      // Continue to lower ECC level
    }
  }

  // If payload exceeds maximum QR Version 40 capacity (~2953 bytes), truncate safely
  const truncatedLengths = [1800, 1200, 800, 400];
  for (const maxLen of truncatedLengths) {
    try {
      return QRCode.create(cleanPayload.slice(0, maxLen), { errorCorrectionLevel: 'L' });
    } catch (_) {}
  }

  return QRCode.create('https://beam-drop-mu.vercel.app', { errorCorrectionLevel: 'M' });
}

export type QrEngineType = 'url' | 'text' | 'wifi' | 'vcard' | 'pdf' | 'applink' | 'analytics';
export type QrBodyShape =
  | 'square'
  | 'rounded'
  | 'dots'
  | 'classy'
  | 'liquid'
  | 'star'
  | 'diamond'
  | 'heart'
  | 'bars';
export type QrOuterEyeShape = 'square' | 'rounded' | 'circle' | 'leaf';
export type QrInnerEyeShape = 'square' | 'rounded' | 'circle' | 'diamond' | 'leaf';
export type QrGradientMode = 'none' | 'linear-diag' | 'linear-horiz' | 'linear-vert' | 'radial';
export type QrFrameStyle =
  | 'none'
  | 'bottom-banner'
  | 'top-banner'
  | 'polaroid'
  | 'vip-ticket'
  | 'manga-panel'
  | 'retro-arcade'
  | 'wifi-badge';
export type QrLogoPreset = 'beamdrop' | 'globe' | 'vcard' | 'wifi' | 'pdf' | 'app' | 'custom' | 'none';
export type QrLogoMask = 'circle' | 'rounded' | 'square';
export type QrArtPresetId = 'none' | 'cyber-anime' | 'sakura-spirit' | 'mecha-neon' | 'cosmic-galaxy' | 'custom';
export type QrArtBlendMode = 'halftone' | 'texture';
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
  badge?: string;
  proOnly?: boolean;
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
  frameText?: string;
  artPreset?: QrArtPresetId;
  artBlendMode?: QrArtBlendMode;
  fx3d?: boolean;
  fxNeon?: boolean;
}

const DESIGNER_PRESETS: DesignerPreset[] = [
  {
    id: 'classic-clean',
    name: 'Classic',
    proOnly: false,
    fgColor: '#0f172a',
    fgColor2: '#1e293b',
    gradientMode: 'none',
    bgColor: '#ffffff',
    bodyShape: 'rounded',
    outerEyeShape: 'rounded',
    innerEyeShape: 'rounded',
    customEyeColor: false,
    outerEyeColor: '#0f172a',
    innerEyeColor: '#0f172a',
    frameStyle: 'none',
    frameColor: '#0f172a',
    artPreset: 'none',
    fx3d: false,
    fxNeon: false
  },
  {
    id: 'liquid-cyan',
    name: 'Liquid Flow',
    badge: 'FREE',
    proOnly: false,
    fgColor: '#0284c7',
    fgColor2: '#2563eb',
    gradientMode: 'linear-diag',
    bgColor: '#ffffff',
    bodyShape: 'liquid',
    outerEyeShape: 'circle',
    innerEyeShape: 'circle',
    customEyeColor: true,
    outerEyeColor: '#0369a1',
    innerEyeColor: '#0284c7',
    frameStyle: 'bottom-banner',
    frameColor: '#0284c7',
    artPreset: 'none',
    fx3d: false,
    fxNeon: false
  },
  {
    id: 'anime-cyber',
    name: 'Cyber Anime',
    badge: 'ART',
    proOnly: true,
    fgColor: '#311042',
    fgColor2: '#0f172a',
    gradientMode: 'linear-diag',
    bgColor: '#ffffff',
    bodyShape: 'liquid',
    outerEyeShape: 'leaf',
    innerEyeShape: 'diamond',
    customEyeColor: true,
    outerEyeColor: '#701a75',
    innerEyeColor: '#db2777',
    frameStyle: 'polaroid',
    frameColor: '#701a75',
    frameText: 'CYBER DROP',
    artPreset: 'cyber-anime',
    artBlendMode: 'halftone',
    fx3d: false,
    fxNeon: true
  },
  {
    id: 'sakura-art',
    name: 'Sakura Heart',
    badge: 'ART',
    proOnly: true,
    fgColor: '#881337',
    fgColor2: '#9d174d',
    gradientMode: 'radial',
    bgColor: '#fff1f2',
    bodyShape: 'heart',
    outerEyeShape: 'circle',
    innerEyeShape: 'circle',
    customEyeColor: true,
    outerEyeColor: '#881337',
    innerEyeColor: '#e11d48',
    frameStyle: 'polaroid',
    frameColor: '#be123c',
    frameText: 'SAKURA EDITION',
    artPreset: 'sakura-spirit',
    artBlendMode: 'halftone',
    fx3d: false,
    fxNeon: false
  },
  {
    id: 'manga-panel',
    name: 'Manga Ink',
    badge: '3D',
    proOnly: true,
    fgColor: '#090d16',
    fgColor2: '#1e293b',
    gradientMode: 'none',
    bgColor: '#ffffff',
    bodyShape: 'star',
    outerEyeShape: 'square',
    innerEyeShape: 'diamond',
    customEyeColor: true,
    outerEyeColor: '#090d16',
    innerEyeColor: '#e11d48',
    frameStyle: 'manga-panel',
    frameColor: '#090d16',
    frameText: 'SCAN!! ドドド',
    artPreset: 'none',
    fx3d: true,
    fxNeon: false
  },
  {
    id: 'obsidian-3d',
    name: '3D Gold Pop',
    badge: 'NEW',
    proOnly: true,
    fgColor: '#0f172a',
    fgColor2: '#b45309',
    gradientMode: 'linear-diag',
    bgColor: '#ffffff',
    bodyShape: 'diamond',
    outerEyeShape: 'rounded',
    innerEyeShape: 'diamond',
    customEyeColor: true,
    outerEyeColor: '#0f172a',
    innerEyeColor: '#d97706',
    frameStyle: 'vip-ticket',
    frameColor: '#0f172a',
    frameText: 'VIP ACCESS PASS',
    artPreset: 'none',
    fx3d: true,
    fxNeon: false
  },
  {
    id: 'retro-arcade',
    name: 'Arcade 8-Bit',
    badge: 'PRO',
    proOnly: true,
    fgColor: '#1e1b4b',
    fgColor2: '#4338ca',
    gradientMode: 'linear-vert',
    bgColor: '#f8fafc',
    bodyShape: 'bars',
    outerEyeShape: 'square',
    innerEyeShape: 'square',
    customEyeColor: true,
    outerEyeColor: '#1e1b4b',
    innerEyeColor: '#7c3aed',
    frameStyle: 'retro-arcade',
    frameColor: '#312e81',
    frameText: 'INSERT COIN • SCAN',
    artPreset: 'mecha-neon',
    artBlendMode: 'halftone',
    fx3d: true,
    fxNeon: false
  },
  {
    id: 'emerald-matrix',
    name: 'Emerald',
    badge: 'PRO',
    proOnly: true,
    fgColor: '#065f46',
    fgColor2: '#0d9488',
    gradientMode: 'radial',
    bgColor: '#ffffff',
    bodyShape: 'liquid',
    outerEyeShape: 'leaf',
    innerEyeShape: 'circle',
    customEyeColor: true,
    outerEyeColor: '#064e3b',
    innerEyeColor: '#059669',
    frameStyle: 'bottom-banner',
    frameColor: '#059669',
    artPreset: 'none',
    fx3d: false,
    fxNeon: false
  }
];

const VCARD_THEMES: Array<{
  id: VcardThemeId;
  name: string;
  swatch: string;
}> = [
  {
    id: 'liquid-glass',
    name: 'Liquid Glass',
    swatch: 'linear-gradient(135deg, #e0f2fe 0%, #38bdf8 50%, #2563eb 100%)'
  },
  {
    id: 'titanium-dark',
    name: 'Titanium Dark',
    swatch: 'linear-gradient(135deg, #090d16 0%, #1e293b 60%, #d97706 100%)'
  },
  {
    id: 'creator-aurora',
    name: 'Aurora',
    swatch: 'linear-gradient(135deg, #4f46e5 0%, #9333ea 50%, #ec4899 100%)'
  },
  {
    id: 'swiss-minimal',
    name: 'Minimal',
    swatch: 'linear-gradient(135deg, #0f172a 0%, #475569 50%, #f8fafc 100%)'
  }
];

// Built-in procedural anime/art illustration generator onto an offscreen canvas (100% offline & instant)
function createBuiltInArtCanvas(preset: QrArtPresetId, size = 400): HTMLCanvasElement | null {
  if (preset === 'none' || preset === 'custom') return null;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  if (preset === 'cyber-anime') {
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, '#fbcfe8');
    g.addColorStop(0.5, '#e0e7ff');
    g.addColorStop(1, '#bae6fd');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    // Neon anime sun & grid horizon
    const sunGrad = ctx.createLinearGradient(0, size * 0.15, 0, size * 0.75);
    sunGrad.addColorStop(0, '#f472b6');
    sunGrad.addColorStop(1, '#fbbf24');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(size / 2, size * 0.46, size * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Horizon stripes across sun
    ctx.fillStyle = '#e0e7ff';
    for (let y = size * 0.48; y < size * 0.78; y += 16) {
      ctx.fillRect(size * 0.15, y, size * 0.7, 5);
    }

    // Anime silhouette character / visor geometric motif in center
    ctx.fillStyle = 'rgba(244, 114, 182, 0.28)';
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.arc(
        (size * ((i * 37) % 100)) / 100,
        (size * ((i * 53) % 100)) / 100,
        8 + (i % 4) * 6,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  } else if (preset === 'sakura-spirit') {
    const g = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size * 0.7);
    g.addColorStop(0, '#ffe4e6');
    g.addColorStop(0.6, '#fecdd3');
    g.addColorStop(1, '#fda4af');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    // Floating Sakura petals
    ctx.fillStyle = 'rgba(244, 63, 94, 0.35)';
    const petals = [
      [0.2, 0.25],
      [0.75, 0.2],
      [0.5, 0.5],
      [0.3, 0.75],
      [0.8, 0.7],
      [0.15, 0.6],
      [0.6, 0.35],
      [0.42, 0.2]
    ];
    petals.forEach(([px, py], idx) => {
      ctx.save();
      ctx.translate(px * size, py * size);
      ctx.rotate((idx * Math.PI) / 4);
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  } else if (preset === 'mecha-neon') {
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, '#dbeafe');
    g.addColorStop(0.5, '#ede9fe');
    g.addColorStop(1, '#cffafe');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    // Mecha hex/circuit lines
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
    ctx.lineWidth = 5;
    for (let i = 40; i < size; i += 60) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(size - i, size);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.28, 0, Math.PI * 2);
    ctx.fill();
  } else if (preset === 'cosmic-galaxy') {
    const g = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size * 0.7);
    g.addColorStop(0, '#f3e8ff');
    g.addColorStop(0.5, '#e0e7ff');
    g.addColorStop(1, '#fae8ff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(168, 85, 247, 0.32)';
    ctx.beginPath();
    ctx.arc(size * 0.38, size * 0.42, size * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(59, 130, 246, 0.28)';
    ctx.beginPath();
    ctx.arc(size * 0.65, size * 0.58, size * 0.24, 0, Math.PI * 2);
    ctx.fill();
  }

  return c;
}

function hexToLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const num = parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16);
  if (Number.isNaN(num)) return 0;
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export const QrStudioView: React.FC<QrStudioViewProps> = ({ receiverBaseUrl }) => {
  const { notifyInfo, notifySuccess, notifyError } = useNotification();
  const { userTier, plan, dailyUsage, trackOp } = useAuth();

  const isPro = userTier === 'pro' || plan === 'pro';
  const qrUsed = dailyUsage.qrGenerationsCount || 0;
  const qrLimit = 15;
  const qrRemaining = isPro ? Infinity : Math.max(0, qrLimit - qrUsed);

  const triggerProUpgradeModal = useCallback((reason: string) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('beamdrop:quota_exceeded', {
          detail: {
            type: 'qr_generate',
            tier: userTier,
            trigger: 'pricing_modal',
            reason
          }
        })
      );
    }
  }, [userTier]);

  const enforceQrGenerationQuota = useCallback(async (): Promise<boolean> => {
    if (isPro) return true;
    try {
      const res = await trackOp('qr_generate');
      return res.allowed;
    } catch (err: any) {
      notifyError(
        'QR Limit Reached (15/15)',
        err?.message || 'Free & Guest limit is 15 QR codes. Upgrade to PRO for Unlimited QR Generation!'
      );
      return false;
    }
  }, [isPro, trackOp, notifyError]);

  // Active QR Mode
  const [engineType, setEngineType] = useState<QrEngineType>('url');

  // Optional Customization Drawer State (Collapsed by default for clean, simple UX)
  const [isCustomizing, setIsCustomizing] = useState<boolean>(false);

  // Preview Mode in Right Sticky Dock ('qr' vs 'iphone' for vCard)
  const [previewTab, setPreviewTab] = useState<'qr' | 'iphone'>('qr');

  // 1. Link (URL) State
  const [websiteUrl, setWebsiteUrl] = useState<string>('');
  const [websiteTitle, setWebsiteTitle] = useState<string>('');
  const [activeDynamicCode, setActiveDynamicCode] = useState<string>('');

  // 2. Text to QR State
  const [plainTextPayload, setPlainTextPayload] = useState<string>('');

  // 3. Wi-Fi State
  const [wifiSsid, setWifiSsid] = useState<string>('');
  const [wifiPassword, setWifiPassword] = useState<string>('');
  const [wifiEncryption, setWifiEncryption] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');
  const [wifiHidden, setWifiHidden] = useState<boolean>(false);
  const [showWifiPassword, setShowWifiPassword] = useState<boolean>(false);

  // 4. vCard (Digital Business Card) State
  const [vcardOutputMode, setVcardOutputMode] = useState<'offline' | 'dynamic'>('offline');
  const [vcardTheme, setVcardTheme] = useState<VcardThemeId>('titanium-dark');
  const [vcardAvatarDataUrl, setVcardAvatarDataUrl] = useState<string | null>(null);
  const [vcardFullName, setVcardFullName] = useState<string>('');
  const [vcardJobTitle, setVcardJobTitle] = useState<string>('');
  const [vcardOrg, setVcardOrg] = useState<string>('');
  const [vcardPhone, setVcardPhone] = useState<string>('');
  const [vcardWhatsapp, setVcardWhatsapp] = useState<string>('');
  const [vcardEmail, setVcardEmail] = useState<string>('');
  const [vcardWebsite, setVcardWebsite] = useState<string>('');
  const [vcardAddress, setVcardAddress] = useState<string>('');
  const vcardAvatarInputRef = useRef<HTMLInputElement | null>(null);

  // 5. PDF State
  const [pdfTitle, setPdfTitle] = useState<string>('');
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

  // 6. App Store Link State
  const [appName, setAppName] = useState<string>('');
  const [appIosUrl, setAppIosUrl] = useState<string>('');
  const [appAndroidUrl, setAppAndroidUrl] = useState<string>('');

  // 7. Saved Dynamic QRs State
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

  // Optional Visual Customization State (Clean defaults)
  const [activePresetId, setActivePresetId] = useState<string>('classic-clean');
  const [activeCustTab, setActiveCustTab] = useState<'art' | 'shapes' | 'colors' | 'frame' | 'logo'>('art');
  const [bodyShape, setBodyShape] = useState<QrBodyShape>('rounded');
  const [outerEyeShape, setOuterEyeShape] = useState<QrOuterEyeShape>('rounded');
  const [innerEyeShape, setInnerEyeShape] = useState<QrInnerEyeShape>('rounded');
  const [fgColor, setFgColor] = useState<string>('#0f172a');
  const [fgColor2, setFgColor2] = useState<string>('#0284c7');
  const [gradientMode, setGradientMode] = useState<QrGradientMode>('none');
  const [bgColor, setBgColor] = useState<string>('#ffffff');
  const [customEyeColor, setCustomEyeColor] = useState<boolean>(false);
  const [outerEyeColor, setOuterEyeColor] = useState<string>('#0f172a');
  const [innerEyeColor, setInnerEyeColor] = useState<string>('#0284c7');
  const [frameStyle, setFrameStyle] = useState<QrFrameStyle>('none');
  const [frameText, setFrameText] = useState<string>('SCAN ME');
  const [frameColor, setFrameColor] = useState<string>('#0f172a');

  // Artistic QR State (Photo/Anime Blend + 3D Pop + Neon Glow)
  const [artPreset, setArtPreset] = useState<QrArtPresetId>('none');
  const [customArtDataUrl, setCustomArtDataUrl] = useState<string | null>(null);
  const [artBlendMode, setArtBlendMode] = useState<QrArtBlendMode>('halftone');
  const [fx3d, setFx3d] = useState<boolean>(false);
  const [fxNeon, setFxNeon] = useState<boolean>(false);
  const artFileInputRef = useRef<HTMLInputElement | null>(null);

  // Logo & Masking State
  const [logoPreset, setLogoPreset] = useState<QrLogoPreset>('none');
  const [customLogoDataUrl, setCustomLogoDataUrl] = useState<string | null>(null);
  const [logoMask, setLogoMask] = useState<QrLogoMask>('circle');
  const [logoQuietZonePad, setLogoQuietZonePad] = useState<number>(8);
  const [logoShadow, setLogoShadow] = useState<boolean>(true);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const miniMockupQrRef = useRef<HTMLCanvasElement | null>(null);
  const [copiedQrImage, setCopiedQrImage] = useState<boolean>(false);

  const applyDesignerPreset = (preset: DesignerPreset) => {
    if (preset.proOnly && !isPro) {
      triggerProUpgradeModal(
        `🔒 "${preset.name}" Art Theme is exclusive to PRO users! Upgrade to PRO to unlock all Art Themes, Customizations & Unlimited QR generation.`
      );
      return;
    }
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
    if (preset.frameText) setFrameText(preset.frameText);
    setArtPreset(preset.artPreset || 'none');
    if (preset.artBlendMode) setArtBlendMode(preset.artBlendMode);
    setFx3d(Boolean(preset.fx3d));
    setFxNeon(Boolean(preset.fxNeon));
  };

  // Ensure non-PRO users cannot remain on a locked PRO preset if they sign out
  useEffect(() => {
    if (!isPro) {
      const currentPreset = DESIGNER_PRESETS.find((p) => p.id === activePresetId);
      if (currentPreset?.proOnly || artPreset !== 'none' || fx3d || fxNeon) {
        const cleanPreset = DESIGNER_PRESETS[0];
        setActivePresetId(cleanPreset.id);
        setFgColor(cleanPreset.fgColor);
        setFgColor2(cleanPreset.fgColor2);
        setGradientMode(cleanPreset.gradientMode);
        setBgColor(cleanPreset.bgColor);
        setBodyShape(cleanPreset.bodyShape);
        setOuterEyeShape(cleanPreset.outerEyeShape);
        setInnerEyeShape(cleanPreset.innerEyeShape);
        setCustomEyeColor(false);
        setFrameStyle('none');
        setArtPreset('none');
        setFx3d(false);
        setFxNeon(false);
        setLogoPreset('none');
      }
    }
  }, [isPro, activePresetId, artPreset, fx3d, fxNeon]);

  // Live Scannability Score (Contrast & Quiet Zone check)
  const scanSafety = useMemo(() => {
    const lumFg = hexToLuminance(fgColor);
    const lumBg = hexToLuminance(bgColor);
    const brightest = Math.max(lumFg, lumBg);
    const darkest = Math.min(lumFg, lumBg);
    const ratio = (brightest + 0.05) / (darkest + 0.05);
    const isInverted = lumFg > lumBg;
    if (isInverted || ratio < 2.8) {
      return {
        ok: false,
        label: isInverted ? 'Inverted Colors (Hard to Scan)' : 'Low Contrast',
        ratio: ratio.toFixed(1)
      };
    }
    return {
      ok: true,
      label: '100% Scan Ready',
      ratio: ratio.toFixed(1)
    };
  }, [fgColor, bgColor]);

  const handleAutoFixContrast = () => {
    setFgColor('#0f172a');
    setBgColor('#ffffff');
    setOuterEyeColor('#0f172a');
  };

  useEffect(() => {
    if (engineType !== 'vcard') {
      setPreviewTab('qr');
    }
  }, [engineType]);

  useEffect(() => {
    try {
      localStorage.setItem('beamdrop_dynamic_qrs_v1', JSON.stringify(dynamicQrs));
    } catch (_) {}
  }, [dynamicQrs]);

  // Compute effective QR payload string
  const qrPayload = useMemo(() => {
    const cleanBase = receiverBaseUrl.replace(/\/$/, '');

    if (activeDynamicCode) {
      return `${cleanBase}/q/${activeDynamicCode}`;
    }

    if (engineType === 'url') {
      return websiteUrl.trim() || cleanBase;
    }

    if (engineType === 'text') {
      return plainTextPayload.trim() || 'BeamDrop QR Text';
    }

    if (engineType === 'wifi') {
      const escapeWifi = (str: string) => str.replace(/([\\;,:])/g, '\\$1');
      const s = escapeWifi(wifiSsid.trim() || 'WiFi');
      const p = wifiEncryption === 'nopass' ? '' : escapeWifi(wifiPassword);
      const h = wifiHidden ? 'true' : 'false';
      return `WIFI:T:${wifiEncryption};S:${s};P:${p};H:${h};;`;
    }

    if (engineType === 'vcard') {
      if (vcardOutputMode === 'dynamic') {
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
        'END:VCARD'
      ].filter(Boolean);
      return lines.join('\n');
    }

    if (engineType === 'pdf') {
      if (uploadedPdfMeta?.shareUrl) return uploadedPdfMeta.shareUrl;
      if (pdfUrl.trim()) return pdfUrl.trim();
      return `${cleanBase}/?tab=qrstudio`;
    }

    if (engineType === 'applink') {
      return appIosUrl.trim() || appAndroidUrl.trim() || cleanBase;
    }

    return cleanBase;
  }, [
    receiverBaseUrl,
    activeDynamicCode,
    engineType,
    websiteUrl,
    plainTextPayload,
    wifiSsid,
    wifiPassword,
    wifiEncryption,
    wifiHidden,
    vcardOutputMode,
    vcardTheme,
    vcardFullName,
    vcardOrg,
    vcardJobTitle,
    vcardPhone,
    vcardWhatsapp,
    vcardEmail,
    vcardWebsite,
    vcardAddress,
    uploadedPdfMeta,
    pdfUrl,
    appIosUrl,
    appAndroidUrl
  ]);

  const isFinderModule = (r: number, c: number, count: number): boolean => {
    if (r < 7 && c < 7) return true;
    if (r < 7 && c >= count - 7) return true;
    if (r >= count - 7 && c < 7) return true;
    return false;
  };

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
      ctx.roundRect(x, y, size, size, [
        radiusBase * 1.6,
        radiusBase * 0.25,
        radiusBase * 1.6,
        radiusBase * 0.25
      ]);
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

  const drawCustomModuleShape = (
    ctx: CanvasRenderingContext2D,
    shape: QrBodyShape,
    x: number,
    y: number,
    cellSize: number,
    r: number,
    c: number,
    isDarkNeighbor: (nr: number, nc: number) => boolean
  ) => {
    const cx = x + cellSize / 2;
    const cy = y + cellSize / 2;

    if (shape === 'liquid') {
      const top = isDarkNeighbor(r - 1, c);
      const bottom = isDarkNeighbor(r + 1, c);
      const left = isDarkNeighbor(r, c - 1);
      const right = isDarkNeighbor(r, c + 1);
      const maxRad = cellSize * 0.48;
      const tl = !top && !left ? maxRad : 0;
      const tr = !top && !right ? maxRad : 0;
      const br = !bottom && !right ? maxRad : 0;
      const bl = !bottom && !left ? maxRad : 0;
      ctx.beginPath();
      ctx.roundRect(x - 0.35, y - 0.35, cellSize + 0.7, cellSize + 0.7, [tl, tr, br, bl]);
      ctx.fill();
      return;
    }

    if (shape === 'star') {
      const outerR = cellSize * 0.54;
      const innerR = cellSize * 0.22;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const rad = i % 2 === 0 ? outerR : innerR;
        const angle = (i * Math.PI) / 4;
        const px = cx + Math.cos(angle) * rad;
        const py = cy + Math.sin(angle) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      return;
    }

    if (shape === 'diamond') {
      const rad = cellSize * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - rad);
      ctx.lineTo(cx + rad, cy);
      ctx.lineTo(cx, cy + rad);
      ctx.lineTo(cx - rad, cy);
      ctx.closePath();
      ctx.fill();
      return;
    }

    if (shape === 'heart') {
      const w = cellSize * 0.92;
      const h = cellSize * 0.92;
      const hx = cx;
      const hy = cy - h * 0.18;
      ctx.beginPath();
      ctx.moveTo(hx, hy + h * 0.65);
      ctx.bezierCurveTo(hx - w * 0.55, hy + h * 0.3, hx - w * 0.5, hy - h * 0.25, hx, hy + h * 0.05);
      ctx.bezierCurveTo(hx + w * 0.5, hy - h * 0.25, hx + w * 0.55, hy + h * 0.3, hx, hy + h * 0.65);
      ctx.closePath();
      ctx.fill();
      return;
    }

    if (shape === 'bars') {
      const top = isDarkNeighbor(r - 1, c);
      const bottom = isDarkNeighbor(r + 1, c);
      const barW = cellSize * 0.76;
      const bx = cx - barW / 2;
      const rad = barW / 2;
      ctx.beginPath();
      ctx.roundRect(
        bx,
        top ? y - 0.5 : y + cellSize * 0.08,
        barW,
        cellSize + (top ? 0.5 : -cellSize * 0.08) + (bottom ? 0.5 : -cellSize * 0.08),
        [top ? 0 : rad, top ? 0 : rad, bottom ? 0 : rad, bottom ? 0 : rad]
      );
      ctx.fill();
      return;
    }

    if (shape === 'dots') {
      ctx.beginPath();
      ctx.arc(cx, cy, (cellSize / 2) * 0.86, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (shape === 'rounded') {
      ctx.beginPath();
      ctx.roundRect(
        x + cellSize * 0.05,
        y + cellSize * 0.05,
        cellSize * 0.9,
        cellSize * 0.9,
        cellSize * 0.35
      );
      ctx.fill();
      return;
    }

    if (shape === 'classy') {
      ctx.beginPath();
      ctx.roundRect(x, y, cellSize * 0.94, cellSize * 0.94, [
        cellSize * 0.45,
        0,
        cellSize * 0.45,
        0
      ]);
      ctx.fill();
      return;
    }

    ctx.fillRect(x, y, Math.ceil(cellSize), Math.ceil(cellSize));
  };

  const renderStyledQrCanvas = useCallback(
    async (targetCanvas: HTMLCanvasElement, scaleFactor = 1) => {
      const payloadToDraw = qrPayload || 'https://beam-drop-mu.vercel.app';
      const qrObj = safeCreateQrCode(payloadToDraw, true);
      const modules = qrObj.modules;
      const count = modules.size;

      const baseWidth = 320 * scaleFactor;
      const hasBottomFrame =
        frameStyle === 'bottom-banner' ||
        frameStyle === 'wifi-badge' ||
        frameStyle === 'polaroid' ||
        frameStyle === 'vip-ticket' ||
        frameStyle === 'manga-panel' ||
        frameStyle === 'retro-arcade';
      const hasTopFrame = frameStyle === 'top-banner' || frameStyle === 'vip-ticket' || frameStyle === 'retro-arcade';
      const bottomExtra = frameStyle === 'polaroid' ? 68 : hasBottomFrame ? 54 : 0;
      const topExtra = hasTopFrame ? 46 : 0;
      const baseHeight = baseWidth + (bottomExtra + topExtra) * scaleFactor;

      targetCanvas.width = baseWidth;
      targetCanvas.height = baseHeight;
      const ctx = targetCanvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, baseWidth, baseHeight);

      const qrOffsetY = topExtra * scaleFactor;
      const ctaText =
        frameStyle === 'wifi-badge'
          ? `WI-FI: ${(wifiSsid || 'JOIN').toUpperCase()}`
          : (frameText || 'SCAN ME').toUpperCase();

      // 1. Draw Frame & Card Background
      if (frameStyle === 'polaroid') {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(0, 0, baseWidth, baseHeight, 22 * scaleFactor);
        ctx.fill();
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 3 * scaleFactor;
        ctx.stroke();

        // Inner photo well border
        const pad = 14 * scaleFactor;
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        ctx.roundRect(pad, pad, baseWidth - pad * 2, baseWidth - pad * 2, 12 * scaleFactor);
        ctx.fill();

        // Polaroid signature caption bar
        ctx.fillStyle = frameColor;
        ctx.font = `900 ${16 * scaleFactor}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ctaText, baseWidth / 2, baseWidth + 32 * scaleFactor);
      } else if (frameStyle === 'manga-panel') {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, baseWidth, baseHeight);

        // Bold double comic book border
        ctx.strokeStyle = frameColor;
        ctx.lineWidth = 6 * scaleFactor;
        ctx.strokeRect(4 * scaleFactor, 4 * scaleFactor, baseWidth - 8 * scaleFactor, baseHeight - 8 * scaleFactor);
        ctx.lineWidth = 2 * scaleFactor;
        ctx.strokeRect(10 * scaleFactor, 10 * scaleFactor, baseWidth - 20 * scaleFactor, baseWidth - 20 * scaleFactor);

        // Corner speed-lines accent
        ctx.fillStyle = frameColor;
        ctx.fillRect(10 * scaleFactor, baseWidth - 4 * scaleFactor, baseWidth - 20 * scaleFactor, 46 * scaleFactor);
        ctx.fillStyle = '#ffffff';
        ctx.font = `900 italic ${16 * scaleFactor}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ctaText, baseWidth / 2, baseWidth + 19 * scaleFactor);
      } else if (frameStyle === 'vip-ticket') {
        const frameGrad = ctx.createLinearGradient(0, 0, baseWidth, baseHeight);
        frameGrad.addColorStop(0, frameColor);
        frameGrad.addColorStop(1, gradientMode !== 'none' ? fgColor2 : '#1e293b');
        ctx.fillStyle = frameGrad;
        ctx.beginPath();
        ctx.roundRect(0, 0, baseWidth, baseHeight, 24 * scaleFactor);
        ctx.fill();

        // Ticket side notches
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(0, qrOffsetY, 12 * scaleFactor, 0, Math.PI * 2);
        ctx.arc(baseWidth, qrOffsetY, 12 * scaleFactor, 0, Math.PI * 2);
        ctx.fill();

        const pad = 12 * scaleFactor;
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        ctx.roundRect(pad, qrOffsetY + pad, baseWidth - pad * 2, baseWidth - pad * 2, 16 * scaleFactor);
        ctx.fill();

        // Top & Bottom VIP labels
        ctx.fillStyle = '#fbbf24';
        ctx.font = `800 ${11 * scaleFactor}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★ BEAMDROP OFFICIAL PASS ★', baseWidth / 2, 24 * scaleFactor);

        ctx.fillStyle = '#ffffff';
        ctx.font = `900 ${15 * scaleFactor}px system-ui, -apple-system, sans-serif`;
        ctx.fillText(ctaText, baseWidth / 2, qrOffsetY + baseWidth + 24 * scaleFactor);
      } else if (frameStyle === 'retro-arcade') {
        ctx.fillStyle = frameColor;
        ctx.beginPath();
        ctx.roundRect(0, 0, baseWidth, baseHeight, 18 * scaleFactor);
        ctx.fill();

        const pad = 12 * scaleFactor;
        ctx.fillStyle = bgColor;
        ctx.fillRect(pad, qrOffsetY + pad, baseWidth - pad * 2, baseWidth - pad * 2);

        ctx.fillStyle = '#38bdf8';
        ctx.font = `900 ${11 * scaleFactor}px ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('HIGH SCORE • P2P READY', baseWidth / 2, 24 * scaleFactor);

        ctx.fillStyle = '#facc15';
        ctx.font = `900 ${14 * scaleFactor}px ui-monospace, monospace`;
        ctx.fillText(ctaText, baseWidth / 2, qrOffsetY + baseWidth + 24 * scaleFactor);
      } else if (frameStyle !== 'none') {
        const frameGrad = ctx.createLinearGradient(0, 0, baseWidth, baseHeight);
        frameGrad.addColorStop(0, frameColor);
        frameGrad.addColorStop(1, gradientMode !== 'none' ? fgColor2 : frameColor);
        ctx.fillStyle = frameGrad;
        ctx.beginPath();
        ctx.roundRect(0, 0, baseWidth, baseHeight, 24 * scaleFactor);
        ctx.fill();

        const pad = 10 * scaleFactor;
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        ctx.roundRect(
          pad,
          qrOffsetY + pad,
          baseWidth - pad * 2,
          baseWidth - pad * 2,
          16 * scaleFactor
        );
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = `800 ${15 * scaleFactor}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (hasTopFrame) {
          ctx.fillText(ctaText, baseWidth / 2, 25 * scaleFactor);
        } else {
          ctx.fillText(ctaText, baseWidth / 2, baseWidth + 24 * scaleFactor);
        }
      } else {
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        ctx.roundRect(0, 0, baseWidth, baseHeight, 22 * scaleFactor);
        ctx.fill();
      }

      const qrPadding = 24 * scaleFactor;
      const qrDrawArea = baseWidth - qrPadding * 2;
      const cellSize = qrDrawArea / count;
      const startX = qrPadding;
      const startY = qrOffsetY + qrPadding;

      // 2. Load Art / Photo Canvas if enabled
      let artSourceCanvas: HTMLCanvasElement | HTMLImageElement | null = null;
      if (artPreset === 'custom' && customArtDataUrl) {
        artSourceCanvas = await new Promise<HTMLImageElement | null>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = customArtDataUrl;
        });
      } else if (artPreset !== 'none') {
        artSourceCanvas = createBuiltInArtCanvas(artPreset, Math.round(qrDrawArea));
      }

      // If Halftone Art Blend mode is active, draw the art backdrop softly inside the QR area
      if (artSourceCanvas && artBlendMode === 'halftone') {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(startX - 4 * scaleFactor, startY - 4 * scaleFactor, qrDrawArea + 8 * scaleFactor, qrDrawArea + 8 * scaleFactor, 12 * scaleFactor);
        ctx.clip();
        ctx.globalAlpha = 0.82;
        ctx.drawImage(artSourceCanvas, startX - 4 * scaleFactor, startY - 4 * scaleFactor, qrDrawArea + 8 * scaleFactor, qrDrawArea + 8 * scaleFactor);
        ctx.restore();
      }

      let mainFill: string | CanvasGradient | CanvasPattern = fgColor;
      if (artSourceCanvas && artBlendMode === 'texture') {
        // Create darkened high-contrast pattern from the art so modules stay scannable
        const patCanvas = document.createElement('canvas');
        patCanvas.width = Math.ceil(qrDrawArea);
        patCanvas.height = Math.ceil(qrDrawArea);
        const pCtx = patCanvas.getContext('2d');
        if (pCtx) {
          pCtx.drawImage(artSourceCanvas, 0, 0, patCanvas.width, patCanvas.height);
          pCtx.fillStyle = 'rgba(15, 23, 42, 0.55)';
          pCtx.fillRect(0, 0, patCanvas.width, patCanvas.height);
          const pat = ctx.createPattern(patCanvas, 'no-repeat');
          if (pat) mainFill = pat;
        }
      } else if (gradientMode === 'linear-diag') {
        const grad = ctx.createLinearGradient(
          startX,
          startY,
          startX + qrDrawArea,
          startY + qrDrawArea
        );
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
        const grad = ctx.createRadialGradient(
          cx,
          cy,
          qrDrawArea * 0.05,
          cx,
          cy,
          qrDrawArea * 0.65
        );
        grad.addColorStop(0, fgColor);
        grad.addColorStop(1, fgColor2);
        mainFill = grad;
      }

      const hasLogo = logoPreset !== 'none';
      const logoBoxSize = 54 * scaleFactor;
      const quietPadPx = logoQuietZonePad * scaleFactor;
      const totalLogoRadiusPx = logoBoxSize / 2 + quietPadPx + cellSize * 0.45;
      const centerCoordX = startX + qrDrawArea / 2;
      const centerCoordY = startY + qrDrawArea / 2;

      const isSkippedForLogo = (r: number, c: number) => {
        if (!hasLogo) return false;
        const modCenterX = startX + (c + 0.5) * cellSize;
        const modCenterY = startY + (r + 0.5) * cellSize;
        if (logoMask === 'circle') {
          return Math.hypot(modCenterX - centerCoordX, modCenterY - centerCoordY) < totalLogoRadiusPx;
        }
        return (
          Math.abs(modCenterX - centerCoordX) < totalLogoRadiusPx &&
          Math.abs(modCenterY - centerCoordY) < totalLogoRadiusPx
        );
      };

      const isDarkNeighbor = (nr: number, nc: number): boolean => {
        if (nr < 0 || nc < 0 || nr >= count || nc >= count) return false;
        if (isFinderModule(nr, nc, count)) return false;
        if (isSkippedForLogo(nr, nc)) return false;
        return Boolean(modules.get(nr, nc));
      };

      // 3. Draw QR Data Modules (with Halftone Light Anchors if art backdrop is enabled)
      ctx.save();
      if (fxNeon) {
        ctx.shadowColor = gradientMode !== 'none' ? fgColor2 : fgColor;
        ctx.shadowBlur = 6 * scaleFactor;
      }

      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (isFinderModule(r, c, count)) continue;
          if (isSkippedForLogo(r, c)) continue;

          const x = startX + c * cellSize;
          const y = startY + r * cellSize;
          const isDark = Boolean(modules.get(r, c));

          if (!isDark) {
            // In Halftone Art mode, draw subtle crisp white micro-dots on light modules so scanners read 100% reliably
            if (artSourceCanvas && artBlendMode === 'halftone') {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
              ctx.beginPath();
              ctx.arc(x + cellSize / 2, y + cellSize / 2, cellSize * 0.28, 0, Math.PI * 2);
              ctx.fill();
            }
            continue;
          }

          // Optional 3D Pop Isometric extrude shadow
          if (fx3d) {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
            drawCustomModuleShape(
              ctx,
              bodyShape,
              x + 1.6 * scaleFactor,
              y + 1.8 * scaleFactor,
              cellSize,
              r,
              c,
              isDarkNeighbor
            );
          }

          ctx.fillStyle = mainFill;
          drawCustomModuleShape(
            ctx,
            bodyShape,
            artSourceCanvas && artBlendMode === 'halftone' ? x + cellSize * 0.06 : x,
            artSourceCanvas && artBlendMode === 'halftone' ? y + cellSize * 0.06 : y,
            artSourceCanvas && artBlendMode === 'halftone' ? cellSize * 0.88 : cellSize,
            r,
            c,
            isDarkNeighbor
          );
        }
      }
      ctx.restore();

      // 4. Draw Finder Eyes (Protected Quiet Zones for 100% Scannability)
      const drawFinderEye = (rowOffset: number, colOffset: number) => {
        const ex = startX + colOffset * cellSize;
        const ey = startY + rowOffset * cellSize;
        const outerSize = 7 * cellSize;
        const innerWhiteSize = 5 * cellSize;
        const ballSize = 3 * cellSize;

        if (artSourceCanvas) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
          ctx.beginPath();
          ctx.roundRect(
            ex - cellSize * 0.5,
            ey - cellSize * 0.5,
            outerSize + cellSize,
            outerSize + cellSize,
            cellSize * 1.5
          );
          ctx.fill();
        }

        if (fx3d) {
          ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
          traceEyeShapePath(
            ctx,
            ex + 2 * scaleFactor,
            ey + 2.2 * scaleFactor,
            outerSize,
            outerEyeShape,
            cellSize * 1.8
          );
          ctx.fill();
        }

        ctx.fillStyle = customEyeColor ? outerEyeColor : mainFill;
        traceEyeShapePath(ctx, ex, ey, outerSize, outerEyeShape, cellSize * 1.8);
        ctx.fill();

        ctx.fillStyle = bgColor;
        traceEyeShapePath(
          ctx,
          ex + cellSize,
          ey + cellSize,
          innerWhiteSize,
          outerEyeShape,
          cellSize * 1.25
        );
        ctx.fill();

        ctx.fillStyle = customEyeColor ? innerEyeColor : mainFill;
        traceEyeShapePath(
          ctx,
          ex + cellSize * 2,
          ey + cellSize * 2,
          ballSize,
          innerEyeShape,
          cellSize * 0.85
        );
        ctx.fill();
      };

      drawFinderEye(0, 0);
      drawFinderEye(0, count - 7);
      drawFinderEye(count - 7, 0);

      // 5. Draw Center Logo / Avatar
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
          ctx.shadowBlur = 12 * scaleFactor;
          ctx.shadowOffsetY = 2 * scaleFactor;
        }

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
          ctx.font = `900 ${16 * scaleFactor}px system-ui, -apple-system, sans-serif`;
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
      artPreset,
      customArtDataUrl,
      artBlendMode,
      fx3d,
      fxNeon,
      logoPreset,
      customLogoDataUrl,
      vcardAvatarDataUrl,
      engineType,
      logoMask,
      logoQuietZonePad,
      logoShadow
    ]
  );

  useEffect(() => {
    if (previewCanvasRef.current && previewTab === 'qr') {
      renderStyledQrCanvas(previewCanvasRef.current, 1);
    }
    if (miniMockupQrRef.current && previewTab === 'iphone') {
      renderStyledQrCanvas(miniMockupQrRef.current, 0.5);
    }
  }, [renderStyledQrCanvas, previewTab]);

  const handleDownloadPng = async () => {
    const allowed = await enforceQrGenerationQuota();
    if (!allowed) return;
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
      notifySuccess('PNG Downloaded', 'High-resolution QR code saved.');
    } catch (_) {
      notifyError('Export Failed', 'Could not generate PNG.');
    }
  };

  const handleDownloadPrintableBusinessCard = async () => {
    const allowed = await enforceQrGenerationQuota();
    if (!allowed) return;
    try {
      const canvas = document.createElement('canvas');
      const W = 1050;
      const H = 600;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

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

      ctx.fillStyle = vcardTheme === 'titanium-dark' ? '#d97706' : '#0284c7';
      ctx.fillRect(0, 0, 14, H);

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
      ctx.fillText(vcardJobTitle || 'Title', textStartX, 152);

      ctx.fillStyle = mutedText;
      ctx.font = '600 18px system-ui, -apple-system, sans-serif';
      ctx.fillText(vcardOrg || '', textStartX, 182);

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

      const qrOffscreen = document.createElement('canvas');
      await renderStyledQrCanvas(qrOffscreen, 1.25);
      const qrW = 360;
      const qrH = (qrOffscreen.height / qrOffscreen.width) * qrW;
      ctx.drawImage(qrOffscreen, W - qrW - 60, (H - qrH) / 2, qrW, qrH);

      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `beamdrop-card-${(vcardFullName || 'vcard').replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      notifySuccess('Card Downloaded', 'Saved 1050×600px business card.');
    } catch (_) {
      notifyError('Export Failed', 'Could not render business card.');
    }
  };

  const handleDownloadSvg = async () => {
    const allowed = await enforceQrGenerationQuota();
    if (!allowed) return;
    try {
      const payloadToDraw = qrPayload || 'https://beam-drop-mu.vercel.app';
      const qrObj = safeCreateQrCode(payloadToDraw, true);
      const modules = qrObj.modules;
      const count = modules.size;
      const size = 400;
      const pad = 32;
      const cell = (size - pad * 2) / count;

      const shapes: string[] = [];
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (!modules.get(r, c)) continue;
          const x = pad + c * cell;
          const y = pad + r * cell;
          const cx = x + cell / 2;
          const cy = y + cell / 2;

          if (bodyShape === 'diamond') {
            const rad = cell * 0.5;
            shapes.push(
              `<polygon points="${cx.toFixed(2)},${(cy - rad).toFixed(2)} ${(cx + rad).toFixed(2)},${cy.toFixed(2)} ${cx.toFixed(2)},${(cy + rad).toFixed(2)} ${(cx - rad).toFixed(2)},${cy.toFixed(2)}" fill="url(#qrGrad)" />`
            );
          } else if (bodyShape === 'star') {
            const outerR = cell * 0.54;
            const innerR = cell * 0.22;
            const pts: string[] = [];
            for (let i = 0; i < 8; i++) {
              const rad = i % 2 === 0 ? outerR : innerR;
              const angle = (i * Math.PI) / 4;
              pts.push(
                `${(cx + Math.cos(angle) * rad).toFixed(2)},${(cy + Math.sin(angle) * rad).toFixed(2)}`
              );
            }
            shapes.push(`<polygon points="${pts.join(' ')}" fill="url(#qrGrad)" />`);
          } else {
            const rx =
              bodyShape === 'dots'
                ? (cell / 2).toFixed(2)
                : bodyShape === 'rounded' || bodyShape === 'liquid' || bodyShape === 'bars'
                ? (cell * 0.34).toFixed(2)
                : '0';
            shapes.push(
              `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" rx="${rx}" fill="url(#qrGrad)" />`
            );
          }
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
  ${shapes.join('\n  ')}
</svg>`;

      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `beamdrop-qr-${engineType}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      notifySuccess('SVG Downloaded', 'Vector SVG saved.');
    } catch (_) {
      notifyError('SVG Failed', 'Could not generate SVG.');
    }
  };

  const handleCopyQrImage = async () => {
    const allowed = await enforceQrGenerationQuota();
    if (!allowed) return;
    try {
      const offscreen = document.createElement('canvas');
      await renderStyledQrCanvas(offscreen, 2);
      const blob = await new Promise<Blob | null>((resolve) =>
        offscreen.toBlob((b) => resolve(b), 'image/png')
      );
      if (blob && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopiedQrImage(true);
        notifyInfo('Copied', 'QR image copied to clipboard.');
        setTimeout(() => setCopiedQrImage(false), 2000);
      } else {
        await navigator.clipboard.writeText(qrPayload);
        setCopiedQrImage(true);
        notifyInfo('Copied', 'QR content copied to clipboard.');
        setTimeout(() => setCopiedQrImage(false), 2000);
      }
    } catch (_) {
      try {
        await navigator.clipboard.writeText(qrPayload);
        setCopiedQrImage(true);
        notifyInfo('Copied', 'QR content copied.');
        setTimeout(() => setCopiedQrImage(false), 2000);
      } catch (__) {}
    }
  };

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

      if (!createRes.ok) throw new Error('Upload session failed');
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
      notifySuccess('PDF Ready', 'Linked to 24h Cloud Drop.');
    } catch (err: any) {
      notifyError('Upload Error', err?.message || 'Could not upload PDF.');
    } finally {
      setIsUploadingPdf(false);
    }
  };

  const handleCreateDynamicQr = async () => {
    const allowed = await enforceQrGenerationQuota();
    if (!allowed) return;
    setIsCreatingDynamic(true);
    try {
      let title = websiteTitle || websiteUrl || 'Dynamic QR';
      let targetUrl = websiteUrl;
      let payload: any = {};

      if (engineType === 'text') {
        title = plainTextPayload.slice(0, 32) || 'Text QR';
        targetUrl = '';
        payload = { text: plainTextPayload };
      } else if (engineType === 'vcard') {
        title = vcardFullName || 'vCard';
        targetUrl = vcardWebsite;
        payload = {
          theme: vcardTheme,
          avatarDataUrl: vcardAvatarDataUrl,
          fullName: vcardFullName,
          jobTitle: vcardJobTitle,
          organization: vcardOrg,
          phone: vcardPhone,
          whatsapp: vcardWhatsapp,
          email: vcardEmail,
          website: vcardWebsite,
          address: vcardAddress
        };
      } else if (engineType === 'applink') {
        title = appName || 'App Link';
        targetUrl = appIosUrl || appAndroidUrl;
        payload = {
          appName,
          iosUrl: appIosUrl,
          androidUrl: appAndroidUrl
        };
      } else if (engineType === 'pdf') {
        title = pdfTitle || 'PDF';
        targetUrl = uploadedPdfMeta?.shareUrl || pdfUrl;
        payload = { docTitle: pdfTitle };
      } else if (engineType === 'wifi') {
        title = wifiSsid || 'Wi-Fi';
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

      if (!res.ok) throw new Error('Failed to create Dynamic QR');
      const data = await res.json();
      if (data.qr) {
        setActiveDynamicCode(data.qr.code);
        setDynamicQrs((prev) => [data.qr, ...prev.filter((i) => i.code !== data.qr.code)]);
        notifySuccess('Dynamic QR Active', `Shortlink /q/${data.qr.code} created.`);
      }
    } catch (err: any) {
      notifyError('Error', err?.message || 'Could not create Dynamic QR.');
    } finally {
      setIsCreatingDynamic(false);
    }
  };

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

  const [isGeneratingQr, setIsGeneratingQr] = useState<boolean>(false);
  const decodeQrInputRef = useRef<HTMLInputElement | null>(null);

  const handleExplicitGenerateQr = async () => {
    setIsGeneratingQr(true);
    const allowed = await enforceQrGenerationQuota();
    if (!allowed) {
      setIsGeneratingQr(false);
      return;
    }
    notifySuccess('QR Code Generated', 'Live QR preview is updated & ready to scan or export.');
    setTimeout(() => setIsGeneratingQr(false), 1200);
  };

  const handleDecodeQrFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = String(ev.target?.result || '');
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            notifyError('Decode Failed', 'Canvas context unavailable.');
            return;
          }
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth'
          });
          if (code && code.data) {
            const decoded = code.data.trim();
            if (/^https?:\/\//i.test(decoded)) {
              setEngineType('url');
              setWebsiteUrl(decoded);
              setActiveDynamicCode('');
            } else {
              setEngineType('text');
              setPlainTextPayload(decoded);
            }
            notifySuccess(
              'QR Code Decoded',
              `Loaded into QR Studio: ${decoded.slice(0, 60)}${decoded.length > 60 ? '...' : ''}`
            );
          } else {
            notifyError('No QR Found', 'Could not detect a valid QR code in the selected image.');
          }
        } catch (_) {
          notifyError('Decode Error', 'Failed to process the QR code image.');
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveDynamicEdit = async (code: string) => {
    try {
      await fetch('/api/qr-studio?action=update', {
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
      notifySuccess('Updated', `Destination updated for /q/${code}.`);
      setEditingCode(null);
    } catch (_) {
      setEditingCode(null);
    }
  };

  const handleDeleteDynamicQr = async (code: string) => {
    setDynamicQrs((prev) => prev.filter((i) => i.code !== code));
    if (activeDynamicCode === code) setActiveDynamicCode('');
    try {
      await fetch(`/api/qr-studio?action=delete&code=${encodeURIComponent(code)}`, {
        method: 'POST'
      });
    } catch (_) {}
  };

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
  };

  // Direct, minimal mode tabs (Including Text to QR!)
  const ENGINE_TABS: Array<{
    id: QrEngineType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'url', label: 'Link', icon: Globe },
    { id: 'text', label: 'Text', icon: Type },
    { id: 'wifi', label: 'Wi-Fi', icon: Wifi },
    { id: 'vcard', label: 'vCard', icon: UserCheck },
    { id: 'pdf', label: 'PDF', icon: FileText },
    { id: 'applink', label: 'App', icon: Smartphone },
    { id: 'analytics', label: `Saved (${dynamicQrs.length})`, icon: BarChart3 }
  ];

  return (
    <div className="space-y-4">
      {/* Clean Minimal Top Bar: Mode Pills + Optional Dynamic Shortlink Button */}
      <div className="bg-white/90 backdrop-blur-xl border border-sky-200/80 rounded-2xl p-2.5 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
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
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-sky-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tier Quota Pill + Optional Dynamic Shortlink Toggle */}
        <div className="flex items-center gap-2">
          {isPro ? (
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-sky-50 border border-sky-200/80 text-sky-700 text-xs font-semibold whitespace-nowrap">
              <Crown className="w-3.5 h-3.5 text-sky-600" />
              <span>PRO Unlimited</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() =>
                triggerProUpgradeModal(
                  'Upgrade to PRO for Unlimited QR Code Generation and full access to all 6 PRO Art Themes & Customizer.'
                )
              }
              className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-200 text-slate-700 hover:text-sky-700 text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap"
              title="Free & Guest Plan: 15 QR Code Limit. Click to unlock PRO Unlimited"
            >
              <span>{qrRemaining}/15 Free</span>
              <span className="px-1.5 py-0.5 rounded-md bg-sky-600 text-white text-[10px] font-bold">
                PRO
              </span>
            </button>
          )}

          {activeDynamicCode ? (
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs whitespace-nowrap">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-mono font-bold text-emerald-900">/q/{activeDynamicCode}</span>
              <button
                type="button"
                onClick={() => setActiveDynamicCode('')}
                className="text-slate-400 hover:text-rose-600 ml-1 cursor-pointer"
                title="Reset to static QR"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            engineType !== 'analytics' && (
              <button
                type="button"
                onClick={handleCreateDynamicQr}
                disabled={isCreatingDynamic}
                className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200/80 text-sky-700 text-xs font-semibold flex items-center space-x-1.5 cursor-pointer transition-colors whitespace-nowrap"
                title="Create editable Dynamic Shortlink QR"
              >
                <Zap className="w-3.5 h-3.5 text-sky-600" />
                <span>{isCreatingDynamic ? 'Saving...' : 'Dynamic Link'}</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN (7 Cols): Direct Content Input + Optional Collapsible Customizer */}
        <div className="lg:col-span-7 space-y-4">
          {/* 1. LINK (URL) */}
          {engineType === 'url' && (
            <div className="bg-white/95 border border-sky-200/80 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                  Website URL
                </label>
                {websiteUrl && (
                  <button
                    type="button"
                    onClick={() => setWebsiteUrl('')}
                    className="text-xs text-slate-400 hover:text-rose-600 font-semibold cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://example.com"
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-sky-500 focus:outline-none text-sm font-mono text-slate-900"
              />
            </div>
          )}

          {/* 2. TEXT TO QR CODE (Direct Text Input) */}
          {engineType === 'text' && (
            <div className="bg-white/95 border border-sky-200/80 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                  Text to QR Code
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400">
                    {plainTextPayload.length} chars
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const clip = await navigator.clipboard.readText();
                        if (clip) setPlainTextPayload(clip);
                      } catch (_) {}
                    }}
                    className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold flex items-center space-x-1 cursor-pointer"
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    <span>Paste</span>
                  </button>
                  {plainTextPayload && (
                    <button
                      type="button"
                      onClick={() => setPlainTextPayload('')}
                      className="px-2 py-1 rounded-lg text-slate-400 hover:text-rose-600 text-xs font-bold cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <textarea
                rows={4}
                value={plainTextPayload}
                onChange={(e) => setPlainTextPayload(e.target.value)}
                placeholder="Type or paste any text, note, code, or message..."
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-sky-500 focus:outline-none text-sm text-slate-900 resize-y"
              />
            </div>
          )}

          {/* 3. WI-FI */}
          {engineType === 'wifi' && (
            <div className="bg-white/95 border border-sky-200/80 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Network Name (SSID)
                  </label>
                  <input
                    type="text"
                    value={wifiSsid}
                    onChange={(e) => setWifiSsid(e.target.value)}
                    placeholder="My_WiFi_5G"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Security</label>
                  <select
                    value={wifiEncryption}
                    onChange={(e) =>
                      setWifiEncryption(e.target.value as 'WPA' | 'WEP' | 'nopass')
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  >
                    <option value="WPA">WPA / WPA2 / WPA3</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">Open (No Password)</option>
                  </select>
                </div>

                {wifiEncryption !== 'nopass' && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                    <div className="relative">
                      <input
                        type={showWifiPassword ? 'text' : 'password'}
                        value={wifiPassword}
                        onChange={(e) => setWifiPassword(e.target.value)}
                        placeholder="Wi-Fi password"
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-sm font-mono text-slate-900 focus:border-sky-500 focus:outline-none"
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
              </div>
            </div>
          )}

          {/* 4. VCARD (DIGITAL BUSINESS CARD) */}
          {engineType === 'vcard' && (
            <div className="bg-white/95 border border-sky-200/80 rounded-2xl p-5 shadow-xs space-y-4">
              {/* Top Row: Mode Switcher + Photo Upload */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setVcardOutputMode('offline');
                      setPreviewTab('qr');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      vcardOutputMode === 'offline'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Direct .vcf QR
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVcardOutputMode('dynamic');
                      setPreviewTab('iphone');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      vcardOutputMode === 'dynamic'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Mobile Card
                  </button>
                </div>

                {/* Photo Upload */}
                <div className="flex items-center gap-2">
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
                  <button
                    type="button"
                    onClick={() => vcardAvatarInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-sky-600" />
                    <span>{vcardAvatarDataUrl ? 'Change Photo' : 'Add Photo'}</span>
                  </button>
                  {vcardAvatarDataUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setVcardAvatarDataUrl(null);
                        setCustomLogoDataUrl(null);
                        setLogoPreset('none');
                      }}
                      className="text-xs text-rose-600 font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Compact Theme Swatches */}
              <div className="grid grid-cols-4 gap-2">
                {VCARD_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setVcardTheme(theme.id)}
                    className={`p-2 rounded-xl border text-center cursor-pointer transition-all ${
                      vcardTheme === theme.id
                        ? 'border-sky-600 bg-sky-50/70'
                        : 'border-slate-200 hover:border-sky-300'
                    }`}
                  >
                    <div
                      className="w-full h-3.5 rounded-md mb-1"
                      style={{ background: theme.swatch }}
                    />
                    <div className="text-[11px] font-bold text-slate-800 truncate">
                      {theme.name}
                    </div>
                  </button>
                ))}
              </div>

              {/* Direct Contact Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={vcardFullName}
                  onChange={(e) => setVcardFullName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={vcardJobTitle}
                  onChange={(e) => setVcardJobTitle(e.target.value)}
                  placeholder="Job Title"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={vcardOrg}
                  onChange={(e) => setVcardOrg(e.target.value)}
                  placeholder="Company"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                />
                <input
                  type="tel"
                  value={vcardPhone}
                  onChange={(e) => setVcardPhone(e.target.value)}
                  placeholder="Phone Number"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                />
                <input
                  type="tel"
                  value={vcardWhatsapp}
                  onChange={(e) => setVcardWhatsapp(e.target.value)}
                  placeholder="WhatsApp Number"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                />
                <input
                  type="email"
                  value={vcardEmail}
                  onChange={(e) => setVcardEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                />
                <input
                  type="url"
                  value={vcardWebsite}
                  onChange={(e) => setVcardWebsite(e.target.value)}
                  placeholder="Website URL"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={vcardAddress}
                  onChange={(e) => setVcardAddress(e.target.value)}
                  placeholder="City / Location"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* 5. PDF TO QR */}
          {engineType === 'pdf' && (
            <div className="bg-white/95 border border-sky-200/80 rounded-2xl p-5 shadow-xs space-y-3">
              <input
                ref={pdfFileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,application/pdf"
                onChange={handlePdfUpload}
                className="hidden"
              />

              <div className="flex items-center justify-between p-3.5 rounded-xl border border-dashed border-sky-300 bg-sky-50/50">
                <span className="text-xs font-bold text-slate-800 truncate">
                  {uploadedPdfMeta
                    ? `${uploadedPdfMeta.name} (${formatBytes(uploadedPdfMeta.size)})`
                    : 'Upload PDF / Document (24h Cloud)'}
                </span>
                <button
                  type="button"
                  onClick={() => pdfFileInputRef.current?.click()}
                  disabled={isUploadingPdf}
                  className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center space-x-1.5 shrink-0 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploadingPdf ? 'Uploading...' : 'Choose File'}</span>
                </button>
              </div>

              <input
                type="url"
                value={pdfUrl}
                onChange={(e) => setPdfUrl(e.target.value)}
                placeholder="Or paste direct PDF URL (https://...)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-xs font-mono text-slate-900 focus:border-sky-500 focus:outline-none"
              />
            </div>
          )}

          {/* 6. APP STORE LINK */}
          {engineType === 'applink' && (
            <div className="bg-white/95 border border-sky-200/80 rounded-2xl p-5 shadow-xs space-y-3">
              <input
                type="text"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="App Name"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
              />
              <input
                type="url"
                value={appIosUrl}
                onChange={(e) => setAppIosUrl(e.target.value)}
                placeholder="Apple App Store URL (iOS)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-xs font-mono text-slate-900 focus:border-sky-500 focus:outline-none"
              />
              <input
                type="url"
                value={appAndroidUrl}
                onChange={(e) => setAppAndroidUrl(e.target.value)}
                placeholder="Google Play Store URL (Android)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white text-xs font-mono text-slate-900 focus:border-sky-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCreateDynamicQr}
                disabled={isCreatingDynamic}
                className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center space-x-2 cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>Create Smart OS Link</span>
              </button>
            </div>
          )}

          {/* 7. SAVED DYNAMIC QRS */}
          {engineType === 'analytics' && (
            <div className="bg-white/95 border border-sky-200/80 rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                  Saved Dynamic QRs
                </span>
                <button
                  type="button"
                  onClick={handleRefreshAnalytics}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center space-x-1 cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      isRefreshingAnalytics ? 'animate-spin text-sky-600' : ''
                    }`}
                  />
                  <span>Refresh</span>
                </button>
              </div>

              {dynamicQrs.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-slate-50 border border-slate-200/60 text-xs text-slate-500">
                  No dynamic links saved yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {dynamicQrs.map((item) => {
                    const shortUrl = `${receiverBaseUrl.replace(/\/$/, '')}/q/${item.code}`;
                    const isEditing = editingCode === item.code;
                    return (
                      <div
                        key={item.code}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {item.title}
                              </span>
                              <span className="text-xs font-mono font-bold text-sky-600">
                                /q/{item.code}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono truncate max-w-xs">
                              {item.targetUrl || item.type}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-xs shrink-0">
                            <span className="font-bold text-slate-800">{item.scans || 0} scans</span>
                            <button
                              type="button"
                              onClick={() => setActiveDynamicCode(item.code)}
                              className="px-2.5 py-1 rounded-lg bg-sky-600 text-white font-bold cursor-pointer"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCode(isEditing ? null : item.code);
                                setEditingTitle(item.title);
                                setEditingTargetUrl(item.targetUrl || '');
                              }}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-white text-slate-600 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <a
                              href={shortUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-white text-slate-600"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteDynamicQr(item.code)}
                              className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {isEditing && (
                          <div className="pt-2 border-t border-slate-200 flex gap-2">
                            <input
                              type="url"
                              value={editingTargetUrl}
                              onChange={(e) => setEditingTargetUrl(e.target.value)}
                              placeholder="New URL..."
                              className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveDynamicEdit(item.code)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                            >
                              Save
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Universal Generate QR Code Action Bar (All 7 Tabs: Link, Text, Wi-Fi, vCard, PDF, App, Saved) */}
          <div className="bg-white/95 border border-sky-200/80 rounded-2xl p-3 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={handleExplicitGenerateQr}
              disabled={isGeneratingQr}
              className="flex-1 min-w-[180px] py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold text-sm flex items-center justify-center space-x-2 shadow-xs cursor-pointer transition-all"
            >
              <QrIcon className="w-4 h-4" />
              <span>{isGeneratingQr ? '✓ QR Code Generated!' : '⚡ Generate QR Code'}</span>
            </button>
            <input
              ref={decodeQrInputRef}
              type="file"
              accept="image/*"
              onChange={handleDecodeQrFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => decodeQrInputRef.current?.click()}
              className="py-3 px-3.5 rounded-xl border border-slate-200 hover:border-sky-300 bg-slate-50 hover:bg-sky-50 text-slate-700 hover:text-sky-700 font-bold text-xs flex items-center space-x-1.5 cursor-pointer transition-colors shrink-0"
              title="Upload any QR image to decode & edit its content"
            >
              <Upload className="w-3.5 h-3.5 text-sky-600" />
              <span>🔍 Decode QR</span>
            </button>
            {engineType !== 'analytics' && !activeDynamicCode && (
              <button
                type="button"
                onClick={handleCreateDynamicQr}
                disabled={isCreatingDynamic}
                className="py-3 px-3.5 rounded-xl border border-sky-200 hover:border-sky-300 bg-sky-50/70 hover:bg-sky-100 text-sky-700 font-bold text-xs flex items-center space-x-1.5 cursor-pointer transition-colors shrink-0"
                title="Create editable Dynamic Shortlink (/q/:code)"
              >
                <Zap className="w-3.5 h-3.5 text-sky-600" />
                <span>Dynamic Link</span>
              </button>
            )}
          </div>

          {/* OPTIONAL COLLAPSIBLE DESIGN CUSTOMIZER (100% Clean Light Mode) */}
          <div className="bg-white/95 border border-sky-200/80 rounded-2xl shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={() => setIsCustomizing((prev) => !prev)}
              className="w-full px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-sky-50/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-sky-600 shrink-0" />
                <span className="text-xs font-bold text-slate-900 whitespace-nowrap">
                  Customize QR Style
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-sky-50 border border-sky-200/80 text-sky-700 text-[10px] font-semibold whitespace-nowrap">
                  {isPro ? 'PRO Active' : 'Optional'}
                </span>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <div className="hidden sm:flex items-center space-x-1">
                  {DESIGNER_PRESETS.slice(0, 6).map((p) => (
                    <span
                      key={p.id}
                      className="w-3 h-3 rounded-full border border-slate-200"
                      style={{
                        background: `linear-gradient(135deg, ${p.fgColor}, ${p.fgColor2})`
                      }}
                    />
                  ))}
                </div>
                {isCustomizing ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </button>

            {isCustomizing && (
              <div className="px-5 pb-5 pt-3 border-t border-slate-100 space-y-4">
                {/* 1-Click Art & Style Themes (Clean 4-Column Light Cards) */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                      Style Themes
                    </span>
                    {!isPro && (
                      <button
                        type="button"
                        onClick={() =>
                          triggerProUpgradeModal(
                            'Unlock all 6 PRO Art Themes (Cyber Anime, Sakura Heart, Manga Ink, 3D Gold Pop, Arcade 8-Bit, Emerald) & Unlimited QR Generation.'
                          )
                        }
                        className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Lock className="w-3 h-3" />
                        <span>Unlock PRO Themes</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {DESIGNER_PRESETS.map((preset) => {
                      const isSelected = activePresetId === preset.id;
                      const isLocked = Boolean(preset.proOnly && !isPro);
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyDesignerPreset(preset)}
                          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'border-sky-600 bg-sky-50/70 shadow-2xs'
                              : 'border-slate-200/90 hover:border-sky-300 bg-white hover:bg-slate-50/60'
                          }`}
                        >
                          <div
                            className="w-6 h-6 rounded-lg shrink-0 border border-black/10"
                            style={{
                              background: `linear-gradient(135deg, ${preset.fgColor}, ${preset.fgColor2})`
                            }}
                          />
                          <span className="text-xs font-semibold text-slate-800 truncate flex-1">
                            {preset.name}
                          </span>
                          {isLocked && (
                            <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Clean Light-Mode Sub-Tabs: Art & FX | Shapes | Colors | Frame | Logo */}
                <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-xl border border-slate-200/60 overflow-x-auto">
                  {[
                    { id: 'art', label: 'Art & FX', icon: Sparkles },
                    { id: 'shapes', label: 'Shapes', icon: Shapes },
                    { id: 'colors', label: 'Colors', icon: Palette },
                    { id: 'frame', label: 'Frame', icon: Frame },
                    { id: 'logo', label: 'Logo', icon: ImageIcon }
                  ].map((t) => {
                    const Icon = t.icon;
                    const active = activeCustTab === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          if (!isPro) {
                            triggerProUpgradeModal(
                              `Custom "${t.label}" studio controls are available on the PRO plan.`
                            );
                            return;
                          }
                          setActiveCustTab(t.id as any);
                        }}
                        className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                          active && isPro
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span>{t.label}</span>
                        {!isPro && <Lock className="w-2.5 h-2.5 text-slate-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {/* Subtle Light-Mode Upgrade Bar for Non-PRO Users */}
                {!isPro && (
                  <div className="px-3.5 py-2.5 rounded-xl bg-sky-50/70 border border-sky-200/80 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Lock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                      <span className="text-xs text-slate-700 truncate">
                        Custom art backgrounds, shapes, colors, frames &amp; logos are included with PRO.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        triggerProUpgradeModal(
                          'Upgrade to PRO to unlock full QR Design Customization and Unlimited QR Generation.'
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors shrink-0"
                    >
                      Unlock PRO
                    </button>
                  </div>
                )}

                {/* Art & Photo Blend + 3D/Neon FX (PRO Only) */}
                {isPro && activeCustTab === 'art' && (
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold text-slate-600">
                          Photo / Anime Art Background
                        </label>
                        <input
                          ref={artFileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => {
                              setCustomArtDataUrl(String(reader.result || ''));
                              setArtPreset('custom');
                            };
                            reader.readAsDataURL(file);
                          }}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => artFileInputRef.current?.click()}
                          className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 text-[11px] font-semibold flex items-center space-x-1 cursor-pointer"
                        >
                          <Upload className="w-3 h-3" />
                          <span>Upload Photo / Anime</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-5 gap-1.5">
                        {(
                          [
                            { id: 'none', label: 'None' },
                            { id: 'cyber-anime', label: 'Cyber Sun' },
                            { id: 'sakura-spirit', label: 'Sakura' },
                            { id: 'mecha-neon', label: 'Mecha' },
                            { id: 'cosmic-galaxy', label: 'Galaxy' }
                          ] as const
                        ).map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setArtPreset(a.id)}
                            className={`py-2 px-2 rounded-xl border text-xs font-bold cursor-pointer ${
                              artPreset === a.id
                                ? 'bg-sky-50 border-sky-500 text-sky-900'
                                : 'border-slate-200 text-slate-600'
                            }`}
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {artPreset !== 'none' && (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setArtBlendMode('halftone')}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                            artBlendMode === 'halftone'
                              ? 'bg-sky-50 border-sky-500 text-sky-900'
                              : 'border-slate-200 text-slate-600'
                          }`}
                        >
                          Halftone Art Overlay
                        </button>
                        <button
                          type="button"
                          onClick={() => setArtBlendMode('texture')}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                            artBlendMode === 'texture'
                              ? 'bg-sky-50 border-sky-500 text-sky-900'
                              : 'border-slate-200 text-slate-600'
                          }`}
                        >
                          Inside QR Modules
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setFx3d((prev) => !prev)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 cursor-pointer ${
                          fx3d
                            ? 'bg-sky-50 border-sky-500 text-sky-900'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        <span>3D Pop Depth</span>
                        {fx3d && <Check className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setFxNeon((prev) => !prev)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 cursor-pointer ${
                          fxNeon
                            ? 'bg-sky-50 border-sky-500 text-sky-900'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        <span>Neon Glow FX</span>
                        {fxNeon && <Check className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Shapes (PRO Only) */}
                {isPro && activeCustTab === 'shapes' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                        Pattern Style
                      </label>
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                        {(
                          [
                            { id: 'rounded', label: 'Rounded' },
                            { id: 'liquid', label: 'Liquid' },
                            { id: 'dots', label: 'Dots' },
                            { id: 'star', label: 'Star' },
                            { id: 'diamond', label: 'Diamond' },
                            { id: 'heart', label: 'Heart' },
                            { id: 'bars', label: 'Bars' },
                            { id: 'square', label: 'Square' }
                          ] as const
                        ).map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setBodyShape(s.id)}
                            className={`py-2 px-1.5 rounded-xl border text-[11px] font-bold cursor-pointer ${
                              bodyShape === s.id
                                ? 'bg-sky-50 border-sky-500 text-sky-900'
                                : 'border-slate-200 text-slate-600'
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                          Corner Ring
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(
                            [
                              { id: 'square', label: 'Square' },
                              { id: 'rounded', label: 'Rounded' },
                              { id: 'circle', label: 'Circle' },
                              { id: 'leaf', label: 'Leaf' }
                            ] as const
                          ).map((e) => (
                            <button
                              key={e.id}
                              type="button"
                              onClick={() => setOuterEyeShape(e.id)}
                              className={`py-1.5 px-2 rounded-lg border text-xs font-bold cursor-pointer ${
                                outerEyeShape === e.id
                                  ? 'bg-sky-50 border-sky-500 text-sky-900'
                                  : 'border-slate-200 text-slate-600'
                              }`}
                            >
                              {e.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                          Corner Dot
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(
                            [
                              { id: 'square', label: 'Square' },
                              { id: 'rounded', label: 'Rounded' },
                              { id: 'circle', label: 'Circle' },
                              { id: 'diamond', label: 'Diamond' }
                            ] as const
                          ).map((e) => (
                            <button
                              key={e.id}
                              type="button"
                              onClick={() => setInnerEyeShape(e.id)}
                              className={`py-1.5 px-2 rounded-lg border text-xs font-bold cursor-pointer ${
                                innerEyeShape === e.id
                                  ? 'bg-sky-50 border-sky-500 text-sky-900'
                                  : 'border-slate-200 text-slate-600'
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

                {/* Colors (PRO Only) */}
                {isPro && activeCustTab === 'colors' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-5 gap-1.5">
                      {(
                        [
                          { id: 'none', label: 'Solid' },
                          { id: 'linear-diag', label: 'Diagonal' },
                          { id: 'linear-horiz', label: 'Horiz' },
                          { id: 'linear-vert', label: 'Vert' },
                          { id: 'radial', label: 'Radial' }
                        ] as const
                      ).map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setGradientMode(g.id)}
                          className={`py-1.5 px-2 rounded-lg border text-xs font-bold cursor-pointer ${
                            gradientMode === g.id
                              ? 'bg-sky-50 border-sky-500 text-sky-900'
                              : 'border-slate-200 text-slate-600'
                          }`}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Color 1
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
                          Color 2
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
                          Background
                        </label>
                        <input
                          type="color"
                          value={bgColor}
                          onChange={(e) => setBgColor(e.target.value)}
                          className="w-full h-9 rounded-lg cursor-pointer border border-slate-200"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Frame (PRO Only) */}
                {isPro && activeCustTab === 'frame' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-1.5">
                      {(
                        [
                          { id: 'none', label: 'None' },
                          { id: 'bottom-banner', label: 'Bottom CTA' },
                          { id: 'top-banner', label: 'Top CTA' },
                          { id: 'polaroid', label: 'Polaroid' },
                          { id: 'vip-ticket', label: 'VIP Pass' },
                          { id: 'manga-panel', label: 'Manga' },
                          { id: 'retro-arcade', label: 'Arcade' },
                          { id: 'wifi-badge', label: 'Wi-Fi Tag' }
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setFrameStyle(f.id)}
                          className={`py-2 px-2 rounded-xl border text-xs font-bold cursor-pointer ${
                            frameStyle === f.id
                              ? 'bg-sky-50 border-sky-500 text-sky-900'
                              : 'border-slate-200 text-slate-600'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    {frameStyle !== 'none' && (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Frame Text
                          </label>
                          <input
                            type="text"
                            maxLength={22}
                            value={frameText}
                            onChange={(e) => setFrameText(e.target.value)}
                            placeholder="SCAN ME"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Frame Color
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
                  </div>
                )}

                {/* Logo (PRO Only) */}
                {isPro && activeCustTab === 'logo' && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { id: 'none', label: 'None' },
                          { id: 'beamdrop', label: 'BeamDrop' },
                          { id: 'globe', label: 'WWW' },
                          { id: 'wifi', label: 'Wi-Fi' },
                          { id: 'vcard', label: 'vCard' },
                          { id: 'pdf', label: 'PDF' }
                        ] as const
                      ).map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => setLogoPreset(l.id)}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
                            logoPreset === l.id
                              ? 'bg-sky-50 border-sky-500 text-sky-900'
                              : 'border-slate-200 text-slate-600'
                          }`}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <div className="flex items-center gap-1.5">
                        {(
                          [
                            { id: 'circle', label: 'Circle Mask' },
                            { id: 'rounded', label: 'Rounded' }
                          ] as const
                        ).map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setLogoMask(m.id)}
                            className={`px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer ${
                              logoMask === m.id
                                ? 'bg-sky-50 border-sky-500 text-sky-900'
                                : 'border-slate-200 text-slate-600'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
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
                          className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 text-xs font-semibold flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Logo</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT STICKY COLUMN (5 Cols): Clean Light-Mode QR Preview & Direct Export */}
        <div className="lg:col-span-5 lg:sticky lg:top-6 self-start z-20">
          <div className="bg-white/95 backdrop-blur-xl text-slate-900 rounded-3xl p-5 shadow-sm border border-sky-200/80 space-y-4">
            {/* Compact Status Bar: Scannability Guard + vCard Toggle */}
            <div className="flex items-center justify-between gap-2">
              <div
                className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold border ${
                  scanSafety.ok
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                {scanSafety.ok ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                )}
                <span>{scanSafety.label}</span>
                {!scanSafety.ok && (
                  <button
                    type="button"
                    onClick={handleAutoFixContrast}
                    className="ml-1 px-1.5 py-0.5 rounded bg-amber-500 text-white text-[10px] font-bold cursor-pointer"
                  >
                    Fix
                  </button>
                )}
              </div>

              {engineType === 'vcard' && (
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('qr')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center space-x-1 cursor-pointer ${
                      previewTab === 'qr' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    <QrIcon className="w-3 h-3" />
                    <span>QR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('iphone')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center space-x-1 cursor-pointer ${
                      previewTab === 'iphone' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    <Smartphone className="w-3 h-3" />
                    <span>Card</span>
                  </button>
                </div>
              )}
            </div>

            {/* QR Canvas (Clean Light Well) */}
            {previewTab === 'qr' && (
              <div className="flex items-center justify-center bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80">
                <canvas
                  ref={previewCanvasRef}
                  className="max-w-full h-auto rounded-2xl shadow-sm bg-white"
                  style={{ maxHeight: '310px' }}
                />
              </div>
            )}

            {/* Mobile Card Mockup (vCard) */}
            {previewTab === 'iphone' && (
              <div className="flex justify-center">
                <div className="w-[276px] rounded-[34px] p-2.5 bg-slate-100 border-2 border-slate-200 shadow-md">
                  <div className="w-20 h-3 bg-slate-300 rounded-full mx-auto mb-2" />
                  <div
                    className={`rounded-[24px] overflow-hidden p-4 space-y-3 ${
                      vcardTheme === 'titanium-dark'
                        ? 'bg-gradient-to-b from-slate-900 to-black text-white border border-amber-500/30'
                        : vcardTheme === 'creator-aurora'
                        ? 'bg-gradient-to-br from-indigo-950 via-purple-950 to-fuchsia-950 text-white'
                        : vcardTheme === 'swiss-minimal'
                        ? 'bg-white text-slate-950 border border-slate-200'
                        : 'bg-gradient-to-b from-sky-50 to-white text-slate-900 border border-sky-100'
                    }`}
                  >
                    <div className="text-center">
                      <div className="w-14 h-14 rounded-full mx-auto mb-2 flex items-center justify-center font-black text-lg overflow-hidden border-2 border-white bg-sky-600 text-white">
                        {vcardAvatarDataUrl ? (
                          <img
                            src={vcardAvatarDataUrl}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          (vcardFullName || 'U').charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="font-extrabold text-sm truncate">
                        {vcardFullName || 'Full Name'}
                      </div>
                      {vcardJobTitle && (
                        <div className="text-[11px] opacity-80 truncate">{vcardJobTitle}</div>
                      )}
                      {vcardOrg && (
                        <div className="text-[10px] opacity-60 truncate">{vcardOrg}</div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleTriggerMockupVcfDownload}
                      className="w-full py-2 px-3 rounded-xl bg-sky-600 text-white font-bold text-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Save Contact</span>
                    </button>

                    <div className="grid grid-cols-2 gap-1.5 text-[10px] font-bold">
                      {vcardPhone && (
                        <a
                          href={`tel:${vcardPhone}`}
                          className="p-2 rounded-lg bg-black/5 flex items-center space-x-1 truncate"
                        >
                          <Phone className="w-3 h-3 shrink-0" />
                          <span>Call</span>
                        </a>
                      )}
                      {vcardWhatsapp && (
                        <a
                          href={`https://wa.me/${vcardWhatsapp.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-emerald-500/15 flex items-center space-x-1 truncate"
                        >
                          <MessageCircle className="w-3 h-3 shrink-0" />
                          <span>WhatsApp</span>
                        </a>
                      )}
                      {vcardEmail && (
                        <a
                          href={`mailto:${vcardEmail}`}
                          className="p-2 rounded-lg bg-black/5 flex items-center space-x-1 truncate"
                        >
                          <Mail className="w-3 h-3 shrink-0" />
                          <span>Email</span>
                        </a>
                      )}
                      {vcardWebsite && (
                        <a
                          href={vcardWebsite}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-black/5 flex items-center space-x-1 truncate"
                        >
                          <Globe className="w-3 h-3 shrink-0" />
                          <span>Web</span>
                        </a>
                      )}
                    </div>

                    <div className="pt-2 border-t border-current/10 flex items-center justify-between">
                      <span className="text-[10px] font-semibold opacity-75">QR Card</span>
                      <canvas
                        ref={miniMockupQrRef}
                        className="w-12 h-12 rounded-lg bg-white p-0.5"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Direct Action Buttons (Light Mode) */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleDownloadPng}
                className="py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>PNG</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadSvg}
                className="py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs flex items-center justify-center space-x-1.5 border border-slate-200 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-sky-600" />
                <span>SVG</span>
              </button>

              <button
                type="button"
                onClick={handleCopyQrImage}
                className="py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs flex items-center justify-center space-x-1.5 border border-slate-200 cursor-pointer transition-colors"
              >
                {copiedQrImage ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-sky-600" />
                )}
                <span>{copiedQrImage ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {engineType === 'vcard' && (
              <button
                type="button"
                onClick={handleDownloadPrintableBusinessCard}
                className="w-full py-2.5 px-4 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 font-semibold text-xs flex items-center justify-center space-x-1.5 cursor-pointer transition-colors"
              >
                <CreditCard className="w-4 h-4 text-sky-600" />
                <span>Print Business Card (PNG)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
