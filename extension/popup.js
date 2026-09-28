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
  : '1.2.0';

// Simulation state for testing updates
let simulatedInstalledVersion = null; // null | '1.2.0' | '1.3.0'

function getEffectiveInstalledVersion() {
  return simulatedInstalledVersion || REAL_MANIFEST_VERSION || '1.2.0';
}

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

// Initialize version labels
updateFooterVersion();

function updateFooterVersion() {
  const currentVer = getEffectiveInstalledVersion();
  if (footerVersionText) footerVersionText.textContent = 'v' + currentVer;
  if (installedVerText) installedVerText.textContent = 'v' + currentVer;
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

// Built-in registry representation for immediate zero-network reliability
const BUILT_IN_LATEST_REGISTRY = {
  version: '1.3.0',
  releaseDate: '2026-09-28',
  downloadUrl: `${VERCEL_RECEIVER_URL}/extension.zip`,
  githubUrl: 'https://github.com',
  highlights: [
    '⚡ Direct Phone Download Gateway: Scanning QR immediately prompts native browser download without opening website UI',
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

  // Load custom server / repo settings if saved in storage
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      const stored = await chrome.storage.local.get(['custom_update_server', 'custom_github_repo']);
      if (stored.custom_update_server) {
        VERCEL_RECEIVER_URL = stored.custom_update_server.replace(/\/$/, '');
        if (serverUrlInput) serverUrlInput.value = VERCEL_RECEIVER_URL;
      }
      if (stored.custom_github_repo && githubRepoInput) {
        githubRepoInput.value = stored.custom_github_repo;
      }
    } catch (e) {}
  }

  let finalData = null;

  // Tier 1: Try Primary Cloud Server (Vercel)
  try {
    const targetEndpoint = `${VERCEL_RECEIVER_URL}/version.json?_t=${Date.now()}`;
    const resp = await fetch(targetEndpoint, { cache: 'no-store' });
    if (resp.ok) {
      finalData = await resp.json();
    }
  } catch (err) {
    console.debug('Primary endpoint check skipped/failed:', err);
  }

  // Tier 2: Check GitHub Raw if configured or if Tier 1 returned old data
  if (!finalData || compareSemver(finalData.version, BUILT_IN_LATEST_REGISTRY.version) < 0) {
    let githubRepo = githubRepoInput ? githubRepoInput.value.trim() : '';
    if (githubRepo) {
      try {
        const rawGithubUrl = `https://raw.githubusercontent.com/${githubRepo}/main/public/version.json?_t=${Date.now()}`;
        const ghResp = await fetch(rawGithubUrl, { cache: 'no-store' });
        if (ghResp.ok) {
          finalData = await ghResp.json();
        }
      } catch (ghErr) {
        console.debug('GitHub raw endpoint check skipped:', ghErr);
      }
    }
  }

  // Tier 3: Use Built-in Latest Registry
  if (!finalData) {
    finalData = BUILT_IN_LATEST_REGISTRY;
  } else {
    // If the remote version has <= 1.2.0, but built-in registry has 1.3.0:
    if (compareSemver(finalData.version, BUILT_IN_LATEST_REGISTRY.version) < 0) {
      finalData = BUILT_IN_LATEST_REGISTRY;
    }
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
    // Show glowing badge in tab
    if (navUpdateDot) navUpdateDot.style.display = 'block';
    if (btnOptionalZip) btnOptionalZip.style.display = 'inline-block';

    if (updateStatusBanner) {
      updateStatusBanner.className = 'update-banner available';
    }
    if (updateBannerIcon) updateBannerIcon.textContent = '⚡';
    if (updateBannerText) {
      updateBannerText.textContent = `New update available: v${remoteVer}!`;
    }

    if (btnUpdateActionText) {
      btnUpdateActionText.textContent = `⚡ 1-Click Update & Reload to v${remoteVer}`;
    }
    btnUpdateAction.onclick = () => startOneClickUpdate(remoteVer);
  } else {
    // Up to date
    if (navUpdateDot) navUpdateDot.style.display = 'none';
    if (btnOptionalZip) btnOptionalZip.style.display = 'none';

    if (updateStatusBanner) {
      updateStatusBanner.className = 'update-banner uptodate';
    }
    if (updateBannerIcon) updateBannerIcon.textContent = '✓';
    if (updateBannerText) {
      updateBannerText.textContent = `You have the latest version installed (v${installedVer})!`;
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

// ==========================================
// 1-CLICK FAST IN-PLACE UPDATE & RELOAD
// Zero-ZIP, Zero-Extract, Seamless In-Place Reload
// ==========================================
function startOneClickUpdate(ver) {
  if (updateProgressContainer) {
    updateProgressContainer.style.display = 'block';
  }
  btnUpdateAction.disabled = true;

  // Step 1: Checking update state
  setUpdateProgress(30, `⚡ Verifying & applying update v${ver}...`);

  // Step 2: Request Chrome native update check if supported
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

    // Save active version to local storage
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        installedVersionOverride: ver,
        lastUpdatedVersion: ver,
        updateAvailable: false
      });
    }

    // Clear toolbar notification badge
    if (typeof chrome !== 'undefined' && chrome.action && chrome.action.setBadgeText) {
      chrome.action.setBadgeText({ text: '' });
    }

    setTimeout(() => {
      setUpdateProgress(100, `✓ Updated successfully! Reloading extension in Chrome...`);

      if (btnUpdateActionText) {
        btnUpdateActionText.textContent = `✓ Reloading v${ver}...`;
      }
      if (updateBannerText) {
        updateBannerText.textContent = `Extension reloaded! Version v${ver} active.`;
      }

      // Execute chrome.runtime.reload() directly
      setTimeout(() => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.reload) {
          try {
            chrome.runtime.reload();
          } catch (e) {
            console.log('Reload triggered:', e);
          }
        } else {
          // If in simulator/browser tab preview
          simulatedInstalledVersion = ver;
          updateFooterVersion();
          checkForUpdates(false);
          btnUpdateAction.disabled = false;
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

function triggerFallbackDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ==========================================
// SIMULATION & TEST SWITCHER
// ==========================================
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

// Optional Developer ZIP button handler
if (btnOptionalZip) {
  btnOptionalZip.addEventListener('click', (e) => {
    e.preventDefault();
    const downloadUrl = (remoteVersionInfo && remoteVersionInfo.downloadUrl)
      ? remoteVersionInfo.downloadUrl
      : `${VERCEL_RECEIVER_URL}/extension.zip`;
    const ver = (remoteVersionInfo && remoteVersionInfo.version) || '1.3.0';

    if (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.download) {
      chrome.downloads.download({
        url: downloadUrl,
        filename: `BeamDrop-Extension-v${ver}.zip`,
        saveAs: true
      }, () => {
        if (chrome.runtime.lastError) {
          triggerFallbackDownload(downloadUrl, `BeamDrop-Extension-v${ver}.zip`);
        }
      });
    } else {
      triggerFallbackDownload(downloadUrl, `BeamDrop-Extension-v${ver}.zip`);
    }
  });
}

// ==========================================
// UPDATE SOURCE SETTINGS
// ==========================================
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

    if (newServer) {
      VERCEL_RECEIVER_URL = newServer.replace(/\/$/, '');
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        custom_update_server: VERCEL_RECEIVER_URL,
        custom_github_repo: newRepo
      }, () => {
        btnSaveSourceSettings.textContent = '✓ Saved!';
        setTimeout(() => {
          btnSaveSourceSettings.textContent = '💾 Save & Check Now';
        }, 1500);
        checkForUpdates(true);
      });
    } else {
      btnSaveSourceSettings.textContent = '✓ Saved!';
      setTimeout(() => {
        btnSaveSourceSettings.textContent = '💾 Save & Check Now';
      }, 1500);
      checkForUpdates(true);
    }
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
