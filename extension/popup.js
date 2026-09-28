/**
 * BeamDrop Chrome Extension - Popup Controller (Manifest V3)
 * Dynamic Staging -> Direct Download QR -> Backpressure Stream -> OTA 1-Click Updater Engine
 */

let VERCEL_RECEIVER_URL = "https://beam-drop-mu.vercel.app";
// Automatic protection: Always force public production Vercel URL for phones so QR codes never point to dev containers
if (!VERCEL_RECEIVER_URL || VERCEL_RECEIVER_URL.includes('.run.app') || VERCEL_RECEIVER_URL.includes('localhost') || VERCEL_RECEIVER_URL.includes('127.0.0.1')) {
  VERCEL_RECEIVER_URL = "https://beam-drop-mu.vercel.app";
}
const CHUNK_SIZE = 64 * 1024; // 64KB slices

// Comprehensive STUN & TURN Relay servers (bypasses Symmetric NAT, CGNAT & 4G/5G mobile firewalls)
const EXTENSION_ICE_SERVERS = [
  // Primary High-Speed Google STUN
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  // Twilio Global STUN
  { urls: 'stun:global.stun.twilio.com:3478' },
  // OpenRelay Public TURN Relay (Encrypted peer-to-peer data pipe when direct STUN is blocked)
  { urls: 'stun:stun.relay.metered.ca:80' },
  {
    urls: 'turn:standard.relay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:standard.relay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  {
    urls: 'turn:standard.relay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject'
  }
];

// Current Installed Version from Manifest
const REAL_MANIFEST_VERSION = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest)
  ? chrome.runtime.getManifest().version
  : '1.4.0';

// State
let stagedFiles = [];
let peer = null;
let activeConnection = null;
let currentPeerId = null;
let isStreaming = false;
let currentActiveView = 'send'; // 'send' | 'updates'
let remoteVersionInfo = null;
let simulatedInstalledVer = null; // null = use REAL_MANIFEST_VERSION

// DOM Elements
const btnPopoutWindow = document.getElementById('btnPopoutWindow');
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
const stagedTypeTag = document.getElementById('stagedTypeTag');
const stagedFileSize = document.getElementById('stagedFileSize');
const btnRemoveFile = document.getElementById('btnRemoveFile');
const btnGenerateQr = document.getElementById('btnGenerateQr');

// Stage 2 Elements
const portalBadgeIcon = document.getElementById('portalBadgeIcon');
const portalFileNameBadge = document.getElementById('portalFileNameBadge');
const portalFileSizeBadge = document.getElementById('portalFileSizeBadge');
const qrcodeCanvas = document.getElementById('qrcodeCanvas');
const portalUrlText = document.getElementById('portalUrlText');
const btnSaveQrWatermark = document.getElementById('btnSaveQrWatermark');
const btnSaveQrWatermarkText = document.getElementById('btnSaveQrWatermarkText');
const btnCopyQrImage = document.getElementById('btnCopyQrImage');
const copyQrImageText = document.getElementById('copyQrImageText');
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

// Stage 5 (Clean 2-State Updates Engine) Elements
const stateUpToDate = document.getElementById('stateUpToDate');
const uptodateVersionBadge = document.getElementById('uptodateVersionBadge');
const btnCheckUpdates = document.getElementById('btnCheckUpdates');
const btnCheckUpdatesText = document.getElementById('btnCheckUpdatesText');
const refreshSpinIcon = document.getElementById('refreshSpinIcon');
const lastCheckedText = document.getElementById('lastCheckedText');
const btnSimulateV120 = document.getElementById('btnSimulateV120');
const btnSimulateV130 = document.getElementById('btnSimulateV130');
const btnSimulateReal = document.getElementById('btnSimulateReal');

const stateUpdateAvailable = document.getElementById('stateUpdateAvailable');
const currentVerPill = document.getElementById('currentVerPill');
const availableVerPill = document.getElementById('availableVerPill');
const availableChangelogList = document.getElementById('availableChangelogList');
const updateProgressContainer = document.getElementById('updateProgressContainer');
const updateProgressLabel = document.getElementById('updateProgressLabel');
const updateProgressPercent = document.getElementById('updateProgressPercent');
const updateProgressFill = document.getElementById('updateProgressFill');
const updatePostDownloadBox = document.getElementById('updatePostDownloadBox');
const downloadedFilename = document.getElementById('downloadedFilename');
const btnOpenExtensionsPage = document.getElementById('btnOpenExtensionsPage');
const btnReloadExtension = document.getElementById('btnReloadExtension');
const btnTriggerUpdate = document.getElementById('btnTriggerUpdate');
const btnTriggerUpdateText = document.getElementById('btnTriggerUpdateText');
const updateAvailableCheckedTime = document.getElementById('updateAvailableCheckedTime');
const btnResetSimulation = document.getElementById('btnResetSimulation');

// Initialize version in footer
if (footerVersionText) {
  footerVersionText.textContent = 'v' + REAL_MANIFEST_VERSION;
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

// Detach to floating window / side panel controller
if (btnPopoutWindow) {
  btnPopoutWindow.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.windows && chrome.windows.create) {
      chrome.windows.create({
        url: chrome.runtime.getURL('popup.html?detached=true'),
        type: 'popup',
        width: 400,
        height: 640
      });
      window.close();
    } else if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.open) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].id) {
          chrome.sidePanel.open({ tabId: tabs[0].id }).catch(() => {});
        }
      });
    } else {
      window.open(window.location.href, '_blank', 'width=400,height=640');
    }
  });
}

// ==========================================
// NAVIGATION CONTROLLER
// ==========================================
navTabSend.addEventListener('click', () => {
  currentActiveView = 'send';
  navTabSend.classList.add('active');
  navTabUpdates.classList.remove('active');

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

  // Clear badge in background service worker
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ action: 'clear_update_badge' }).catch(() => {});
  }

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

function getExtensionFileTypeInfo(name, mime = '') {
  const ext = (name || '').split('.').pop().toLowerCase();
  if (['xls', 'xlsx', 'csv', 'ods', 'tsv'].includes(ext) || mime.includes('spreadsheet') || mime.includes('excel')) {
    return { tag: ext.toUpperCase(), icon: '📊', class: 'tag-excel' };
  }
  if (['ppt', 'pptx', 'pps', 'ppsx', 'odp'].includes(ext) || mime.includes('presentation')) {
    return { tag: ext.toUpperCase(), icon: '📽️', class: 'tag-ppt' };
  }
  if (ext === 'pdf' || mime === 'application/pdf') {
    return { tag: 'PDF', icon: '📑', class: 'tag-pdf' };
  }
  if (['doc', 'docx', 'rtf', 'odt'].includes(ext) || mime.includes('word')) {
    return { tag: ext.toUpperCase(), icon: '📄', class: 'tag-doc' };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
    return { tag: ext.toUpperCase(), icon: '📦', class: 'tag-zip' };
  }
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
    return { tag: ext.toUpperCase(), icon: '🖼️', class: 'tag-image' };
  }
  if (mime.startsWith('video/') || ['mp4', 'mkv', 'mov', 'webm'].includes(ext)) {
    return { tag: ext.toUpperCase(), icon: '🎬', class: 'tag-video' };
  }
  return { tag: ext.toUpperCase() || 'FILE', icon: '📄', class: '' };
}

function stageSelectedFiles(files) {
  stagedFiles = files;
  const first = files[0];
  if (!first) return;

  stagedCard.style.display = 'flex';
  stagedFileName.textContent = files.length > 1 ? `${first.name} (+${files.length - 1} more)` : first.name;
  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  stagedFileSize.textContent = formatBytes(totalSize);

  const fileInfo = getExtensionFileTypeInfo(first.name, first.type);
  if (stagedTypeTag) {
    stagedTypeTag.textContent = fileInfo.tag;
    stagedTypeTag.className = 'staged-type-tag ' + fileInfo.class;
  }

  if (first.type.startsWith('image/')) {
    thumbImg.src = URL.createObjectURL(first);
    thumbImg.style.display = 'block';
    thumbIcon.style.display = 'none';
  } else {
    thumbImg.style.display = 'none';
    thumbIcon.textContent = fileInfo.icon;
    thumbIcon.style.display = 'block';
  }

  btnGenerateQr.disabled = false;
  updateStatus('ready', 'File Staged');
}

// ==========================================
// STAGE 2: Direct Download Portal & QR Engine
// ==========================================
btnGenerateQr.addEventListener('click', () => {
  if (stagedFiles.length === 0) return;
  startPortalSession();
});

btnCancelPortal.addEventListener('click', () => {
  cleanupTransferSession();
});

btnCopyLink.addEventListener('click', () => {
  if (!portalUrlText.textContent) return;
  navigator.clipboard.writeText(portalUrlText.textContent).then(() => {
    copyLinkText.textContent = 'Copied!';
    setTimeout(() => {
      copyLinkText.textContent = 'Copy Link';
    }, 2000);
  });
});

// BeamDrop High-Res Watermarked QR Card Generator
async function createExtensionWatermarkedQr(targetUrl, name, size) {
  const width = 640;
  const height = 800;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Background Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#060913');
  bgGrad.addColorStop(0.5, '#0b1120');
  bgGrad.addColorStop(1, '#020617');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Border & Corner cyan accents
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, width - 28, height - 28);
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 5;
  // Corners
  ctx.beginPath(); ctx.moveTo(14, 50); ctx.lineTo(14, 14); ctx.lineTo(50, 14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(width - 50, 14); ctx.lineTo(width - 14, 14); ctx.lineTo(width - 14, 50); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(14, height - 50); ctx.lineTo(14, height - 14); ctx.lineTo(50, height - 14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(width - 50, height - 14); ctx.lineTo(width - 14, height - 14); ctx.lineTo(width - 14, height - 50); ctx.stroke();

  // Brand Header
  ctx.textAlign = 'center';
  ctx.font = 'bold 32px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('⚡ BeamDrop', width / 2, 60);

  ctx.font = '600 13px monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('DIRECT P2P FILE GATEWAY', width / 2, 85);

  // File Badge
  if (name) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(40, 105, width - 80, 48, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillStyle = '#f8fafc';
    const displayTrunc = name.length > 28 ? name.slice(0, 25) + '...' : name;
    ctx.fillText(`📄 ${displayTrunc}`, 55, 129);

    if (size) {
      ctx.textAlign = 'right';
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(formatBytes(size), width - 55, 129);
    }
  }

  // QR Box
  const qrBoxSize = 380;
  const qrX = (width - qrBoxSize) / 2;
  const qrY = 175;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(qrX, qrY, qrBoxSize, qrBoxSize, 24);
  ctx.fill();

  const tempCanvas = document.createElement('canvas');
  await QRCode.toCanvas(tempCanvas, targetUrl, {
    width: 320,
    margin: 0,
    color: { dark: '#090d16', light: '#ffffff' }
  });
  ctx.drawImage(tempCanvas, qrX + 30, qrY + 30, 320, 320);

  // Center logo
  ctx.fillStyle = '#06b6d4';
  ctx.beginPath();
  ctx.roundRect(width / 2 - 28, qrY + qrBoxSize / 2 - 28, 56, 56, 14);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚡', width / 2, qrY + qrBoxSize / 2);

  // Scan text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillStyle = '#f1f5f9';
  ctx.fillText('Point Camera to Download Directly', width / 2, qrY + qrBoxSize + 28);

  ctx.font = '500 13px system-ui, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Direct RAM stream over WebRTC DataChannel', width / 2, qrY + qrBoxSize + 52);

  // Watermark Footer
  const footerY = height - 65;
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, footerY);
  ctx.lineTo(width - 30, footerY);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('⚡ BeamDrop • Zero Cloud Storage • Encrypted P2P', width / 2, footerY + 20);

  ctx.font = '500 11px monospace';
  ctx.fillStyle = '#64748b';
  ctx.fillText('https://beam-drop-mu.vercel.app', width / 2, footerY + 38);

  return canvas;
}

if (btnSaveQrWatermark) {
  btnSaveQrWatermark.addEventListener('click', async () => {
    const targetUrl = portalUrlText.textContent;
    if (!targetUrl) return;
    const first = stagedFiles[0];
    const originalText = btnSaveQrWatermarkText ? btnSaveQrWatermarkText.textContent : '';
    if (btnSaveQrWatermarkText) btnSaveQrWatermarkText.textContent = 'Generating...';

    try {
      const card = await createExtensionWatermarkedQr(
        targetUrl,
        first ? first.name : 'beamdrop-transfer',
        stagedFiles.reduce((acc, f) => acc + f.size, 0)
      );
      const a = document.createElement('a');
      a.href = card.toDataURL('image/png');
      a.download = first ? `beamdrop-qr-${first.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.png` : 'beamdrop-qr-card.png';
      a.click();
      if (btnSaveQrWatermarkText) btnSaveQrWatermarkText.textContent = '✓ Saved QR Card!';
      setTimeout(() => {
        if (btnSaveQrWatermarkText) btnSaveQrWatermarkText.textContent = originalText;
      }, 2000);
    } catch (e) {
      console.error('Failed to save QR card:', e);
      if (btnSaveQrWatermarkText) btnSaveQrWatermarkText.textContent = originalText;
    }
  });
}

if (btnCopyQrImage) {
  btnCopyQrImage.addEventListener('click', async () => {
    const targetUrl = portalUrlText.textContent;
    if (!targetUrl) return;
    const first = stagedFiles[0];
    try {
      const card = await createExtensionWatermarkedQr(
        targetUrl,
        first ? first.name : 'beamdrop-transfer',
        stagedFiles.reduce((acc, f) => acc + f.size, 0)
      );
      card.toBlob(async (blob) => {
        if (!blob) return;
        if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          copyQrImageText.textContent = 'Copied!';
          setTimeout(() => { copyQrImageText.textContent = 'Copy QR Code'; }, 2000);
        } else {
          navigator.clipboard.writeText(targetUrl);
          copyQrImageText.textContent = 'Link Copied!';
          setTimeout(() => { copyQrImageText.textContent = 'Copy QR Code'; }, 2000);
        }
      }, 'image/png');
    } catch (e) {
      console.error('Failed to copy QR code image:', e);
    }
  });
}

async function startPortalSession() {
  updateStatus('ready', 'Starting Portal...');

  const randomSub = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).substring(2, 10);
  currentPeerId = 'beam-' + randomSub;

  const first = stagedFiles[0];
  const fileNameEnc = encodeURIComponent(first.name);
  const fileSize = first.size;
  const mimeEnc = encodeURIComponent(first.type || '');

  // Direct download route: /download?peer=...&name=...&size=...&mime=...
  const safeBaseUrl = (VERCEL_RECEIVER_URL && !VERCEL_RECEIVER_URL.includes('.run.app') && !VERCEL_RECEIVER_URL.includes('localhost'))
    ? VERCEL_RECEIVER_URL.replace(/\/$/, '')
    : "https://beam-drop-mu.vercel.app";
  const targetUrl = `${safeBaseUrl}/download?peer=${currentPeerId}&name=${fileNameEnc}&size=${fileSize}&mime=${mimeEnc}`;

  // Update badge on top of QR code in popup
  const fileInfo = getExtensionFileTypeInfo(first.name, first.type);
  if (portalBadgeIcon) {
    portalBadgeIcon.textContent = fileInfo.icon;
  }
  if (portalFileNameBadge && first) {
    portalFileNameBadge.textContent = stagedFiles.length > 1
      ? `${first.name} (+${stagedFiles.length - 1})`
      : first.name;
  }
  if (portalFileSizeBadge && first) {
    portalFileSizeBadge.textContent = `(${formatBytes(stagedFiles.reduce((acc, f) => acc + f.size, 0))})`;
  }

  portalUrlText.textContent = targetUrl;

  try {
    await QRCode.toCanvas(qrcodeCanvas, targetUrl, {
      width: 196,
      margin: 2,
      color: {
        dark: '#030712',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('QR rendering failed:', err);
  }

  showStage('portal');
  initPeerJsSession();
}

function initPeerJsSession() {
  if (peer) {
    try { peer.destroy(); } catch (e) {}
  }

  peer = new Peer(currentPeerId, {
    debug: 1,
    config: {
      iceServers: EXTENSION_ICE_SERVERS
    }
  });

  peer.on('open', (id) => {
    console.log('[Extension] Portal PeerJS Open:', id);
    updateStatus('ready', 'Awaiting Phone...');
  });

  peer.on('connection', (conn) => {
    console.log('[Extension] Receiver Connected:', conn.peer);
    activeConnection = conn;
    updateStatus('connected', 'Phone Connected');
    setupConnectionHandlers(conn);
  });

  peer.on('error', (err) => {
    console.error('[Extension] PeerJS Error:', err);
    updateStatus('idle', 'Connection Error');
  });
}

function setupConnectionHandlers(conn) {
  conn.on('open', () => {
    showStage('transfer');
    startBackpressureStream(conn);
  });

  conn.on('data', (data) => {
    if (data && data.type === 'ack') {
      // Receiver acknowledged chunk
    }
  });

  conn.on('close', () => {
    console.log('[Extension] Connection closed.');
    if (!isStreaming) {
      updateStatus('idle', 'Disconnected');
    }
  });
}

// ==========================================
// STAGE 3: Backpressure Stream Transmission
// ==========================================
async function startBackpressureStream(conn) {
  isStreaming = true;
  const file = stagedFiles[0];
  if (!file) return;

  transferFileTitle.textContent = `Streaming: ${file.name}`;
  transferProgressFill.style.width = '0%';
  transferPercentText.textContent = '0%';
  transferSpeedText.textContent = '0.0 MB/s';
  transferEtaText.textContent = '--s remaining';

  const fileId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'f-' + Date.now();

  // 1. Send File Metadata Header (compatible with standard and custom receivers)
  conn.send({
    type: 'FILE_START',
    fileId: fileId,
    fileName: file.name,
    fileSize: file.size,
    fileMime: file.type || 'application/octet-stream',
    totalChunks: Math.ceil(file.size / CHUNK_SIZE),
    payload: {
      id: fileId,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      chunkSize: CHUNK_SIZE,
      totalChunks: Math.ceil(file.size / CHUNK_SIZE)
    }
  });

  // 2. Stream File Slices
  let offset = 0;
  let chunkIndex = 0;
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const startTime = Date.now();
  let lastSpeedCheck = startTime;
  let lastBytes = 0;

  const dataChannel = conn.dataChannel;

  while (offset < file.size) {
    if (dataChannel && dataChannel.bufferedAmount > 4 * CHUNK_SIZE) {
      await waitForBufferDrain(dataChannel);
    }

    const slice = file.slice(offset, offset + CHUNK_SIZE);
    const arrayBuffer = await slice.arrayBuffer();

    conn.send({
      type: 'FILE_CHUNK',
      fileId: fileId,
      chunkIndex: chunkIndex,
      totalChunks: totalChunks,
      data: arrayBuffer
    });

    offset += slice.size;
    chunkIndex++;

    const progress = Math.min(100, Math.round((offset / file.size) * 100));
    transferProgressFill.style.width = `${progress}%`;
    transferPercentText.textContent = `${progress}%`;

    const now = Date.now();
    if (now - lastSpeedCheck > 300) {
      const durationSec = (now - lastSpeedCheck) / 1000;
      const bytesSent = offset - lastBytes;
      const speedMBs = (bytesSent / (1024 * 1024)) / durationSec;
      transferSpeedText.textContent = `${speedMBs.toFixed(1)} MB/s`;

      const remainingBytes = file.size - offset;
      const etaSec = speedMBs > 0 ? Math.round((remainingBytes / (1024 * 1024)) / speedMBs) : 0;
      transferEtaText.textContent = `${etaSec}s remaining`;

      lastSpeedCheck = now;
      lastBytes = offset;
    }
  }

  // 3. Send Complete Signal (compatible with all receivers)
  conn.send({
    type: 'FILE_END',
    fileId: fileId
  });
  conn.send({
    type: 'complete',
    fileId: fileId
  });
  isStreaming = false;

  setTimeout(() => {
    showStage('complete');
    updateStatus('ready', 'Transfer Complete');
  }, 400);
}

function waitForBufferDrain(dc) {
  return new Promise((resolve) => {
    const check = () => {
      if (!dc || dc.bufferedAmount < CHUNK_SIZE) {
        resolve();
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
}

// ==========================================
// STAGE 4: Reset & Resend
// ==========================================
btnSendAnother.addEventListener('click', () => {
  cleanupTransferSession();
});

function cleanupTransferSession() {
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
// STAGE 5: OVER-THE-AIR (OTA) 1-CLICK UPDATER ENGINE
// ==========================================

const GITHUB_RAW_FALLBACK = "https://raw.githubusercontent.com/raouf-djmilo/BeamDrop/main/public/version.json";

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

// Built-in registry fallback
const BUILT_IN_LATEST_REGISTRY = {
  version: '1.4.0',
  downloadUrl: 'https://beam-drop-mu.vercel.app/extension.zip',
  highlights: [
    'Direct chrome.downloads API integration: auto-downloads new extension.zip directly to your computer',
    'Dual-cloud polling: Checks Vercel + raw.githubusercontent.com simultaneously with cache-busting',
    'Native Chrome desktop notification when a new version is pushed to GitHub/Vercel',
    'Interactive Version Simulator in the Updates tab to preview and test how older version users experience updates',
    'Guided 2-step reload assistant with 1-click chrome://extensions launcher'
  ]
};

async function fetchLatestCloudVersion() {
  // 1. First try requesting through background service worker (bypasses popup CORS sandbox)
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      const bgData = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'fetch_cloud_version' }, (res) => {
          resolve(res);
        });
      });
      if (bgData && bgData.version) {
        return bgData;
      }
    } catch (e) {
      console.debug('Background fetch delegation skipped:', e);
    }
  }

  // 2. Direct fetch with multi-endpoint fallback
  const endpoints = [
    `${VERCEL_RECEIVER_URL}/version.json?_t=${Date.now()}`,
    `${GITHUB_RAW_FALLBACK}?_t=${Date.now()}`,
    'https://beam-drop-mu.vercel.app/version.json'
  ];

  for (const ep of endpoints) {
    try {
      const resp = await fetch(ep, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store'
      });
      if (resp.ok) {
        const json = await resp.json();
        if (json && json.version) return json;
      }
    } catch (e) {
      console.debug('Failed to fetch from endpoint:', ep, e);
    }
  }

  return BUILT_IN_LATEST_REGISTRY;
}

async function checkForUpdates(manual = false) {
  if (manual) {
    if (btnCheckUpdatesText) btnCheckUpdatesText.textContent = 'Checking cloud...';
    if (refreshSpinIcon) refreshSpinIcon.classList.add('spinning');
  }

  const currentVer = simulatedInstalledVer || REAL_MANIFEST_VERSION;
  if (footerVersionText) footerVersionText.textContent = 'v' + currentVer;

  remoteVersionInfo = await fetchLatestCloudVersion();
  const latestVer = remoteVersionInfo.version || '1.4.0';
  const isNewer = compareSemver(latestVer, currentVer) > 0;

  // Sync simulator button highlights
  if (btnSimulateV120) btnSimulateV120.className = simulatedInstalledVer === '1.2.0' ? 'btn-sim-ver active-sim' : 'btn-sim-ver';
  if (btnSimulateV130) btnSimulateV130.className = simulatedInstalledVer === '1.3.0' ? 'btn-sim-ver active-sim' : 'btn-sim-ver';
  if (btnSimulateReal) btnSimulateReal.className = !simulatedInstalledVer ? 'btn-sim-ver active-sim' : 'btn-sim-ver';

  if (isNewer) {
    // STATE B: NEW UPDATE AVAILABLE
    if (stateUpToDate) stateUpToDate.style.display = 'none';
    if (stateUpdateAvailable) stateUpdateAvailable.style.display = 'block';
    if (navUpdateDot) navUpdateDot.style.display = 'block';

    if (currentVerPill) currentVerPill.textContent = `v${currentVer} ➔`;
    if (availableVerPill) availableVerPill.textContent = 'v' + latestVer;
    if (btnTriggerUpdateText) btnTriggerUpdateText.textContent = `⚡ Download & Apply Update v${latestVer}`;
    if (updatePostDownloadBox) updatePostDownloadBox.style.display = 'none';
    if (updateProgressContainer) updateProgressContainer.style.display = 'none';
    if (btnTriggerUpdate) btnTriggerUpdate.style.display = 'flex';
    if (btnResetSimulation) btnResetSimulation.style.display = simulatedInstalledVer ? 'inline' : 'none';

    const notes = remoteVersionInfo.highlights || (remoteVersionInfo.changelog && remoteVersionInfo.changelog[0] && remoteVersionInfo.changelog[0].changes) || [
      'Automated 1-click extension package downloader via chrome.downloads',
      'Dual Vercel & GitHub Raw cloud release synchronization',
      'Performance enhancements and streaming stability fixes.'
    ];

    if (availableChangelogList) {
      availableChangelogList.innerHTML = notes
        .map(item => `<li>${escapeHtml(item)}</li>`)
        .join('');
    }

    if (btnTriggerUpdate) {
      btnTriggerUpdate.disabled = false;
      btnTriggerUpdate.onclick = () => startOneClickUpdate(latestVer);
    }
  } else {
    // STATE A: USER IS UP-TO-DATE
    if (stateUpdateAvailable) stateUpdateAvailable.style.display = 'none';
    if (stateUpToDate) stateUpToDate.style.display = 'block';
    if (navUpdateDot) navUpdateDot.style.display = 'none';

    if (uptodateVersionBadge) uptodateVersionBadge.textContent = 'v' + currentVer;
  }

  const nowTime = 'Last checked: ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (lastCheckedText) lastCheckedText.textContent = nowTime;
  if (updateAvailableCheckedTime) updateAvailableCheckedTime.textContent = nowTime;

  if (manual) {
    setTimeout(() => {
      if (btnCheckUpdatesText) btnCheckUpdatesText.textContent = 'Check for Updates';
      if (refreshSpinIcon) refreshSpinIcon.classList.remove('spinning');
    }, 450);
  }
}

// 1-Click Update Action (Downloads real ZIP package directly)
async function startOneClickUpdate(ver) {
  if (updateProgressContainer) updateProgressContainer.style.display = 'block';
  if (btnTriggerUpdate) btnTriggerUpdate.disabled = true;

  setUpdateProgress(25, `⚡ Requesting package v${ver} from cloud...`);

  const downloadUrl = (remoteVersionInfo && remoteVersionInfo.downloadUrl) || `${VERCEL_RECEIVER_URL}/extension.zip`;
  const filename = `BeamDrop-Extension-v${ver}.zip`;

  setTimeout(async () => {
    setUpdateProgress(60, `⚡ Saving ${filename} to your Downloads...`);

    let downloadTriggered = false;

    // 1. Try Chrome Downloads API
    if (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.download) {
      try {
        chrome.downloads.download({
          url: downloadUrl,
          filename: filename,
          saveAs: false,
          conflictAction: 'overwrite'
        }, (id) => {
          if (id) downloadTriggered = true;
          finishDownloadStep(ver, filename);
        });
      } catch (err) {
        console.warn('Chrome downloads error:', err);
      }
    }

    // 2. Try Chrome runtime background message
    if (!downloadTriggered && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'download_update_package',
        url: downloadUrl,
        filename: filename
      }, (resp) => {
        if (resp && resp.success) {
          finishDownloadStep(ver, filename);
        } else {
          fallbackBrowserDownload(downloadUrl, filename, ver);
        }
      });
      return;
    }

    if (!downloadTriggered) {
      fallbackBrowserDownload(downloadUrl, filename, ver);
    }
  }, 400);
}

function fallbackBrowserDownload(url, filename, ver) {
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (e) {
    window.open(url, '_blank');
  }
  finishDownloadStep(ver, filename);
}

function finishDownloadStep(ver, filename) {
  setUpdateProgress(100, `✓ Downloaded ${filename} successfully!`);

  setTimeout(() => {
    if (updateProgressContainer) updateProgressContainer.style.display = 'none';
    if (btnTriggerUpdate) btnTriggerUpdate.style.display = 'none';

    if (updatePostDownloadBox) {
      updatePostDownloadBox.style.display = 'block';
      if (downloadedFilename) downloadedFilename.textContent = filename;
    }

    // Clear toolbar badge
    if (typeof chrome !== 'undefined' && chrome.action && chrome.action.setBadgeText) {
      chrome.action.setBadgeText({ text: '' });
    }
  }, 500);
}

// Handlers for Post-Download Assistant
if (btnOpenExtensionsPage) {
  btnOpenExtensionsPage.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: 'chrome://extensions' });
    } else {
      window.open('chrome://extensions', '_blank');
    }
  });
}

if (btnReloadExtension) {
  btnReloadExtension.addEventListener('click', () => {
    if (btnReloadExtension) btnReloadExtension.textContent = '🔄 Reloading...';
    setTimeout(() => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.reload) {
        chrome.runtime.reload();
      } else {
        // If testing simulation, reset to real version
        setSimulatedVersion(null);
      }
    }, 400);
  });
}

// Simulator version switcher (allows instant testing of older version update flows)
function setSimulatedVersion(ver) {
  simulatedInstalledVer = ver;
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    if (ver) {
      chrome.storage.local.set({ simulated_installed_version: ver });
    } else {
      chrome.storage.local.remove(['simulated_installed_version']);
    }
  }
  checkForUpdates(false);
}

if (btnSimulateV120) {
  btnSimulateV120.addEventListener('click', () => setSimulatedVersion('1.2.0'));
}
if (btnSimulateV130) {
  btnSimulateV130.addEventListener('click', () => setSimulatedVersion('1.3.0'));
}
if (btnSimulateReal) {
  btnSimulateReal.addEventListener('click', () => setSimulatedVersion(null));
}
if (btnResetSimulation) {
  btnResetSimulation.addEventListener('click', () => setSimulatedVersion(null));
}

function setUpdateProgress(percent, label) {
  if (updateProgressFill) updateProgressFill.style.width = percent + '%';
  if (updateProgressPercent) updateProgressPercent.textContent = percent + '%';
  if (updateProgressLabel) updateProgressLabel.textContent = label;
}

if (btnCheckUpdates) {
  btnCheckUpdates.addEventListener('click', () => {
    checkForUpdates(true);
  });
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

