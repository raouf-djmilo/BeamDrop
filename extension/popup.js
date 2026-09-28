/**
 * BeamDrop Chrome Extension - Popup Controller (Manifest V3)
 * Dynamic Staging -> Generate QR -> Backpressure Stream -> Reset
 */

const VERCEL_RECEIVER_URL = "https://beam-drop-mu.vercel.app";
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
// STAGE 2: Generate QR Code Portal
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

  const targetUrl = `${VERCEL_RECEIVER_URL}/?peer=${currentPeerId}`;
  portalUrlText.textContent = targetUrl;

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
    // When phone opens DataChannel, immediately transition to Stage 3 and stream!
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
  const targetUrl = `${VERCEL_RECEIVER_URL}/?peer=${currentPeerId}`;
  navigator.clipboard.writeText(targetUrl);
  copyLinkText.textContent = 'Copied!';
  setTimeout(() => { copyLinkText.textContent = 'Copy Link'; }, 2000);
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
  let startTime = Date.now();
  let lastTime = Date.now();
  let lastBytes = 0;

  for (let i = 0; i < totalChunks; i++) {
    // Check connection liveness
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

    // BACKPRESSURE CONTROL: Check bufferedAmount before sending next chunk
    const dataChannel = activeConnection.dataChannel;
    if (dataChannel) {
      while (dataChannel.bufferedAmount > 1024 * 1024) {
        await new Promise(r => setTimeout(r, 20));
      }
    }

    // Yield execution
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

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Start on Stage 1
showStage('staging');
updateStatus('idle', 'Ready');
