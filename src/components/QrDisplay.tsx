import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Download,
  Copy,
  Check,
  ExternalLink,
  QrCode as QrIcon,
  Sparkles,
  Shield,
  FileSpreadsheet,
  Presentation,
  FileText,
  FileArchive,
  Image as ImageIcon,
  Film,
  Zap,
  CheckCircle2
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
  showControls?: boolean;
}

export const QrDisplay: React.FC<QrDisplayProps> = ({
  value,
  size = 210,
  label,
  sublabel,
  fileName,
  fileSize,
  fileCategory,
  showControls = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);
  const [copyImageSupported, setCopyImageSupported] = useState(true);

  // Render main interactive QR canvas
  useEffect(() => {
    if (!canvasRef.current || !value) return;

    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: {
        dark: '#090d16',
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

  // Helper to generate the high-res Watermarked BeamDrop QR Card
  const createWatermarkedQrCanvas = async (): Promise<HTMLCanvasElement> => {
    const cardWidth = 720;
    const cardHeight = 880;
    const canvas = document.createElement('canvas');
    canvas.width = cardWidth;
    canvas.height = cardHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2d context');

    // 1. Background Gradient (Dark Cyber Slate with ambient glow)
    const bgGrad = ctx.createLinearGradient(0, 0, cardWidth, cardHeight);
    bgGrad.addColorStop(0, '#060913');
    bgGrad.addColorStop(0.5, '#0b1120');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, cardWidth, cardHeight);

    // Decorative ambient glow spots
    const radialGlow = ctx.createRadialGradient(cardWidth / 2, 80, 10, cardWidth / 2, 80, 280);
    radialGlow.addColorStop(0, 'rgba(6, 182, 212, 0.22)');
    radialGlow.addColorStop(1, 'rgba(6, 182, 212, 0)');
    ctx.fillStyle = radialGlow;
    ctx.fillRect(0, 0, cardWidth, 400);

    // 2. Rounded Outer Card Border
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.7)';
    ctx.lineWidth = 4;
    ctx.strokeRect(16, 16, cardWidth - 32, cardHeight - 32);

    // Subtle corner cyan accents
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 6;
    // Top-left corner
    ctx.beginPath();
    ctx.moveTo(16, 60);
    ctx.lineTo(16, 16);
    ctx.lineTo(60, 16);
    ctx.stroke();
    // Top-right corner
    ctx.beginPath();
    ctx.moveTo(cardWidth - 60, 16);
    ctx.lineTo(cardWidth - 16, 16);
    ctx.lineTo(cardWidth - 16, 60);
    ctx.stroke();
    // Bottom-left corner
    ctx.beginPath();
    ctx.moveTo(16, cardHeight - 60);
    ctx.lineTo(16, cardHeight - 16);
    ctx.lineTo(60, cardHeight - 16);
    ctx.stroke();
    // Bottom-right corner
    ctx.beginPath();
    ctx.moveTo(cardWidth - 60, cardHeight - 16);
    ctx.lineTo(cardWidth - 16, cardHeight - 16);
    ctx.lineTo(cardWidth - 16, cardHeight - 60);
    ctx.stroke();

    // 3. Header: Brand Logo & Title
    // Icon badge circle
    const iconX = cardWidth / 2 - 130;
    const iconY = 70;
    const gradIcon = ctx.createLinearGradient(iconX - 25, iconY - 25, iconX + 25, iconY + 25);
    gradIcon.addColorStop(0, '#06b6d4');
    gradIcon.addColorStop(1, '#3b82f6');
    ctx.fillStyle = gradIcon;
    ctx.beginPath();
    ctx.arc(iconX, iconY, 26, 0, Math.PI * 2);
    ctx.fill();

    // Lightning bolt inside circle
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡', iconX, iconY);

    // Project Name Header
    ctx.textAlign = 'left';
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('BeamDrop', iconX + 42, iconY - 6);

    ctx.font = '600 14px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('DIRECT P2P FILE GATEWAY', iconX + 44, iconY + 18);

    // 4. Staged File Badge (if provided)
    let qrTopY = 160;
    if (fileName) {
      const pillWidth = 580;
      const pillHeight = 56;
      const pillX = (cardWidth - pillWidth) / 2;
      const pillY = 130;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 14);
      ctx.fill();
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Icon & filename text
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillStyle = '#f8fafc';

      let cleanName = fileName;
      if (cleanName.length > 34) {
        cleanName = cleanName.slice(0, 31) + '...';
      }
      ctx.fillText(`📄 ${cleanName}`, pillX + 20, pillY + pillHeight / 2);

      if (fileSize && fileSize > 0) {
        ctx.textAlign = 'right';
        ctx.font = 'bold 15px monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(formatBytes(fileSize), pillX + pillWidth - 20, pillY + pillHeight / 2);
      }
      qrTopY = 210;
    }

    // 5. White Rounded QR Card Container
    const qrCardSize = 420;
    const qrCardX = (cardWidth - qrCardSize) / 2;
    const qrCardY = qrTopY;

    // Soft drop shadow for QR container
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 15;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(qrCardX, qrCardY, qrCardSize, qrCardSize, 28);
    ctx.fill();
    ctx.restore();

    // High-res QR code on an offscreen canvas to draw cleanly inside the white card
    const qrRawCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrRawCanvas, value, {
      width: 360,
      margin: 0,
      color: {
        dark: '#090d16',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    });

    const qrInnerX = qrCardX + (qrCardSize - 360) / 2;
    const qrInnerY = qrCardY + (qrCardSize - 360) / 2;
    ctx.drawImage(qrRawCanvas, qrInnerX, qrInnerY, 360, 360);

    // Center branded badge over the QR code
    const centerBadgeSize = 64;
    const centerBadgeX = qrCardX + qrCardSize / 2;
    const centerBadgeY = qrCardY + qrCardSize / 2;

    const centerGrad = ctx.createLinearGradient(
      centerBadgeX - 32,
      centerBadgeY - 32,
      centerBadgeX + 32,
      centerBadgeY + 32
    );
    centerGrad.addColorStop(0, '#06b6d4');
    centerGrad.addColorStop(1, '#2563eb');

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(centerBadgeX - 36, centerBadgeY - 36, 72, 72, 18);
    ctx.fill();

    ctx.fillStyle = centerGrad;
    ctx.beginPath();
    ctx.roundRect(centerBadgeX - 32, centerBadgeY - 32, 64, 64, 16);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡', centerBadgeX, centerBadgeY);
    ctx.restore();

    // 6. Scan Instruction text below QR
    const textStartY = qrCardY + qrCardSize + 36;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = '#f1f5f9';
    ctx.fillText('Point Phone Camera or QR Scanner to Connect', cardWidth / 2, textStartY);

    ctx.font = '500 15px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Direct RAM stream over encrypted WebRTC DataChannel', cardWidth / 2, textStartY + 28);

    // 7. OFFICIAL BEAMDROP WATERMARK FOOTER
    const footerY = cardHeight - 75;

    // Divider line
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, footerY);
    ctx.lineTo(cardWidth - 40, footerY);
    ctx.stroke();

    // Watermark text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('⚡ BeamDrop • Zero Cloud Storage • Encrypted P2P', cardWidth / 2, footerY + 24);

    ctx.font = '500 12px monospace';
    ctx.fillStyle = '#64748b';
    ctx.fillText('https://beam-drop-mu.vercel.app', cardWidth / 2, footerY + 44);

    return canvas;
  };

  // Download QR Code as Branded Watermarked Image
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
      console.error('Failed to export watermarked QR image:', err);
      // Fallback: download raw canvas
      if (canvasRef.current) {
        const url = canvasRef.current.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
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
          if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            setCopiedImage(true);
            setTimeout(() => setCopiedImage(false), 2200);
          } else {
            setCopyImageSupported(false);
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

  return (
    <div className="flex flex-col items-center w-full">
      {/* Interactive QR Display Card with Glow */}
      <div className="relative group">
        <div className="absolute -inset-1.5 bg-gradient-to-r from-cyan-500/30 via-blue-500/20 to-indigo-500/30 rounded-3xl blur-md group-hover:blur-lg transition-all opacity-80" />
        
        <div className="relative p-3.5 bg-white rounded-3xl shadow-2xl border-2 border-slate-200/90 transition-transform duration-200 group-hover:scale-[1.01]">
          <canvas ref={canvasRef} className="rounded-2xl block" />

          {/* Center Logo Overlay for branding */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500 via-sky-500 to-blue-600 shadow-xl flex items-center justify-center border-[3px] border-white pointer-events-none">
            <Zap className="w-6 h-6 text-white fill-current" />
          </div>
        </div>
      </div>

      {/* Label and Sublabel */}
      {(label || sublabel) && (
        <div className="text-center mt-3 max-w-[280px]">
          {label && <p className="text-xs font-bold text-slate-100">{label}</p>}
          {sublabel && <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{sublabel}</p>}
        </div>
      )}

      {/* Full Control Bar: Save Watermarked Image + Copy Link + Copy Image */}
      {showControls && (
        <div className="w-full mt-3.5 space-y-2">
          {/* Primary Action: Download Branded Watermarked QR Card */}
          <button
            onClick={handleDownloadWatermarked}
            disabled={isGeneratingCard}
            className="w-full py-2.5 px-3 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center space-x-2 transition-all active:scale-[0.98] cursor-pointer"
            title="Download high-resolution QR card with BeamDrop watermark"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isGeneratingCard ? 'Generating Card...' : 'Save QR Card (BeamDrop Watermark)'}</span>
          </button>

          {/* Secondary Action Row: Copy Link & Copy QR Image */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={handleCopyLink}
              className="py-2 px-2.5 bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 hover:border-cyan-500/50 text-slate-200 rounded-xl font-medium flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              title="Copy direct download URL"
            >
              {copiedLink ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">Link Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Copy Link</span>
                </>
              )}
            </button>

            <button
              onClick={handleCopyQrImage}
              className="py-2 px-2.5 bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700/80 hover:border-cyan-500/50 text-slate-200 rounded-xl font-medium flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              title="Copy QR image to clipboard for WhatsApp, Slack, Discord"
            >
              {copiedImage ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">QR Copied!</span>
                </>
              ) : (
                <>
                  <QrIcon className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Copy QR Code</span>
                </>
              )}
            </button>
          </div>

          {/* BeamDrop Brand Watermark Micro-tag */}
          <div className="pt-1 flex items-center justify-center space-x-2 text-[10px] text-slate-500 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            <span>BeamDrop Watermark Engine</span>
            <span>•</span>
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-cyan-400 flex items-center space-x-1"
            >
              <span>Test Link</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
