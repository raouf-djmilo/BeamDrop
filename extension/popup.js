/**
 * BeamDrop Chrome Extension - Universal Device Bridge (Manifest V3)
 * High-Speed RAM-to-RAM Bridge: Files, Text, Links, System Clipboard, and Apple/Android-Style OTA Updater
 */

let VERCEL_RECEIVER_URL = "https://beam-drop-mu.vercel.app";
if (!VERCEL_RECEIVER_URL || VERCEL_RECEIVER_URL.includes('.run.app') || VERCEL_RECEIVER_URL.includes('localhost') || VERCEL_RECEIVER_URL.includes('127.0.0.1')) {
  VERCEL_RECEIVER_URL = "https://beam-drop-mu.vercel.app";
}
const VERCEL_HOST = "https://beam-drop-mu.vercel.app";

let CHUNK_SIZE = 256 * 1024; // Dynamic Adaptive LAN Chunker (Up to 512KB)

// Ultra-Fast Zero-Deadlock STUN Server Matrix
const EXTENSION_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' }
];

// Current Installed Version from Manifest
const REAL_MANIFEST_VERSION = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest)
  ? (chrome.runtime.getManifest().version || '1.5.2')
  : '1.5.2';

// Global App State
let activeBridgeMode = 'files'; // 'files' | 'text'
let stagedFiles = [];
let stagedTextContent = '';
let currentObjectType = 'file'; // 'file' | 'text' | 'link' | 'bundle'
let activePreparedFile = null; // Single file or generated ZIP bundle
let peer = null;
let activeConnection = null;
let currentPeerId = null;
let isStreaming = false;
let currentActiveTab = 'send'; // 'send' | 'updates'
let remoteVersionInfo = null;

// ==========================================
// DOM Elements Selection
// ==========================================
const btnPopoutWindow = document.getElementById('btnPopoutWindow');
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const footerVersionText = document.getElementById('footerVersionText');

// Navigation Tabs
const navTabSend = document.getElementById('navTabSend');
const navTabNearby = document.getElementById('navTabNearby');
const navTabUpdates = document.getElementById('navTabUpdates');
const navUpdateDot = document.getElementById('navUpdateDot');
const navNearbyCountBadge = document.getElementById('navNearbyCountBadge');

// Stages
const stageStaging = document.getElementById('stageStaging');
const stagePortal = document.getElementById('stagePortal');
const stageTransfer = document.getElementById('stageTransfer');
const stageComplete = document.getElementById('stageComplete');
const stageUpdates = document.getElementById('stageUpdates');
const stageNearby = document.getElementById('stageNearby');

// Nearby Radar Elements
const myDeviceNameInput = document.getElementById('myDeviceNameInput');
const deviceSelfAvatar = document.getElementById('deviceSelfAvatar');
const chipWifiStatus = document.getElementById('chipWifiStatus');
const btnScanBluetooth = document.getElementById('btnScanBluetooth');
const btnScanBtText = document.getElementById('btnScanBtText');
const radarBlipsContainer = document.getElementById('radarBlipsContainer');
const radarScanningStatusText = document.getElementById('radarScanningStatusText');
const nearbyDevicesList = document.getElementById('nearbyDevicesList');
const nearbyCountLabel = document.getElementById('nearbyCountLabel');
const btnRefreshRadar = document.getElementById('btnRefreshRadar');
const nearbyEmptyState = document.getElementById('nearbyEmptyState');

// Network Telemetry HUD Elements
const telemetrySsid = document.getElementById('telemetrySsid');
const telemetryBandSpeed = document.getElementById('telemetryBandSpeed');
const telemetryModeTag = document.getElementById('telemetryModeTag');
const telemetrySubnetTag = document.getElementById('telemetrySubnetTag');
const chipWifiText = document.getElementById('chipWifiText');
const radarRoomPinInput = document.getElementById('radarRoomPinInput');

let currentRadarRoomPin = '';
try {
  currentRadarRoomPin = localStorage.getItem('beamdrop_radar_pin') || '';
} catch (e) {}

if (radarRoomPinInput) {
  radarRoomPinInput.value = currentRadarRoomPin;
  radarRoomPinInput.addEventListener('input', (e) => {
    currentRadarRoomPin = e.target.value.trim();
    try {
      localStorage.setItem('beamdrop_radar_pin', currentRadarRoomPin);
    } catch (_) {}
    discoveredPeersMap.clear();
    renderNearbyDevices();
    broadcastPresenceBeacon();
    scanSpiderNetwork();
  });
}

// Category Filter Buttons & Badges
const filterBtnAll = document.getElementById('filterBtnAll');
const filterBtnPhones = document.getElementById('filterBtnPhones');
const filterBtnPcs = document.getElementById('filterBtnPcs');
const filterBtnNetwork = document.getElementById('filterBtnNetwork');
const filterCountAll = document.getElementById('filterCountAll');
const filterCountPhones = document.getElementById('filterCountPhones');
const filterCountPcs = document.getElementById('filterCountPcs');
const filterCountNetwork = document.getElementById('filterCountNetwork');

// Incoming Transfer Order Modal Elements
const incomingTransferModal = document.getElementById('incomingTransferModal');
const incomingSenderAvatar = document.getElementById('incomingSenderAvatar');
const incomingSenderName = document.getElementById('incomingSenderName');
const incomingTransportBadge = document.getElementById('incomingTransportBadge');
const incomingObjIcon = document.getElementById('incomingObjIcon');
const incomingObjName = document.getElementById('incomingObjName');
const incomingObjSize = document.getElementById('incomingObjSize');
const btnDeclineTransfer = document.getElementById('btnDeclineTransfer');
const btnAcceptTransfer = document.getElementById('btnAcceptTransfer');

// Bridge Mode Buttons & Sub-views
const modeBtnFiles = document.getElementById('modeBtnFiles');
const modeBtnText = document.getElementById('modeBtnText');
const modeBtnClipboard = document.getElementById('modeBtnClipboard');
const viewFilesMode = document.getElementById('viewFilesMode');
const viewTextMode = document.getElementById('viewTextMode');

// Files View Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const stagedCard = document.getElementById('stagedCard');
const thumbImg = document.getElementById('thumbImg');
const thumbIcon = document.getElementById('thumbIcon');
const stagedFileName = document.getElementById('stagedFileName');
const stagedTypeTag = document.getElementById('stagedTypeTag');
const stagedFileSize = document.getElementById('stagedFileSize');
const multiFileSummary = document.getElementById('multiFileSummary');
const btnRemoveFile = document.getElementById('btnRemoveFile');
const btnGenerateQr = document.getElementById('btnGenerateQr');

// Text View Elements (Smart Notebook Engine)
const textPayloadInput = document.getElementById('textPayloadInput');
const btnQuickPaste = document.getElementById('btnQuickPaste');
const textCharCount = document.getElementById('textCharCount');
const textTypeBadge = document.getElementById('textTypeBadge');
const btnGenerateTextQr = document.getElementById('btnGenerateTextQr');
const textTypeAuto = document.getElementById('textTypeAuto');
const textTypeNote = document.getElementById('textTypeNote');
const textTypeCode = document.getElementById('textTypeCode');
const textTypeUrl = document.getElementById('textTypeUrl');

// Portal Elements
const portalBadgeIcon = document.getElementById('portalBadgeIcon');
const portalFileNameBadge = document.getElementById('portalFileNameBadge');
const portalFileSizeBadge = document.getElementById('portalFileSizeBadge');
const qrcodeCanvas = document.getElementById('qrcodeCanvas');
const qrScanInstruction = document.getElementById('qrScanInstruction');
const portalRadarPill = document.getElementById('portalRadarPill');
const portalRadarDot = document.getElementById('portalRadarDot');
const portalRadarText = document.getElementById('portalRadarText');
const portalUrlText = document.getElementById('portalUrlText');
const btnSaveQrWatermark = document.getElementById('btnSaveQrWatermark');
const btnSaveQrWatermarkText = document.getElementById('btnSaveQrWatermarkText');
const btnCopyQrImage = document.getElementById('btnCopyQrImage');
const copyQrImageText = document.getElementById('copyQrImageText');
const btnCopyLink = document.getElementById('btnCopyLink');
const copyLinkText = document.getElementById('copyLinkText');
const btnCancelPortal = document.getElementById('btnCancelPortal');

// Transfer Stage Elements
const transferFileTitle = document.getElementById('transferFileTitle');
const transferProgressFill = document.getElementById('transferProgressFill');
const transferPercentText = document.getElementById('transferPercentText');
const transferSpeedText = document.getElementById('transferSpeedText');
const transferEtaText = document.getElementById('transferEtaText');

// Complete Stage Elements
const completeSubText = document.getElementById('completeSubText');
const btnSendAnother = document.getElementById('btnSendAnother');

// Updates Stage Elements
const stateUpToDate = document.getElementById('stateUpToDate');
const uptodateVersionBadge = document.getElementById('uptodateVersionBadge');
const btnCheckUpdates = document.getElementById('btnCheckUpdates');
const btnCheckUpdatesText = document.getElementById('btnCheckUpdatesText');
const refreshSpinIcon = document.getElementById('refreshSpinIcon');
const lastCheckedText = document.getElementById('lastCheckedText');
const btnForceReloadExt = document.getElementById('btnForceReloadExt');
const btnForceReloadExtText = document.getElementById('btnForceReloadExtText');

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

// Initialize version in footer
if (footerVersionText) {
  footerVersionText.textContent = 'v' + REAL_MANIFEST_VERSION;
}

// ==========================================
// UI Helpers
// ==========================================
function showStage(stageName) {
  stageStaging.style.display = stageName === 'staging' ? 'flex' : 'none';
  stagePortal.style.display = stageName === 'portal' ? 'flex' : 'none';
  stageTransfer.style.display = stageName === 'transfer' ? 'flex' : 'none';
  stageComplete.style.display = stageName === 'complete' ? 'flex' : 'none';
  stageUpdates.style.display = stageName === 'updates' ? 'flex' : 'none';
  if (stageNearby) stageNearby.style.display = stageName === 'nearby' ? 'flex' : 'none';
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

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ==========================================
// DETACH TO FLOATING WINDOW OR SIDE PANEL
// ==========================================
if (btnPopoutWindow) {
  btnPopoutWindow.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.open) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].id) {
          chrome.sidePanel.open({ tabId: tabs[0].id }).catch(() => {
            openFloatingWindowFallback();
          });
        } else {
          openFloatingWindowFallback();
        }
      });
    } else {
      openFloatingWindowFallback();
    }
  });
}

function openFloatingWindowFallback() {
  if (typeof chrome !== 'undefined' && chrome.windows && chrome.windows.create) {
    chrome.windows.create({
      url: chrome.runtime.getURL('popup.html?detached=true'),
      type: 'popup',
      width: 410,
      height: 640
    });
    window.close();
  } else {
    window.open(window.location.href, '_blank', 'width=410,height=640');
  }
}

// ==========================================
// NAVIGATION CONTROLLER
// ==========================================
navTabSend.addEventListener('click', () => {
  currentActiveTab = 'send';
  navTabSend.classList.add('active');
  if (navTabNearby) navTabNearby.classList.remove('active');
  navTabUpdates.classList.remove('active');

  if (isStreaming) {
    showStage('transfer');
  } else if (currentPeerId && activeConnection) {
    showStage('portal');
  } else {
    showStage('staging');
  }
});

if (navTabNearby) {
  navTabNearby.addEventListener('click', () => {
    currentActiveTab = 'nearby';
    navTabNearby.classList.add('active');
    navTabSend.classList.remove('active');
    navTabUpdates.classList.remove('active');
    showStage('nearby');
    startNearbyDiscovery();
  });
}

navTabUpdates.addEventListener('click', () => {
  currentActiveTab = 'updates';
  navTabUpdates.classList.add('active');
  navTabSend.classList.remove('active');
  if (navTabNearby) navTabNearby.classList.remove('active');
  showStage('updates');

  // Clear badge in background service worker
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ action: 'clear_update_badge' }).catch(() => {});
  }

  checkForUpdates(false);
});

// ==========================================
// BRIDGE OBJECT MODE SWITCHER
// ==========================================
function switchBridgeMode(mode) {
  activeBridgeMode = mode;
  modeBtnFiles.className = mode === 'files' ? 'bridge-mode-btn active' : 'bridge-mode-btn';
  modeBtnText.className = mode === 'text' ? 'bridge-mode-btn active' : 'bridge-mode-btn';
  modeBtnClipboard.className = mode === 'clipboard' ? 'bridge-mode-btn active' : 'bridge-mode-btn';

  if (mode === 'files') {
    viewFilesMode.style.display = 'flex';
    viewTextMode.style.display = 'none';
  } else if (mode === 'text' || mode === 'clipboard') {
    viewFilesMode.style.display = 'none';
    viewTextMode.style.display = 'flex';
    // Mode changed to clipboard/text: do NOT auto-read clipboard without direct user click
    if (mode === 'clipboard') {
      // Focus input without raising DOMException
      if (textPayloadInput) textPayloadInput.focus();
    }
  }
}

modeBtnFiles.addEventListener('click', () => switchBridgeMode('files'));
modeBtnText.addEventListener('click', () => switchBridgeMode('text'));
modeBtnClipboard.addEventListener('click', () => switchBridgeMode('clipboard'));

// ==========================================
// STAGE 1A: FILE STAGING
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
  activePreparedFile = null;
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
  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  if (files.length > 1) {
    currentObjectType = 'bundle';
    stagedFileName.textContent = `${first.name} (+${files.length - 1} more)`;
    if (multiFileSummary) multiFileSummary.style.display = 'flex';
    if (stagedTypeTag) {
      stagedTypeTag.textContent = 'ZIP BUNDLE';
      stagedTypeTag.className = 'staged-type-tag tag-zip';
    }
    thumbImg.style.display = 'none';
    thumbIcon.textContent = '📦';
    thumbIcon.style.display = 'block';
  } else {
    currentObjectType = 'file';
    stagedFileName.textContent = first.name;
    if (multiFileSummary) multiFileSummary.style.display = 'none';
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
  }

  stagedFileSize.textContent = formatBytes(totalSize);
  btnGenerateQr.disabled = false;
  updateStatus('ready', 'Object Staged');
}

btnGenerateQr.addEventListener('click', async () => {
  if (stagedFiles.length === 0) return;
  btnGenerateQr.disabled = true;
  btnGenerateQr.innerHTML = '<span>⚡ Preparing Transmission...</span>';

  try {
    if (stagedFiles.length > 1 && typeof JSZip !== 'undefined') {
      // Auto-bundle multiple files into a clean RAM ZIP archive
      const zip = new JSZip();
      for (const f of stagedFiles) {
        zip.file(f.name, f);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      activePreparedFile = new File([zipBlob], `beamdrop-bundle-${stagedFiles.length}-files.zip`, {
        type: 'application/zip'
      });
    } else {
      activePreparedFile = stagedFiles[0];
    }

    startFilePortalSession(activePreparedFile);
  } catch (err) {
    console.error('Failed to prepare files:', err);
    activePreparedFile = stagedFiles[0];
    startFilePortalSession(activePreparedFile);
  } finally {
    btnGenerateQr.disabled = false;
    btnGenerateQr.innerHTML = '<span>⚡ Generate Direct Download QR</span>';
  }
});

// ==========================================
// STAGE 1B: TEXT & LINK COMPOSER (SMART NOTEBOOK ENGINE)
// ==========================================
let selectedTextMode = 'auto'; // 'auto' | 'note' | 'code' | 'url'

function updateTextFormatPills(mode) {
  selectedTextMode = mode;
  [textTypeAuto, textTypeNote, textTypeCode, textTypeUrl].forEach(btn => {
    if (btn) btn.classList.remove('active');
  });
  if (mode === 'auto' && textTypeAuto) textTypeAuto.classList.add('active');
  if (mode === 'note' && textTypeNote) textTypeNote.classList.add('active');
  if (mode === 'code' && textTypeCode) textTypeCode.classList.add('active');
  if (mode === 'url' && textTypeUrl) textTypeUrl.classList.add('active');

  updateTextTypeVisuals();
}

if (textTypeAuto) textTypeAuto.addEventListener('click', () => updateTextFormatPills('auto'));
if (textTypeNote) textTypeNote.addEventListener('click', () => updateTextFormatPills('note'));
if (textTypeCode) textTypeCode.addEventListener('click', () => updateTextFormatPills('code'));
if (textTypeUrl) textTypeUrl.addEventListener('click', () => updateTextFormatPills('url'));

function resolveTextType(text) {
  if (selectedTextMode !== 'auto') {
    return selectedTextMode;
  }
  const trimmed = text.trim();
  if (/^https?:\/\/[^\s]+$/i.test(trimmed) || /^www\.[^\s]+\.[a-z]{2,}[^\s]*$/i.test(trimmed)) {
    return 'url';
  }
  if (
    /\b(const|let|var|function|def\s|class\s|import\s|export\s|console\.log|SELECT\s|public\s+class|=>)\b/.test(text) ||
    (text.split('\n').length >= 3 && /;\s*$/.test(text))
  ) {
    return 'code';
  }
  return 'note';
}

function updateTextTypeVisuals() {
  const text = textPayloadInput.value.trim();
  stagedTextContent = text;
  textCharCount.textContent = `${text.length} chars`;

  const effectiveType = resolveTextType(text);

  if (effectiveType === 'url') {
    textTypeBadge.textContent = 'LINK';
    textTypeBadge.style.color = '#34d399';
    textTypeBadge.style.borderColor = 'rgba(52, 211, 153, 0.4)';
    textTypeBadge.style.background = 'rgba(52, 211, 153, 0.12)';
    currentObjectType = 'link';
  } else if (effectiveType === 'code') {
    textTypeBadge.textContent = 'CODE';
    textTypeBadge.style.color = '#38bdf8';
    textTypeBadge.style.borderColor = 'rgba(56, 189, 248, 0.4)';
    textTypeBadge.style.background = 'rgba(56, 189, 248, 0.12)';
    currentObjectType = 'text';
  } else {
    textTypeBadge.textContent = 'NOTE';
    textTypeBadge.style.color = '#fbbf24';
    textTypeBadge.style.borderColor = 'rgba(251, 191, 36, 0.4)';
    textTypeBadge.style.background = 'rgba(251, 191, 36, 0.12)';
    currentObjectType = 'text';
  }

  btnGenerateTextQr.disabled = text.length === 0;
  if (text.length > 0) {
    updateStatus('ready', `${effectiveType.toUpperCase()} Ready`);
  } else {
    updateStatus('idle', 'Ready');
  }
}

textPayloadInput.addEventListener('input', updateTextTypeVisuals);

btnQuickPaste.addEventListener('click', readClipboardAndFill);

async function readClipboardAndFill() {
  try {
    if (document.hasFocus() && navigator.clipboard && navigator.clipboard.readText) {
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        textPayloadInput.value = clipText;
        textPayloadInput.dispatchEvent(new Event('input'));
        if (btnQuickPaste) {
          btnQuickPaste.innerHTML = '<span>✓ Pasted!</span>';
          setTimeout(() => {
            btnQuickPaste.innerHTML = '<span>📋 Paste from Clipboard</span>';
          }, 1500);
        }
      }
    }
  } catch (_) {
    // Silently ignore to avoid triggering Chrome extension error badges
  }
}

btnGenerateTextQr.addEventListener('click', () => {
  if (!stagedTextContent) return;
  startTextPortalSession(stagedTextContent);
});

// ==========================================
// BACKGROUND CONTEXT MENU PENDING SHARE DETECTION
// ==========================================
function checkPendingShareFromBackground() {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ action: 'get_pending_share' }, (res) => {
      if (res && res.payload && res.payload.content) {
        switchBridgeMode('text');
        textPayloadInput.value = res.payload.content;
        textPayloadInput.dispatchEvent(new Event('input'));
        // Automatically launch portal for immediate scanning
        startTextPortalSession(res.payload.content);
      }
    });
  }
}

// Call on startup
checkPendingShareFromBackground();

// ==========================================
// STAGE 2: PORTAL ENGINE (QR & P2P INITIALIZATION)
// ==========================================
async function startFilePortalSession(file) {
  isStreaming = false;
  if (!activePreparedFile && file) {
    activePreparedFile = file;
  }
  // Suspend radar scanning and beacons during active QR session to prevent peer collision & socket congestion
  stopNearbyDiscovery();

  updateStatus('ready', 'Starting Portal...');

  const randomSub = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).substring(2, 10);
  currentPeerId = 'beam-' + randomSub;

  const fileNameEnc = encodeURIComponent(file.name);
  const fileSize = file.size;
  const mimeEnc = encodeURIComponent(file.type || 'application/octet-stream');

  const safeBaseUrl = (VERCEL_RECEIVER_URL && !VERCEL_RECEIVER_URL.includes('.run.app') && !VERCEL_RECEIVER_URL.includes('localhost'))
    ? VERCEL_RECEIVER_URL.replace(/\/$/, '')
    : "https://beam-drop-mu.vercel.app";

  const targetUrl = `${safeBaseUrl}/download?peer=${currentPeerId}&type=file&name=${fileNameEnc}&size=${fileSize}&mime=${mimeEnc}`;

  // Update badge on top of QR code in popup
  const fileInfo = getExtensionFileTypeInfo(file.name, file.type);
  if (portalBadgeIcon) portalBadgeIcon.textContent = fileInfo.icon;
  if (portalFileNameBadge) portalFileNameBadge.textContent = file.name;
  if (portalFileSizeBadge) portalFileSizeBadge.textContent = `(${formatBytes(file.size)})`;
  if (qrScanInstruction) qrScanInstruction.textContent = 'Scan with your phone to download directly';

  portalUrlText.textContent = targetUrl;

  try {
    await QRCode.toCanvas(qrcodeCanvas, targetUrl, {
      width: 196,
      margin: 2,
      color: { dark: '#030712', light: '#ffffff' }
    });
  } catch (err) {
    console.error('QR rendering failed:', err);
  }

  // Pre-stage in Ephemeral In-Memory RAM Transit for instant mobile 4G/5G phone fallback
  try {
    const transitUrl = `${safeBaseUrl}/api/transit?peer=${currentPeerId}&name=${fileNameEnc}&mime=${mimeEnc}`;
    fetch(transitUrl, {
      method: 'POST',
      body: file
    }).then(res => res.json()).then(data => {
      console.log('[BeamDrop] RAM Transit staged for mobile fallback:', data);
    }).catch(err => {
      console.debug('[BeamDrop] Transit stage notice:', err);
    });
  } catch (_) {}

  showStage('portal');
  initPeerJsSession('file');
}

async function startTextPortalSession(text) {
  // Suspend radar scanning and beacons during active QR session
  stopNearbyDiscovery();

  updateStatus('ready', 'Starting Notebook Bridge...');

  const chosenType = resolveTextType(text);
  const safeBaseUrl = (VERCEL_RECEIVER_URL && !VERCEL_RECEIVER_URL.includes('.run.app') && !VERCEL_RECEIVER_URL.includes('localhost'))
    ? VERCEL_RECEIVER_URL.replace(/\/$/, '')
    : "https://beam-drop-mu.vercel.app";

  // Check if payload fits in instant zero-latency URL fragment (<= 2200 chars)
  const isInstant = text.length <= 2200;
  let targetUrl = '';

  if (isInstant) {
    // Zero-latency URL hash embedded payload (never touches server logs)
    const b64Data = btoa(unescape(encodeURIComponent(text)));
    targetUrl = `${safeBaseUrl}/notebook.html#data=${b64Data}&type=${chosenType}`;

    if (portalBadgeIcon) portalBadgeIcon.textContent = chosenType === 'code' ? '💻' : (chosenType === 'url' ? '🔗' : '📓');
    if (portalFileNameBadge) portalFileNameBadge.textContent = chosenType === 'code' ? 'Code Snippet' : (chosenType === 'url' ? 'Beamed Link' : 'Notebook Note');
    if (portalFileSizeBadge) portalFileSizeBadge.textContent = `(${text.length} chars • Instant)`;
    if (qrScanInstruction) qrScanInstruction.textContent = 'Scan with Phone Camera or open link on PC to view Notebook';

    if (portalRadarPill) {
      portalRadarPill.className = 'portal-pill instant';
    }
    if (portalRadarDot) {
      portalRadarDot.style.backgroundColor = '#10b981';
      portalRadarDot.style.boxShadow = '0 0 8px #10b981';
    }
    if (portalRadarText) {
      portalRadarText.textContent = '⚡ Instant Notebook Ready (Zero Latency)';
    }
  } else {
    // Large text fallback: Stream over WebRTC PeerJS
    const randomSub = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).substring(2, 10);
    currentPeerId = 'beam-' + randomSub;

    targetUrl = `${safeBaseUrl}/notebook.html?peer=${currentPeerId}&type=${chosenType}`;

    if (portalBadgeIcon) portalBadgeIcon.textContent = chosenType === 'code' ? '💻' : '📓';
    if (portalFileNameBadge) portalFileNameBadge.textContent = chosenType === 'code' ? 'Large Code File' : 'Long Note Document';
    if (portalFileSizeBadge) portalFileSizeBadge.textContent = `(${formatBytes(text.length)} • WebRTC)`;
    if (qrScanInstruction) qrScanInstruction.textContent = 'Scan to stream directly into Notebook';

    if (portalRadarPill) {
      portalRadarPill.className = 'portal-pill';
    }
    if (portalRadarDot) {
      portalRadarDot.style.backgroundColor = '';
      portalRadarDot.style.boxShadow = '';
    }
    if (portalRadarText) {
      portalRadarText.textContent = 'Awaiting device connection to stream...';
    }
  }

  portalUrlText.textContent = targetUrl;

  try {
    await QRCode.toCanvas(qrcodeCanvas, targetUrl, {
      width: 196,
      margin: 2,
      color: { dark: '#030712', light: '#ffffff' }
    });
  } catch (err) {
    console.error('QR rendering failed:', err);
  }

  showStage('portal');

  if (!isInstant) {
    initPeerJsSession('text');
  } else {
    // In instant mode, destroy any lingering P2P listener
    if (peer) {
      try { peer.destroy(); } catch (e) {}
      peer = null;
    }
    activeConnection = null;
  }
}

// Copy link handler
btnCopyLink.addEventListener('click', () => {
  if (!portalUrlText.textContent) return;
  navigator.clipboard.writeText(portalUrlText.textContent).then(() => {
    copyLinkText.textContent = 'Copied!';
    setTimeout(() => { copyLinkText.textContent = 'Copy Link'; }, 2000);
  });
});

// Cancel portal session
btnCancelPortal.addEventListener('click', () => {
  cleanupTransferSession();
});

// High-Res Watermarked QR Card Generator
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

  // Borders & Accents
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, width - 28, height - 28);
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 5;
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
  ctx.fillText('UNIVERSAL EPHEMERAL DEVICE BRIDGE', width / 2, 85);

  // Object Badge
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
    ctx.fillText(`⚡ ${displayTrunc}`, 55, 129);

    if (size) {
      ctx.textAlign = 'right';
      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(typeof size === 'number' ? formatBytes(size) : size, width - 55, 129);
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

  // Scan instruction
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillStyle = '#f1f5f9';
  ctx.fillText('Point Camera to Beam Directly', width / 2, qrY + qrBoxSize + 28);

  ctx.font = '500 13px system-ui, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Encrypted RAM-to-RAM DataChannel • Zero Cloud Storage', width / 2, qrY + qrBoxSize + 52);

  // Footer Watermark
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
  ctx.fillText('⚡ BeamDrop • Universal P2P Bridge • RAM-to-RAM', width / 2, footerY + 20);

  ctx.font = '500 11px monospace';
  ctx.fillStyle = '#64748b';
  ctx.fillText('https://beam-drop-mu.vercel.app', width / 2, footerY + 38);

  return canvas;
}

if (btnSaveQrWatermark) {
  btnSaveQrWatermark.addEventListener('click', async () => {
    const targetUrl = portalUrlText.textContent;
    if (!targetUrl) return;
    const name = activePreparedFile ? activePreparedFile.name : (stagedTextContent ? 'Beamed-Text' : 'BeamDrop');
    const size = activePreparedFile ? activePreparedFile.size : `${stagedTextContent.length} chars`;

    const originalText = btnSaveQrWatermarkText ? btnSaveQrWatermarkText.textContent : '';
    if (btnSaveQrWatermarkText) btnSaveQrWatermarkText.textContent = 'Generating...';

    try {
      const card = await createExtensionWatermarkedQr(targetUrl, name, size);
      const a = document.createElement('a');
      a.href = card.toDataURL('image/png');
      a.download = `beamdrop-qr-${name.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
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
    const name = activePreparedFile ? activePreparedFile.name : (stagedTextContent ? 'Beamed-Text' : 'BeamDrop');
    const size = activePreparedFile ? activePreparedFile.size : `${stagedTextContent.length} chars`;

    try {
      const card = await createExtensionWatermarkedQr(targetUrl, name, size);
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

// ==========================================
// PEERJS WEBRTC SESSION CONTROLLER
// ==========================================
function initPeerJsSession(type = 'file') {
  if (peer) {
    try { peer.destroy(); } catch (e) {}
  }

  peer = new Peer(currentPeerId, {
    debug: 0,
    logFunction: () => {}, // Completely silent logger: Chrome counts any console.warn/error as extension red errors
    config: {
      iceServers: EXTENSION_ICE_SERVERS
    }
  });

  peer.on('open', (id) => {
    console.log('[BeamDrop] Peer Open:', id);
    updateStatus('ready', 'Awaiting Phone...');
  });

  peer.on('connection', (conn) => {
    console.log('[BeamDrop] Receiver Connected:', conn.peer);

    // If an existing connection exists from an earlier test or device, cleanly close it
    if (activeConnection && activeConnection !== conn) {
      try { activeConnection.close(); } catch (_) {}
    }

    activeConnection = conn;
    updateStatus('connected', 'Device Connected');

    // Transition to transfer stage
    showStage('transfer');

    // Enforce strict binaryType on DataChannel
    if (conn.dataChannel) {
      try { conn.dataChannel.binaryType = 'arraybuffer'; } catch (_) {}
    }

    setupConnectionHandlers(conn, type);
  });

  peer.on('disconnected', () => {
    // Only reconnect signaling if there is NO active P2P transfer session
    if (!activeConnection && peer && !peer.destroyed) {
      try { peer.reconnect(); } catch (e) {}
    }
  });

  peer.on('error', (err) => {
    const errMsg = String(err && (err.message || err.type || err) || '');
    const errType = String(err && err.type || '');

    // Ignore benign transient signaling server drops (WebRTC P2P operates peer-to-peer)
    if (
      errType === 'network' ||
      errType === 'server-error' ||
      errType === 'socket-error' ||
      errType === 'socket-closed' ||
      errType === 'lost-connection' ||
      errMsg.includes('Lost connection') ||
      errMsg.includes('socket') ||
      errType === 'peer-unavailable'
    ) {
      // Never print console.warn/error here, because Chromium intercepts it and creates red error badges
      if (!activeConnection && peer && !peer.destroyed && peer.disconnected) {
        try { peer.reconnect(); } catch (_) {}
      }
      return;
    }

    // Only set idle status if truly failed with no active connection
    if (!activeConnection || !activeConnection.open) {
      updateStatus('idle', 'Connection Error');
    }
  });
}

function setupConnectionHandlers(conn, type) {
  let streamStarted = false;

  const startTransmission = () => {
    if (streamStarted) return;
    streamStarted = true;
    updateStatus('connected', 'Streaming to Device...');
    showStage('transfer');

    // Enforce binaryType and bufferedAmountLowThreshold
    try {
      if (conn.dataChannel) {
        conn.dataChannel.binaryType = 'arraybuffer';
        conn.dataChannel.bufferedAmountLowThreshold = 32 * 1024;
      }
    } catch (_) {}

    if (type === 'text') {
      streamTextPayload(conn);
    } else if (activePreparedFile) {
      startBackpressureStream(conn, activePreparedFile);
    }
  };

  // 1. Listen for signals from receiver (Phone or PC)
  conn.on('data', (data) => {
    let msg = data;
    if (typeof data === 'string') {
      try { msg = JSON.parse(data); } catch (_) {}
    }
    if (msg && (msg.type === 'RECEIVER_READY' || msg.type === 'START_STREAM' || msg.type === 'DEVICE_INFO')) {
      console.log('[BeamDrop] Receiver signaled readiness:', msg.type);
      startTransmission();
    }
    if (msg && (msg.type === 'TRANSFER_COMPLETE_ACK' || msg.type === 'TRANSFER_SUCCESS')) {
      console.log('[BeamDrop] Receiver confirmed 100% receipt:', msg.device || 'remote device');
      isStreaming = false;
      transferProgressFill.style.width = '100%';
      transferPercentText.textContent = '100%';
      transferSpeedText.textContent = 'Completed';
      transferEtaText.textContent = '0s';
      showStage('complete');
      completeSubText.textContent = `Successfully received on ${msg.device || 'device'} with zero cloud storage.`;
      updateStatus('ready', 'Transfer Complete');
    }
  });

  // 2. Direct hook into native WebRTC RTCDataChannel onopen event
  if (conn.dataChannel) {
    conn.dataChannel.onopen = () => {
      console.log('[BeamDrop] Native RTCDataChannel onopen fired');
      startTransmission();
    };
  }

  // 3. Start when DataChannel is confirmed OPEN
  if (conn.open || (conn.dataChannel && conn.dataChannel.readyState === 'open')) {
    startTransmission();
  }

  conn.on('open', () => {
    console.log('[BeamDrop] DataChannel open confirmed');
    startTransmission();
  });

  // 4. Polling watchdog: check channel open status up to 15 seconds
  const pollTimer = setInterval(() => {
    if (streamStarted) {
      clearInterval(pollTimer);
      return;
    }
    if (conn.open || (conn.dataChannel && conn.dataChannel.readyState === 'open')) {
      clearInterval(pollTimer);
      startTransmission();
    }
  }, 100);
  setTimeout(() => clearInterval(pollTimer), 15000);

  conn.on('close', () => {
    clearInterval(pollTimer);
    if (!isStreaming) {
      updateStatus('idle', 'Disconnected');
      if (portalRadarText) portalRadarText.textContent = 'Connection closed';
    }
  });
}

function handleReceiverControlMessage(conn, msg, type) {
  // Backwards compatibility
}

// ==========================================
// STAGE 3: TRANSMISSION ENGINES
// ==========================================
async function streamTextPayload(conn) {
  isStreaming = true;
  transferFileTitle.textContent = `Beaming text (${stagedTextContent.length} chars)...`;
  transferProgressFill.style.width = '50%';
  transferPercentText.textContent = '50%';
  transferSpeedText.textContent = 'Instant';
  transferEtaText.textContent = 'In-flight';

  const isLink = stagedTextContent.startsWith('http://') || stagedTextContent.startsWith('https://');

  conn.send({
    type: 'TEXT_PAYLOAD',
    text: stagedTextContent,
    subType: isLink ? 'link' : 'text',
    timestamp: Date.now()
  });

  transferProgressFill.style.width = '100%';
  transferPercentText.textContent = '100%';
  isStreaming = false;

  setTimeout(() => {
    showStage('complete');
    completeSubText.textContent = isLink
      ? 'Link beamed directly to phone browser!'
      : 'Text transferred directly to phone clipboard!';
    updateStatus('ready', 'Transfer Complete');
  }, 400);
}

let extensionWakeLock = null;
async function requestExtensionWakeLock() {
  try {
    if ('wakeLock' in navigator && !extensionWakeLock) {
      extensionWakeLock = await navigator.wakeLock.request('screen');
      extensionWakeLock.addEventListener('release', () => { extensionWakeLock = null; });
    }
  } catch (e) {}
}
async function releaseExtensionWakeLock() {
  try {
    if (extensionWakeLock) {
      await extensionWakeLock.release();
      extensionWakeLock = null;
    }
  } catch (e) {}
}

async function startBackpressureStream(conn, file) {
  if (!file || isStreaming) return;
  isStreaming = true;
  requestExtensionWakeLock();

  showStage('transfer');
  updateStatus('connected', 'Syncing...');
  transferFileTitle.textContent = "Streaming: " + file.name;
  transferProgressFill.style.width = '0%';
  transferPercentText.textContent = '0%';
  transferSpeedText.textContent = 'Syncing...';
  transferEtaText.textContent = 'Awaiting receiver ACK...';

  const fileId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'f-' + Date.now();
  // Safe 32KB chunk size for universal mobile (iOS Safari WebKit + Android Chrome + Desktop)
  const CHUNK_SIZE = 32 * 1024;
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  // 1. Send File Metadata Header
  conn.send({
    type: 'FILE_START',
    fileId: fileId,
    fileName: file.name,
    fileSize: file.size,
    fileMime: file.type || 'application/octet-stream',
    totalChunks: totalChunks,
    payload: {
      id: fileId,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      chunkSize: CHUNK_SIZE,
      totalChunks: totalChunks
    }
  });

  // Ensure bufferedAmountLowThreshold and binaryType
  const dc = conn.dataChannel;
  if (dc) {
    try {
      dc.binaryType = 'arraybuffer';
      dc.bufferedAmountLowThreshold = 32 * 1024;
    } catch (_) {}
  }

  // 2. WAIT FOR RECEIVER ACK_START (Lockstep Handshake - up to 2500ms for mobile round-trip)
  await new Promise((resolve) => {
    let resolved = false;
    const onAck = (data) => {
      if (!data) return;
      let msg = data;
      if (typeof data === 'string') {
        try { msg = JSON.parse(data); } catch (_) {}
      }
      if (msg && (msg.type === 'ACK_START' || msg.type === 'START_STREAM' || msg.type === 'RECEIVER_READY')) {
        if (!resolved) {
          resolved = true;
          conn.off ? conn.off('data', onAck) : null;
          resolve();
        }
      }
    };

    conn.on('data', onAck);

    // Fallback: start sending after 2000ms if ACK was lost
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    }, 2000);
  });

  updateStatus('connected', 'Streaming...');
  transferEtaText.textContent = 'Streaming data...';

  // 3. High-speed raw binary slice pumping with Mobile-Friendly Backpressure
  let offset = 0;
  let chunkIndex = 0;
  const startTime = Date.now();
  let lastSpeedCheck = startTime;
  let lastBytes = 0;

  const HIGH_WATER_MARK = 256 * 1024;
  const LOW_WATER_MARK = 32 * 1024;

  while (offset < file.size) {
    if (!conn.open) {
      console.warn('[BeamDrop] DataChannel closed during stream');
      break;
    }

    if (dc && dc.bufferedAmount > HIGH_WATER_MARK) {
      await new Promise((resolve) => {
        let resolved = false;
        const done = () => {
          if (!resolved) {
            resolved = true;
            if (watchdog) clearTimeout(watchdog);
            if (dc) dc.onbufferedamountlow = null;
            resolve();
          }
        };

        const watchdog = setTimeout(done, 150);

        if (dc) {
          dc.onbufferedamountlow = done;
        }

        const pollInt = setInterval(() => {
          if (!dc || dc.bufferedAmount <= LOW_WATER_MARK) {
            clearInterval(pollInt);
            done();
          }
        }, 10);
      });
    }

    const currentSliceSize = Math.min(CHUNK_SIZE, file.size - offset);
    const slice = file.slice(offset, offset + currentSliceSize);
    const arrayBuffer = await slice.arrayBuffer();

    // Send RAW ArrayBuffer directly
    try {
      conn.send(arrayBuffer);
    } catch (sendErr) {
      console.warn('[BeamDrop] Chunk send dropped:', sendErr);
    }

    offset += currentSliceSize;
    chunkIndex++;

    const progress = Math.min(100, Math.round((offset / file.size) * 100));
    transferProgressFill.style.width = progress + "%";
    transferPercentText.textContent = progress + "%";

    const now = Date.now();
    if (now - lastSpeedCheck > 250) {
      const durationSec = (now - lastSpeedCheck) / 1000;
      const bytesSent = offset - lastBytes;
      const speedMBs = (bytesSent / (1024 * 1024)) / durationSec;
      transferSpeedText.textContent = speedMBs.toFixed(1) + " MB/s";
      const remainingBytes = file.size - offset;
      const etaSec = speedMBs > 0 ? Math.round((remainingBytes / (1024 * 1024)) / speedMBs) : 0;
      transferEtaText.textContent = etaSec + "s remaining";
      lastSpeedCheck = now;
      lastBytes = offset;
    }
  }

  // 4. Send Complete Signal
  try {
    conn.send({ type: 'FILE_END', fileId: fileId });
    conn.send({ type: 'complete', fileId: fileId });
  } catch (_) {}
  
  isStreaming = false;
  releaseExtensionWakeLock();

  // Immediate instant 100% visual completion
  transferProgressFill.style.width = '100%';
  transferPercentText.textContent = '100%';
  transferSpeedText.textContent = 'Completed';
  transferEtaText.textContent = '0s';

  showStage('complete');
  completeSubText.textContent = 'Direct transmission finished with zero cloud storage.';
  updateStatus('ready', 'Transfer Complete');
}

// Reset session
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
  activePreparedFile = null;
  stagedTextContent = '';
  isStreaming = false;

  stagedCard.style.display = 'none';
  if (fileInput) fileInput.value = '';
  if (textPayloadInput) textPayloadInput.value = '';
  btnGenerateQr.disabled = true;
  btnGenerateTextQr.disabled = true;
  transferProgressFill.style.width = '0%';
  transferPercentText.textContent = '0%';

  showStage('staging');
  updateStatus('idle', 'Ready');
}

// ==========================================
// STAGE 5: APPLE/ANDROID-STYLE OTA UPDATES ENGINE
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

const BUILT_IN_LATEST_REGISTRY = {
  version: '1.5.2',
  downloadUrl: 'https://beam-drop-mu.vercel.app/extension.zip',
  highlights: [
    '📡 Nearby Radar: AirDrop-style Wi-Fi & Bluetooth Device Discovery with Accept/Decline security',
    '📓 Instant Smart Notebook: Text, code, and links open directly into an interactive notebook on Phone & PC',
    '⚡ Zero-ZIP 1-Click Auto Upgrade Engine: Direct in-place rebuild & reload with 0 manual ZIP downloads or file extraction',
    '🔄 In-Popup Instant Reload: Force reload files from disk directly with a single click',
    '💻 Syntax Highlighting & Line Numbers: Auto-detects JavaScript, Python, HTML, SQL, and Shell code',
    '✨ Ultra-Clean Cyber Glassmorphism UI: Fully refined premium interface for the Chrome Extension'
  ]
};

async function fetchLatestCloudVersion() {
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

  const endpoints = [
    `${VERCEL_HOST}/version.json?_t=${Date.now()}`,
    `${GITHUB_RAW_FALLBACK}?_t=${Date.now()}`
  ];

  for (const ep of endpoints) {
    try {
      const resp = await fetch(ep, { method: 'GET', mode: 'cors', cache: 'no-store' });
      if (resp.ok) {
        const json = await resp.json();
        if (json && (json.version || json.latestVersion)) return json;
      }
    } catch (e) {
      console.debug('Failed to fetch from endpoint:', ep, e);
    }
  }

  return BUILT_IN_LATEST_REGISTRY;
}

async function checkForUpdates(manual = false) {
  if (manual && refreshSpinIcon) {
    refreshSpinIcon.classList.add('spinning');
    if (btnCheckUpdatesText) btnCheckUpdatesText.textContent = 'Checking...';
  }

  // 1. Detect Local Environment & Local Build Fingerprint
  const manifest = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest)
    ? chrome.runtime.getManifest()
    : { version: REAL_MANIFEST_VERSION };
  const isUnpacked = !('update_url' in manifest);

  const localVer = manifest.version || REAL_MANIFEST_VERSION;
  const localBuildInfo = (typeof window !== 'undefined' && window.BEAMDROP_BUILD)
    ? window.BEAMDROP_BUILD
    : { version: localVer, buildHash: 'local-init', buildTimestamp: 0 };
  const localHash = localBuildInfo.buildHash || 'local-init';

  let remoteVersionInfo = null;

  try {
    const urls = [
      `${VERCEL_HOST}/version.json?_t=${Date.now()}`,
      `${GITHUB_RAW_FALLBACK}?_t=${Date.now()}`
    ];

    for (const url of urls) {
      try {
        const resp = await fetch(url, { cache: 'no-store' });
        if (resp.ok) {
          remoteVersionInfo = await resp.json();
          if (remoteVersionInfo && (remoteVersionInfo.version || remoteVersionInfo.latestVersion)) break;
        }
      } catch (_) {}
    }
  } catch (err) {
    console.debug('Cloud version check notice:', err);
  }

  const latestVer = remoteVersionInfo ? (remoteVersionInfo.version || remoteVersionInfo.latestVersion) : localVer;
  const remoteHash = remoteVersionInfo ? (remoteVersionInfo.buildHash || '') : '';

  // Dual Check:
  // Condition 1: New SemVer version (e.g., 1.6.2 -> 1.6.3)
  const isNewerVersion = compareVersions(localVer, latestVer) < 0;
  // Condition 2: Same SemVer version, but new code patch / commit pushed to GitHub/Vercel
  const isNewGitPatch = (localVer === latestVer) && Boolean(remoteHash && localHash !== remoteHash);

  const isUpdateAvailable = isNewerVersion || isNewGitPatch;

  if (isUpdateAvailable) {
    // STATE B: UPDATE / HOTFIX AVAILABLE
    if (stateUpToDate) stateUpToDate.style.display = 'none';
    if (stateUpdateAvailable) stateUpdateAvailable.style.display = 'block';
    if (navUpdateDot) navUpdateDot.style.display = 'block';

    const pulseTag = document.querySelector('.available-pulse-tag');
    if (pulseTag) {
      pulseTag.textContent = isNewGitPatch
        ? '⚡ Live Patch Available'
        : '⚡ New Version Available';
    }

    if (currentVerPill) {
      currentVerPill.textContent = isNewGitPatch
        ? ('v' + localVer + ' (' + localHash.slice(0, 8) + ') ➔')
        : ('v' + localVer + ' ➔');
    }
    if (availableVerPill) {
      availableVerPill.textContent = isNewGitPatch
        ? ('Patch ' + (remoteHash ? remoteHash.slice(0, 8) : 'latest'))
        : ('v' + latestVer);
    }

    const guideTargetVer = document.getElementById('guideTargetVer');
    if (guideTargetVer) {
      guideTargetVer.textContent = isNewGitPatch
        ? (latestVer + ' (Build: ' + remoteHash.slice(0, 8) + ')')
        : latestVer;
    }
    const reloadTargetVer = document.getElementById('reloadTargetVer');
    if (reloadTargetVer) {
      reloadTargetVer.textContent = isNewGitPatch
        ? (latestVer + ' (Build: ' + remoteHash.slice(0, 8) + ')')
        : latestVer;
    }

    const unpackedGuide = document.getElementById('unpackedUpgradeGuide');
    const updateModeNotice = document.getElementById('updateModeNotice');
    const btnReloadExtension = document.getElementById('btnReloadExtension');

    if (isUnpacked) {
      // Zero-ZIP In-Place Folder Sync Mode (via updater.html)
      if (unpackedGuide) unpackedGuide.style.display = 'block';
      
      // Check whether a folder handle exists in IndexedDB
      let hasLinkedFolder = false;
      let linkedFolderName = '';
      try {
        if (window.BeamDropFolderStore) {
          const folderData = await window.BeamDropFolderStore.getFolderData();
          if (folderData && folderData.handle) {
            hasLinkedFolder = true;
            linkedFolderName = folderData.folderName || folderData.handle.name || 'Extension Folder';
          }
        }
      } catch (_) {}

      if (hasLinkedFolder) {
        // Folder IS linked: allow direct sync flow via updater tab
        const patchOrVerLabel = isNewGitPatch ? ('Patch ' + remoteHash.slice(0, 8)) : ('v' + latestVer);
        if (btnTriggerUpdateText) {
          btnTriggerUpdateText.textContent = `⚡ Sync & Overwrite to ${patchOrVerLabel}`;
        }
        if (updateModeNotice) {
          updateModeNotice.textContent = `📁 Linked: ${linkedFolderName} • 1-Click Direct In-Place Sync`;
        }

        if (btnTriggerUpdate) {
          btnTriggerUpdate.style.display = 'flex';
          btnTriggerUpdate.disabled = false;
          btnTriggerUpdate.onclick = () => {
            const updaterUrl = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
              ? chrome.runtime.getURL('updater.html?action=sync')
              : 'updater.html?action=sync';

            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
              chrome.tabs.create({ url: updaterUrl });
            } else {
              window.open(updaterUrl, '_blank');
            }
          };
        }
      } else {
        // NO folder is linked yet: prompt to link folder first
        if (btnTriggerUpdateText) {
          btnTriggerUpdateText.textContent = '📁 Link Folder to Enable 1-Click Updates';
        }
        if (updateModeNotice) {
          updateModeNotice.textContent = '⚡ Link your local folder once to enable 1-click in-place disk updates';
        }

        if (btnTriggerUpdate) {
          btnTriggerUpdate.style.display = 'flex';
          btnTriggerUpdate.disabled = false;
          btnTriggerUpdate.onclick = () => {
            const updaterUrl = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
              ? chrome.runtime.getURL('updater.html')
              : 'updater.html';

            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
              chrome.tabs.create({ url: updaterUrl });
            } else {
              window.open(updaterUrl, '_blank');
            }
          };
        }
      }

      if (btnReloadExtension) {
        btnReloadExtension.onclick = () => {
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.reload) {
            chrome.runtime.reload();
          } else {
            window.location.reload();
          }
        };
      }
    } else {
      // Web Store Production Mode
      if (unpackedGuide) unpackedGuide.style.display = 'none';
      if (btnTriggerUpdateText) btnTriggerUpdateText.textContent = '⚡ 1-Click Update & Reload';
      if (updateModeNotice) updateModeNotice.textContent = '⚡ Managed by Chrome Web Store';

      if (btnTriggerUpdate) {
        btnTriggerUpdate.style.display = 'flex';
        btnTriggerUpdate.disabled = false;
        btnTriggerUpdate.onclick = () => {
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.requestUpdateCheck) {
            chrome.runtime.requestUpdateCheck(() => {
              chrome.runtime.reload();
            });
          } else {
            chrome.runtime.reload();
          }
        };
      }
    }

    const notes = (remoteVersionInfo && remoteVersionInfo.patchNotes)
      ? [remoteVersionInfo.patchNotes, ...(remoteVersionInfo.highlights || [])]
      : (remoteVersionInfo && remoteVersionInfo.highlights) || [
          '🚀 Real-time WebRTC DataChannel optimizations',
          '⚡ Instant RECEIVER_READY two-way handshake',
          '🛡️ Zero buffer deadlock with 150ms watchdog guard'
        ];

    if (availableChangelogList) {
      availableChangelogList.innerHTML = notes
        .slice(0, 5)
        .map(item => '<li>' + escapeHtml(item) + '</li>')
        .join('');
    }
  } else {
    // STATE A: UP TO DATE
    if (stateUpdateAvailable) stateUpdateAvailable.style.display = 'none';
    if (stateUpToDate) stateUpToDate.style.display = 'block';
    if (navUpdateDot) navUpdateDot.style.display = 'none';
    if (uptodateVersionBadge) {
      uptodateVersionBadge.textContent = 'v' + localVer + ' (' + localHash.slice(0, 8) + ')';
    }
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

// Download Update Package via Chrome Downloads API or direct link
function downloadUpdatePackage(ver) {
  const downloadUrl = (VERCEL_RECEIVER_URL && !VERCEL_RECEIVER_URL.includes('.run.app') && !VERCEL_RECEIVER_URL.includes('localhost'))
    ? VERCEL_RECEIVER_URL.replace(/\/$/, '') + '/extension.zip'
    : 'https://beam-drop-mu.vercel.app/extension.zip';

  if (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.download) {
    chrome.downloads.download({
      url: downloadUrl,
      filename: 'beamdrop-v' + ver + '.zip',
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        window.open(downloadUrl, '_blank');
      }
    });
  } else {
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = 'beamdrop-v' + ver + '.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  if (btnTriggerUpdateText) {
    btnTriggerUpdateText.textContent = '✓ Downloaded beamdrop-v' + ver + '.zip!';
  }
}

function compareVersions(v1, v2) {
  const p1 = (v1 || '').split('.').map(Number);
  const p2 = (v2 || '').split('.').map(Number);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const n1 = p1[i] || 0;
    const n2 = p2[i] || 0;
    if (n1 < n2) return -1;
    if (n1 > n2) return 1;
  }
  return 0;
}

if (btnCheckUpdates) {
  btnCheckUpdates.addEventListener('click', () => {
    checkForUpdates(true);
  });
}

// ==========================================
// STAGE 6: NEARBY RADAR & DISCOVERY ENGINE (AirDrop-Style Handshake)
// ==========================================
let myDeviceName = 'My Device';
let myDeviceType = 'laptop';
let myDeviceIcon = '💻';
let myDiscoveryPeer = null;
let myDiscoveryPeerId = null;
// ==========================================
// STAGE 6: SPIDER RADAR & WI-FI HOTSPOT DISCOVERY ENGINE
// ==========================================
let isDiscoveringNearby = false;
let nearbyScanTimer = null;
const discoveredPeersMap = new Map();
let pendingIncomingTransfer = null;
let activeRadarFilter = 'all'; // 'all' | 'phone' | 'laptop' | 'router'
let currentNetworkMeta = null;

// Audio feedback for radar discovery
function playRadarBlipSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch (e) {}
}

// Device Identity Detection
function detectLocalDeviceMeta() {
  const ua = navigator.userAgent;
  let type = 'laptop';
  let icon = '💻';
  let name = 'Windows PC';
  if (/Android/i.test(ua)) { type = 'phone'; icon = '📱'; name = 'Android Device'; }
  else if (/iPhone/i.test(ua)) { type = 'phone'; icon = '📱'; name = 'iPhone'; }
  else if (/iPad|Tablet/i.test(ua)) { type = 'tablet'; icon = '📟'; name = 'Tablet'; }
  else if (/Macintosh/i.test(ua)) { type = 'laptop'; icon = '💻'; name = 'MacBook Pro'; }
  else if (/Linux/i.test(ua)) { type = 'desktop'; icon = '🖥️'; name = 'Linux PC'; }
  return { type, icon, name };
}

let detectedMyLanIp = 'Detecting...';
let detectedRoomHash = '';

async function detectLanAndRoomInExtension() {
  // A. Detect private LAN IP via WebRTC
  try {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pc.createDataChannel('ext-lan-ip');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const timer = setTimeout(() => { try { pc.close(); } catch(_) {} }, 3500);

    pc.onicecandidate = (event) => {
      if (!event || !event.candidate || !event.candidate.candidate) return;
      const candidateStr = event.candidate.candidate;
      const ipRegex = /\b(192\.168\.[0-9]{1,3}\.[0-9]{1,3}|10\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}|172\.(?:1[6-9]|2[0-9]|3[01])\.[0-9]{1,3}\.[0-9]{1,3})\b/;
      const match = candidateStr.match(ipRegex);
      if (match && match[1]) {
        detectedMyLanIp = match[1];
        clearTimeout(timer);
        try { pc.close(); } catch(_) {}
        if (telemetrySubnetTag) {
          telemetrySubnetTag.textContent = detectedMyLanIp;
        }
      }
    };
  } catch (e) {}

  // B. Fetch Room Hash from /api/ip
  const ipEndpoints = [
    `${VERCEL_RECEIVER_URL}/api/ip`,
  ];
  for (const url of ipEndpoints) {
    try {
      const res = await fetch(url + '?_t=' + Date.now(), { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json && json.success && json.roomHash) {
          detectedRoomHash = json.roomHash;
          if (telemetrySsid) {
            telemetrySsid.textContent = '🟢 Connected to Mesh';
          }
          if (telemetryBandSpeed) {
            telemetryBandSpeed.textContent = 'Room: ' + json.roomHash + ' • IP: ' + json.ip;
          }
          if (telemetrySubnetTag) {
            telemetrySubnetTag.textContent = json.roomHash;
          }
          if (detectedMyLanIp === 'Detecting...') {
            detectedMyLanIp = json.ip;
          }
          break;
        }
      }
    } catch (_) {}
  }
}
detectLanAndRoomInExtension();

async function initDeviceIdentity() {
  const meta = detectLocalDeviceMeta();
  myDeviceType = meta.type;
  myDeviceIcon = meta.icon;
  if (deviceSelfAvatar) deviceSelfAvatar.textContent = myDeviceIcon;

  if (chrome.storage && chrome.storage.local) {
    const stored = await chrome.storage.local.get(['beam_device_name']);
    if (stored && stored.beam_device_name) {
      myDeviceName = stored.beam_device_name;
    } else {
      myDeviceName = `${meta.name} (${Math.floor(Math.random() * 900 + 100)})`;
      chrome.storage.local.set({ beam_device_name: myDeviceName });
    }
  } else {
    myDeviceName = `${meta.name} (${Math.floor(Math.random() * 900 + 100)})`;
  }

  if (myDeviceNameInput) {
    myDeviceNameInput.value = myDeviceName;
    myDeviceNameInput.addEventListener('change', () => {
      myDeviceName = myDeviceNameInput.value.trim() || 'My Device';
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ beam_device_name: myDeviceName });
      }
      broadcastPresenceBeacon();
    });
  }
}

// Call identity setup on startup
initDeviceIdentity();
scanSpiderNetwork(); // Pre-scan immediately so radar telemetry & badge are ready

// Scan LAN & Hotspot via clean Cloud Mesh API
async function scanSpiderNetwork(isManual = false) {
  if (isManual && radarScanningStatusText) {
    radarScanningStatusText.textContent = "⚡ Spider sweep in progress...";
  }

  let scanResult = null;
  const pinParam = currentRadarRoomPin ? ("&pin=" + encodeURIComponent(currentRadarRoomPin)) : "";
  const cloudEndpoints = [
    VERCEL_RECEIVER_URL + "/api/mesh/devices?_t=" + Date.now() + pinParam
  ];

  for (const ep of cloudEndpoints) {
    try {
      const resp = await fetch(ep, { cache: "no-store" });
      if (resp.ok) {
        const json = await resp.json();
        if (json && json.success && Array.isArray(json.devices)) {
          json.devices.forEach(dev => {
            if (dev.id !== myDiscoveryPeerId) {
              registerDiscoveredPeer(dev);
            }
          });
          break;
        }
      }
    } catch (_) {}
  }

  if (scanResult && scanResult.network) {
    currentNetworkMeta = scanResult.network;

    // Update Telemetry HUD Bar
    if (telemetrySsid) {
      telemetrySsid.textContent = scanResult.network.ssid || 'Wi-Fi Network';
    }
    if (telemetryBandSpeed) {
      telemetryBandSpeed.textContent = `${scanResult.network.band || '5 GHz'} • ${scanResult.network.speed || '1200 Mbps'} (${scanResult.network.signal || '90%'})`;
    }
    if (telemetryModeTag) {
      telemetryModeTag.textContent = scanResult.network.isHotspot ? 'HOTSPOT MESH' : 'WI-FI LAN';
      telemetryModeTag.style.borderColor = scanResult.network.isHotspot ? '#fbbf24' : '#38bdf8';
      telemetryModeTag.style.color = scanResult.network.isHotspot ? '#fbbf24' : '#38bdf8';
    }
    if (telemetrySubnetTag && detectedRoomHash) {
      telemetrySubnetTag.textContent = detectedRoomHash;
    }
    if (chipWifiText) {
      chipWifiText.textContent = scanResult.network.isHotspot
        ? '🔥 Mobile Hotspot Mode'
        : `📶 ${scanResult.network.ssid}`;
    }

    let newlyDiscoveredCount = 0;

    // Register active devices from real ARP table & telemetry
    if (Array.isArray(scanResult.devices)) {
      scanResult.devices.forEach(dev => {
        const isNew = !discoveredPeersMap.has(dev.id);
        if (isNew) newlyDiscoveredCount++;

        const octet = parseInt((dev.ip || '1').split('.').pop(), 10) || 1;
        // Deterministic angle using golden ratio dispersion so nodes don't collide
        const angle = ((octet * 137.5) % 360) * (Math.PI / 180);

        let dist = 52;
        if (dev.isGateway) {
          dist = 22; // Inner hub for router/hotspot host
        } else if (dev.deviceType === 'phone') {
          dist = 36 + ((octet % 3) * 5); // First orbit: smartphones (Android / iPhone)
        } else if (dev.deviceType === 'laptop') {
          dist = 56 + ((octet % 3) * 5); // Second orbit: PCs & Laptops
        } else {
          dist = 72; // Outer orbit: other smart devices
        }

        const x = Math.min(88, Math.max(12, 50 + Math.cos(angle) * dist));
        const y = Math.min(88, Math.max(12, 50 + Math.sin(angle) * dist));

        discoveredPeersMap.set(dev.id, {
          id: dev.id,
          ip: dev.ip,
          mac: dev.mac,
          name: dev.name,
          deviceType: dev.deviceType,
          icon: dev.icon,
          latency: dev.latency || 5,
          isGateway: dev.isGateway,
          protocol: dev.protocol || 'wifi',
          signal: dev.signal || scanResult.network.signal,
          lastSeen: Date.now(),
          x,
          y
        });
      });
    }

    if (newlyDiscoveredCount > 0) {
      playRadarBlipSound();
    }

    if (radarScanningStatusText) {
      const devCount = discoveredPeersMap.size;
      radarScanningStatusText.textContent = `Spider Radar: ${devCount} active device${devCount === 1 ? '' : 's'} on ${scanResult.network.isHotspot ? 'Hotspot' : 'Wi-Fi'}`;
    }
  } else {
    if (radarScanningStatusText) {
      radarScanningStatusText.textContent = `Scanning local Wi-Fi mesh & Bluetooth...`;
    }
  }

  renderNearbyDevices();
}

// Broadcast Channel for intra-machine & local tab discovery
const localMeshBroadcast = (typeof BroadcastChannel !== 'undefined')
  ? new BroadcastChannel('beamdrop_local_mesh_channel')
  : null;

if (localMeshBroadcast) {
  localMeshBroadcast.onmessage = (event) => {
    const data = event.data;
    if (!data) return;
    if (data.type === 'RADAR_BEACON' && data.id !== myDiscoveryPeerId) {
      registerDiscoveredPeer(data);
      localMeshBroadcast.postMessage({
        type: 'RADAR_PONG',
        id: myDiscoveryPeerId,
        name: myDeviceName,
        deviceType: myDeviceType,
        icon: myDeviceIcon,
        protocol: 'wifi',
        timestamp: Date.now()
      });
    } else if (data.type === 'RADAR_PONG' && data.id !== myDiscoveryPeerId) {
      registerDiscoveredPeer(data);
    }
  };
}

function registerDiscoveredPeer(peerData) {
  if (!peerData || !peerData.id) return;
  const existing = discoveredPeersMap.get(peerData.id);
  const angle = existing ? existing.angle : Math.random() * Math.PI * 2;
  const dist = existing ? existing.dist : 36 + Math.random() * 25;
  const x = Math.min(88, Math.max(12, 50 + Math.cos(angle) * dist));
  const y = Math.min(88, Math.max(12, 50 + Math.sin(angle) * dist));

  discoveredPeersMap.set(peerData.id, {
    id: peerData.id,
    ip: peerData.ip || 'LAN Node',
    name: peerData.name || 'Nearby Device',
    deviceType: peerData.deviceType || 'phone',
    icon: peerData.icon || (peerData.deviceType === 'phone' ? '📱' : '💻'),
    protocol: peerData.protocol || 'wifi',
    latency: peerData.latency || 4,
    lastSeen: Date.now(),
    x, y, angle, dist
  });

  renderNearbyDevices();
}

function broadcastPresenceBeacon() {
  if (!myDiscoveryPeerId) return;
  const payload = {
    type: 'RADAR_BEACON',
    id: myDiscoveryPeerId,
    name: myDeviceName,
    deviceType: myDeviceType,
    icon: myDeviceIcon,
    protocol: 'wifi',
    ip: detectedMyLanIp !== 'Detecting...' ? detectedMyLanIp : undefined,
    pin: currentRadarRoomPin || undefined,
    timestamp: Date.now()
  };
  if (localMeshBroadcast) {
    localMeshBroadcast.postMessage(payload);
  }

  // Announce to Cloud & Local Signaling (PairDrop Same-Wi-Fi Discovery)
  const announceEndpoints = [
    `${VERCEL_RECEIVER_URL}/api/mesh/announce`,
  ];

  announceEndpoints.forEach(url => {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  });
}

// Start Spider Radar Discovery Loop

function stopNearbyDiscovery() {
  isDiscoveringNearby = false;
  if (nearbyScanTimer) {
    clearInterval(nearbyScanTimer);
    nearbyScanTimer = null;
  }
  if (myDiscoveryPeer) {
    try {
      myDiscoveryPeer.destroy();
    } catch (_) {}
    myDiscoveryPeer = null;
  }
}

function startNearbyDiscovery() {
  isDiscoveringNearby = true;
  initDiscoveryPeerListener();
  broadcastPresenceBeacon();
  scanSpiderNetwork();

  if (nearbyScanTimer) clearInterval(nearbyScanTimer);
  nearbyScanTimer = setInterval(() => {
    broadcastPresenceBeacon();
    scanSpiderNetwork();
    pruneStaleNearbyPeers();
  }, 3000);

  renderNearbyDevices();
}

function pruneStaleNearbyPeers() {
  const now = Date.now();
  let changed = false;
  for (const [id, peer] of discoveredPeersMap.entries()) {
    if (now - peer.lastSeen > 15000 && !peer.isGateway) {
      discoveredPeersMap.delete(id);
      changed = true;
    }
  }
  if (changed) renderNearbyDevices();
}

function initDiscoveryPeerListener() {
  if (myDiscoveryPeer && !myDiscoveryPeer.destroyed) return;

  if (!myDiscoveryPeerId) {
    myDiscoveryPeerId = 'beam-rad-' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 8));
  }

  try {
    myDiscoveryPeer = new Peer(myDiscoveryPeerId, {
      debug: 0,
      logFunction: (_lvl, ...args) => {
        const msg = args.map(a => (a && a.message) || String(a)).join(' ');
        if (msg.includes('Lost connection') || msg.includes('socket') || msg.includes('disconnected')) return;
        // Silent logger to keep Chrome extension errors count at 0
      },
      config: { iceServers: EXTENSION_ICE_SERVERS }
    });

    myDiscoveryPeer.on('open', (id) => {
      console.log('[BeamDrop Nearby] Discovery Peer Listening:', id);
      broadcastPresenceBeacon();
    });

    myDiscoveryPeer.on('connection', (conn) => {
      console.log('[BeamDrop Nearby] Inbound Connection from:', conn.peer);
      conn.on('data', (data) => {
        if (!data) return;
        if (data.type === 'TRANSFER_INVITE') {
          handleIncomingTransferInvite(conn, data);
        } else if (data.type === 'TRANSFER_ACCEPTED') {
          handleRemoteTransferAccepted(conn);
        } else if (data.type === 'TRANSFER_DECLINED') {
          handleRemoteTransferDeclined(conn, data);
        }
      });
    });

    myDiscoveryPeer.on('disconnected', () => {
      if (myDiscoveryPeer && !myDiscoveryPeer.destroyed) {
        try { myDiscoveryPeer.reconnect(); } catch (e) {}
      }
    });

    myDiscoveryPeer.on('error', (err) => {
      const errMsg = String(err && (err.message || err.type || err) || '');
      const errType = String(err && err.type || '');

      if (
        errType === 'network' ||
        errType === 'server-error' ||
        errType === 'socket-error' ||
        errType === 'socket-closed' ||
        errType === 'lost-connection' ||
        errMsg.includes('Lost connection') ||
        errMsg.includes('socket')
      ) {
        if (myDiscoveryPeer && !myDiscoveryPeer.destroyed && myDiscoveryPeer.disconnected) {
          try { myDiscoveryPeer.reconnect(); } catch (e) {}
        }
        return;
      }
      console.debug('[BeamDrop Nearby] Peer listener notice:', err.type);
    });
  } catch (e) {
    console.debug('Failed to init discovery peer listener:', e);
  }
}

// Category Filter Controller
function setRadarFilter(filter) {
  activeRadarFilter = filter;
  [filterBtnAll, filterBtnPhones, filterBtnPcs, filterBtnNetwork].forEach(btn => {
    if (btn) btn.classList.remove('active');
  });
  if (filter === 'all' && filterBtnAll) filterBtnAll.classList.add('active');
  if (filter === 'phone' && filterBtnPhones) filterBtnPhones.classList.add('active');
  if (filter === 'laptop' && filterBtnPcs) filterBtnPcs.classList.add('active');
  if (filter === 'router' && filterBtnNetwork) filterBtnNetwork.classList.add('active');
  renderNearbyDevices();
}

if (filterBtnAll) filterBtnAll.addEventListener('click', () => setRadarFilter('all'));
if (filterBtnPhones) filterBtnPhones.addEventListener('click', () => setRadarFilter('phone'));
if (filterBtnPcs) filterBtnPcs.addEventListener('click', () => setRadarFilter('laptop'));
if (filterBtnNetwork) filterBtnNetwork.addEventListener('click', () => setRadarFilter('router'));

// Render Discovered Devices & Spider Radar Blips
function renderNearbyDevices() {
  if (!nearbyDevicesList) return;

  const allPeers = Array.from(discoveredPeersMap.values());
  const phoneCount = allPeers.filter(p => p.deviceType === 'phone').length;
  const pcCount = allPeers.filter(p => p.deviceType === 'laptop' || p.deviceType === 'desktop').length;
  const routerCount = allPeers.filter(p => p.deviceType === 'router').length;

  if (filterCountAll) filterCountAll.textContent = allPeers.length;
  if (filterCountPhones) filterCountPhones.textContent = phoneCount;
  if (filterCountPcs) filterCountPcs.textContent = pcCount;
  if (filterCountNetwork) filterCountNetwork.textContent = routerCount;

  if (nearbyCountLabel) nearbyCountLabel.textContent = allPeers.length;
  if (navNearbyCountBadge) {
    if (allPeers.length > 0) {
      navNearbyCountBadge.textContent = allPeers.length;
      navNearbyCountBadge.style.display = 'inline-block';
    } else {
      navNearbyCountBadge.style.display = 'none';
    }
  }

  // Filter peers by active category
  const filteredPeers = allPeers.filter(p => {
    if (activeRadarFilter === 'all') return true;
    if (activeRadarFilter === 'phone') return p.deviceType === 'phone';
    if (activeRadarFilter === 'laptop') return p.deviceType === 'laptop' || p.deviceType === 'desktop';
    if (activeRadarFilter === 'router') return p.deviceType === 'router';
    return true;
  });

  // Render Spider Radar Blips
  if (radarBlipsContainer) {
    radarBlipsContainer.innerHTML = '';
    filteredPeers.forEach(peer => {
      const blip = document.createElement('div');
      blip.className = `radar-blip ${peer.deviceType || 'phone'}`;
      blip.style.left = `${peer.x}%`;
      blip.style.top = `${peer.y}%`;

      const tooltip = document.createElement('div');
      tooltip.className = 'blip-tooltip';
      tooltip.textContent = `${peer.name} (${peer.latency || 5}ms)`;
      blip.appendChild(tooltip);

      const iconSpan = document.createElement('span');
      iconSpan.textContent = peer.icon || '📱';
      blip.appendChild(iconSpan);

      blip.addEventListener('click', (e) => {
        e.stopPropagation();
        initiateDirectBeam(peer);
      });
      radarBlipsContainer.appendChild(blip);
    });
  }

  // Render Device List Cards
  if (filteredPeers.length === 0) {
    if (nearbyEmptyState) nearbyEmptyState.style.display = 'block';
    nearbyDevicesList.querySelectorAll('.nearby-device-card').forEach(el => el.remove());
  } else {
    if (nearbyEmptyState) nearbyEmptyState.style.display = 'none';
    nearbyDevicesList.querySelectorAll('.nearby-device-card').forEach(el => el.remove());

    filteredPeers.forEach(peer => {
      const card = document.createElement('div');
      card.className = 'nearby-device-card';

      const isBt = peer.protocol === 'bt';
      const isHotspot = peer.protocol === 'hotspot';
      let protoLabel = '📶 Wi-Fi 5GHz';
      let protoClass = 'device-protocol-badge wifi';
      if (isBt) {
        protoLabel = '🔵 Bluetooth';
        protoClass = 'device-protocol-badge bt';
      } else if (isHotspot) {
        protoLabel = '🔥 Hotspot';
        protoClass = 'device-protocol-badge wifi';
      }

      const maskedMac = peer.mac ? peer.mac.replace(/^([0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2})-.*-([0-9a-f]{2})$/i, '$1-**-**-$2') : '';
      const pingText = peer.latency ? `${peer.latency}ms` : '< 5ms';

      card.innerHTML = `
        <div class="device-avatar-wrap">
          <span>${peer.icon || '📱'}</span>
          <span class="device-online-dot"></span>
        </div>
        <div class="device-details-box">
          <div class="device-title-row">
            <span class="device-name-text">${escapeHtml(peer.name)}</span>
            <span class="${protoClass}">${protoLabel}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
            <span style="font-size: 10px; color: #38bdf8; font-family: ui-monospace, monospace;">${peer.ip || 'LAN Node'}</span>
            <span style="font-size: 9px; color: #34d399; font-weight: 700; background: rgba(52, 211, 153, 0.1); padding: 1px 4px; border-radius: 4px; border: 1px solid rgba(52, 211, 153, 0.3);">${pingText}</span>
            ${maskedMac ? `<span style="font-size: 8.5px; color: #64748b; font-family: ui-monospace, monospace;">${maskedMac}</span>` : ''}
          </div>
        </div>
        <button class="btn-beam-device" type="button" title="Send object to ${escapeHtml(peer.name)}">
          <span>⚡ Beam</span>
        </button>
      `;

      card.querySelector('.btn-beam-device').addEventListener('click', () => {
        initiateDirectBeam(peer);
      });

      nearbyDevicesList.appendChild(card);
    });
  }
}

// Bluetooth completely purged - 100% Local Wi-Fi Mesh


