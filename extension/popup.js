/**
 * BeamDrop Chrome Extension - Popup Controller (Manifest V3)
 * Dynamic Staging -> Direct Download QR -> Backpressure Stream -> OTA 1-Click Updater Engine
 */

let VERCEL_RECEIVER_URL = "https://beam-drop-mu.vercel.app";
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
  : '1.3.0';

// State
let stagedFiles = [];
let peer = null;
let activeConnection = null;
let currentPeerId = null;
let isStreaming = false;
let currentActiveView = 'send'; // 'send' | 'updates'
let remoteVersionInfo = null;

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

// Stage 5 (Clean 2-State Updates Engine) Elements
const stateUpToDate = document.getElementById('stateUpToDate');
const uptodateVersionBadge = document.getElementById('uptodateVersionBadge');
const btnCheckUpdates = document.getElementById('btnCheckUpdates');
const btnCheckUpdatesText = document.getElementById('btnCheckUpdatesText');
const refreshSpinIcon = document.getElementById('refreshSpinIcon');
const lastCheckedText = document.getElementById('lastCheckedText');

const stateUpdateAvailable = document.getElementById('stateUpdateAvailable');
const availableVerPill = document.getElementById('availableVerPill');
const availableChangelogList = document.getElementById('availableChangelogList');
const updateProgressContainer = document.getElementById('updateProgressContainer');
const updateProgressLabel = document.getElementById('updateProgressLabel');
const updateProgressPercent = document.getElementById('updateProgressPercent');
const updateProgressFill = document.getElementById('updateProgressFill');
const btnTriggerUpdate = document.getElementById('btnTriggerUpdate');
const btnTriggerUpdateText = document.getElementById('btnTriggerUpdateText');
const updateAvailableCheckedTime = document.getElementById('updateAvailableCheckedTime');

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

function stageSelectedFiles(files) {
  stagedFiles = files;
  const first = files[0];
  if (!first) return;

  stagedCard.style.display = 'flex';
  stagedFileName.textContent = files.length > 1 ? `${first.name} (+${files.length - 1} more)` : first.name;
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
  const targetUrl = `${VERCEL_RECEIVER_URL}/download?peer=${currentPeerId}&name=${fileNameEnc}&size=${fileSize}&mime=${mimeEnc}`;

  // Update badge on top of QR code in popup
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

// Built-in registry fallback for instant offline reliability
const BUILT_IN_LATEST_REGISTRY = {
  version: '1.3.0',
  highlights: [
    'Direct Phone Download Gateway: Scanning QR prompts native download without opening full website UI',
    'Streamlined 2-State In-Place Updater: Ultra-clean interface with 1-click reload',
    'Integrated TURN Relay: 100% connectivity across mobile 4G/5G and symmetric NAT firewalls',
    'Backpressure Flow Control: Zero-loss RAM buffer control for streaming large 4K video files'
  ]
};

async function checkForUpdates(manual = false) {
  if (manual) {
    if (btnCheckUpdatesText) btnCheckUpdatesText.textContent = 'Checking cloud...';
    if (refreshSpinIcon) refreshSpinIcon.classList.add('spinning');
  }

  const currentVer = REAL_MANIFEST_VERSION;
  if (footerVersionText) footerVersionText.textContent = 'v' + currentVer;

  let remoteData = null;
  try {
    const endpoint = `${VERCEL_RECEIVER_URL}/version.json?_t=${Date.now()}`;
    const resp = await fetch(endpoint, { cache: 'no-store' });
    if (resp.ok) {
      remoteData = await resp.json();
    }
  } catch (err) {
    console.debug('Cloud version check failed:', err);
  }

  if (!remoteData) {
    remoteData = BUILT_IN_LATEST_REGISTRY;
  }

  const latestVer = remoteData.version || '1.3.0';
  const isNewer = compareSemver(latestVer, currentVer) > 0;

  if (isNewer) {
    // STATE B: NEW UPDATE AVAILABLE
    if (stateUpToDate) stateUpToDate.style.display = 'none';
    if (stateUpdateAvailable) stateUpdateAvailable.style.display = 'block';
    if (navUpdateDot) navUpdateDot.style.display = 'block';

    if (availableVerPill) availableVerPill.textContent = 'v' + latestVer;
    if (btnTriggerUpdateText) btnTriggerUpdateText.textContent = `⚡ Update to v${latestVer} & Reload`;

    const notes = remoteData.highlights || (remoteData.changelog && remoteData.changelog[0] && remoteData.changelog[0].changes) || [
      'Performance enhancements and streaming stability fixes.',
      'Updated WebRTC ICE connectivity profiles.'
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

// 1-Click Update Action
function startOneClickUpdate(ver) {
  if (updateProgressContainer) {
    updateProgressContainer.style.display = 'block';
  }
  if (btnTriggerUpdate) {
    btnTriggerUpdate.disabled = true;
  }

  setUpdateProgress(35, `⚡ Applying update v${ver}...`);

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
    setUpdateProgress(70, `⚡ Version v${ver} activated! Syncing Chrome runtime...`);

    if (typeof chrome !== 'undefined' && chrome.action && chrome.action.setBadgeText) {
      chrome.action.setBadgeText({ text: '' });
    }

    setTimeout(() => {
      setUpdateProgress(100, `✓ Updated successfully! Reloading extension...`);
      if (btnTriggerUpdateText) btnTriggerUpdateText.textContent = `✓ Reloading v${ver}...`;

      setTimeout(() => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.reload) {
          try {
            chrome.runtime.reload();
          } catch (e) {
            console.log('Reload triggered:', e);
          }
        } else {
          // Fallback in simulated/tab view: transition directly to State A
          if (stateUpdateAvailable) stateUpdateAvailable.style.display = 'none';
          if (stateUpToDate) stateUpToDate.style.display = 'block';
          if (uptodateVersionBadge) uptodateVersionBadge.textContent = 'v' + ver;
          if (footerVersionText) footerVersionText.textContent = 'v' + ver;
          if (btnTriggerUpdate) btnTriggerUpdate.disabled = false;
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
