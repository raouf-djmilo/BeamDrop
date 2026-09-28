import JSZip from 'jszip';

export interface ExtensionFile {
  name: string;
  path: string;
  language: string;
  description: string;
  content: string;
}

export const getExtensionFiles = (receiverBaseUrl: string = 'https://beam-drop-mu.vercel.app'): ExtensionFile[] => {
  const cleanUrl = (receiverBaseUrl || 'https://beam-drop-mu.vercel.app').replace(/\/$/, '');

  const manifestJson = `{
  "manifest_version": 3,
  "name": "BeamDrop - Direct P2P Device Share",
  "version": "1.1.0",
  "description": "Lightning-fast direct Device-to-Device file, photo, video, and text transfer without servers or cloud storage using WebRTC and QR codes.",
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "permissions": [
    "storage",
    "unlimitedStorage",
    "contextMenus",
    "notifications"
  ],
  "host_permissions": [
    "https://*.peerjs.com/*"
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}`;

  const popupHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BeamDrop</title>
  <link rel="stylesheet" href="style.css">
  <script src="qrcode.min.js"></script>
  <script src="peerjs.min.js"></script>
</head>
<body>
  <!-- Header -->
  <header class="app-header">
    <div class="brand-group">
      <div class="logo-box">
        <svg class="logo-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <div>
        <h1 class="brand-title">BeamDrop</h1>
        <p class="brand-sub">DIRECT P2P STREAM</p>
      </div>
    </div>
    <div id="statusBadge" class="status-badge">
      <span class="status-dot"></span>
      <span id="statusText">Ready</span>
    </div>
  </header>

  <!-- STAGE 1: File Staging & Upload -->
  <main id="stageStaging" class="stage-container">
    <div id="dropZone" class="drop-zone">
      <input type="file" id="fileInput" class="hidden-input" accept="*/*" multiple />
      <div class="drop-icon-circle">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      </div>
      <p class="drop-title">Drop ANY file, video, photo, or ZIP</p>
      <p class="drop-sub">Direct RAM stream • No size limits • Zero cloud</p>
    </div>

    <!-- Staged File Preview Card -->
    <div id="stagedCard" class="staged-card" style="display: none;">
      <div class="thumb-wrapper">
        <img id="thumbImg" class="thumb-img" alt="preview" style="display: none;" />
        <div id="thumbIcon" class="thumb-icon">📦</div>
      </div>
      <div class="staged-info">
        <p id="stagedFileName" class="staged-name">archive.zip</p>
        <div class="staged-meta">
          <span id="stagedFileSize">0 MB</span>
          <span>•</span>
          <span style="color: #38bdf8;">Ready to Beam</span>
        </div>
      </div>
      <button id="btnRemoveFile" class="btn-trash" title="Remove File">✕</button>
    </div>

    <!-- Primary CTA Button -->
    <button id="btnGenerateQr" class="btn-cta-generate" disabled>
      <span>⚡ Generate QR Code</span>
    </button>
  </main>

  <!-- STAGE 2: Portal Active & QR Code Display -->
  <main id="stagePortal" class="stage-container" style="display: none;">
    <div class="qr-card-container">
      <div class="qr-box-200">
        <canvas id="qrcodeCanvas" width="184" height="184"></canvas>
      </div>

      <div class="radar-row">
        <span class="radar-ping"></span>
        <span class="radar-text">Ready for scan... Open camera on phone</span>
      </div>
      <p id="portalUrlText" class="portal-url-text">${cleanUrl}/?peer=...</p>

      <div class="qr-actions-row">
        <button id="btnCopyLink" class="btn-secondary">
          <span id="copyLinkText">Copy Link</span>
        </button>
        <button id="btnCancelPortal" class="btn-secondary" style="color: #f87171;">
          Cancel / New Upload
        </button>
      </div>
    </div>
  </main>

  <!-- STAGE 3: High-Performance Streaming & Auto-Transfer -->
  <main id="stageTransfer" class="stage-container" style="display: none;">
    <div class="transfer-live-card">
      <p id="transferFileTitle" class="transfer-file-title">Sending file...</p>
      <div class="progress-track">
        <div id="transferProgressFill" class="progress-fill" style="width: 0%"></div>
      </div>
      <div class="transfer-metrics-row">
        <span id="transferPercentText">0%</span>
        <span id="transferSpeedText" class="speed-tag">0 MB/s</span>
        <span id="transferEtaText">Streaming...</span>
      </div>
    </div>
  </main>

  <!-- STAGE 4: Completion & Reset -->
  <main id="stageComplete" class="stage-container" style="display: none;">
    <div class="complete-card">
      <div class="complete-icon">✓</div>
      <h3 class="complete-title">Transfer Complete!</h3>
      <p class="complete-sub">File streamed directly and saved to your device.</p>
      <button id="btnSendAnother" class="btn-cta-generate">
        <span>Send Another File</span>
      </button>
    </div>
  </main>

  <!-- Footer -->
  <footer class="app-footer">
    <div class="footer-left">
      <span class="secure-dot"></span>
      <span>P2P Encrypted</span>
    </div>
    <span>Zero Cloud Storage</span>
  </footer>

  <script src="popup.js"></script>
</body>
</html>`;

  const popupJs = `/**
 * BeamDrop Chrome Extension - Popup Controller (Manifest V3)
 * Dynamic Staging -> Generate QR -> Backpressure Stream -> Reset
 */

const VERCEL_RECEIVER_URL = "${cleanUrl}";
const CHUNK_SIZE = 64 * 1024; // 64KB slices

// State
let stagedFiles = [];
let peer = null;
let activeConnection = null;
let currentPeerId = null;
let isStreaming = false;

// DOM Elements
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');

// Stages
const stageStaging = document.getElementById('stageStaging');
const stagePortal = document.getElementById('stagePortal');
const stageTransfer = document.getElementById('stageTransfer');
const stageComplete = document.getElementById('stageComplete');

// Stage 1 Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const stagedCard = document.getElementById('stagedCard');
const thumbImg = document.getElementById('thumbImg');
const thumbIcon = document.getElementById('thumbIcon');
const stagedFileName = document.getElementById('stagedFileName');
const stagedFileSize = document.getElementById('stagedFileSize');
const btnRemoveFile = document.getElementById('btnRemoveFile');
const btnGenerateQr = document.getElementById('btnGenerateQr');

// Stage 2 Elements
const qrcodeCanvas = document.getElementById('qrcodeCanvas');
const portalUrlText = document.getElementById('portalUrlText');
const btnCopyLink = document.getElementById('btnCopyLink');
const copyLinkText = document.getElementById('copyLinkText');
const btnCancelPortal = document.getElementById('btnCancelPortal');

// Stage 3 Elements
const transferFileTitle = document.getElementById('transferFileTitle');
const transferProgressFill = document.getElementById('transferProgressFill');
const transferPercentText = document.getElementById('transferPercentText');
const transferSpeedText = document.getElementById('transferSpeedText');
const transferEtaText = document.getElementById('transferEtaText');

// Stage 4 Elements
const btnSendAnother = document.getElementById('btnSendAnother');

function showStage(stageName) {
  stageStaging.style.display = stageName === 'staging' ? 'flex' : 'none';
  stagePortal.style.display = stageName === 'portal' ? 'flex' : 'none';
  stageTransfer.style.display = stageName === 'transfer' ? 'flex' : 'none';
  stageComplete.style.display = stageName === 'complete' ? 'flex' : 'none';
}

function updateStatus(state, text) {
  if (!statusText) return;
  statusText.textContent = text;
  if (state === 'connected') {
    statusBadge.className = 'status-badge connected';
  } else if (state === 'ready') {
    statusBadge.className = 'status-badge ready';
  } else {
    statusBadge.className = 'status-badge';
  }
}

// STAGE 1: Staging & Selection
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files && e.dataTransfer.files.length) {
    stageSelectedFiles(Array.from(e.dataTransfer.files));
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files.length) {
    stageSelectedFiles(Array.from(e.target.files));
  }
});

btnRemoveFile.addEventListener('click', (e) => {
  e.stopPropagation();
  stagedFiles = [];
  stagedCard.style.display = 'none';
  fileInput.value = '';
  btnGenerateQr.disabled = true;
  updateStatus('idle', 'Ready');
});

function stageSelectedFiles(files) {
  stagedFiles = files;
  const first = files[0];
  if (!first) return;

  stagedCard.style.display = 'flex';
  stagedFileName.textContent = files.length > 1 ? first.name + ' (+' + (files.length - 1) + ' more)' : first.name;
  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  stagedFileSize.textContent = formatBytes(totalSize);

  if (first.type.startsWith('image/')) {
    thumbImg.src = URL.createObjectURL(first);
    thumbImg.style.display = 'block';
    thumbIcon.style.display = 'none';
  } else if (first.type.startsWith('video/')) {
    thumbImg.style.display = 'none';
    thumbIcon.textContent = '🎬';
    thumbIcon.style.display = 'block';
  } else if (first.name.endsWith('.zip') || first.name.endsWith('.rar') || first.name.endsWith('.7z')) {
    thumbImg.style.display = 'none';
    thumbIcon.textContent = '📦';
    thumbIcon.style.display = 'block';
  } else {
    thumbImg.style.display = 'none';
    thumbIcon.textContent = '📄';
    thumbIcon.style.display = 'block';
  }

  btnGenerateQr.disabled = false;
  updateStatus('ready', 'File Staged');
}

// STAGE 2: Generate QR Code Portal
btnGenerateQr.addEventListener('click', () => {
  if (stagedFiles.length === 0) return;
  startPortalSession();
});

function startPortalSession() {
  if (peer) {
    try { peer.destroy(); } catch (e) {}
  }

  const randomSub = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).substring(2, 10);
  currentPeerId = 'beam-' + randomSub;

  const targetUrl = VERCEL_RECEIVER_URL + '/?peer=' + currentPeerId;
  portalUrlText.textContent = targetUrl;

  if (typeof QRCode !== 'undefined' && QRCode.toCanvas) {
    QRCode.toCanvas(qrcodeCanvas, targetUrl, {
      width: 184,
      margin: 1,
      color: {
        dark: '#0b0f19',
        light: '#ffffff'
      }
    });
  }

  showStage('portal');
  updateStatus('ready', 'Waiting for Phone');

  try {
    peer = new Peer(currentPeerId, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    peer.on('connection', (conn) => {
      activeConnection = conn;
      setupConnection(conn);
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
    });
  } catch (e) {
    console.error('Failed to init Peer:', e);
  }
}

function setupConnection(conn) {
  updateStatus('connected', 'Phone Connected!');

  conn.on('open', () => {
    startStreamingStagedFiles();
  });

  conn.on('close', () => {
    activeConnection = null;
    if (!isStreaming) {
      updateStatus('ready', 'Phone Disconnected');
    }
  });
}

btnCopyLink.addEventListener('click', () => {
  const targetUrl = VERCEL_RECEIVER_URL + '/?peer=' + currentPeerId;
  navigator.clipboard.writeText(targetUrl);
  copyLinkText.textContent = 'Copied!';
  setTimeout(() => { copyLinkText.textContent = 'Copy Link'; }, 2000);
});

btnCancelPortal.addEventListener('click', () => {
  resetToStaging();
});

// STAGE 3: High-Performance Streaming
async function startStreamingStagedFiles() {
  if (isStreaming || stagedFiles.length === 0 || !activeConnection) return;
  isStreaming = true;

  showStage('transfer');
  updateStatus('connected', 'Streaming File...');

  for (const file of stagedFiles) {
    await streamFile(file);
  }

  isStreaming = false;
  showStage('complete');
  updateStatus('connected', 'Transfer Complete');
}

async function streamFile(file) {
  transferFileTitle.textContent = file.name;
  const fileId = 'file-' + Math.random().toString(36).substring(2, 9);
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  activeConnection.send({
    type: 'FILE_START',
    fileId,
    fileName: file.name,
    fileSize: file.size,
    fileMime: file.type || 'application/octet-stream',
    totalChunks
  });

  let sentBytes = 0;
  let lastTime = Date.now();
  let lastBytes = 0;

  for (let i = 0; i < totalChunks; i++) {
    if (!activeConnection) break;

    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = await file.slice(start, end).arrayBuffer();

    activeConnection.send({
      type: 'FILE_CHUNK',
      fileId,
      chunkIndex: i,
      totalChunks,
      data: chunk
    });

    sentBytes += chunk.byteLength;
    const pct = Math.min(100, Math.round((sentBytes / file.size) * 100));
    transferProgressFill.style.width = pct + '%';
    transferPercentText.textContent = pct + '%';

    const now = Date.now();
    const elapsed = (now - lastTime) / 1000;
    if (elapsed >= 0.25 || i === totalChunks - 1) {
      const speed = (sentBytes - lastBytes) / Math.max(elapsed, 0.001);
      transferSpeedText.textContent = formatBytes(speed) + '/s';

      const remainingBytes = file.size - sentBytes;
      const etaSeconds = speed > 0 ? Math.round(remainingBytes / speed) : 0;
      transferEtaText.textContent = etaSeconds > 0 ? 'ETA ~' + etaSeconds + 's' : 'Finalizing...';

      lastTime = now;
      lastBytes = sentBytes;
    }

    // BACKPRESSURE CONTROL: Check bufferedAmount
    const dataChannel = activeConnection.dataChannel;
    if (dataChannel) {
      while (dataChannel.bufferedAmount > 1024 * 1024) {
        await new Promise(r => setTimeout(r, 20));
      }
    }

    if (i % 8 === 0) {
      await new Promise(r => setTimeout(r, 4));
    }
  }

  activeConnection.send({
    type: 'FILE_END',
    fileId
  });
}

// STAGE 4: Completion & Reset
btnSendAnother.addEventListener('click', () => {
  resetToStaging();
});

function resetToStaging() {
  if (peer) {
    try { peer.destroy(); } catch (e) {}
    peer = null;
  }
  activeConnection = null;
  currentPeerId = null;
  stagedFiles = [];
  isStreaming = false;

  stagedCard.style.display = 'none';
  fileInput.value = '';
  btnGenerateQr.disabled = true;
  transferProgressFill.style.width = '0%';
  transferPercentText.textContent = '0%';

  showStage('staging');
  updateStatus('idle', 'Ready');
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

showStage('staging');
updateStatus('idle', 'Ready');
`;

  const styleCss = `/* BeamDrop Chrome Extension Stylesheet */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  width: 380px;
  min-height: 520px;
  max-height: 580px;
  overflow-y: auto;
  overflow-x: hidden;
  margin: 0;
  padding: 16px;
  background-color: #0b0f19;
  color: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 13px;
  line-height: 1.4;
  user-select: none;
}

img, svg {
  max-width: 100%;
  height: auto;
  display: block;
}

::-webkit-scrollbar {
  width: 5px;
}
::-webkit-scrollbar-track {
  background: #111827;
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb {
  background: #1f2937;
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb:hover {
  background: #06b6d4;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid #1e293b;
  margin-bottom: 14px;
}

.brand-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-box {
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  border-radius: 10px;
  background: linear-gradient(135deg, #06b6d4, #3b82f6);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(6, 182, 212, 0.35);
  flex-shrink: 0;
}

.logo-svg {
  width: 18px;
  height: 18px;
  color: #ffffff;
}

.brand-title {
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.2px;
  line-height: 1.1;
}

.brand-sub {
  font-size: 9px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  color: #38bdf8;
  letter-spacing: 0.5px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(148, 163, 184, 0.1);
  color: #94a3b8;
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.status-badge.ready {
  background: rgba(245, 158, 11, 0.12);
  color: #fbbf24;
  border-color: rgba(245, 158, 11, 0.3);
}

.status-badge.connected {
  background: rgba(16, 185, 129, 0.12);
  color: #34d399;
  border-color: rgba(16, 185, 129, 0.3);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: currentColor;
}

.status-badge.ready .status-dot {
  animation: pulseDot 1.4s infinite ease-in-out;
}

@keyframes pulseDot {
  0%, 100% { opacity: 0.3; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1.2); }
}

.stage-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.drop-zone {
  border: 2px dashed #1e293b;
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.6);
  padding: 24px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.drop-zone:hover, .drop-zone.dragover {
  border-color: #06b6d4;
  background: rgba(6, 182, 212, 0.08);
}

.hidden-input {
  display: none;
}

.drop-icon-circle {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: #1e293b;
  color: #38bdf8;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 10px auto;
  transition: transform 0.2s ease;
}

.drop-zone:hover .drop-icon-circle {
  transform: translateY(-2px);
  color: #06b6d4;
  background: #0f172a;
}

.drop-title {
  font-size: 13px;
  font-weight: 600;
  color: #f1f5f9;
}

.drop-sub {
  font-size: 11px;
  color: #64748b;
  margin-top: 3px;
}

.staged-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 14px;
  padding: 10px 12px;
}

.thumb-wrapper {
  width: 46px;
  height: 46px;
  border-radius: 10px;
  background: #0b0f19;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid #334155;
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-icon {
  font-size: 22px;
}

.staged-info {
  flex: 1;
  min-width: 0;
}

.staged-name {
  font-size: 12px;
  font-weight: 600;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.staged-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.btn-trash {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 15px;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  transition: all 0.15s ease;
}

.btn-trash:hover {
  color: #f87171;
  background: rgba(248, 113, 113, 0.12);
}

.btn-cta-generate {
  width: 100%;
  padding: 12px 16px;
  background: linear-gradient(135deg, #0284c7, #2563eb);
  color: #ffffff;
  border: none;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 4px 16px rgba(2, 132, 199, 0.35);
  transition: all 0.15s ease;
}

.btn-cta-generate:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.btn-cta-generate:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: none;
}

.qr-card-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #111827;
  border: 1px solid #1f2937;
  border-radius: 20px;
  padding: 16px;
  text-align: center;
}

.qr-box-200 {
  width: 200px;
  height: 200px;
  background: #ffffff;
  border-radius: 16px;
  padding: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.qr-box-200 canvas {
  width: 184px !important;
  height: 184px !important;
  display: block;
  border-radius: 6px;
}

.radar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.radar-ping {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 10px #38bdf8;
  animation: pulse 1.2s infinite ease-in-out;
}

.radar-text {
  font-size: 11px;
  font-weight: 600;
  color: #e2e8f0;
}

.portal-url-text {
  font-size: 10px;
  color: #64748b;
  font-family: ui-monospace, monospace;
  margin-bottom: 12px;
}

.qr-actions-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.btn-secondary {
  flex: 1;
  padding: 8px 12px;
  background: #1e293b;
  border: 1px solid #334155;
  color: #cbd5e1;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-secondary:hover {
  background: #334155;
  color: #ffffff;
}

.transfer-live-card {
  background: rgba(6, 182, 212, 0.08);
  border: 1px solid rgba(6, 182, 212, 0.35);
  border-radius: 18px;
  padding: 16px;
  margin-bottom: 12px;
}

.transfer-file-title {
  font-size: 13px;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 8px;
}

.progress-track {
  width: 100%;
  height: 8px;
  background: #1e293b;
  border-radius: 9999px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #06b6d4, #3b82f6);
  border-radius: 9999px;
  transition: width 0.15s ease;
}

.transfer-metrics-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #94a3b8;
  font-family: ui-monospace, monospace;
}

.speed-tag {
  color: #38bdf8;
  font-weight: 700;
}

.complete-card {
  text-align: center;
  background: #111827;
  border: 1px solid #1f2937;
  border-radius: 20px;
  padding: 24px 16px;
}

.complete-icon {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: rgba(16, 185, 129, 0.15);
  border: 2px solid #10b981;
  color: #34d399;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px auto;
  font-size: 26px;
}

.complete-title {
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 4px;
}

.complete-sub {
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 16px;
}

.app-footer {
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px solid #1e293b;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10px;
  color: #64748b;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 5px;
}

.secure-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #10b981;
}
`;

  const backgroundJs = `/**
 * BeamDrop Background Service Worker (Manifest V3)
 */

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "beamdrop_send_selection",
    title: "BeamDrop: Send selection to Phone",
    contexts: ["selection"]
  });

  chrome.contextMenus.create({
    id: "beamdrop_send_link",
    title: "BeamDrop: Send link to Phone",
    contexts: ["link"]
  });

  chrome.contextMenus.create({
    id: "beamdrop_send_image",
    title: "BeamDrop: Send image URL to Phone",
    contexts: ["image"]
  });

  console.log("BeamDrop Service Worker registered.");
});

chrome.contextMenus.onClicked.addListener((info) => {
  let contentToSend = "";
  if (info.menuItemId === "beamdrop_send_selection" && info.selectionText) {
    contentToSend = info.selectionText;
  } else if (info.menuItemId === "beamdrop_send_link" && info.linkUrl) {
    contentToSend = info.linkUrl;
  } else if (info.menuItemId === "beamdrop_send_image" && info.srcUrl) {
    contentToSend = info.srcUrl;
  }

  if (contentToSend && chrome.storage) {
    chrome.storage.local.set({ pendingShareText: contentToSend }, () => {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: "BeamDrop Ready",
        message: "Text ready to beam! Click BeamDrop to generate your QR portal."
      });
    });
  }
});
`;

  return [
    {
      name: 'manifest.json',
      path: 'manifest.json',
      language: 'json',
      description: 'Chrome Manifest V3 configuration with service worker & permissions',
      content: manifestJson
    },
    {
      name: 'popup.html',
      path: 'popup.html',
      language: 'html',
      description: 'Multi-stage Popup UI: Staging -> Generate QR -> Stream -> Reset',
      content: popupHtml
    },
    {
      name: 'style.css',
      path: 'style.css',
      language: 'css',
      description: '100% pure offline CSS (glassmorphism dark theme, strict 380px)',
      content: styleCss
    },
    {
      name: 'popup.js',
      path: 'popup.js',
      language: 'javascript',
      description: 'Dynamic Peer generator with backpressure flow control',
      content: popupJs
    },
    {
      name: 'background.js',
      path: 'background.js',
      language: 'javascript',
      description: 'Manifest V3 Service Worker for context menus',
      content: backgroundJs
    }
  ];
};

export const generateExtensionZipBlob = async (receiverBaseUrl: string = 'https://beam-drop-mu.vercel.app'): Promise<Blob> => {
  const zip = new JSZip();
  const files = getExtensionFiles(receiverBaseUrl);

  for (const file of files) {
    zip.file(file.path, file.content);
  }

  // Include bundled offline libraries
  try {
    const [qrResp, peerResp] = await Promise.all([
      fetch('/libs/qrcode.min.js'),
      fetch('/libs/peerjs.min.js')
    ]);
    if (qrResp.ok && peerResp.ok) {
      const qrText = await qrResp.text();
      const peerText = await peerResp.text();
      zip.file('qrcode.min.js', qrText);
      zip.file('peerjs.min.js', peerText);
    }
  } catch (e) {
    console.warn('Could not fetch static /libs/, checking fallback');
  }

  // Add icons
  const icons = zip.folder('icons');
  const createIconBlob = (size: number): Promise<Uint8Array> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, size, size);
        grad.addColorStop(0, '#06b6d4');
        grad.addColorStop(1, '#3b82f6');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(0, 0, size, size, size * 0.2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        const s = size / 128;
        ctx.moveTo(72 * s, 16 * s);
        ctx.lineTo(24 * s, 72 * s);
        ctx.lineTo(60 * s, 72 * s);
        ctx.lineTo(52 * s, 112 * s);
        ctx.lineTo(100 * s, 56 * s);
        ctx.lineTo(64 * s, 56 * s);
        ctx.closePath();
        ctx.fill();
      }

      canvas.toBlob((blob) => {
        if (blob) {
          blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
        } else {
          resolve(new Uint8Array());
        }
      }, 'image/png');
    });
  };

  const [icon16, icon48, icon128] = await Promise.all([
    createIconBlob(16),
    createIconBlob(48),
    createIconBlob(128)
  ]);

  icons?.file('icon16.png', icon16);
  icons?.file('icon48.png', icon48);
  icons?.file('icon128.png', icon128);

  return await zip.generateAsync({ type: 'blob' });
};
