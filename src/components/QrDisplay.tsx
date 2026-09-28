import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Download, ExternalLink, QrCode as QrIcon } from 'lucide-react';

interface QrDisplayProps {
  value: string;
  size?: number;
  label?: string;
  sublabel?: string;
  showDownload?: boolean;
}

export const QrDisplay: React.FC<QrDisplayProps> = ({
  value,
  size = 200,
  label,
  sublabel,
  showDownload = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;

    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    }).catch((err) => {
      console.error('Failed to render QR Code:', err);
    });
  }, [value, size]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'beamdrop-qr.png';
    a.click();
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative p-3 bg-white rounded-2xl shadow-xl shadow-cyan-950/20 border border-slate-200 group">
        <canvas ref={canvasRef} className="rounded-lg block" />

        {/* Center Logo Overlay for branding */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-md flex items-center justify-center border-2 border-white pointer-events-none">
          <QrIcon className="w-5 h-5 text-white" />
        </div>
      </div>

      {(label || sublabel) && (
        <div className="text-center mt-3 max-w-[260px]">
          {label && <p className="text-xs font-semibold text-slate-200">{label}</p>}
          {sublabel && <p className="text-[11px] text-slate-400 mt-0.5">{sublabel}</p>}
        </div>
      )}

      {showDownload && (
        <div className="flex items-center space-x-2 mt-2">
          <button
            onClick={handleDownload}
            className="flex items-center space-x-1 text-[11px] text-slate-400 hover:text-cyan-400 transition-colors py-1 px-2 rounded-lg hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save QR Image</span>
          </button>
          <span className="text-slate-600">•</span>
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="flex items-center space-x-1 text-[11px] text-slate-400 hover:text-cyan-400 transition-colors py-1 px-2 rounded-lg hover:bg-slate-800"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Link</span>
          </a>
        </div>
      )}
    </div>
  );
};
