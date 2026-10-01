import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Download,
  Copy,
  Check,
  QrCode as QrIcon,
  Zap,
  CheckCircle2,
  FileSpreadsheet,
  Presentation,
  FileText,
  FileArchive,
  Image as ImageIcon,
  Film,
  Smartphone,
  Layers,
  ArrowRight
} from 'lucide-react';
import { formatBytes } from '../utils/formatters';

interface QrDisplayProps {
  value: string;
  size?: number;
  label?: string;
  sublabel?: string;
  fileName?: string;
  fileSize?: number;
  fileCategory?: string;
  sessionToken?: string;
  showControls?: boolean;
}

export const QrDisplay: React.FC<QrDisplayProps> = ({
  value,
  size = 220,
  label,
  sublabel,
  fileName,
  fileSize,
  fileCategory,
  sessionToken,
  showControls = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);

  // Render main interactive QR canvas
  useEffect(() => {
    if (!canvasRef.current || !value) return;

    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    }).catch((err) => {
      console.error('Failed to render QR Code:', err);
    });
  }, [value, size]);

  // Copy target pairing link
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  // Helper to generate a high-res BeamDrop QR Card canvas
  const createWatermarkedQrCanvas = async (): Promise<HTMLCanvasElement> => {
    const cardWidth = 720;
    const cardHeight = 860;
    const canvas = document.createElement('canvas');
    canvas.width = cardWidth;
    canvas.height = cardHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2d context');

    // 1. Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, cardWidth, cardHeight);
    bgGrad.addColorStop(0, '#060913');
    bgGrad.addColorStop(0.5, '#0b1120');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, cardWidth, cardHeight);

    // Decorative ambient glow spots
    const radialGlow = ctx.createRadialGradient(cardWidth / 2, 80, 10, cardWidth / 2, 80, 280);
    radialGlow.addColorStop(0, 'rgba(14, 165, 233, 0.25)');
    radialGlow.addColorStop(1, 'rgba(14, 165, 233, 0)');
    ctx.fillStyle = radialGlow;
    ctx.fillRect(0, 0, cardWidth, 400);

    // 2. Header Branding
    ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('BeamDrop', cardWidth / 2, 60);

    ctx.font = '500 16px system-ui, sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('Direct Device-to-Device Transfer', cardWidth / 2, 95);

    // 3. File Info Badge (if files present)
    let qrCardY = 130;
    if (fileName) {
      const badgeWidth = 560;
      const badgeHeight = 64;
      const badgeX = (cardWidth - badgeWidth) / 2;
      const badgeY = 120;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 16);
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      const truncatedName = fileName.length > 34 ? fileName.slice(0, 31) + '...' : fileName;
      ctx.fillText(truncatedName, badgeX + 24, badgeY + 38);

      if (fileSize) {
        ctx.font = 'bold 15px monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'right';
        ctx.fillText(formatBytes(fileSize), badgeX + badgeWidth - 24, badgeY + 38);
      }
      qrCardY = 205;
    }

    // 4. White QR Container
    const qrCardSize = 400;
    const qrCardX = (cardWidth - qrCardSize) / 2;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(14, 165, 233, 0.4)';
    ctx.shadowBlur = 35;
    ctx.beginPath();
    ctx.roundRect(qrCardX, qrCardY, qrCardSize, qrCardSize, 28);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw QR code onto white container
    const qrTempCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrTempCanvas, value, {
      width: qrCardSize - 32,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
      errorCorrectionLevel: 'H'
    });
    ctx.drawImage(qrTempCanvas, qrCardX + 16, qrCardY + 16);

    // Center Logo Emblem
    const centerBadgeSize = 56;
    const centerBadgeX = cardWidth / 2;
    const centerBadgeY = qrCardY + qrCardSize / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerBadgeX, centerBadgeY, centerBadgeSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#0284c7';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BD', centerBadgeX, centerBadgeY);
    ctx.restore();

    // 5. Scan Instruction text below QR
    const textStartY = qrCardY + qrCardSize + 32;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('Point Camera to Beam Directly', cardWidth / 2, textStartY);

    ctx.font = '500 14px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Encrypted WebRTC P2P Transfer', cardWidth / 2, textStartY + 26);

    return canvas;
  };

  // Download QR Code as Image
  const handleDownloadWatermarked = async () => {
    try {
      setIsGeneratingCard(true);
      const cardCanvas = await createWatermarkedQrCanvas();
      const dataUrl = cardCanvas.toDataURL('image/png', 1.0);

      const a = document.createElement('a');
      a.href = dataUrl;
      const safeName = fileName
        ? `beamdrop-qr-${fileName.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`
        : 'beamdrop-qr-card.png';
      a.download = safeName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to export QR image:', err);
      if (canvasRef.current) {
        const fallbackUrl = canvasRef.current.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = fallbackUrl;
        a.download = 'beamdrop-qr.png';
        a.click();
      }
    } finally {
      setIsGeneratingCard(false);
    }
  };

  // Copy QR Image to Clipboard
  const handleCopyQrImage = async () => {
    try {
      const cardCanvas = await createWatermarkedQrCanvas();
      cardCanvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            setCopiedImage(true);
            setTimeout(() => setCopiedImage(false), 2200);
          } else {
            handleCopyLink();
          }
        } catch (err) {
          console.warn('Clipboard write image failed, falling back to link copy:', err);
          handleCopyLink();
        }
      }, 'image/png');
    } catch (err) {
      console.error('Failed to copy QR image:', err);
      handleCopyLink();
    }
  };

  // Category Icon Resolver
  const renderCategoryIcon = () => {
    switch (fileCategory) {
      case 'spreadsheet':
        return <FileSpreadsheet className="w-4 h-4 text-emerald-600" />;
      case 'presentation':
        return <Presentation className="w-4 h-4 text-amber-600" />;
      case 'document':
        return <FileText className="w-4 h-4 text-rose-600" />;
      case 'archive':
        return <FileArchive className="w-4 h-4 text-purple-600" />;
      case 'image':
        return <ImageIcon className="w-4 h-4 text-sky-600" />;
      case 'video':
        return <Film className="w-4 h-4 text-indigo-600" />;
      default:
        return <Layers className="w-4 h-4 text-sky-600" />;
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* File Info / Status Pill Header above QR */}
      <div className="w-full mb-3.5">
        {fileName ? (
          <div className="flex items-center justify-between px-3.5 py-2 rounded-2xl bg-sky-50/90 border border-sky-200/90 shadow-2xs">
            <div className="flex items-center space-x-2.5 truncate text-left">
              <div className="p-1 rounded-lg bg-white shadow-2xs shrink-0">
                {renderCategoryIcon()}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-slate-900 truncate leading-tight">
                  {fileName}
                </p>
                <p className="text-[10px] text-sky-700 font-mono font-medium">
                  {fileSize ? formatBytes(fileSize) : 'Direct Beam'}
                </p>
              </div>
            </div>
            <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              Ready
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center space-x-2 px-3 py-1.5 rounded-xl bg-sky-50/80 border border-sky-200/70 text-slate-700 text-xs font-semibold">
            <Smartphone className="w-3.5 h-3.5 text-sky-600" />
            <span>Point camera to connect</span>
          </div>
        )}
      </div>

      {/* Interactive QR Display Card with Laser Focus Corner Brackets */}
      <div className="relative group p-2">
        {/* Soft Ambient Glow Behind QR */}
        <div className="absolute -inset-1 bg-gradient-to-tr from-sky-400/20 via-blue-500/15 to-indigo-500/20 rounded-3xl blur-md group-hover:blur-lg transition-all opacity-80" />

        {/* High-Tech Framing Container with 4 Corner Brackets */}
        <div className="relative p-4 bg-white rounded-3xl shadow-xl border border-sky-100 transition-all duration-200 group-hover:shadow-2xl">
          {/* Top-Left Corner Bracket */}
          <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-sky-500 rounded-tl-lg pointer-events-none" />
          {/* Top-Right Corner Bracket */}
          <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-sky-500 rounded-tr-lg pointer-events-none" />
          {/* Bottom-Left Corner Bracket */}
          <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-sky-500 rounded-bl-lg pointer-events-none" />
          {/* Bottom-Right Corner Bracket */}
          <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-sky-500 rounded-br-lg pointer-events-none" />

          {/* QR Canvas */}
          <canvas ref={canvasRef} className="rounded-2xl block mx-auto" />

          {/* Center Logo Emblem */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 shadow-lg flex items-center justify-center border-2 border-white pointer-events-none">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
        </div>
      </div>

      {/* Dynamic Rolling Session Security Badge */}
      {sessionToken && (
        <div className="mt-2.5 flex items-center space-x-1.5 px-3 py-1 rounded-full bg-sky-50 border border-sky-200/90 text-[10px] text-sky-800 font-mono font-medium shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Rolling Session: #{sessionToken.slice(0, 7)}</span>
        </div>
      )}

      {/* Clean 3-Step Micro Scan Guide */}
      <div className="w-full mt-2.5 py-2 px-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-[10px] text-slate-600 font-medium">
        <span className="flex items-center space-x-1">
          <span className="w-3.5 h-3.5 rounded-full bg-sky-600 text-white text-[9px] font-bold flex items-center justify-center">1</span>
          <span>Open Camera</span>
        </span>
        <ArrowRight className="w-3 h-3 text-slate-300" />
        <span className="flex items-center space-x-1">
          <span className="w-3.5 h-3.5 rounded-full bg-sky-600 text-white text-[9px] font-bold flex items-center justify-center">2</span>
          <span>Scan Code</span>
        </span>
        <ArrowRight className="w-3 h-3 text-slate-300" />
        <span className="flex items-center space-x-1">
          <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 text-white text-[9px] font-bold flex items-center justify-center">3</span>
          <span className="text-emerald-700 font-semibold">Direct Beam</span>
        </span>
      </div>

      {/* Control Actions: Save QR + Copy Link + Copy Image */}
      {showControls && (
        <div className="w-full mt-3 space-y-2">
          {/* Primary Action: Download Crisp QR Card */}
          <button
            type="button"
            onClick={handleDownloadWatermarked}
            disabled={isGeneratingCard}
            className="w-full py-2.5 px-3 bg-sky-600 hover:bg-sky-500 active:scale-[0.99] text-white font-semibold text-xs rounded-xl shadow-xs hover:shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer"
            title="Download QR code image"
          >
            <Download className="w-4 h-4" />
            <span>{isGeneratingCard ? 'Generating Image...' : 'Save QR Card'}</span>
          </button>

          {/* Secondary Action Row: Copy Link & Copy QR Image */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={handleCopyLink}
              className="py-2 px-2.5 bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-slate-700 hover:text-sky-800 rounded-xl font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Copy direct web link"
            >
              {copiedLink ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-sky-600" />
                  <span>Copy Link</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleCopyQrImage}
              className="py-2 px-2.5 bg-white hover:bg-sky-50 border border-slate-200 hover:border-sky-300 text-slate-700 hover:text-sky-800 rounded-xl font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Copy QR image to clipboard"
            >
              {copiedImage ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">QR Copied!</span>
                </>
              ) : (
                <>
                  <QrIcon className="w-3.5 h-3.5 text-sky-600" />
                  <span>Copy QR</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
