/**
 * BeamDrop Chrome Extension - Popup Controller (Manifest V3)
 * Dynamic Staging -> Direct Download QR -> Backpressure Stream -> OTA Updates Engine
 */

const VERCEL_RECEIVER_URL = "https://beam-drop-mu.vercel.app";
const CHUNK_SIZE = 64 * 1024; // 64KB slices

// Current Installed Version from Manifest
const INSTALLED_VERSION = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest)
  ? chrome.runtime.getManifest().version
  : '1.2.0';

// State
let stagedFiles = [];
let peer = null;
let activeConnection = null;
let currentPeerId = null;
let isStreaming = false;
let currentActiveView = 'send'; // 'send' | 'updates'
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
const lastCheckedText = document.getElementById('lastCheckedText');
const updateHighlightsList = document.getElementById('updateHighlightsList');
const changelogList = document.getElementById('changelogList');

// Set footer version
if (footerVersionText) {
  footerVersionText.textContent = 'v' + INSTALLED_VERSION;
}
if (installedVerText) {
  installedVerText.textContent = 'v' + INSTALLED_VERSION;
}

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

// ==========================================
// NAVIGATION CONTROLLER
// ==========================================
navTabSend.addEventListener('click', () => {
  currentActiveView = 'send';
  navTabSend.classList.add('active');
  navTabUpdates.classList.remove('active');

  // Resume staging or current transfer stage
  if (isStreaming) {
    showStage('transfer');
  } else if (currentPeerId && activeConnection) {
    showStage('portal');
  } else if (stagedFiles.length > 0) {
    showStage('staging');
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

// ==========================================
// STAGE 1: Staging & File Selection
// ==========================================
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
  stagedFileName.textContent = files.length > 1 ? `${first.name} (+${files.length - 1} more)` : first.name;
  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  stagedFileSize.textContent = formatBytes(totalSize);

  // Thumbnail / Icon
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

// ==========================================
// STAGE 2: Generate Direct Download QR Code Portal
// ==========================================
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

  // DIRECT DOWNLOAD PATH:
  const targetUrl = `${VERCEL_RECEIVER_URL}/download?peer=${currentPeerId}&name=${fileNameEnc}&size=${fileSizeEnc}&mime=${fileMimeEnc}`;
  portalUrlText.textContent = targetUrl;

  if (portalFileNameBadge && first) {
    portalFileNameBadge.textContent = stagedFiles.length > 1 ? `${first.name} (+${stagedFiles.length - 1} more)` : first.name;
  }
  if (portalFileSizeBadge && first) {
    const totalSize = stagedFiles.reduce((acc, f) => acc + f.size, 0);
    portalFileSizeBadge.textContent = formatBytes(totalSize);
  }

  // Render QR Code directly to canvas
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

  // Initialize WebRTC Peer
  try {
    peer = new Peer(currentPeerId, {
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
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
  const targetUrl = portalUrlText.textContent || `${VERCEL_RECEIVER_URL}/download?peer=${currentPeerId}`;
  navigator.clipboard.writeText(targetUrl);
  copyLinkText.textContent = 'Copied!';
  setTimeout(() => { copyLinkText.textContent = 'Copy Download Link'; }, 2000);
});

btnCancelPortal.addEventListener('click', () => {
  resetToStaging();
});

// ==========================================
// STAGE 3: High-Performance Streaming
// ==========================================
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
      transferEtaText.textContent = etaSeconds > 0 ? `ETA ~${etaSeconds}s` : 'Finalizing...';

      lastTime = now;
      lastBytes = sentBytes;
    }

    // BACKPRESSURE CONTROL
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

// ==========================================
// STAGE 4: Completion & Full Reset
// ==========================================
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

// ==========================================
// STAGE 5: OVER-THE-AIR (OTA) UPDATES ENGINE
// ==========================================

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

async function checkForUpdates(manual = false) {
  if (manual && btnUpdateActionText) {
    btnUpdateActionText.textContent = 'Checking server...';
  }

  try {
    const targetEndpoint = `${VERCEL_RECEIVER_URL}/version.json?_t=${Date.now()}`;
    const resp = await fetch(targetEndpoint, { cache: 'no-store' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);

    const data = await resp.json();
    remoteVersionInfo = data;
    renderVersionState(data);
  } catch (err) {
    console.warn('Could not fetch remote version.json, using fallback registry:', err);
    // Built-in fallback registry
    const fallback = {
      version: '1.2.0',
      releaseDate: '2026-09-28',
      downloadUrl: `${VERCEL_RECEIVER_URL}/extension.zip`,
      highlights: [
        '⚡ Direct Download QR Gateway: Phone triggers download without opening website UI',
        '🔄 Over-The-Air Update Engine: In-extension Updates tab with 1-click update check and download',
        '📦 Dynamic Staging & Backpressure flow control'
      ],
      changelog: [
        {
          version: '1.2.0',
          date: '2026-09-28',
          type: 'major',
          title: 'Direct Download Gateway & OTA Update System',
          changes: [
            'Direct Phone Download: Scanning QR immediately prompts native browser download for that specific file',
            'Dedicated Updates Tab in extension with live GitHub/Vercel release check',
            'Automatic version comparison & 1-click update ZIP package download'
          ]
        },
        {
          version: '1.1.0',
          date: '2026-09-28',
          type: 'minor',
          title: 'Staging Area & Flow Control',
          changes: [
            'Multi-file staging container before generating QR code',
            '64KB chunk backpressure control to prevent buffer saturation'
          ]
        }
      ]
    };
    remoteVersionInfo = fallback;
    renderVersionState(fallback);
  } finally {
    if (lastCheckedText) {
      lastCheckedText.textContent = 'Last checked: ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }
}

function renderVersionState(data) {
  const remoteVer = data.version || '1.2.0';
  if (remoteVerText) remoteVerText.textContent = 'v' + remoteVer;
  if (installedVerText) installedVerText.textContent = 'v' + INSTALLED_VERSION;

  const isNewer = compareSemver(remoteVer, INSTALLED_VERSION) > 0;

  if (isNewer) {
    // Show glowing badge in tab
    if (navUpdateDot) navUpdateDot.style.display = 'block';

    if (updateStatusBanner) {
      updateStatusBanner.className = 'update-banner available';
    }
    if (updateBannerIcon) updateBannerIcon.textContent = '⚡';
    if (updateBannerText) {
      updateBannerText.textContent = `New update available: v${remoteVer}!`;
    }

    if (btnUpdateActionText) {
      btnUpdateActionText.textContent = `⚡ Download Update v${remoteVer} (.ZIP)`;
    }
    btnUpdateAction.onclick = downloadExtensionUpdate;
  } else {
    // Up to date
    if (navUpdateDot) navUpdateDot.style.display = 'none';

    if (updateStatusBanner) {
      updateStatusBanner.className = 'update-banner uptodate';
    }
    if (updateBannerIcon) updateBannerIcon.textContent = '✓';
    if (updateBannerText) {
      updateBannerText.textContent = `You have the latest version installed (v${INSTALLED_VERSION})!`;
    }

    if (btnUpdateActionText) {
      btnUpdateActionText.textContent = '🔄 Check for Updates Now';
    }
    btnUpdateAction.onclick = () => checkForUpdates(true);
  }

  // Render Highlights
  if (updateHighlightsList && data.highlights) {
    updateHighlightsList.innerHTML = data.highlights
      .map(item => `<li>${escapeHtml(item)}</li>`)
      .join('');
  }

  // Render Changelog
  if (changelogList && data.changelog) {
    changelogList.innerHTML = data.changelog
      .map(entry => `
        <div class="changelog-card">
          <div class="changelog-card-header">
            <span class="changelog-tag ${entry.type || 'minor'}">v${entry.version}</span>
            <span class="changelog-date">${entry.date}</span>
          </div>
          <p class="changelog-title">${escapeHtml(entry.title)}</p>
          <ul class="changelog-items">
            ${(entry.changes || []).map(ch => `<li>${escapeHtml(ch)}</li>`).join('')}
          </ul>
        </div>
      `)
      .join('');
  }
}

function downloadExtensionUpdate() {
  const ver = remoteVersionInfo ? remoteVersionInfo.version : '1.2.0';
  const downloadUrl = (remoteVersionInfo && remoteVersionInfo.downloadUrl)
    ? remoteVersionInfo.downloadUrl
    : `${VERCEL_RECEIVER_URL}/extension.zip`;

  btnUpdateActionText.textContent = 'Preparing update package...';

  // Use Chrome downloads API if available
  if (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.download) {
    chrome.downloads.download({
      url: downloadUrl,
      filename: `BeamDrop-Extension-v${ver}.zip`,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.warn('Chrome download error, using fallback:', chrome.runtime.lastError);
        triggerFallbackDownload(downloadUrl, `BeamDrop-Extension-v${ver}.zip`);
      } else {
        notifyDownloadSuccess(ver);
      }
    });
  } else {
    triggerFallbackDownload(downloadUrl, `BeamDrop-Extension-v${ver}.zip`);
    notifyDownloadSuccess(ver);
  }
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
    btnUpdateActionText.textContent = `✓ v${ver} Downloaded! Click Reload in Chrome`;
  }
  if (updateBannerText) {
    updateBannerText.textContent = 'ZIP saved to Downloads! Extract & reload in chrome://extensions';
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Initial update check on startup (runs silently in background)
checkForUpdates(false);

// Start on Stage 1 (Staging)
showStage('staging');
updateStatus('idle', 'Ready');
