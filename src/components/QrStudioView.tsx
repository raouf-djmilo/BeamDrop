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
  Plus,
  Trash2,
  Edit3,
  Upload,
  ShieldCheck,
  Zap,
  Eye,
  EyeOff,
  CheckCircle2,
  Link2
} from 'lucide-react';
import { useNotification } from '../context/NotificationContext';
import { formatBytes } from '../utils/formatters';

export type QrEngineType = 'url' | 'vcard' | 'wifi' | 'pdf' | 'applink' | 'analytics';
export type QrBodyShape = 'square' | 'rounded' | 'dots' | 'classy';
export type QrEyeShape = 'square' | 'rounded' | 'circle';
export type QrFrameStyle = 'none' | 'bottom-banner' | 'top-banner' | 'card-badge';
export type QrLogoPreset = 'beamdrop' | 'globe' | 'vcard' | 'wifi' | 'pdf' | 'app' | 'custom' | 'none';

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

const COLOR_PRESETS = [
  { name: 'Executive Slate', fg: '#0f172a', fg2: '#1e293b', bg: '#ffffff', frame: '#0f172a' },
  { name: 'Electric Sky', fg: '#0284c7', fg2: '#2563eb', bg: '#ffffff', frame: '#0284c7' },
  { name: 'Cyber Emerald', fg: '#059669', fg2: '#0d9488', bg: '#ffffff', frame: '#059669' },
  { name: 'Royal Indigo', fg: '#4f46e5', fg2: '#7c3aed', bg: '#ffffff', frame: '#4f46e5' },
  { name: 'Crimson Pulse', fg: '#e11d48', fg2: '#db2777', bg: '#ffffff', frame: '#e11d48' },
  { name: 'Amber Gold', fg: '#d97706', fg2: '#ea580c', bg: '#ffffff', frame: '#d97706' }
];

export const QrStudioView: React.FC<QrStudioViewProps> = ({ receiverBaseUrl }) => {
  const { notifyInfo, notifySuccess, notifyError } = useNotification();

  // Active Engine Mode
  const [engineType, setEngineType] = useState<QrEngineType>('url');

  // 1. Website URL State
  const [websiteUrl, setWebsiteUrl] = useState<string>('https://beam-drop-mu.vercel.app');
  const [websiteTitle, setWebsiteTitle] = useState<string>('BeamDrop Official Website');
  const [isDynamicMode, setIsDynamicMode] = useState<boolean>(false);
  const [activeDynamicCode, setActiveDynamicCode] = useState<string>('');

  // 2. Digital Business Card (vCard) State
  const [vcardFullName, setVcardFullName] = useState<string>('Alex Rivera');
  const [vcardJobTitle, setVcardJobTitle] = useState<string>('Senior Systems Architect');
  const [vcardOrg, setVcardOrg] = useState<string>('BeamDrop Cloud Labs');
  const [vcardPhone, setVcardPhone] = useState<string>('+1 (555) 234-5678');
  const [vcardEmail, setVcardEmail] = useState<string>('alex@beamdrop.io');
  const [vcardWebsite, setVcardWebsite] = useState<string>('https://beam-drop-mu.vercel.app');
  const [vcardAddress, setVcardAddress] = useState<string>('San Francisco, CA');
  const [vcardMode, setVcardMode] = useState<'offline' | 'dynamic'>('offline');

  // 3. WiFi Direct Connect State
  const [wifiSsid, setWifiSsid] = useState<string>('BeamDrop_5G_Guest');
  const [wifiPassword, setWifiPassword] = useState<string>('BeamDrop2026!');
  const [wifiEncryption, setWifiEncryption] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');
  const [wifiHidden, setWifiHidden] = useState<boolean>(false);
  const [showWifiPassword, setShowWifiPassword] = useState<boolean>(false);

  // 4. PDF & Document Showcase State (Integrated with 24h Cloud Drop)
  const [pdfTitle, setPdfTitle] = useState<string>('Product Architecture Whitepaper.pdf');
  const [pdfAuthor, setPdfAuthor] = useState<string>('BeamDrop Engineering');
  const [pdfDescription, setPdfDescription] = useState<string>('Scan to view or download the verified PDF document directly on your phone.');
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
  const [appAndroidUrl, setAppAndroidUrl] = useState<string>('https://play.google.com/store/apps/details?id=io.beamdrop.app');
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

  // Visual Studio Customization State (QRCG Style)
  const [activeCustTab, setActiveCustTab] = useState<'shapes' | 'colors' | 'frame' | 'logo'>('shapes');
  const [bodyShape, setBodyShape] = useState<QrBodyShape>('rounded');
  const [eyeShape, setEyeShape] = useState<QrEyeShape>('rounded');
  const [fgColor, setFgColor] = useState<string>('#0f172a');
  const [fgColor2, setFgColor2] = useState<string>('#0284c7');
  const [useGradient, setUseGradient] = useState<boolean>(true);
  const [bgColor, setBgColor] = useState<string>('#ffffff');
  const [frameStyle, setFrameStyle] = useState<QrFrameStyle>('bottom-banner');
  const [frameText, setFrameText] = useState<string>('SCAN ME');
  const [frameColor, setFrameColor] = useState<string>('#0284c7');
  const [logoPreset, setLogoPreset] = useState<QrLogoPreset>('beamdrop');
  const [customLogoDataUrl, setCustomLogoDataUrl] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copiedQrImage, setCopiedQrImage] = useState<boolean>(false);
  const [copiedPayloadText, setCopiedPayloadText] = useState<boolean>(false);

  // Auto-update default CTA Frame Text & Logo when switching engines
  useEffect(() => {
    if (engineType === 'url') {
      setFrameText('SCAN ME');
      if (logoPreset !== 'custom' && logoPreset !== 'none') setLogoPreset('globe');
    } else if (engineType === 'vcard') {
      setFrameText('SAVE CONTACT');
      if (logoPreset !== 'custom' && logoPreset !== 'none') setLogoPreset('vcard');
    } else if (engineType === 'wifi') {
      setFrameText('JOIN WI-FI');
      if (logoPreset !== 'custom' && logoPreset !== 'none') setLogoPreset('wifi');
    } else if (engineType === 'pdf') {
      setFrameText('VIEW PDF');
      if (logoPreset !== 'custom' && logoPreset !== 'none') setLogoPreset('pdf');
    } else if (engineType === 'applink') {
      setFrameText('GET THE APP');
      if (logoPreset !== 'custom' && logoPreset !== 'none') setLogoPreset('app');
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
      const raw = websiteUrl.trim() || cleanBase;
      return raw;
    }

    if (engineType === 'vcard') {
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
    vcardFullName,
    vcardOrg,
    vcardJobTitle,
    vcardPhone,
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

  // Draw custom QRCG-style QR Canvas (supports high-res export scale)
  const renderStyledQrCanvas = useCallback(
    async (targetCanvas: HTMLCanvasElement, scaleFactor = 1) => {
      const payloadToDraw = qrPayload || 'https://beam-drop-mu.vercel.app';
      const qrObj = QRCode.create(payloadToDraw, { errorCorrectionLevel: 'H' });
      const modules = qrObj.modules;
      const count = modules.size;

      const baseWidth = 340 * scaleFactor;
      const hasBottomFrame = frameStyle === 'bottom-banner' || frameStyle === 'card-badge';
      const hasTopFrame = frameStyle === 'top-banner';
      const extraHeight = (hasBottomFrame ? 58 : hasTopFrame ? 58 : 0) * scaleFactor;
      const baseHeight = baseWidth + extraHeight;

      targetCanvas.width = baseWidth;
      targetCanvas.height = baseHeight;
      const ctx = targetCanvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, baseWidth, baseHeight);

      // 1. Draw Outer Frame Background if active
      const qrOffsetY = hasTopFrame ? 54 * scaleFactor : 0;
      if (frameStyle !== 'none') {
        ctx.fillStyle = frameColor;
        ctx.beginPath();
        ctx.roundRect(0, 0, baseWidth, baseHeight, 24 * scaleFactor);
        ctx.fill();

        // Inner white card for QR
        const pad = 10 * scaleFactor;
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

        // Frame CTA Text
        ctx.fillStyle = '#ffffff';
        ctx.font = `800 ${17 * scaleFactor}px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const ctaText = (frameText || 'SCAN ME').toUpperCase();
        if (hasTopFrame) {
          ctx.fillText(ctaText, baseWidth / 2, 29 * scaleFactor);
        } else {
          ctx.fillText(ctaText, baseWidth / 2, baseWidth + 27 * scaleFactor);
        }
      } else {
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        ctx.roundRect(0, 0, baseWidth, baseHeight, 22 * scaleFactor);
        ctx.fill();
      }

      // 2. Setup QR Foreground Fill (Solid or Linear Gradient)
      const qrPadding = 28 * scaleFactor;
      const qrDrawArea = baseWidth - qrPadding * 2;
      const cellSize = qrDrawArea / count;
      const startX = qrPadding;
      const startY = qrOffsetY + qrPadding;

      let mainFill: string | CanvasGradient = fgColor;
      if (useGradient) {
        const grad = ctx.createLinearGradient(startX, startY, startX + qrDrawArea, startY + qrDrawArea);
        grad.addColorStop(0, fgColor);
        grad.addColorStop(1, fgColor2);
        mainFill = grad;
      }

      // Center logo exclusion zone
      const hasLogo = logoPreset !== 'none';
      const centerMin = Math.floor(count * 0.38);
      const centerMax = Math.ceil(count * 0.62);

      // 3. Draw Data Modules
      ctx.fillStyle = mainFill;
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (!modules.get(r, c)) continue;
          if (isFinderModule(r, c, count)) continue;
          if (hasLogo && r >= centerMin && r < centerMax && c >= centerMin && c < centerMax) {
            continue;
          }

          const x = startX + c * cellSize;
          const y = startY + r * cellSize;

          if (bodyShape === 'dots') {
            ctx.beginPath();
            ctx.arc(
              x + cellSize / 2,
              y + cellSize / 2,
              (cellSize / 2) * 0.86,
              0,
              Math.PI * 2
            );
            ctx.fill();
          } else if (bodyShape === 'rounded') {
            ctx.beginPath();
            ctx.roundRect(
              x + cellSize * 0.05,
              y + cellSize * 0.05,
              cellSize * 0.9,
              cellSize * 0.9,
              cellSize * 0.34
            );
            ctx.fill();
          } else if (bodyShape === 'classy') {
            ctx.beginPath();
            ctx.roundRect(x, y, cellSize * 0.94, cellSize * 0.94, [
              cellSize * 0.42,
              0,
              cellSize * 0.42,
              0
            ]);
            ctx.fill();
          } else {
            ctx.fillRect(x, y, Math.ceil(cellSize), Math.ceil(cellSize));
          }
        }
      }

      // 4. Draw Custom 3 Corner Finder Eyes (7x7 outer ring + 3x3 inner ball)
      const drawFinderEye = (rowOffset: number, colOffset: number) => {
        const ex = startX + colOffset * cellSize;
        const ey = startY + rowOffset * cellSize;
        const outerSize = 7 * cellSize;
        const innerWhiteSize = 5 * cellSize;
        const ballSize = 3 * cellSize;

        ctx.fillStyle = mainFill;
        ctx.beginPath();
        if (eyeShape === 'circle') {
          ctx.arc(ex + outerSize / 2, ey + outerSize / 2, outerSize / 2, 0, Math.PI * 2);
        } else if (eyeShape === 'rounded') {
          ctx.roundRect(ex, ey, outerSize, outerSize, cellSize * 1.8);
        } else {
          ctx.rect(ex, ey, outerSize, outerSize);
        }
        ctx.fill();

        ctx.fillStyle = bgColor;
        ctx.beginPath();
        if (eyeShape === 'circle') {
          ctx.arc(ex + outerSize / 2, ey + outerSize / 2, innerWhiteSize / 2, 0, Math.PI * 2);
        } else if (eyeShape === 'rounded') {
          ctx.roundRect(
            ex + cellSize,
            ey + cellSize,
            innerWhiteSize,
            innerWhiteSize,
            cellSize * 1.2
          );
        } else {
          ctx.rect(ex + cellSize, ey + cellSize, innerWhiteSize, innerWhiteSize);
        }
        ctx.fill();

        ctx.fillStyle = mainFill;
        ctx.beginPath();
        if (eyeShape === 'circle') {
          ctx.arc(ex + outerSize / 2, ey + outerSize / 2, ballSize / 2, 0, Math.PI * 2);
        } else if (eyeShape === 'rounded') {
          ctx.roundRect(
            ex + cellSize * 2,
            ey + cellSize * 2,
            ballSize,
            ballSize,
            cellSize * 0.8
          );
        } else {
          ctx.rect(ex + cellSize * 2, ey + cellSize * 2, ballSize, ballSize);
        }
        ctx.fill();
      };

      drawFinderEye(0, 0);
      drawFinderEye(0, count - 7);
      drawFinderEye(count - 7, 0);

      // 5. Draw Center Logo Emblem if enabled
      if (hasLogo) {
        const cx = startX + qrDrawArea / 2;
        const cy = startY + qrDrawArea / 2;
        const logoBoxSize = 58 * scaleFactor;

        ctx.save();
        ctx.fillStyle = bgColor;
        ctx.beginPath();
        ctx.roundRect(
          cx - logoBoxSize / 2 - 4 * scaleFactor,
          cy - logoBoxSize / 2 - 4 * scaleFactor,
          logoBoxSize + 8 * scaleFactor,
          logoBoxSize + 8 * scaleFactor,
          16 * scaleFactor
        );
        ctx.fill();

        if (logoPreset === 'custom' && customLogoDataUrl) {
          await new Promise<void>((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              ctx.drawImage(
                img,
                cx - logoBoxSize / 2,
                cy - logoBoxSize / 2,
                logoBoxSize,
                logoBoxSize
              );
              resolve();
            };
            img.onerror = () => resolve();
            img.src = customLogoDataUrl;
          });
        } else {
          // Badge circle/rounded square
          ctx.fillStyle = mainFill;
          ctx.beginPath();
          ctx.roundRect(
            cx - logoBoxSize / 2,
            cy - logoBoxSize / 2,
            logoBoxSize,
            logoBoxSize,
            14 * scaleFactor
          );
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = `900 ${18 * scaleFactor}px system-ui, -apple-system, sans-serif`;
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
      eyeShape,
      fgColor,
      fgColor2,
      useGradient,
      bgColor,
      frameStyle,
      frameText,
      frameColor,
      logoPreset,
      customLogoDataUrl
    ]
  );

  // Re-render live preview canvas whenever anything changes
  useEffect(() => {
    if (previewCanvasRef.current) {
      renderStyledQrCanvas(previewCanvasRef.current, 1);
    }
  }, [renderStyledQrCanvas]);

  // Export High-Resolution Print PNG (1360px+)
  const handleDownloadPng = async () => {
    try {
      const offscreen = document.createElement('canvas');
      await renderStyledQrCanvas(offscreen, 4); // 4x retina print resolution
      const dataUrl = offscreen.toDataURL('image/png', 1.0);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `beamdrop-qr-${engineType}-${Date.now().toString(36)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      notifySuccess('High-Res PNG Exported', 'Downloaded 4x print-ready QR code PNG.');
    } catch (err) {
      notifyError('Export Failed', 'Could not generate PNG file.');
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
          const rx = bodyShape === 'dots' ? (cell / 2).toFixed(2) : bodyShape === 'rounded' ? (cell * 0.32).toFixed(2) : '0';
          rects.push(`<rect x="${x}" y="${y}" width="${w}" height="${w}" rx="${rx}" fill="url(#qrGrad)" />`);
        }
      }

      const stop2 = useGradient ? fgColor2 : fgColor;
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
    } catch (err) {
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
      // Compute SHA-256
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
      notifySuccess('PDF Uploaded to 24h Cloud Vault', 'QR code now links directly to your verified PDF showcase.');
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
        title = `${vcardFullName} (vCard)`;
        targetUrl = vcardWebsite;
        payload = {
          fullName: vcardFullName,
          jobTitle: vcardJobTitle,
          organization: vcardOrg,
          phone: vcardPhone,
          email: vcardEmail,
          website: vcardWebsite,
          address: vcardAddress
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
        setIsDynamicMode(true);
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
            ? { ...item, title: editingTitle || item.title, targetUrl: editingTargetUrl, updatedAt: Date.now() }
            : item
        )
      );

      if (res.ok) {
        notifySuccess('Dynamic Destination Updated', `QR /q/${code} now redirects to the new link without re-printing!`);
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
      setIsDynamicMode(false);
    }
    try {
      await fetch(`/api/qr-studio?action=delete&code=${encodeURIComponent(code)}`, { method: 'POST' });
    } catch (_) {}
    notifyInfo('Dynamic QR Removed', `Deleted /q/${code}.`);
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
    { id: 'analytics', label: 'Dynamic QRs', subtitle: `Analytics (${dynamicQrs.length})`, icon: BarChart3 }
  ];

  return (
    <div className="space-y-5">
      {/* Studio Header Bar */}
      <div className="bg-white/90 backdrop-blur-xl border border-sky-200/80 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2 text-xs text-sky-700 font-semibold">
            <span>BeamDrop Universal OS</span>
            <span aria-hidden="true">·</span>
            <span>Core 2: QR Studio</span>
            <span aria-hidden="true">·</span>
            <span>Print & Dynamic Analytics</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            QR Code Generator &amp; Dynamic Studio
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
                onClick={() => {
                  setActiveDynamicCode('');
                  setIsDynamicMode(false);
                }}
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
              <span>{isCreatingDynamic ? 'Creating Shortlink...' : 'Make Dynamic QR (/q/shortlink)'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 6 QR Generator Engine Selector Tabs (Interactive Segmented Bar) */}
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
                  <span className={`text-[10px] font-mono font-bold ${isActive ? 'text-sky-100' : 'text-sky-600'}`}>
                    {dynamicQrs.length} active
                  </span>
                )}
              </div>
              <div className="mt-2">
                <div className="text-xs font-bold leading-tight">{tab.label}</div>
                <div className={`text-[10px] mt-0.5 truncate ${isActive ? 'text-sky-100' : 'text-slate-400'}`}>
                  {tab.subtitle}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main 2-Column QRCG Studio Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (7 Cols): Content Input & Dynamic QR Analytics */}
        <div className="lg:col-span-7 space-y-5">
          {/* ENGINE 1: WEBSITE LINK */}
          {engineType === 'url' && (
            <div className="bg-white/90 backdrop-blur-xl border border-sky-200/80 rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">1. Enter Website or Destination URL</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Generate a direct QR code for any link, or activate Dynamic QR to track scans and update the link later.
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">Campaign / Label Title (For Dynamic Tracking)</label>
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

          {/* ENGINE 2: DIGITAL BUSINESS CARD (vCard) */}
          {engineType === 'vcard' && (
            <div className="bg-white/90 backdrop-blur-xl border border-sky-200/80 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">1. Digital Business Card (vCard 3.0)</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    When scanned, phones immediately prompt to save your contact details or open your executive profile card.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={vcardFullName}
                    onChange={(e) => setVcardFullName(e.target.value)}
                    placeholder="Alex Rivera"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Job Title / Role</label>
                  <input
                    type="text"
                    value={vcardJobTitle}
                    onChange={(e) => setVcardJobTitle(e.target.value)}
                    placeholder="Senior Architect"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Company / Organization</label>
                  <input
                    type="text"
                    value={vcardOrg}
                    onChange={(e) => setVcardOrg(e.target.value)}
                    placeholder="BeamDrop Inc."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={vcardPhone}
                    onChange={(e) => setVcardPhone(e.target.value)}
                    placeholder="+1 555 234 5678"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={vcardEmail}
                    onChange={(e) => setVcardEmail(e.target.value)}
                    placeholder="alex@company.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Website / Portfolio</label>
                  <input
                    type="url"
                    value={vcardWebsite}
                    onChange={(e) => setVcardWebsite(e.target.value)}
                    placeholder="https://company.com"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">City / Office Address</label>
                  <input
                    type="text"
                    value={vcardAddress}
                    onChange={(e) => setVcardAddress(e.target.value)}
                    placeholder="San Francisco, CA"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ENGINE 3: WI-FI DIRECT CONNECT */}
          {engineType === 'wifi' && (
            <div className="bg-white/90 backdrop-blur-xl border border-sky-200/80 rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">1. Wi-Fi Direct Connect Credentials</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Guests, cafés, and offices can join your Wi-Fi network with a single camera scan—no typing required.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Network Name (SSID)</label>
                  <input
                    type="text"
                    value={wifiSsid}
                    onChange={(e) => setWifiSsid(e.target.value)}
                    placeholder="Office_5G_WiFi"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Security / Encryption</label>
                  <select
                    value={wifiEncryption}
                    onChange={(e) => setWifiEncryption(e.target.value as 'WPA' | 'WEP' | 'nopass')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  >
                    <option value="WPA">WPA / WPA2 / WPA3</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">None (Open Network)</option>
                  </select>
                </div>

                {wifiEncryption !== 'nopass' && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Wi-Fi Password</label>
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
                        {showWifiPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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

          {/* ENGINE 4: PDF & DOCUMENT SHOWCASE (24h Cloud Drop Integrated) */}
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
                      {uploadedPdfMeta ? uploadedPdfMeta.name : 'Upload PDF or Document to 24h Cloud Drop'}
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
                  <span>{isUploadingPdf ? 'Uploading...' : uploadedPdfMeta ? 'Replace PDF' : 'Select PDF File'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Document Title</label>
                  <input
                    type="text"
                    value={pdfTitle}
                    onChange={(e) => setPdfTitle(e.target.value)}
                    placeholder="Product Catalog 2026.pdf"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Company / Author</label>
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
                <h2 className="text-base font-extrabold text-slate-900">1. Multi-Store Smart App QR (iOS &amp; Android)</h2>
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">Developer / Tagline</label>
                  <input
                    type="text"
                    value={appSubtitle}
                    onChange={(e) => setAppSubtitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Apple App Store URL (iOS / iPadOS)</label>
                  <input
                    type="url"
                    value={appIosUrl}
                    onChange={(e) => setAppIosUrl(e.target.value)}
                    placeholder="https://apps.apple.com/app/..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-mono text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Google Play Store URL (Android)</label>
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
                  <h2 className="text-base font-extrabold text-slate-900">Dynamic QR Campaigns &amp; Live Scan Telemetry</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Update any Dynamic QR destination URL in real time without re-printing the physical QR code.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRefreshAnalytics}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center space-x-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingAnalytics ? 'animate-spin text-sky-600' : ''}`} />
                  <span>Sync Scans</span>
                </button>
              </div>

              {dynamicQrs.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
                  <BarChart3 className="w-8 h-8 text-slate-400 mx-auto" />
                  <div className="text-sm font-bold text-slate-700">No Dynamic QR Codes Created Yet</div>
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
                              <span className="text-sm font-extrabold text-slate-900">{item.title}</span>
                              <span className="text-xs text-slate-400" aria-hidden="true">·</span>
                              <span className="text-xs font-mono font-bold text-sky-600">/q/{item.code}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono truncate max-w-md mt-0.5">
                              Target: {item.targetUrl || 'Interactive Landing Card'}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 text-xs">
                            <div className="text-right">
                              <div className="font-extrabold text-slate-900">{item.scans || 0} Scans</div>
                              <div className="text-[10px] text-slate-500">
                                iOS {item.osBreakdown?.iOS || 0} · Android {item.osBreakdown?.Android || 0} · Web{' '}
                                {item.osBreakdown?.Desktop || 0}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveDynamicCode(item.code);
                                notifyInfo('Loaded in Preview', `Previewing Dynamic QR /q/${item.code}`);
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
                              <label className="block text-[10px] font-bold text-slate-600 mb-1">Campaign Title</label>
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

          {/* VISUAL DESIGN STUDIO (QRCG Customizer: Shapes, Colors, Frames, Logos) */}
          <div className="bg-white/90 backdrop-blur-xl border border-sky-200/80 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">2. Customize Design, Frame &amp; Brand Logo</h2>
                <p className="text-xs text-slate-500">
                  High error-correction (Level H — 30% redundancy) ensures instant camera scanning with custom logos and shapes.
                </p>
              </div>

              {/* Segmented Customizer Tabs */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl shrink-0">
                {[
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
                      onClick={() => setActiveCustTab(t.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                        active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TAB 1: MODULE & EYE SHAPES */}
            {activeCustTab === 'shapes' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Pattern Module Shape</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: 'square', label: 'Classic Square' },
                        { id: 'rounded', label: 'Smooth Rounded' },
                        { id: 'dots', label: 'Modern Dots' },
                        { id: 'classy', label: 'Classy Diamond' }
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

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Corner Finder Eye Shape</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'square', label: 'Square' },
                        { id: 'rounded', label: 'Rounded' },
                        { id: 'circle', label: 'Circle' }
                      ] as const
                    ).map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setEyeShape(e.id)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                          eyeShape === e.id
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
            )}

            {/* TAB 2: COLOR PALETTES & GRADIENTS */}
            {activeCustTab === 'colors' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">Curated Executive Color Themes</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          setFgColor(preset.fg);
                          setFgColor2(preset.fg2);
                          setBgColor(preset.bg);
                          setFrameColor(preset.frame);
                          setUseGradient(true);
                        }}
                        className="p-2 rounded-xl border border-slate-200 hover:border-sky-400 flex items-center space-x-2 text-left cursor-pointer"
                      >
                        <span
                          className="w-5 h-5 rounded-lg shrink-0"
                          style={{ background: `linear-gradient(135deg, ${preset.fg}, ${preset.fg2})` }}
                        />
                        <span className="text-xs font-bold text-slate-700 truncate">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Primary Color</label>
                    <input
                      type="color"
                      value={fgColor}
                      onChange={(e) => setFgColor(e.target.value)}
                      className="w-full h-9 rounded-lg cursor-pointer border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Gradient Stop 2</label>
                    <input
                      type="color"
                      value={fgColor2}
                      onChange={(e) => setFgColor2(e.target.value)}
                      disabled={!useGradient}
                      className="w-full h-9 rounded-lg cursor-pointer border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Background</label>
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="w-full h-9 rounded-lg cursor-pointer border border-slate-200"
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center space-x-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useGradient}
                        onChange={(e) => setUseGradient(e.target.checked)}
                        className="rounded text-sky-600"
                      />
                      <span>Linear Gradient</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: FRAMES & CALL-TO-ACTION BANNERS */}
            {activeCustTab === 'frame' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Frame Layout</label>
                  <select
                    value={frameStyle}
                    onChange={(e) => setFrameStyle(e.target.value as QrFrameStyle)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800"
                  >
                    <option value="bottom-banner">Bottom CTA Banner</option>
                    <option value="top-banner">Top Header Banner</option>
                    <option value="none">Minimal Borderless</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Call-To-Action Text</label>
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">Frame Accent Color</label>
                  <input
                    type="color"
                    value={frameColor}
                    onChange={(e) => setFrameColor(e.target.value)}
                    className="w-full h-9 rounded-xl cursor-pointer border border-slate-200"
                  />
                </div>
              </div>
            )}

            {/* TAB 4: CENTER BRAND LOGO */}
            {activeCustTab === 'logo' && (
              <div className="space-y-3">
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
                    <span>Upload Custom Company Logo</span>
                  </button>
                  {customLogoDataUrl && (
                    <span className="text-xs text-emerald-700 font-semibold">Custom logo active</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT STICKY COLUMN (5 Cols): Live Interactive QR Preview & High-Res Export Dock */}
        <div className="lg:col-span-5 lg:sticky lg:top-6">
          <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-800 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-sky-400 font-bold">
                  Live Studio Preview
                </span>
                <h3 className="text-sm font-extrabold text-white mt-0.5">
                  {activeDynamicCode ? `Dynamic QR (/q/${activeDynamicCode})` : 'High-Density Vector Matrix'}
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">ECC: Level H (30%)</span>
            </div>

            {/* Canvas Container */}
            <div className="flex flex-col items-center justify-center bg-slate-950/70 rounded-2xl p-4 border border-slate-800/80">
              <canvas
                ref={previewCanvasRef}
                className="max-w-full h-auto rounded-2xl shadow-2xl"
                style={{ maxHeight: '340px' }}
              />
            </div>

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
                {copiedPayloadText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
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

            <button
              type="button"
              onClick={handleCopyQrImage}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-slate-200 font-bold text-xs flex items-center justify-center space-x-2 border border-slate-700/80 cursor-pointer transition-colors"
            >
              {copiedQrImage ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-sky-400" />}
              <span>{copiedQrImage ? 'QR Card Copied to Clipboard!' : 'Copy QR Card Image to Clipboard'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
