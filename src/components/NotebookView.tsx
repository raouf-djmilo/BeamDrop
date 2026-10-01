import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Copy,
  Check,
  Download,
  QrCode,
  Share2,
  Trash2,
  Code2,
  Sparkles,
  ExternalLink,
  Zap,
  FileText,
  Clock,
  Terminal
} from 'lucide-react';
import QRCode from 'qrcode';
import { playChime } from '../utils/audio';

interface NotebookViewProps {
  initialContent?: string;
  onBeamNote?: (text: string) => void;
}

export const NotebookView: React.FC<NotebookViewProps> = ({
  initialContent = '',
  onBeamNote
}) => {
  const [content, setContent] = useState<string>(initialContent);
  const [detectedType, setDetectedType] = useState<'note' | 'code' | 'url'>('note');
  const [codeLang, setCodeLang] = useState<string>('text');
  const [copied, setCopied] = useState<boolean>(false);
  const [qrModalOpen, setQrModalOpen] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Sample notes for immediate exploration
  const sampleNotes = [
    {
      title: 'JavaScript WebRTC Bridge',
      text: `// BeamDrop RAM-to-RAM Chunking\nconst CHUNK_SIZE = 64 * 1024;\nasync function streamBuffer(channel, arrayBuffer) {\n  for (let offset = 0; offset < arrayBuffer.byteLength; offset += CHUNK_SIZE) {\n    const slice = arrayBuffer.slice(offset, offset + CHUNK_SIZE);\n    channel.send(slice);\n  }\n}`
    },
    {
      title: 'Local Wi-Fi Mesh Config',
      text: `{\n  "network": "Wi-Fi_P2P_Mesh",\n  "band": "5 GHz / 2.4 GHz",\n  "speed": "Auto-Negotiated",\n  "encryption": "WPA3 / WPA2",\n  "mode": "Direct Device-to-Device Mesh"\n}`
    },
    {
      title: 'Vercel Deployment URL',
      text: `https://beam-drop-mu.vercel.app`
    }
  ];

  // Auto-detect format & language
  useEffect(() => {
    const trimmed = content.trim();
    if (!trimmed) {
      setDetectedType('note');
      setCodeLang('text');
      return;
    }

    if (/^https?:\/\/[^\s]+$/i.test(trimmed)) {
      setDetectedType('url');
      setCodeLang('URL Link');
    } else if (
      trimmed.startsWith('{') || trimmed.startsWith('[') ||
      trimmed.includes('function') || trimmed.includes('const ') ||
      trimmed.includes('import ') || trimmed.includes('def ') ||
      trimmed.includes('<html') || trimmed.includes('class ')
    ) {
      setDetectedType('code');
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) setCodeLang('JSON');
      else if (trimmed.includes('def ') || trimmed.includes('import numpy')) setCodeLang('Python');
      else if (trimmed.includes('<html') || trimmed.includes('</div>')) setCodeLang('HTML');
      else setCodeLang('JavaScript / TypeScript');
    } else {
      setDetectedType('note');
      setCodeLang('Markdown Note');
    }
  }, [content]);

  // Generate QR Code for sharing text to phone
  const generateQrForText = async () => {
    if (!content.trim()) return;
    try {
      const b64 = btoa(unescape(encodeURIComponent(content.trim())));
      const host = typeof window !== 'undefined' ? window.location.origin : 'https://beam-drop-mu.vercel.app';
      const shareUrl = `${host}/notebook.html#data=${b64}&type=${detectedType}`;
      const url = await QRCode.toDataURL(shareUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      setQrDataUrl(url);
      setQrModalOpen(true);
      playChime('connect');
    } catch (e) {
      console.error('Failed to generate QR for text:', e);
    }
  };

  const copyToClipboard = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    playChime('connect');
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadAsFile = () => {
    if (!content) return;
    const ext = detectedType === 'code' ? (codeLang === 'JSON' ? 'json' : 'js') : 'txt';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BeamDrop_Note_${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    playChime('complete');
  };

  const lineCount = content ? content.split('\n').length : 0;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-panel-glow rounded-3xl p-5 border border-cyan-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-extrabold text-white tracking-tight">
                Notebook
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live text editor for beamed notes, code snippets, and links.
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={copyToClipboard}
            disabled={!content.trim()}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-cyan-500 text-slate-200 hover:text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-40"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          <button
            onClick={downloadAsFile}
            disabled={!content.trim()}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-cyan-500 text-slate-200 hover:text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Save File</span>
          </button>

          <button
            onClick={generateQrForText}
            disabled={!content.trim()}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-cyan-600/20 cursor-pointer disabled:opacity-40"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Generate Phone QR</span>
          </button>

          {onBeamNote && (
            <button
              onClick={() => onBeamNote(content)}
              disabled={!content.trim()}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-40"
            >
              <Zap className="w-3.5 h-3.5 fill-white" />
              <span>Beam Note</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Editor & Preset Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Editor Area (8 cols) */}
        <div className="lg:col-span-8 glass-panel rounded-3xl p-5 border border-slate-800 space-y-4">
          {/* Metadata pill row */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center space-x-2">
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                detectedType === 'url'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : detectedType === 'code'
                  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              }`}>
                {codeLang}
              </span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-slate-400 font-mono">
                {charCount} chars • {wordCount} words • {lineCount} lines
              </span>
            </div>

            {content && (
              <button
                onClick={() => setContent('')}
                className="text-xs text-slate-500 hover:text-red-400 flex items-center space-x-1 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          {/* Text Area */}
          <div className="relative">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste code snippet, URL link, or write a note to beam to nearby devices..."
              rows={14}
              className="w-full bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 text-sm font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 leading-relaxed resize-y selection:bg-cyan-500 selection:text-white"
            />
          </div>

          {/* URL clickable preview if type is URL */}
          {detectedType === 'url' && content.trim() && (
            <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-2xl flex items-center justify-between">
              <div className="flex items-center space-x-2 truncate">
                <ExternalLink className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-xs text-cyan-200 truncate">{content.trim()}</span>
              </div>
              <a
                href={content.trim()}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-cyan-400 hover:underline shrink-0 ml-2"
              >
                Open Link ↗
              </a>
            </div>
          )}
        </div>

        {/* Presets & Samples Sidebar (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-panel rounded-3xl p-5 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Explore Quick Templates</span>
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Load ready-to-test code blocks, JSON schemas, or web links to beam immediately to your smartphone.
            </p>

            <div className="space-y-2 pt-1">
              {sampleNotes.map((sample, idx) => (
                <div
                  key={idx}
                  onClick={() => setContent(sample.text)}
                  className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900 cursor-pointer transition-all group"
                >
                  <p className="text-xs font-bold text-slate-200 group-hover:text-cyan-300 transition-colors">
                    {sample.title}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 truncate mt-1">
                    {sample.text.replace(/\n/g, ' ')}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-3xl p-5 border border-slate-800 space-y-2">
            <h4 className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span>Zero-Cloud Privacy</span>
            </h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              All notes and code in this hub are kept exclusively in device RAM. No database, no logging, and zero server retention.
            </p>
          </div>
        </div>
      </div>

      {/* QR Code Sharing Modal */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="glass-panel-glow rounded-3xl p-6 max-w-sm w-full border border-cyan-500/40 text-center space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-mono text-cyan-400 uppercase">Phone QR Portal</span>
              <button
                onClick={() => setQrModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 rounded-lg bg-slate-900"
              >
                ✕ Close
              </button>
            </div>

            <h3 className="text-sm font-extrabold text-white">Scan to Open in Mobile Notebook</h3>
            <p className="text-xs text-slate-400">
              Point your smartphone camera to load this note directly into the mobile notebook web view.
            </p>

            <div className="bg-white p-3 rounded-2xl mx-auto w-fit shadow-xl">
              <img src={qrDataUrl} alt="Note QR Code" className="w-56 h-56 rounded-lg" />
            </div>

            <button
              onClick={() => setQrModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
