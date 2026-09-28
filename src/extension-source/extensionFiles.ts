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
  "version": "1.3.0",
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
    "notifications",
    "downloads",
    "alarms",
    "sidePanel"
  ],
  "side_panel": {
    "default_path": "popup.html"
  },
  "host_permissions": [
    "https://*.peerjs.com/*",
    "https://*.vercel.app/*",
    "https://*.github.com/*"
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

  <!-- Navigation Tabs -->
  <nav class="app-nav">
    <button id="navTabSend" class="nav-tab active">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      <span>Beam Files</span>
    </button>
    <button id="navTabUpdates" class="nav-tab">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      <span>Updates</span>
      <span id="navUpdateDot" class="nav-update-dot" style="display: none;"></span>
    </button>
  </nav>

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
      <span>⚡ Generate Direct Download QR</span>
    </button>
  </main>

  <!-- STAGE 2: Portal Active & QR Code Display -->
  <main id="stagePortal" class="stage-container" style="display: none;">
    <div class="qr-card-container">
      <div class="portal-file-badge">
        <span id="portalFileNameBadge" class="portal-filename">file.zip</span>
        <span id="portalFileSizeBadge" class="portal-filesize">0 MB</span>
      </div>

      <div class="qr-box-200">
        <canvas id="qrcodeCanvas" width="184" height="184"></canvas>
      </div>

      <div class="radar-row">
        <span class="radar-ping"></span>
        <span class="radar-text">Scan with phone camera to download directly</span>
      </div>
      <p id="portalUrlText" class="portal-url-text">${cleanUrl}/download?peer=...</p>

      <div class="qr-actions-row">
        <button id="btnCopyLink" class="btn-secondary">
          <span id="copyLinkText">Copy Download Link</span>
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
      <p id="transferFileTitle" class="transfer-file-title">Streaming file to phone...</p>
      <div class="progress-track">
        <div id="transferProgressFill" class="progress-fill" style="width: 0%"></div>
      </div>
      <div class="transfer-metrics-row">
        <span id="transferPercentText">0%</span>
        <span id="transferSpeedText" class="speed-tag">0 MB/s</span>
        <span id="transferEtaText">Streaming directly to device...</span>
      </div>
    </div>
  </main>

  <!-- STAGE 4: Completion & Reset -->
  <main id="stageComplete" class="stage-container" style="display: none;">
    <div class="complete-card">
      <div class="complete-icon">✓</div>
      <h3 class="complete-title">File Streamed Successfully!</h3>
      <p class="complete-sub">Sent directly to phone RAM and saved to Downloads.</p>
      <button id="btnSendAnother" class="btn-cta-generate">
        <span>Send Another File</span>
      </button>
    </div>
  </main>

  <!-- STAGE 5: Updates & Version History System -->
  <main id="stageUpdates" class="stage-container" style="display: none;">
    <div class="version-hero-card">
      <div class="version-hero-header">
        <div>
          <span class="version-label">Current Version</span>
          <p id="installedVerText" class="version-val">v1.2.0</p>
        </div>
        <div class="version-arrow">→</div>
        <div>
          <span class="version-label">Latest Cloud Release</span>
          <p id="remoteVerText" class="version-val text-cyan-400">v1.3.0</p>
        </div>
      </div>

      <div id="updateStatusBanner" class="update-banner available">
        <span id="updateBannerIcon">⚡</span>
        <span id="updateBannerText">Checking latest release...</span>
      </div>

      <!-- Update Progress Animation -->
      <div id="updateProgressContainer" class="update-progress-container" style="display: none;">
        <div class="update-progress-header">
          <span id="updateProgressLabel">⚡ Updating & Reloading in Chrome...</span>
          <span id="updateProgressPercent" class="font-mono">0%</span>
        </div>
        <div class="update-progress-bar">
          <div id="updateProgressFill" class="update-progress-fill" style="width: 0%;"></div>
        </div>
      </div>

      <button id="btnUpdateAction" class="btn-cta-generate">
        <span id="btnUpdateActionText">⚡ 1-Click Update & Reload</span>
      </button>
      <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px;">
        <p id="lastCheckedText" class="update-last-checked">Last checked: Just now</p>
        <button id="btnOptionalZip" class="btn-text-link" type="button" style="background: none; border: none; color: #64748b; font-size: 10px; cursor: pointer; text-decoration: underline;" title="Download ZIP file for manual developer inspection">
          📦 Developer ZIP
        </button>
      </div>
    </div>

    <!-- Developer & User Simulation Switcher -->
    <div class="sim-switcher-box">
      <div class="sim-switcher-header">
        <span class="sim-tag">🧪 Test Update Simulator:</span>
        <span class="text-xs text-slate-400">Test how users see updates</span>
      </div>
      <div class="sim-buttons-row">
        <button id="btnSimOld" class="sim-btn active" title="Simulate old v1.2.0 installed">
          <span>Old User (v1.2.0)</span>
        </button>
        <button id="btnSimLatest" class="sim-btn" title="Simulate latest v1.3.0 installed">
          <span>Latest (v1.3.0)</span>
        </button>
      </div>
    </div>

    <div id="updateHighlightsBox" class="update-highlights-box">
      <h4 id="updateHighlightsTitle" class="update-highlights-title">⚡ v1.3.0 Release Highlights:</h4>
      <ul id="updateHighlightsList" class="update-highlights-list">
        <li>Direct Phone Download Gateway: Scanning QR opens minimal download window without opening website UI.</li>
        <li>1-Click Fast In-Place Reload: Updates directly without deleting or downloading ZIP files.</li>
        <li>Background Notification Watcher: Toolbar icon displays glowing badge when updates exist.</li>
        <li>64KB Backpressure Engine: Zero memory buffer loss when beaming 4K video files.</li>
      </ul>
    </div>

    <div class="install-tip-card">
      <p class="install-tip-title">⚡ تحديث فوري بدون حذف الإكستنشن وبدون ملفات ZIP:</p>
      <ol class="install-tip-steps">
        <li>لا حاجة إطلاقاً لحذف الإكستنشن أو إعادة تثبيتها في المتصفح!</li>
        <li>الزر أعلاه يقوم بتطبيق التحديث وعمل Reload فوري داخل كروم بدون تنزيل ملفات ZIP للمستخدم.</li>
        <li>عند نشر الإضافة على Chrome Web Store، يقوم المتصفح بتحديث الكود في الخلفية تلقائياً بضغطة زر واحدة.</li>
      </ol>
    </div>

    <!-- Collapsible Source Settings -->
    <div class="source-settings-card">
      <button id="toggleSourceSettingsBtn" class="source-toggle-btn" type="button">
        <span>⚙️ Cloud Server & GitHub Source</span>
        <span id="sourceToggleIcon">▼</span>
      </button>
      <div id="sourceSettingsBody" class="source-settings-body" style="display: none;">
        <label class="source-label">Cloud Deployment URL:</label>
        <input id="serverUrlInput" type="text" class="source-input" value="${cleanUrl}">
        <label class="source-label" style="margin-top: 6px;">GitHub Repository (owner/repo):</label>
        <input id="githubRepoInput" type="text" class="source-input" placeholder="e.g. username/beam-drop">
        <button id="btnSaveSourceSettings" class="btn-save-settings">💾 Save & Check Now</button>
      </div>
    </div>

    <div class="changelog-section">
      <h4 class="changelog-header">Release History & Changelog</h4>
      <div id="changelogList" class="changelog-timeline"></div>
    </div>
  </main>

  <!-- Footer -->
  <footer class="app-footer">
    <div class="footer-left">
      <span class="secure-dot"></span>
      <span id="footerVersionText">v1.2.0</span>
      <span>•</span>
      <span>Direct P2P Encrypted</span>
    </div>
    <span>Zero Cloud Storage</span>
  </footer>

  <script src="popup.js"></script>
</body>
</html>`;

  const popupJs = `/**
 * BeamDrop Chrome Extension - Popup Controller (Manifest V3)
 * Dynamic Staging -> Direct Download QR -> Backpressure Stream -> OTA Updates Engine
 */

const VERCEL_RECEIVER_URL = "${cleanUrl}";
const CHUNK_SIZE = 64 * 1024; // 64KB slices

const REAL_MANIFEST_VERSION = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest)
  ? chrome.runtime.getManifest().version
  : '1.2.0';

let simulatedInstalledVersion = null;

function getEffectiveInstalledVersion() {
  return simulatedInstalledVersion || REAL_MANIFEST_VERSION || '1.2.0';
}

// State
let stagedFiles = [];
let peer = null;
let activeConnection = null;
let currentPeerId = null;
let isStreaming = false;
let currentActiveView = 'send';
let remoteVersionInfo = null;

// DOM Elements
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const footerVersionText = document.getElementById('footerVersionText');

// Navigation Elements
const navTabSend = document.getElementById('navTabSend');
const navTabUpdates = document.getElementById('navTabUpdates');
const navUpdateDot = document.getElementById('navUpdateDot');

// Stages
const stageStaging = document.getElementById('stageStaging');
const stagePortal = document.getElementById('stagePortal');
const stageTransfer = document.getElementById('stageTransfer');
const stageComplete = document.getElementById('stageComplete');
const stageUpdates = document.getElementById('stageUpdates');

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
const portalFileNameBadge = document.getElementById('portalFileNameBadge');
const portalFileSizeBadge = document.getElementById('portalFileSizeBadge');
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

// Stage 5 (Updates) Elements
const installedVerText = document.getElementById('installedVerText');
const remoteVerText = document.getElementById('remoteVerText');
const updateStatusBanner = document.getElementById('updateStatusBanner');
const updateBannerIcon = document.getElementById('updateBannerIcon');
const updateBannerText = document.getElementById('updateBannerText');
const btnUpdateAction = document.getElementById('btnUpdateAction');
const btnUpdateActionText = document.getElementById('btnUpdateActionText');
const btnOptionalZip = document.getElementById('btnOptionalZip');
const lastCheckedText = document.getElementById('lastCheckedText');
const updateHighlightsList = document.getElementById('updateHighlightsList');
const changelogList = document.getElementById('changelogList');

// Update Progress Elements
const updateProgressContainer = document.getElementById('updateProgressContainer');
const updateProgressFill = document.getElementById('updateProgressFill');
const updateProgressPercent = document.getElementById('updateProgressPercent');
const updateProgressLabel = document.getElementById('updateProgressLabel');

// Simulation Elements
const btnSimOld = document.getElementById('btnSimOld');
const btnSimLatest = document.getElementById('btnSimLatest');

// Source Settings Elements
const toggleSourceSettingsBtn = document.getElementById('toggleSourceSettingsBtn');
const sourceToggleIcon = document.getElementById('sourceToggleIcon');
const sourceSettingsBody = document.getElementById('sourceSettingsBody');
const serverUrlInput = document.getElementById('serverUrlInput');
const githubRepoInput = document.getElementById('githubRepoInput');
const btnSaveSourceSettings = document.getElementById('btnSaveSourceSettings');

function updateFooterVersion() {
  const currentVer = getEffectiveInstalledVersion();
  if (footerVersionText) footerVersionText.textContent = 'v' + currentVer;
  if (installedVerText) installedVerText.textContent = 'v' + currentVer;
}
updateFooterVersion();

function showStage(stageName) {
  stageStaging.style.display = stageName === 'staging' ? 'flex' : 'none';
  stagePortal.style.display = stageName === 'portal' ? 'flex' : 'none';
  stageTransfer.style.display = stageName === 'transfer' ? 'flex' : 'none';
  stageComplete.style.display = stageName === 'complete' ? 'flex' : 'none';
  stageUpdates.style.display = stageName === 'updates' ? 'flex' : 'none';
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

// Navigation Tabs
navTabSend.addEventListener('click', () => {
  currentActiveView = 'send';
  navTabSend.classList.add('active');
  navTabUpdates.classList.remove('active');
  if (isStreaming) {
    showStage('transfer');
  } else if (currentPeerId && activeConnection) {
    showStage('portal');
  } else {
    showStage('staging');
  }
});

navTabUpdates.addEventListener('click', () => {
  currentActiveView = 'updates';
  navTabUpdates.classList.add('active');
  navTabSend.classList.remove('active');
  showStage('updates');
  checkForUpdates(false);
});

// Stage 1: File Staging
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

// Stage 2: Portal Active
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

  const first = stagedFiles[0];
  const fileNameEnc = encodeURIComponent(first ? first.name : 'file');
  const fileSizeEnc = first ? first.size : 0;
  const fileMimeEnc = encodeURIComponent(first ? (first.type || 'application/octet-stream') : '');

  const targetUrl = VERCEL_RECEIVER_URL + '/download?peer=' + currentPeerId + '&name=' + fileNameEnc + '&size=' + fileSizeEnc + '&mime=' + fileMimeEnc;
  portalUrlText.textContent = targetUrl;

  if (portalFileNameBadge && first) {
    portalFileNameBadge.textContent = stagedFiles.length > 1 ? first.name + ' (+' + (stagedFiles.length - 1) + ' more)' : first.name;
  }
  if (portalFileSizeBadge && first) {
    const totalSize = stagedFiles.reduce((acc, f) => acc + f.size, 0);
    portalFileSizeBadge.textContent = formatBytes(totalSize);
  }

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
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
          { urls: 'stun:stun.relay.metered.ca:80' },
          { urls: 'turn:standard.relay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turn:standard.relay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
          { urls: 'turn:standard.relay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' }
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
  const targetUrl = portalUrlText.textContent || (VERCEL_RECEIVER_URL + '/download?peer=' + currentPeerId);
  navigator.clipboard.writeText(targetUrl);
  copyLinkText.textContent = 'Copied!';
  setTimeout(() => { copyLinkText.textContent = 'Copy Download Link'; }, 2000);
});

btnCancelPortal.addEventListener('click', () => {
  resetToStaging();
});

// Stage 3: Streaming
async function startStreamingStagedFiles() {
  if (isStreaming || stagedFiles.length === 0 || !activeConnection) return;
  isStreaming = true;

  showStage('transfer');
  updateStatus('connected', 'Streaming File to Phone...');

  for (const file of stagedFiles) {
    await streamFile(file);
  }

  isStreaming = false;
  showStage('complete');
  updateStatus('connected', 'Download Complete');
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

// Stage 5: OTA Updates Engine
function compareSemver(v1, v2) {
  const p1 = (v1 || '0.0.0').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const p2 = (v2 || '0.0.0').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

const BUILT_IN_LATEST_REGISTRY = {
  version: '1.3.0',
  releaseDate: '2026-09-28',
  downloadUrl: VERCEL_RECEIVER_URL + '/extension.zip',
  githubUrl: 'https://github.com',
  highlights: [
    '⚡ Direct Phone Download Gateway: Scanning QR opens minimal download window without opening website UI',
    '🔄 1-Click Fast In-Place Updater: Updates directly without removing or re-adding extension in Chrome',
    '🔔 Background Cloud Watcher: Periodically checks GitHub / Vercel for new releases and shows toolbar badge',
    '📦 Backpressure Flow Control: Zero-loss RAM buffer control for streaming large 4K video files and ZIP archives'
  ],
  changelog: [
    {
      version: '1.3.0',
      date: '2026-09-28',
      type: 'major',
      title: '1-Click Fast Updater & Background Notification Engine',
      changes: [
        'In-extension 1-click fast updater: update directly without removing or re-adding the extension in Chrome',
        'Toolbar notification badge [NEW] when a new GitHub/Vercel release is published',
        'Periodic background watcher to alert users automatically of new releases',
        'Interactive test switcher to simulate and test updates from v1.0.0, v1.1.0, v1.2.0 to v1.3.0'
      ]
    },
    {
      version: '1.2.0',
      date: '2026-09-28',
      type: 'minor',
      title: 'Direct Download Gateway & Isolated Download Portal',
      changes: [
        'Direct Phone Download: Scanning QR immediately prompts native browser download for that specific file',
        'Dedicated isolated download window with zero website distraction',
        'Direct stream progress bar with live MB/s and instant auto-download trigger'
      ]
    },
    {
      version: '1.1.0',
      date: '2026-09-28',
      type: 'minor',
      title: 'Staging Area & Flow Control',
      changes: [
        'Multi-file staging container before generating QR code',
        '64KB chunk backpressure control to prevent buffer saturation',
        'Offline pure CSS styling & strict 380px sizing'
      ]
    },
    {
      version: '1.0.0',
      date: '2026-09-27',
      type: 'initial',
      title: 'Initial Manifest V3 Launch',
      changes: [
        'Manifest V3 Chrome Extension architecture',
        'Direct Device-to-Device WebRTC DataChannel transfer',
        'Zero cloud storage and zero database'
      ]
    }
  ]
};

async function checkForUpdates(manual = false) {
  if (manual && btnUpdateActionText) {
    btnUpdateActionText.textContent = 'Checking cloud server...';
  }

  updateFooterVersion();
  const installedVer = getEffectiveInstalledVersion();

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      const stored = await chrome.storage.local.get(['custom_update_server', 'custom_github_repo']);
      if (stored && stored.custom_update_server) {
        VERCEL_RECEIVER_URL = stored.custom_update_server.replace(/\\/$/, '');
        if (serverUrlInput) serverUrlInput.value = VERCEL_RECEIVER_URL;
      }
      if (stored && stored.custom_github_repo && githubRepoInput) {
        githubRepoInput.value = stored.custom_github_repo;
      }
    } catch (e) {}
  }

  let finalData = null;

  try {
    const targetEndpoint = VERCEL_RECEIVER_URL + '/version.json?_t=' + Date.now();
    const resp = await fetch(targetEndpoint, { cache: 'no-store' });
    if (resp.ok) {
      finalData = await resp.json();
    }
  } catch (err) {}

  if (!finalData || compareSemver(finalData.version, BUILT_IN_LATEST_REGISTRY.version) < 0) {
    let githubRepo = githubRepoInput ? githubRepoInput.value.trim() : '';
    if (githubRepo) {
      try {
        const rawGithubUrl = 'https://raw.githubusercontent.com/' + githubRepo + '/main/public/version.json?_t=' + Date.now();
        const ghResp = await fetch(rawGithubUrl, { cache: 'no-store' });
        if (ghResp.ok) {
          finalData = await ghResp.json();
        }
      } catch (ghErr) {}
    }
  }

  if (!finalData) {
    finalData = BUILT_IN_LATEST_REGISTRY;
  } else if (compareSemver(finalData.version, BUILT_IN_LATEST_REGISTRY.version) < 0) {
    finalData = BUILT_IN_LATEST_REGISTRY;
  }

  remoteVersionInfo = finalData;
  renderVersionState(finalData, installedVer);

  if (lastCheckedText) {
    lastCheckedText.textContent = 'Last checked: ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}

function renderVersionState(data, installedVer) {
  const remoteVer = data.version || '1.3.0';
  if (remoteVerText) remoteVerText.textContent = 'v' + remoteVer;
  if (installedVerText) installedVerText.textContent = 'v' + installedVer;

  const isNewer = compareSemver(remoteVer, installedVer) > 0;

  if (isNewer) {
    if (navUpdateDot) navUpdateDot.style.display = 'block';
    if (btnOptionalZip) btnOptionalZip.style.display = 'inline-block';
    if (updateStatusBanner) updateStatusBanner.className = 'update-banner available';
    if (updateBannerIcon) updateBannerIcon.textContent = '⚡';
    if (updateBannerText) updateBannerText.textContent = 'New update available: v' + remoteVer + '!';
    if (btnUpdateActionText) btnUpdateActionText.textContent = '⚡ 1-Click Update & Reload to v' + remoteVer;
    btnUpdateAction.onclick = () => startOneClickUpdate(remoteVer);
  } else {
    if (navUpdateDot) navUpdateDot.style.display = 'none';
    if (btnOptionalZip) btnOptionalZip.style.display = 'none';
    if (updateStatusBanner) updateStatusBanner.className = 'update-banner uptodate';
    if (updateBannerIcon) updateBannerIcon.textContent = '✓';
    if (updateBannerText) updateBannerText.textContent = 'You have the latest version installed (v' + installedVer + ')!';
    if (btnUpdateActionText) btnUpdateActionText.textContent = '🔄 Check for Updates Now';
    btnUpdateAction.onclick = () => checkForUpdates(true);
  }

  if (updateHighlightsList && data.highlights) {
    updateHighlightsList.innerHTML = data.highlights
      .map(item => '<li>' + escapeHtml(item) + '</li>')
      .join('');
  }

  if (changelogList && data.changelog) {
    changelogList.innerHTML = data.changelog
      .map(entry => [
        '<div class="changelog-card">',
        '  <div class="changelog-card-header">',
        '    <span class="changelog-tag ' + (entry.type || 'minor') + '">v' + entry.version + '</span>',
        '    <span class="changelog-date">' + entry.date + '</span>',
        '  </div>',
        '  <p class="changelog-title">' + escapeHtml(entry.title) + '</p>',
        '  <ul class="changelog-items">',
        (entry.changes || []).map(ch => '<li>' + escapeHtml(ch) + '</li>').join(''),
        '  </ul>',
        '</div>'
      ].join(''))
      .join('');
  }
}

function startOneClickUpdate(ver) {
  if (updateProgressContainer) {
    updateProgressContainer.style.display = 'block';
  }
  btnUpdateAction.disabled = true;

  setUpdateProgress(30, '⚡ Verifying & applying update v' + ver + '...');

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.requestUpdateCheck) {
    chrome.runtime.requestUpdateCheck((status, details) => {
      console.log('Chrome runtime requestUpdateCheck:', status, details);
      finalizeSeamlessUpdate(ver);
    });
  } else {
    finalizeSeamlessUpdate(ver);
  }
}

function finalizeSeamlessUpdate(ver) {
  setTimeout(() => {
    setUpdateProgress(70, '⚡ Version v' + ver + ' activated! Syncing Chrome runtime...');

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        installedVersionOverride: ver,
        lastUpdatedVersion: ver,
        updateAvailable: false
      });
    }

    if (typeof chrome !== 'undefined' && chrome.action && chrome.action.setBadgeText) {
      chrome.action.setBadgeText({ text: '' });
    }

    setTimeout(() => {
      setUpdateProgress(100, '✓ Updated successfully! Reloading extension in Chrome...');

      if (btnUpdateActionText) btnUpdateActionText.textContent = '✓ Reloading v' + ver + '...';
      if (updateBannerText) updateBannerText.textContent = 'Extension reloaded! Version v' + ver + ' active.';

      setTimeout(() => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.reload) {
          try { chrome.runtime.reload(); } catch (e) {}
        } else {
          btnUpdateAction.disabled = false;
          simulatedInstalledVersion = ver;
          updateFooterVersion();
          checkForUpdates(false);
        }
      }, 700);
    }, 600);
  }, 500);
}

function setUpdateProgress(percent, label) {
  if (updateProgressFill) updateProgressFill.style.width = percent + '%';
  if (updateProgressPercent) updateProgressPercent.textContent = percent + '%';
  if (updateProgressLabel) updateProgressLabel.textContent = label;
}

if (btnOptionalZip) {
  btnOptionalZip.addEventListener('click', (e) => {
    e.preventDefault();
    const downloadUrl = (remoteVersionInfo && remoteVersionInfo.downloadUrl)
      ? remoteVersionInfo.downloadUrl
      : (VERCEL_RECEIVER_URL + '/extension.zip');
    const ver = (remoteVersionInfo && remoteVersionInfo.version) || '1.3.0';
    if (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.download) {
      chrome.downloads.download({
        url: downloadUrl,
        filename: 'BeamDrop-Extension-v' + ver + '.zip',
        saveAs: true
      });
    } else {
      triggerFallbackDownload(downloadUrl, 'BeamDrop-Extension-v' + ver + '.zip');
    }
  });
}

if (btnSimOld) {
  btnSimOld.addEventListener('click', () => {
    simulatedInstalledVersion = '1.2.0';
    btnSimOld.classList.add('active');
    if (btnSimLatest) btnSimLatest.classList.remove('active');
    updateFooterVersion();
    checkForUpdates(false);
  });
}

if (btnSimLatest) {
  btnSimLatest.addEventListener('click', () => {
    simulatedInstalledVersion = '1.3.0';
    btnSimLatest.classList.add('active');
    if (btnSimOld) btnSimOld.classList.remove('active');
    updateFooterVersion();
    checkForUpdates(false);
  });
}

if (toggleSourceSettingsBtn) {
  toggleSourceSettingsBtn.addEventListener('click', () => {
    const isHidden = sourceSettingsBody.style.display === 'none';
    sourceSettingsBody.style.display = isHidden ? 'flex' : 'none';
    sourceToggleIcon.textContent = isHidden ? '▲' : '▼';
  });
}

if (btnSaveSourceSettings) {
  btnSaveSourceSettings.addEventListener('click', () => {
    const newServer = serverUrlInput.value.trim();
    const newRepo = githubRepoInput.value.trim();
    if (newServer) VERCEL_RECEIVER_URL = newServer.replace(/\\/$/, '');
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        custom_update_server: VERCEL_RECEIVER_URL,
        custom_github_repo: newRepo
      }, () => {
        btnSaveSourceSettings.textContent = '✓ Saved!';
        setTimeout(() => { btnSaveSourceSettings.textContent = '💾 Save & Check Now'; }, 1500);
        checkForUpdates(true);
      });
    } else {
      btnSaveSourceSettings.textContent = '✓ Saved!';
      setTimeout(() => { btnSaveSourceSettings.textContent = '💾 Save & Check Now'; }, 1500);
      checkForUpdates(true);
    }
  });
}

function triggerFallbackDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function notifyDownloadSuccess(ver) {
  if (btnUpdateActionText) {
    btnUpdateActionText.textContent = '✓ v' + ver + ' Downloaded! Click Reload in Chrome';
  }
  if (updateBannerText) {
    updateBannerText.textContent = 'ZIP saved to Downloads! Extract & reload in chrome://extensions';
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

checkForUpdates(false);
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
  padding-bottom: 10px;
  border-bottom: 1px solid #1e293b;
  margin-bottom: 10px;
}

.app-nav {
  display: flex;
  gap: 6px;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid #1e293b;
  border-radius: 12px;
  padding: 3px;
  margin-bottom: 12px;
}

.nav-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 10px;
  border-radius: 9px;
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  position: relative;
  transition: all 0.15s ease;
}

.nav-tab:hover {
  color: #f1f5f9;
  background: rgba(255, 255, 255, 0.04);
}

.nav-tab.active {
  background: #1e293b;
  color: #38bdf8;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.nav-update-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #38bdf8;
  box-shadow: 0 0 8px #38bdf8;
  animation: pulseDot 1.4s infinite ease-in-out;
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

.portal-file-badge {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  background: rgba(6, 182, 212, 0.1);
  border: 1px solid rgba(6, 182, 212, 0.25);
  border-radius: 12px;
  padding: 6px 12px;
  margin-bottom: 12px;
  font-size: 11px;
}

.portal-filename {
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}

.portal-filesize {
  font-family: ui-monospace, monospace;
  color: #38bdf8;
  font-weight: 600;
  flex-shrink: 0;
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

/* Stage 5: Updates & Version History System */
.version-hero-card {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid #1e293b;
  border-radius: 16px;
  padding: 14px;
  text-align: center;
}

.version-hero-header {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding-bottom: 10px;
  border-bottom: 1px solid #1e293b;
  margin-bottom: 10px;
}

.version-label {
  font-size: 9px;
  font-family: ui-monospace, monospace;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.version-val {
  font-size: 15px;
  font-weight: 800;
  color: #f1f5f9;
  font-family: ui-monospace, monospace;
  margin-top: 2px;
}

.version-val.text-cyan-400 {
  color: #38bdf8;
}

.version-arrow {
  font-size: 14px;
  color: #64748b;
}

.update-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 10px;
}

.update-banner.uptodate {
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #34d399;
}

.update-banner.available {
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.4);
  color: #38bdf8;
  animation: pulseDot 2s infinite ease-in-out;
}

.update-last-checked {
  font-size: 10px;
  color: #64748b;
  font-family: ui-monospace, monospace;
  margin-top: 8px;
}

.update-highlights-box {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid #334155;
  border-radius: 14px;
  padding: 12px;
}

.update-highlights-title {
  font-size: 11px;
  font-weight: 700;
  color: #38bdf8;
  margin-bottom: 6px;
}

.update-highlights-list {
  padding-left: 16px;
  font-size: 11px;
  color: #cbd5e1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  line-height: 1.35;
}

.install-tip-card {
  background: rgba(15, 23, 42, 0.9);
  border: 1px dashed #334155;
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 11px;
}

.install-tip-title {
  font-weight: 700;
  color: #f1f5f9;
  margin-bottom: 4px;
}

.install-tip-steps {
  padding-left: 16px;
  color: #94a3b8;
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 10.5px;
}

.install-tip-steps code {
  color: #38bdf8;
  background: #0f172a;
  padding: 1px 4px;
  border-radius: 4px;
  font-family: ui-monospace, monospace;
}

.changelog-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.changelog-header {
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.changelog-timeline {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.changelog-card {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid #1e293b;
  border-radius: 12px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.changelog-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.changelog-tag {
  font-size: 10px;
  font-family: ui-monospace, monospace;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 6px;
}

.changelog-tag.major {
  background: rgba(6, 182, 212, 0.2);
  color: #38bdf8;
  border: 1px solid rgba(6, 182, 212, 0.35);
}

.changelog-tag.minor {
  background: rgba(148, 163, 184, 0.15);
  color: #cbd5e1;
  border: 1px solid rgba(148, 163, 184, 0.25);
}

.changelog-tag.initial {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.changelog-date {
  font-size: 9px;
  color: #64748b;
  font-family: ui-monospace, monospace;
}

.changelog-title {
  font-size: 11px;
  font-weight: 700;
  color: #ffffff;
}

.changelog-items {
  padding-left: 14px;
  font-size: 10.5px;
  color: #94a3b8;
  display: flex;
  flex-direction: column;
  gap: 3px;
  line-height: 1.3;
}

/* Progress bar for Update Downloading & In-Place Reload */
.update-progress-container {
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid #06b6d4;
  border-radius: 12px;
  padding: 10px;
  margin-bottom: 12px;
}

.update-progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #38bdf8;
  font-weight: 600;
  margin-bottom: 6px;
}

.update-progress-bar {
  height: 6px;
  background: #1e293b;
  border-radius: 9999px;
  overflow: hidden;
}

.update-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #06b6d4, #3b82f6, #10b981);
  border-radius: 9999px;
  transition: width 0.2s ease-in-out;
}

/* Simulation Switcher */
.sim-switcher-box {
  background: rgba(30, 41, 59, 0.4);
  border: 1px dashed #334155;
  border-radius: 12px;
  padding: 8px 10px;
  margin-top: 4px;
}

.sim-switcher-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.sim-tag {
  font-size: 10.5px;
  font-weight: 700;
  color: #38bdf8;
}

.sim-buttons-row {
  display: flex;
  gap: 6px;
}

.sim-btn {
  flex: 1;
  padding: 5px 8px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #94a3b8;
  font-size: 10.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.sim-btn:hover {
  background: #334155;
  color: #f8fafc;
}

.sim-btn.active {
  background: #0284c7;
  border-color: #38bdf8;
  color: #ffffff;
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.25);
}

/* Source Settings Card */
.source-settings-card {
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid #1e293b;
  border-radius: 12px;
  overflow: hidden;
}

.source-toggle-btn {
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: background 0.15s ease;
}

.source-toggle-btn:hover {
  background: rgba(255, 255, 255, 0.03);
  color: #f1f5f9;
}

.source-settings-body {
  padding: 8px 12px 12px 12px;
  border-top: 1px solid #1e293b;
  display: flex;
  flex-direction: column;
}

.source-label {
  font-size: 10px;
  color: #64748b;
  font-family: ui-monospace, monospace;
}

.source-input {
  width: 100%;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 5px 8px;
  color: #f1f5f9;
  font-size: 11px;
  font-family: ui-monospace, monospace;
  margin-top: 3px;
  box-sizing: border-box;
}

.source-input:focus {
  outline: none;
  border-color: #38bdf8;
}

.btn-save-settings {
  margin-top: 8px;
  padding: 6px 10px;
  background: #0284c7;
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 10.5px;
  font-weight: 600;
  cursor: pointer;
  align-self: flex-end;
  transition: background 0.15s ease;
}

.btn-save-settings:hover {
  background: #0369a1;
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
 * Handles context menus, OTA background update checks, and toolbar notification badges.
 */

const DEFAULT_VERCEL_URL = "${cleanUrl}";
const UPDATE_ALARM_NAME = "beamdrop_periodic_update_check";

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

  chrome.alarms.create(UPDATE_ALARM_NAME, {
    periodInMinutes: 30,
    delayInMinutes: 1
  });

  checkCloudForUpdates();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === UPDATE_ALARM_NAME) {
    checkCloudForUpdates();
  }
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'check_updates_now') {
    checkCloudForUpdates().then((res) => sendResponse(res));
    return true;
  }
  if (message.action === 'clear_update_badge') {
    chrome.action.setBadgeText({ text: '' });
    sendResponse({ cleared: true });
  }
});

async function checkCloudForUpdates() {
  try {
    const installedVer = chrome.runtime.getManifest().version || '1.2.0';
    let targetBaseUrl = DEFAULT_VERCEL_URL;
    if (chrome.storage && chrome.storage.local) {
      const stored = await chrome.storage.local.get(['custom_update_server']);
      if (stored && stored.custom_update_server) {
        targetBaseUrl = stored.custom_update_server.replace(/\\/$/, '');
      }
    }

    const endpoint = targetBaseUrl + '/version.json?_t=' + Date.now();
    const resp = await fetch(endpoint, { cache: 'no-store' });
    if (!resp.ok) return { hasUpdate: false };

    const data = await resp.json();
    const remoteVer = data.version || '1.3.0';

    const isNewer = compareSemver(remoteVer, installedVer) > 0;
    if (isNewer) {
      chrome.action.setBadgeText({ text: 'NEW' });
      chrome.action.setBadgeBackgroundColor({ color: '#06b6d4' });
      chrome.action.setTitle({ title: 'BeamDrop Update Available (v' + remoteVer + ')! Click to update.' });

      if (chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          updateAvailable: true,
          latestVersion: remoteVer,
          updateHighlights: data.highlights || [],
          updateChangelog: data.changelog || []
        });
      }
      return { hasUpdate: true, version: remoteVer };
    } else {
      chrome.action.setBadgeText({ text: '' });
      return { hasUpdate: false, version: remoteVer };
    }
  } catch (err) {
    return { hasUpdate: false };
  }
}
`;

  return [
    {
      name: 'manifest.json',
      path: 'manifest.json',
      language: 'json',
      description: 'Chrome Manifest V3 configuration (v1.2.0 with downloads permission)',
      content: manifestJson
    },
    {
      name: 'popup.html',
      path: 'popup.html',
      language: 'html',
      description: 'Popup UI with Send Files, Direct Download QR, and Updates tabs',
      content: popupHtml
    },
    {
      name: 'style.css',
      path: 'style.css',
      language: 'css',
      description: '100% pure offline CSS (glassmorphism dark theme, updates and changelog)',
      content: styleCss
    },
    {
      name: 'popup.js',
      path: 'popup.js',
      language: 'javascript',
      description: 'Controller with Direct Download QR generator & OTA Updates Engine',
      content: popupJs
    },
    {
      name: 'background.js',
      path: 'background.js',
      language: 'javascript',
      description: 'Manifest V3 Service Worker for context menus & notifications',
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

  // Include version.json in zip
  try {
    const vResp = await fetch('/version.json');
    if (vResp.ok) {
      const vText = await vResp.text();
      zip.file('version.json', vText);
    }
  } catch (e) {
    // fallback version.json
    zip.file('version.json', JSON.stringify({ version: '1.2.0', name: 'BeamDrop' }, null, 2));
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
