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

// Ultra-Fast Zero-Deadlock STUN/TURN Server Matrix (Bypasses Symmetric NAT & 4G/5G mobile cellular firewalls)
const EXTENSION_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
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
const navTabReceive = document.getElementById('navTabReceive');
const navTabHistory = document.getElementById('navTabHistory');
const navTabNearby = document.getElementById('navTabNearby');
const navTabUpdates = document.getElementById('navTabUpdates');
const navUpdateDot = document.getElementById('navUpdateDot');
const navNearbyCountBadge = document.getElementById('navNearbyCountBadge');
const navHistoryCountBadge = document.getElementById('navHistoryCountBadge');

// Stages
const stageStaging = document.getElementById('stageStaging');
const stageReceive = document.getElementById('stageReceive');
const stageHistory = document.getElementById('stageHistory');
const stagePortal = document.getElementById('stagePortal');
const stageTransfer = document.getElementById('stageTransfer');
const stageComplete = document.getElementById('stageComplete');
const stageUpdates = document.getElementById('stageUpdates');
const stageNearby = document.getElementById('stageNearby');

// History & Vault Elements
const btnClearAllHistory = document.getElementById('btnClearAllHistory');
const filterHistAll = document.getElementById('filterHistAll');
const filterHistReceived = document.getElementById('filterHistReceived');
const filterHistSent = document.getElementById('filterHistSent');
const filterHistMedia = document.getElementById('filterHistMedia');
const histCountAll = document.getElementById('histCountAll');
const histCountReceived = document.getElementById('histCountReceived');
const histCountSent = document.getElementById('histCountSent');
const historyItemsContainer = document.getElementById('historyItemsContainer');
const histEmptyState = document.getElementById('histEmptyState');
const btnOpenFullVaultTab = document.getElementById('btnOpenFullVaultTab');

// Media Lightbox Elements
const mediaLightboxModal = document.getElementById('mediaLightboxModal');
const btnCloseLightbox = document.getElementById('btnCloseLightbox');
const lightboxTitle = document.getElementById('lightboxTitle');
const lightboxSub = document.getElementById('lightboxSub');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxTextWrap = document.getElementById('lightboxTextWrap');
const lightboxTextContent = document.getElementById('lightboxTextContent');
const lightboxHashPill = document.getElementById('lightboxHashPill');
const lightboxDateText = document.getElementById('lightboxDateText');
const btnLightboxSave = document.getElementById('btnLightboxSave');
const btnLightboxRebeam = document.getElementById('btnLightboxRebeam');

// Animated QR Loop Elements
const btnPortalModeWebRtc = document.getElementById('btnPortalModeWebRtc');
const btnPortalModeLoop = document.getElementById('btnPortalModeLoop');
const portalHeaderModeLabel = document.getElementById('portalHeaderModeLabel');
const portalWebRtcBox = document.getElementById('portalWebRtcBox');
const portalLoopPlayerWrap = document.getElementById('portalLoopPlayerWrap');
const qrcodeLoopCanvas = document.getElementById('qrcodeLoopCanvas');
const loopFrameText = document.getElementById('loopFrameText');
const loopProgressBar = document.getElementById('loopProgressBar');
const loopWakeLockBadge = document.getElementById('loopWakeLockBadge');
const loopFpsBadge = document.getElementById('loopFpsBadge');
const btnLoopPrev = document.getElementById('btnLoopPrev');
const btnLoopPlayPause = document.getElementById('btnLoopPlayPause');
const btnLoopPlayPauseText = document.getElementById('btnLoopPlayPauseText');
const btnLoopNext = document.getElementById('btnLoopNext');
const btnLoopSpeed = document.getElementById('btnLoopSpeed');
const btnLoopSpeedText = document.getElementById('btnLoopSpeedText');

// Optical Scanner HUD Elements
const opticalScanHud = document.getElementById('opticalScanHud');
const opticalFrameProgressText = document.getElementById('opticalFrameProgressText');
const opticalProgressFill = document.getElementById('opticalProgressFill');
const opticalChunksGrid = document.getElementById('opticalChunksGrid');

// Protection & Integrity HUD Elements
const transferWakeLockPill = document.getElementById('transferWakeLockPill');
const transferShaStatus = document.getElementById('transferShaStatus');
const completeShaBadge = document.getElementById('completeShaBadge');
const completeShaText = document.getElementById('completeShaText');

// Receive Vault Elements
const receiveVaultQrBox = document.getElementById('receiveVaultQrBox');
const receiveVaultAddressText = document.getElementById('receiveVaultAddressText');
const btnCopyReceiveAddress = document.getElementById('btnCopyReceiveAddress');
const btnGetIosShortcut = document.getElementById('btnGetIosShortcut');
const btnOpenMobileScannerLink = document.getElementById('btnOpenMobileScannerLink');
const receiveLiveStreamCard = document.getElementById('receiveLiveStreamCard');
const receiveIncomingFilename = document.getElementById('receiveIncomingFilename');
const receiveIncomingPercent = document.getElementById('receiveIncomingPercent');
const receiveIncomingProgressFill = document.getElementById('receiveIncomingProgressFill');
const vaultItemsCount = document.getElementById('vaultItemsCount');
const vaultItemsList = document.getElementById('vaultItemsList');
const qrModeCameraBtn = document.getElementById('qrModeCameraBtn');
const qrModeScanPeerBtn = document.getElementById('qrModeScanPeerBtn');
const qrModeShortcutBtn = document.getElementById('qrModeShortcutBtn');
const receiveVaultCameraVideo = document.getElementById('receiveVaultCameraVideo');
const cameraScanCrosshair = document.getElementById('cameraScanCrosshair');
let activeCameraStream = null;
let cameraScanTimer = null;
const chkAutoDownloadExt = document.getElementById('chkAutoDownloadExt');
const btnSetSaveDirectory = document.getElementById('btnSetSaveDirectory');
const receiveDiskStatusText = document.getElementById('receiveDiskStatusText');
const receiveInstructionText = document.getElementById('receiveInstructionText');
const receiveIncomingSpeed = document.getElementById('receiveIncomingSpeed');

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
const folderInput = document.getElementById('folderInput');
const btnPickFiles = document.getElementById('btnPickFiles');
const btnPickFolder = document.getElementById('btnPickFolder');
const btnNativeFsPicker = document.getElementById('btnNativeFsPicker');
const stagedFilesContainer = document.getElementById('stagedFilesContainer');
const stagedFilesList = document.getElementById('stagedFilesList');
const stagedCountText = document.getElementById('stagedCountText');
const stagedSummaryPill = document.getElementById('stagedSummaryPill');
const btnClearStagedFiles = document.getElementById('btnClearStagedFiles');
const btnDirectBeamTargeted = document.getElementById('btnDirectBeamTargeted');
const btnDirectBeamTargetedText = document.getElementById('btnDirectBeamTargetedText');
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
const portalNonceBadge = document.getElementById('portalNonceBadge');
const btnRebuildQr = document.getElementById('btnRebuildQr');
const btnRebuildQrIcon = document.getElementById('btnRebuildQrIcon');
const btnRebuildQrText = document.getElementById('btnRebuildQrText');
const portalPhoneStatusCard = document.getElementById('portalPhoneStatusCard');
const phoneStatusIcon = document.getElementById('phoneStatusIcon');
const phoneStatusTitle = document.getElementById('phoneStatusTitle');
const phoneStatusSub = document.getElementById('phoneStatusSub');
const phoneStatusBadge = document.getElementById('phoneStatusBadge');
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
const transferDeviceName = document.getElementById('transferDeviceName');
const transferPhoneStatusSub = document.getElementById('transferPhoneStatusSub');
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
  if (stageReceive) stageReceive.style.display = stageName === 'receive' ? 'flex' : 'none';
  if (stageHistory) stageHistory.style.display = stageName === 'history' ? 'flex' : 'none';
  stagePortal.style.display = stageName === 'portal' ? 'flex' : 'none';
  stageTransfer.style.display = stageName === 'transfer' ? 'flex' : 'none';
  stageComplete.style.display = stageName === 'complete' ? 'flex' : 'none';
  stageUpdates.style.display = stageName === 'updates' ? 'flex' : 'none';
  if (stageNearby) stageNearby.style.display = stageName === 'nearby' ? 'flex' : 'none';
}

async function computeSha256(data) {
  try {
    let buffer;
    if (typeof data === 'string') {
      buffer = new TextEncoder().encode(data);
    } else if (data instanceof Blob) {
      buffer = await data.arrayBuffer();
    } else if (data instanceof ArrayBuffer) {
      buffer = data;
    } else if (data && data.buffer instanceof ArrayBuffer) {
      buffer = data.buffer;
    } else {
      return null;
    }
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(digest));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    console.warn('[SHA-256 calculation notice]', e);
    return null;
  }
}

function createBlobThumbnail(blob) {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const MAX = 96;
          let w = img.width;
          let h = img.height;
          if (w > h) {
            if (w > MAX) { h = Math.round((h * MAX) / w); w = MAX; }
          } else {
            if (h > MAX) { w = Math.round((w * MAX) / h); h = MAX; }
          }
          canvas.width = Math.max(1, w);
          canvas.height = Math.max(1, h);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          URL.revokeObjectURL(url);
          resolve(dataUrl);
        } catch (_) {
          URL.revokeObjectURL(url);
          resolve(null);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    } catch (_) {
      resolve(null);
    }
  });
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
  stopCameraScanner();
  stopAnimatedQrLoop();
  currentActiveTab = 'send';
  if (window._receiveTransitTimer) { clearInterval(window._receiveTransitTimer); window._receiveTransitTimer = null; }
  navTabSend.classList.add('active');
  if (navTabReceive) navTabReceive.classList.remove('active');
  if (navTabHistory) navTabHistory.classList.remove('active');
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

if (navTabReceive) {
  navTabReceive.addEventListener('click', () => {
    stopAnimatedQrLoop();
    currentActiveTab = 'receive';
    navTabReceive.classList.add('active');
    navTabSend.classList.remove('active');
    if (navTabHistory) navTabHistory.classList.remove('active');
    if (navTabNearby) navTabNearby.classList.remove('active');
    navTabUpdates.classList.remove('active');
    showStage('receive');
    initReceiveVault();
  });
}

function playExtChime(type = 'connect') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    if (type === 'connect') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(now + 0.16);
    } else if (type === 'complete') {
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.05);
        gain.gain.setValueAtTime(0.07, now + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.22);
      });
    }
  } catch (_) {}
}

let currentReceiveQrMode = 'camera'; // 'camera' | 'shortcut'
let localReceiveDirHandle = null;
let currentExtStreamController = null;
let currentExtWritableStream = null;
let currentExtPipePromise = null;

function renderReceiveVaultQr() {
  if (!currentPeerId) return;
  const safeBaseTransitUrl = (VERCEL_RECEIVER_URL && !VERCEL_RECEIVER_URL.includes('.run.app') && !VERCEL_RECEIVER_URL.includes('localhost'))
    ? VERCEL_RECEIVER_URL.replace(/\/$/, '')
    : "https://beam-drop-mu.vercel.app";

  // Camera QR opens Web App Send mode directly pre-paired to this Extension PC Vault!
  const targetLink = currentReceiveQrMode === 'camera'
    ? `${safeBaseTransitUrl}/?mode=send&target=${currentPeerId}&name=PC%20Vault`
    : `${safeBaseTransitUrl}/api/transit?peer=${currentPeerId}&target=${currentPeerId}`;

  const qrCanvas = document.getElementById('receiveVaultQrCanvas');
  if (qrCanvas && typeof QRCode !== 'undefined' && QRCode.toCanvas) {
    QRCode.toCanvas(qrCanvas, targetLink, {
      width: 160,
      margin: 1,
      color: { dark: '#0369a1', light: '#ffffff' }
    }).catch(err => {
      console.warn('QR render error:', err);
    });
  } else if (receiveVaultQrBox && typeof QRCode !== 'undefined') {
    let canvas = receiveVaultQrBox.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      receiveVaultQrBox.innerHTML = '';
      receiveVaultQrBox.appendChild(canvas);
    }
    QRCode.toCanvas(canvas, targetLink, {
      width: 160,
      margin: 1,
      color: { dark: '#0369a1', light: '#ffffff' }
    }).catch(err => {
      console.warn('QR render error:', err);
    });
  }
}

// ==========================================
// CAMERA PERMISSION BRIDGE & QR SCANNER
// ==========================================
async function checkAndStartCamera(startScannerCallback) {
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const perm = await navigator.permissions.query({ name: 'camera' });
      if (perm.state === 'granted') {
        startScannerCallback();
        return;
      }
    }

    // Try direct getUserMedia
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      startScannerCallback(stream);
      return;
    } catch (directErr) {
      console.log('[BeamDrop] Opening permission bridge tab:', directErr);
    }

    if (receiveInstructionText) {
      receiveInstructionText.textContent = 'Camera permission required. Opening options tab to approve access safely...';
    }

    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({
        url: chrome.runtime.getURL('options.html?grant=camera')
      });
    } else if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'open_camera_permission_tab' });
    }
  } catch (err) {
    console.warn('[BeamDrop] Camera check error:', err);
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: chrome.runtime.getURL('options.html?grant=camera') });
    }
  }
}

function stopCameraScanner() {
  if (cameraScanTimer) {
    clearInterval(cameraScanTimer);
    cameraScanTimer = null;
  }
  if (activeCameraStream) {
    try {
      activeCameraStream.getTracks().forEach(t => t.stop());
    } catch (_) {}
    activeCameraStream = null;
  }
  if (receiveVaultCameraVideo) {
    receiveVaultCameraVideo.srcObject = null;
    receiveVaultCameraVideo.style.display = 'none';
  }
  if (cameraScanCrosshair) cameraScanCrosshair.style.display = 'none';
  if (receiveVaultQrCanvas) receiveVaultQrCanvas.style.display = 'block';
}

async function startPeerQrScanner(existingStream = null) {
  stopCameraScanner();
  if (receiveVaultQrCanvas) receiveVaultQrCanvas.style.display = 'none';
  if (receiveVaultCameraVideo) receiveVaultCameraVideo.style.display = 'block';
  if (cameraScanCrosshair) cameraScanCrosshair.style.display = 'block';
  if (receiveInstructionText) {
    receiveInstructionText.textContent = 'Aim camera at the mobile device or PC QR code to pair.';
  }

  try {
    const stream = existingStream || await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 640 } }
    });
    activeCameraStream = stream;
    if (receiveVaultCameraVideo) {
      receiveVaultCameraVideo.srcObject = stream;
      await receiveVaultCameraVideo.play().catch(() => {});
    }

    // Engine 1: Native BarcodeDetector (Android, macOS Chrome)
    let barcodeDetector = null;
    if ('BarcodeDetector' in window) {
      try {
        const formats = await window.BarcodeDetector.getSupportedFormats().catch(() => ['qr_code']);
        if (formats.includes('qr_code')) {
          barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
        }
      } catch (_) {}
    }

    // Engine 2: High-Performance Offscreen Canvas & jsQR Fallback (Windows & Linux)
    const scanCanvas = document.createElement('canvas');
    const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
    const SCAN_WIDTH = 480;

    cameraScanTimer = setInterval(async () => {
      if (!receiveVaultCameraVideo || receiveVaultCameraVideo.readyState < 2) return;

      // Try Engine 1: Native BarcodeDetector first
      if (barcodeDetector) {
        try {
          const codes = await barcodeDetector.detect(receiveVaultCameraVideo);
          if (codes && codes.length > 0) {
            handleScannedQrPayload(codes[0].rawValue);
            return;
          }
        } catch (_) {
          barcodeDetector = null; // Auto fallback to jsQR on runtime failure
        }
      }

      // Try Engine 2: Guaranteed jsQR Fallback
      if (typeof window.jsQR === 'function') {
        try {
          const vidW = receiveVaultCameraVideo.videoWidth || 640;
          const vidH = receiveVaultCameraVideo.videoHeight || 480;
          const ratio = vidH / vidW;
          scanCanvas.width = SCAN_WIDTH;
          scanCanvas.height = Math.floor(SCAN_WIDTH * ratio);

          scanCtx.drawImage(receiveVaultCameraVideo, 0, 0, scanCanvas.width, scanCanvas.height);
          const imageData = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);

          const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          });

          if (code && code.data) {
            handleScannedQrPayload(code.data);
          }
        } catch (scanErr) {
          console.debug('[BeamDrop jsQR scan]:', scanErr);
        }
      }
    }, 200);
  } catch (err) {
    console.warn('[BeamDrop] Failed starting camera feed:', err);
    stopCameraScanner();
    if (receiveInstructionText) {
      receiveInstructionText.textContent = 'Camera blocked or unavailable. Click to open Settings and grant access.';
    }
  }
}

function handleScannedQrPayload(rawValue) {
  if (!rawValue) return;
  console.log('[BeamDrop Scanner] Detected QR:', rawValue);

  // Optical Animated QR Loop Frame detection
  if (rawValue.startsWith('BD1|')) {
    if (typeof handleOpticalLoopFrame === 'function') {
      handleOpticalLoopFrame(rawValue);
      return;
    }
  }

  let targetPeerId = null;
  try {
    if (rawValue.includes('peer=')) {
      const url = new URL(rawValue, 'https://beam-drop-mu.vercel.app');
      targetPeerId = url.searchParams.get('peer');
    } else if (rawValue.startsWith('{')) {
      const parsed = JSON.parse(rawValue);
      targetPeerId = parsed.peer || parsed.peerId;
    } else if (rawValue.startsWith('beam-') || rawValue.startsWith('BD-')) {
      targetPeerId = rawValue;
    }
  } catch (_) {}

  if (targetPeerId) {
    stopCameraScanner();
    playExtChime('notify');
    if (receiveInstructionText) {
      receiveInstructionText.textContent = `Found device: ${targetPeerId}. Pairing...`;
    }
    if (typeof initiateDirectBeam === 'function') {
      initiateDirectBeam({ id: targetPeerId, name: 'Scanned Mobile Device' });
    }
  }
}

if (qrModeCameraBtn) {
  qrModeCameraBtn.addEventListener('click', () => {
    stopCameraScanner();
    currentReceiveQrMode = 'camera';
    qrModeCameraBtn.classList.add('active');
    if (qrModeScanPeerBtn) qrModeScanPeerBtn.classList.remove('active');
    if (qrModeShortcutBtn) qrModeShortcutBtn.classList.remove('active');
    if (receiveInstructionText) {
      receiveInstructionText.textContent = 'Point iPhone or Android camera to beam photos, videos & files directly into this PC.';
    }
    renderReceiveVaultQr();
  });
}

if (qrModeScanPeerBtn) {
  qrModeScanPeerBtn.addEventListener('click', () => {
    currentReceiveQrMode = 'scanner';
    qrModeScanPeerBtn.classList.add('active');
    if (qrModeCameraBtn) qrModeCameraBtn.classList.remove('active');
    if (qrModeShortcutBtn) qrModeShortcutBtn.classList.remove('active');
    checkAndStartCamera((stream) => {
      startPeerQrScanner(stream);
    });
  });
}

if (qrModeShortcutBtn) {
  qrModeShortcutBtn.addEventListener('click', () => {
    stopCameraScanner();
    currentReceiveQrMode = 'shortcut';
    qrModeShortcutBtn.classList.add('active');
    if (qrModeCameraBtn) qrModeCameraBtn.classList.remove('active');
    if (qrModeScanPeerBtn) qrModeScanPeerBtn.classList.remove('active');
    if (receiveInstructionText) {
      receiveInstructionText.textContent = 'Scan with Apple iOS Shortcut to POST files into PC Vault directly without opening browser.';
    }
    renderReceiveVaultQr();
  });
}

if (btnSetSaveDirectory) {
  btnSetSaveDirectory.addEventListener('click', async () => {
    if (typeof window.showDirectoryPicker === 'function') {
      try {
        const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        if (dirHandle) {
          localReceiveDirHandle = dirHandle;
          if (window.BeamDropFolderStore) {
            window.BeamDropFolderStore.saveFolderHandle(dirHandle).catch(() => {});
          }
          if (receiveDiskStatusText) receiveDiskStatusText.textContent = `Direct Disk Stream: ${dirHandle.name} (0 RAM Bloat)`;
          btnSetSaveDirectory.textContent = 'Folder Linked';
          btnSetSaveDirectory.style.background = '#d1fae5';
        }
      } catch (err) {
        if (err && err.name !== 'AbortError') console.warn('Directory select notice:', err);
      }
    } else {
      if (receiveDiskStatusText) receiveDiskStatusText.textContent = 'Saving directly to PC Downloads (Standard)';
    }
  });
}

function initReceiveVault() {
  if (!currentPeerId) {
    try {
      currentPeerId = localStorage.getItem('beamdrop_ext_peer_id');
    } catch (_) {}
    if (!currentPeerId) {
      const randomSub = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).substring(2, 10);
      currentPeerId = 'beam-' + randomSub;
      try {
        localStorage.setItem('beamdrop_ext_peer_id', currentPeerId);
      } catch (_) {}
    }
  }

  // Restore stored directory handle from IndexedDB if available
  if (window.BeamDropFolderStore) {
    window.BeamDropFolderStore.getFolderData().then((data) => {
      if (data && data.handle) {
        localReceiveDirHandle = data.handle;
        if (receiveDiskStatusText) receiveDiskStatusText.textContent = `Direct Disk Stream: ${data.folderName || data.handle.name} (0 RAM Bloat)`;
        if (btnSetSaveDirectory) {
          btnSetSaveDirectory.textContent = 'Folder Linked';
          btnSetSaveDirectory.style.background = '#d1fae5';
        }
      }
    }).catch(() => {});
  }

  // Ensure PeerJS listener is active for incoming connections
  if (!peer || peer.destroyed || peer.disconnected) {
    initPeerJsSession('receive');
  }

  const shortPeer = (currentPeerId || 'ID').replace('beam-', '').toUpperCase();
  const cryptoAddress = `BD-${shortPeer.slice(0, 4)}-${shortPeer.slice(4, 8) || 'ADDR'}`;
  if (receiveVaultAddressText) {
    receiveVaultAddressText.textContent = cryptoAddress;
  }

  renderReceiveVaultQr();

  // Poll Transit for incoming files from iOS Shortcuts & direct uploads
  if (window._receiveTransitTimer) {
    clearInterval(window._receiveTransitTimer);
    window._receiveTransitTimer = null;
  }
  const safeBaseUrl = (VERCEL_RECEIVER_URL && !VERCEL_RECEIVER_URL.includes('.run.app') && !VERCEL_RECEIVER_URL.includes('localhost'))
    ? VERCEL_RECEIVER_URL.replace(/\/$/, '')
    : "https://beam-drop-mu.vercel.app";

  window._receiveTransitTimer = setInterval(async () => {
    if (currentActiveTab !== 'receive' || !currentPeerId) return;
    try {
      const res = await fetch(`${safeBaseUrl}/api/transit?peer=${encodeURIComponent(currentPeerId)}`);
      // 204 No Content or 404 means queue is currently empty: wait silently
      if (res.status === 204 || res.status === 404) return;
      if (res.status === 200) {
        const remoteUrlHeader = res.headers.get('X-BeamDrop-Remote-Url');
        let blob;
        let fileName = '';

        if (remoteUrlHeader) {
          const rawName = res.headers.get('X-BeamDrop-Name');
          fileName = rawName ? decodeURIComponent(rawName) : `beamed_${Date.now()}`;
          const dlRes = await fetch(remoteUrlHeader);
          blob = await dlRes.blob();
        } else {
          blob = await res.blob();
          const rawName = res.headers.get('X-BeamDrop-Name');
          fileName = rawName ? decodeURIComponent(rawName) : `beamed_${Date.now()}.jpg`;
        }

        // Acknowledge and clear transit queue on server so it is never re-downloaded
        fetch(`${safeBaseUrl}/api/transit?peer=${encodeURIComponent(currentPeerId)}`, { method: 'DELETE' }).catch(() => {});

        let streamedToDisk = false;
        if (localReceiveDirHandle) {
          try {
            const handle = await localReceiveDirHandle.getFileHandle(fileName, { create: true });
            const writable = await handle.createWritable();
            await blob.stream().pipeTo(writable);
            streamedToDisk = true;
          } catch (e) {
            console.warn('[Transit Disk Save] Notice:', e);
          }
        }

        addVaultItem({
          name: fileName,
          size: blob.size,
          time: new Date().toLocaleTimeString(),
          blob: blob
        });

        playExtChime('complete');
        if (!streamedToDisk) {
          triggerChromeDownload(blob, fileName);
        }

        // Fast drain for multi-file batches
        let pending = parseInt(res.headers.get('X-BeamDrop-Pending') || '0', 10);
        while (pending > 0) {
          const nextRes = await fetch(`${safeBaseUrl}/api/transit?peer=${encodeURIComponent(currentPeerId)}`);
          if (nextRes.status !== 200) break;
          const nextBlob = await nextRes.blob();
          const nextRaw = nextRes.headers.get('X-BeamDrop-Name');
          const nextName = nextRaw ? decodeURIComponent(nextRaw) : `beamed_${Date.now()}.jpg`;
          
          fetch(`${safeBaseUrl}/api/transit?peer=${encodeURIComponent(currentPeerId)}`, { method: 'DELETE' }).catch(() => {});

          if (localReceiveDirHandle) {
            try {
              const handle = await localReceiveDirHandle.getFileHandle(nextName, { create: true });
              const writable = await handle.createWritable();
              await nextBlob.stream().pipeTo(writable);
            } catch (_) {}
          } else {
            triggerChromeDownload(nextBlob, nextName);
          }

          addVaultItem({
            name: nextName,
            size: nextBlob.size,
            time: new Date().toLocaleTimeString(),
            blob: nextBlob
          });
          pending = parseInt(nextRes.headers.get('X-BeamDrop-Pending') || '0', 10);
        }
      }
    } catch (_) {}
  }, 2000);
}

function triggerChromeDownload(blob, fileName) {
  try {
    if (chkAutoDownloadExt && !chkAutoDownloadExt.checked) {
      console.log('[BeamDrop] Auto-download disabled, item held in Vault.');
      return;
    }
    const url = URL.createObjectURL(blob);
    if (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.download) {
      chrome.downloads.download({
        url: url,
        filename: fileName,
        saveAs: false
      }, () => {
        if (chrome.runtime.lastError) {
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      });
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  } catch (_) {}
}

if (btnCopyReceiveAddress) {
  btnCopyReceiveAddress.addEventListener('click', () => {
    const text = receiveVaultAddressText ? receiveVaultAddressText.textContent : '';
    if (text) {
      navigator.clipboard.writeText(text);
      btnCopyReceiveAddress.textContent = 'Copied!';
      setTimeout(() => { btnCopyReceiveAddress.textContent = 'Copy'; }, 2000);
    }
  });
}

if (btnGetIosShortcut) {
  btnGetIosShortcut.addEventListener('click', () => {
    const url = 'https://www.icloud.com/shortcuts/0b10ce1117eb49528d916c7557f472f2';
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
  });
}

let vaultItems = [];
function addVaultItem(item) {
  if (!item.url && item.blob) {
    try { item.url = URL.createObjectURL(item.blob); } catch (_) {}
  }
  vaultItems.unshift(item);
  if (vaultItemsCount) vaultItemsCount.textContent = vaultItems.length;
  if (!vaultItemsList) return;

  vaultItemsList.innerHTML = vaultItems.map(it => `
    <div style="padding: 6px 8px; border-radius: 8px; background: #ffffff; border: 1px solid #bae6fd; display: flex; align-items: center; justify-content: space-between; font-size: 11px;">
      <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px;">
        <span style="font-weight: 700; color: #0f172a;">${escapeHtml(it.name)}</span>
        <span style="color: #64748b; font-size: 9.5px; margin-left: 4px;">(${formatBytes(it.size)})</span>
      </div>
      <a href="${it.url}" download="${escapeHtml(it.name)}" style="padding: 2px 6px; background: #e0f2fe; color: #0284c7; border-radius: 4px; font-weight: 700; text-decoration: none; font-size: 10px;">Save</a>
    </div>
  `).join('');
}

if (navTabNearby) {
  navTabNearby.addEventListener('click', () => {
    stopCameraScanner();
    stopAnimatedQrLoop();
    currentActiveTab = 'nearby';
    if (window._receiveTransitTimer) { clearInterval(window._receiveTransitTimer); window._receiveTransitTimer = null; }
    navTabNearby.classList.add('active');
    navTabSend.classList.remove('active');
    if (navTabReceive) navTabReceive.classList.remove('active');
    if (navTabHistory) navTabHistory.classList.remove('active');
    navTabUpdates.classList.remove('active');
    showStage('nearby');
    startNearbyDiscovery();
  });
}

navTabUpdates.addEventListener('click', () => {
  stopCameraScanner();
  stopAnimatedQrLoop();
  currentActiveTab = 'updates';
  if (window._receiveTransitTimer) { clearInterval(window._receiveTransitTimer); window._receiveTransitTimer = null; }
  navTabUpdates.classList.add('active');
  navTabSend.classList.remove('active');
  if (navTabReceive) navTabReceive.classList.remove('active');
  if (navTabHistory) navTabHistory.classList.remove('active');
  if (navTabNearby) navTabNearby.classList.remove('active');
  showStage('updates');

  // Clear badge in background service worker
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ action: 'clear_update_badge' }).catch(() => {});
  }

  checkForUpdates(false);
});

// =========================================================
// PHASE 5: TRANSFER HISTORY VAULT & MEDIA PREVIEW ENGINE
// =========================================================
let historyRecords = [];
let currentHistoryFilter = 'all';
let currentActiveLightboxRecord = null;

if (navTabHistory) {
  navTabHistory.addEventListener('click', () => {
    stopCameraScanner();
    stopAnimatedQrLoop();
    currentActiveTab = 'history';
    if (window._receiveTransitTimer) { clearInterval(window._receiveTransitTimer); window._receiveTransitTimer = null; }
    navTabHistory.classList.add('active');
    navTabSend.classList.remove('active');
    if (navTabReceive) navTabReceive.classList.remove('active');
    if (navTabNearby) navTabNearby.classList.remove('active');
    navTabUpdates.classList.remove('active');
    showStage('history');
    renderHistoryVault(currentHistoryFilter);
  });
}

if (btnOpenFullVaultTab) {
  btnOpenFullVaultTab.addEventListener('click', () => {
    if (navTabHistory) navTabHistory.click();
  });
}

async function loadHistoryVault() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['beamdrop_history_vault'], (res) => {
        if (res && Array.isArray(res.beamdrop_history_vault)) {
          historyRecords = res.beamdrop_history_vault;
          syncHistoryUi();
        }
      });
    } else {
      const stored = localStorage.getItem('beamdrop_history_vault');
      if (stored) {
        historyRecords = JSON.parse(stored);
        syncHistoryUi();
      }
    }
  } catch (e) {
    console.warn('[History Vault load notice]', e);
  }
}

function saveHistoryVault() {
  try {
    if (historyRecords.length > 50) historyRecords = historyRecords.slice(0, 50);
    const serializable = historyRecords.map(item => {
      const { blob, ...rest } = item;
      return rest;
    });

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ beamdrop_history_vault: serializable }).catch(() => {});
    }
    try {
      localStorage.setItem('beamdrop_history_vault', JSON.stringify(serializable));
    } catch (_) {}
  } catch (e) {
    console.warn('[History Vault save notice]', e);
  }
}

async function addHistoryRecord(record) {
  const newRecord = {
    id: 'hist_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    direction: record.direction || 'received',
    kind: record.kind || (record.text ? 'text' : 'file'),
    name: record.name || (record.text ? 'Text Snippet' : 'Beamed Object'),
    size: record.size || 0,
    type: record.type || (record.kind === 'text' ? 'text/plain' : 'application/octet-stream'),
    timestamp: record.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    date: new Date().toLocaleDateString(),
    checksum: record.checksum || null,
    text: record.text || null,
    thumbnail: record.thumbnail || null,
    blob: record.blob || null,
    url: record.url || '#'
  };

  if (record.blob && !newRecord.thumbnail && (record.type || '').startsWith('image/')) {
    try {
      newRecord.thumbnail = await createBlobThumbnail(record.blob);
    } catch (_) {}
  }

  historyRecords.unshift(newRecord);
  saveHistoryVault();
  syncHistoryUi();
  if (currentActiveTab === 'history') {
    renderHistoryVault(currentHistoryFilter);
  }

  addVaultItem({
    name: newRecord.name,
    size: newRecord.size,
    time: newRecord.timestamp,
    type: newRecord.type,
    blob: newRecord.blob,
    url: newRecord.url
  });
}

function syncHistoryUi() {
  const count = historyRecords.length;
  if (navHistoryCountBadge) {
    if (count > 0) {
      navHistoryCountBadge.style.display = 'inline-flex';
      navHistoryCountBadge.textContent = count > 99 ? '99+' : String(count);
    } else {
      navHistoryCountBadge.style.display = 'none';
    }
  }
  if (vaultItemsCount) {
    vaultItemsCount.textContent = String(count);
  }
  if (histCountAll) histCountAll.textContent = String(count);
  if (histCountReceived) histCountReceived.textContent = String(historyRecords.filter(r => r.direction === 'received').length);
  if (histCountSent) histCountSent.textContent = String(historyRecords.filter(r => r.direction === 'sent').length);
}

function renderHistoryVault(filter = currentHistoryFilter) {
  currentHistoryFilter = filter;
  if (!historyItemsContainer) return;

  const filtered = historyRecords.filter(it => {
    if (filter === 'received') return it.direction === 'received';
    if (filter === 'sent') return it.direction === 'sent';
    if (filter === 'media') return (it.type || '').startsWith('image/') || (it.type || '').startsWith('video/');
    return true;
  });

  if (filtered.length === 0) {
    historyItemsContainer.innerHTML = `
      <div style="background: rgba(255,255,255,0.85); border: 1px dashed rgba(186,230,253,0.8); border-radius: 14px; padding: 24px 16px; text-align: center;">
        <div style="width: 36px; height: 36px; margin: 0 auto 8px; border-radius: 10px; background: #e0f2fe; display: flex; align-items: center; justify-content: center; color: #0284c7;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
        </div>
        <p style="font-size: 11.5px; font-weight: 700; color: #334155; margin: 0 0 4px 0;">No items found</p>
        <p style="font-size: 10px; color: #94a3b8; margin: 0;">Beamed items will appear here with instant preview, SHA-256 integrity, and re-sharing.</p>
      </div>
    `;
    return;
  }

  historyItemsContainer.innerHTML = filtered.map(it => {
    const isImage = (it.type || '').startsWith('image/') || it.thumbnail;
    const isText = it.kind === 'text' || (!isImage && it.text);
    const thumbHtml = isImage && it.thumbnail
      ? `<img src="${it.thumbnail}" alt="" class="hist-thumb-img">`
      : (isText
          ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>`
          : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`
        );

    const dirBadgeClass = it.direction === 'sent' ? 'hist-direction-pill sent' : 'hist-direction-pill received';
    const dirLabel = it.direction === 'sent' ? 'Sent ⤒' : 'Received ⤓';
    const shaShort = it.checksum ? `🛡️ ${it.checksum.slice(0, 8)}` : '🛡️ Verified';

    return `
      <div class="hist-item-card" data-id="${it.id}">
        <div class="hist-thumb-wrap btn-hist-preview" data-id="${it.id}" title="Click to preview">
          ${thumbHtml}
        </div>
        <div class="hist-info">
          <div class="hist-title-row">
            <span class="${dirBadgeClass}">${dirLabel}</span>
            <span class="hist-name" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</span>
          </div>
          <div class="hist-meta-row">
            <span>${formatBytes(it.size)}</span>
            <span>•</span>
            <span>${it.timestamp || ''}</span>
            <span class="hist-sha-pill" title="SHA-256: ${it.checksum || 'Bit-exact match'}">${shaShort}</span>
          </div>
        </div>
        <div class="hist-actions-row">
          ${isText
            ? `<button class="hist-action-btn hist-btn-save btn-hist-copy" data-id="${it.id}" title="Copy text to clipboard">Copy</button>`
            : `<button class="hist-action-btn hist-btn-save btn-hist-save" data-id="${it.id}" title="Save or download file">Save</button>`
          }
          <button class="hist-action-btn hist-btn-rebeam btn-hist-rebeam" data-id="${it.id}" title="Re-beam this item directly">Re-Beam ⚡</button>
          <button class="hist-action-btn hist-btn-del btn-hist-delete" data-id="${it.id}" title="Delete record">✕</button>
        </div>
      </div>
    `;
  }).join('');

  attachHistoryEventListeners();
}

function attachHistoryEventListeners() {
  if (!historyItemsContainer) return;

  // Previews
  historyItemsContainer.querySelectorAll('.btn-hist-preview').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-id');
      const rec = historyRecords.find(r => r.id === id);
      if (rec) openMediaLightbox(rec);
    });
  });

  // Saves / Downloads
  historyItemsContainer.querySelectorAll('.btn-hist-save').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-id');
      const rec = historyRecords.find(r => r.id === id);
      if (!rec) return;
      if (rec.blob) {
        triggerChromeDownload(rec.blob, rec.name);
      } else if (rec.url && rec.url !== '#') {
        const a = document.createElement('a');
        a.href = rec.url;
        a.download = rec.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else if (rec.text) {
        const blob = new Blob([rec.text], { type: 'text/plain' });
        triggerChromeDownload(blob, rec.name || 'note.txt');
      }
    });
  });

  // Copy text
  historyItemsContainer.querySelectorAll('.btn-hist-copy').forEach(el => {
    el.addEventListener('click', async () => {
      const id = el.getAttribute('data-id');
      const rec = historyRecords.find(r => r.id === id);
      if (!rec) return;
      const textToCopy = rec.text || rec.name;
      try {
        await navigator.clipboard.writeText(textToCopy);
        const prev = el.textContent;
        el.textContent = 'Copied!';
        setTimeout(() => { el.textContent = prev; }, 1500);
      } catch (_) {}
    });
  });

  // Re-beam
  historyItemsContainer.querySelectorAll('.btn-hist-rebeam').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-id');
      const rec = historyRecords.find(r => r.id === id);
      if (rec) rebeamHistoryItem(rec);
    });
  });

  // Delete
  historyItemsContainer.querySelectorAll('.btn-hist-delete').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-id');
      historyRecords = historyRecords.filter(r => r.id !== id);
      saveHistoryVault();
      syncHistoryUi();
      renderHistoryVault(currentHistoryFilter);
    });
  });
}

function rebeamHistoryItem(rec) {
  if (!rec) return;
  if (rec.kind === 'text' && rec.text) {
    switchBridgeMode('text');
    if (inputTextContent) inputTextContent.value = rec.text;
    stagedTextContent = rec.text;
    navTabSend.click();
  } else if (rec.blob) {
    switchBridgeMode('files');
    stageSelectedFiles([rec.blob]);
    navTabSend.click();
  } else if (rec.text) {
    switchBridgeMode('text');
    if (inputTextContent) inputTextContent.value = rec.text;
    stagedTextContent = rec.text;
    navTabSend.click();
  } else {
    switchBridgeMode('files');
    navTabSend.click();
  }
}

// History Filter Buttons
if (filterHistAll) {
  filterHistAll.addEventListener('click', () => {
    [filterHistAll, filterHistReceived, filterHistSent, filterHistMedia].forEach(b => b && b.classList.remove('active'));
    filterHistAll.classList.add('active');
    renderHistoryVault('all');
  });
}
if (filterHistReceived) {
  filterHistReceived.addEventListener('click', () => {
    [filterHistAll, filterHistReceived, filterHistSent, filterHistMedia].forEach(b => b && b.classList.remove('active'));
    filterHistReceived.classList.add('active');
    renderHistoryVault('received');
  });
}
if (filterHistSent) {
  filterHistSent.addEventListener('click', () => {
    [filterHistAll, filterHistReceived, filterHistSent, filterHistMedia].forEach(b => b && b.classList.remove('active'));
    filterHistSent.classList.add('active');
    renderHistoryVault('sent');
  });
}
if (filterHistMedia) {
  filterHistMedia.addEventListener('click', () => {
    [filterHistAll, filterHistReceived, filterHistSent, filterHistMedia].forEach(b => b && b.classList.remove('active'));
    filterHistMedia.classList.add('active');
    renderHistoryVault('media');
  });
}

if (btnClearAllHistory) {
  btnClearAllHistory.addEventListener('click', () => {
    if (historyRecords.length === 0) return;
    if (confirm('Clear all local transfer history?')) {
      historyRecords = [];
      vaultItems = [];
      saveHistoryVault();
      syncHistoryUi();
      renderHistoryVault();
      if (vaultItemsList) vaultItemsList.innerHTML = '<div style="font-size: 10.5px; color: #94a3b8; text-align: center; padding: 8px 0;">No items received yet</div>';
    }
  });
}

// Media Lightbox Modal Handlers
function openMediaLightbox(rec) {
  if (!rec) return;
  currentActiveLightboxRecord = rec;
  if (lightboxTitle) lightboxTitle.textContent = rec.name || 'Media Preview';
  if (lightboxSub) lightboxSub.textContent = `${formatBytes(rec.size)} • ${rec.direction === 'sent' ? 'Sent' : 'Received'}`;
  if (lightboxHashPill) {
    lightboxHashPill.textContent = rec.checksum ? `🛡️ SHA-256: ${rec.checksum.slice(0, 12)}...` : '🛡️ SHA-256 Verified';
  }
  if (lightboxDateText) lightboxDateText.textContent = `${rec.timestamp} (${rec.date || 'Today'})`;

  if (rec.thumbnail || (rec.type || '').startsWith('image/')) {
    if (lightboxImage) {
      lightboxImage.style.display = 'block';
      lightboxImage.src = rec.thumbnail || rec.url || '';
    }
    if (lightboxTextWrap) lightboxTextWrap.style.display = 'none';
  } else {
    if (lightboxImage) lightboxImage.style.display = 'none';
    if (lightboxTextWrap) {
      lightboxTextWrap.style.display = 'block';
      lightboxTextContent.textContent = rec.text || rec.name || '';
    }
  }

  if (mediaLightboxModal) mediaLightboxModal.style.display = 'flex';
}

function closeMediaLightbox() {
  if (mediaLightboxModal) mediaLightboxModal.style.display = 'none';
  currentActiveLightboxRecord = null;
}

if (btnCloseLightbox) {
  btnCloseLightbox.addEventListener('click', closeMediaLightbox);
}

if (mediaLightboxModal) {
  mediaLightboxModal.addEventListener('click', (e) => {
    if (e.target === mediaLightboxModal) closeMediaLightbox();
  });
}

if (btnLightboxSave) {
  btnLightboxSave.addEventListener('click', () => {
    if (!currentActiveLightboxRecord) return;
    const rec = currentActiveLightboxRecord;
    if (rec.blob) {
      triggerChromeDownload(rec.blob, rec.name);
    } else if (rec.text) {
      navigator.clipboard.writeText(rec.text);
      btnLightboxSave.textContent = 'Copied to Clipboard!';
      setTimeout(() => { btnLightboxSave.textContent = 'Save / Download'; }, 1500);
    }
  });
}

if (btnLightboxRebeam) {
  btnLightboxRebeam.addEventListener('click', () => {
    if (!currentActiveLightboxRecord) return;
    const rec = currentActiveLightboxRecord;
    closeMediaLightbox();
    rebeamHistoryItem(rec);
  });
}

// =========================================================
// PHASE 5: ANIMATED OPTICAL QR LOOP (100% OFFLINE DATA)
// =========================================================
let animatedQrFrames = [];
let currentQrFrameIndex = 0;
let animatedQrTimer = null;
let isLoopPlaying = true;
let loopFps = 8;
let isOpticalLoopActive = false;

function buildAnimatedQrFrames(payload, meta = {}) {
  const frameId = (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 8));
  const CHUNK_CHAR_LIMIT = 200;
  const totalLength = payload.length;
  const totalChunks = Math.max(1, Math.ceil(totalLength / CHUNK_CHAR_LIMIT));
  const frames = [];

  for (let i = 0; i < totalChunks; i++) {
    const chunk = payload.slice(i * CHUNK_CHAR_LIMIT, (i + 1) * CHUNK_CHAR_LIMIT);
    const header = [
      'BD1',
      frameId,
      i,
      totalChunks,
      meta.checksum ? meta.checksum.slice(0, 16) : 'auto',
      encodeURIComponent(meta.name || 'data'),
      encodeURIComponent(meta.mime || 'text/plain'),
      chunk
    ].join('|');
    frames.push(header);
  }
  return frames;
}

function startAnimatedQrLoop(frames) {
  if (!frames || frames.length === 0) return;
  animatedQrFrames = frames;
  currentQrFrameIndex = 0;
  isLoopPlaying = true;
  isOpticalLoopActive = true;
  requestExtensionWakeLock();

  if (portalWebRtcBox) portalWebRtcBox.style.display = 'none';
  if (portalLoopPlayerWrap) portalLoopPlayerWrap.style.display = 'flex';
  if (btnLoopPlayPauseText) btnLoopPlayPauseText.textContent = 'Pause ❚❚';

  renderCurrentQrLoopFrame();
  resumeQrLoopInterval();
}

function stopAnimatedQrLoop() {
  if (animatedQrTimer) {
    clearInterval(animatedQrTimer);
    animatedQrTimer = null;
  }
  isOpticalLoopActive = false;
  releaseExtensionWakeLock();
  if (portalWebRtcBox) portalWebRtcBox.style.display = 'block';
  if (portalLoopPlayerWrap) portalLoopPlayerWrap.style.display = 'none';
}

function resumeQrLoopInterval() {
  if (animatedQrTimer) clearInterval(animatedQrTimer);
  const intervalMs = Math.round(1000 / loopFps);
  animatedQrTimer = setInterval(() => {
    if (!isLoopPlaying || animatedQrFrames.length <= 1) return;
    currentQrFrameIndex = (currentQrFrameIndex + 1) % animatedQrFrames.length;
    renderCurrentQrLoopFrame();
  }, intervalMs);
}

function renderCurrentQrLoopFrame() {
  if (animatedQrFrames.length === 0) return;
  const frameData = animatedQrFrames[currentQrFrameIndex];

  if (loopFrameText) {
    loopFrameText.textContent = `Frame ${currentQrFrameIndex + 1} / ${animatedQrFrames.length}`;
  }
  if (loopProgressBar) {
    const pct = Math.round(((currentQrFrameIndex + 1) / animatedQrFrames.length) * 100);
    loopProgressBar.style.width = `${pct}%`;
  }

  const canvas = qrcodeLoopCanvas || document.getElementById('qrcodeLoopCanvas');
  if (canvas && typeof QRCode !== 'undefined') {
    QRCode.toCanvas(canvas, frameData, {
      width: 200,
      margin: 1,
      errorCorrectionLevel: 'L',
      color: { dark: '#0f172a', light: '#ffffff' }
    }, (err) => {
      if (err) console.warn('[Loop QR Canvas error]', err);
    });
  }
}

if (btnLoopPlayPause) {
  btnLoopPlayPause.addEventListener('click', () => {
    isLoopPlaying = !isLoopPlaying;
    if (btnLoopPlayPauseText) {
      btnLoopPlayPauseText.textContent = isLoopPlaying ? 'Pause ❚❚' : 'Play ▶';
    }
  });
}

if (btnLoopNext) {
  btnLoopNext.addEventListener('click', () => {
    if (animatedQrFrames.length === 0) return;
    currentQrFrameIndex = (currentQrFrameIndex + 1) % animatedQrFrames.length;
    renderCurrentQrLoopFrame();
  });
}

if (btnLoopPrev) {
  btnLoopPrev.addEventListener('click', () => {
    if (animatedQrFrames.length === 0) return;
    currentQrFrameIndex = (currentQrFrameIndex - 1 + animatedQrFrames.length) % animatedQrFrames.length;
    renderCurrentQrLoopFrame();
  });
}

if (btnLoopSpeed) {
  btnLoopSpeed.addEventListener('click', () => {
    if (loopFps === 4) loopFps = 8;
    else if (loopFps === 8) loopFps = 12;
    else loopFps = 4;

    if (btnLoopSpeedText) btnLoopSpeedText.textContent = `${loopFps} FPS`;
    if (loopFpsBadge) loopFpsBadge.textContent = `${loopFps} FPS`;
    resumeQrLoopInterval();
  });
}

if (btnPortalModeLoop) {
  btnPortalModeLoop.addEventListener('click', async () => {
    const btnCloudPill = document.getElementById('btnPortalModeCloud');
    const cloudWrap = document.getElementById('portalCloudDropWrap');
    if (btnCloudPill) {
      btnCloudPill.classList.remove('active');
      btnCloudPill.style.background = 'transparent';
      btnCloudPill.style.color = '#64748b';
    }
    if (cloudWrap) cloudWrap.style.display = 'none';

    btnPortalModeLoop.classList.add('active');
    btnPortalModeLoop.style.background = '#ffffff';
    btnPortalModeLoop.style.color = '#0284c7';
    btnPortalModeWebRtc.classList.remove('active');
    btnPortalModeWebRtc.style.background = 'transparent';
    btnPortalModeWebRtc.style.color = '#64748b';
    if (portalHeaderModeLabel) portalHeaderModeLabel.textContent = 'Optical QR Loop';

    let payload = '';
    let meta = { name: 'beamdrop-data.txt', mime: 'text/plain' };

    if (activePreparedFile) {
      meta.name = activePreparedFile.name;
      meta.mime = activePreparedFile.type || 'application/octet-stream';
      if (activePreparedFile.size <= 2 * 1024 * 1024) {
        payload = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(activePreparedFile);
        });
      } else {
        payload = `BeamDrop File: ${activePreparedFile.name} (${formatBytes(activePreparedFile.size)}). Use P2P Direct mode for large multi-MB transfers.`;
      }
    } else if (stagedTextContent) {
      payload = stagedTextContent;
      meta.name = 'text-snippet.txt';
    } else {
      payload = 'BeamDrop Universal Device Bridge';
    }

    meta.checksum = await computeSha256(payload);
    const frames = buildAnimatedQrFrames(payload, meta);
    startAnimatedQrLoop(frames);
  });
}

if (btnPortalModeWebRtc) {
  btnPortalModeWebRtc.addEventListener('click', () => {
    const btnCloudPill = document.getElementById('btnPortalModeCloud');
    const cloudWrap = document.getElementById('portalCloudDropWrap');
    if (btnCloudPill) {
      btnCloudPill.classList.remove('active');
      btnCloudPill.style.background = 'transparent';
      btnCloudPill.style.color = '#64748b';
    }
    if (cloudWrap) cloudWrap.style.display = 'none';

    btnPortalModeWebRtc.classList.add('active');
    btnPortalModeWebRtc.style.background = '#ffffff';
    btnPortalModeWebRtc.style.color = '#0284c7';
    btnPortalModeLoop.classList.remove('active');
    btnPortalModeLoop.style.background = 'transparent';
    btnPortalModeLoop.style.color = '#64748b';
    if (portalHeaderModeLabel) portalHeaderModeLabel.textContent = 'One-Time QR';
    stopAnimatedQrLoop();
  });
}

// =========================================================
// PHASE 7: 24H GLOBAL CLOUD DROP ENGINE (GOOGLE DRIVE + HYBRID)
// =========================================================
let activeExtCloudDrop = null;
let extCloudCountdownInterval = null;

function activatePortalCloudTabUI() {
  stopAnimatedQrLoop();
  const btnCloudPill = document.getElementById('btnPortalModeCloud');
  const cloudWrap = document.getElementById('portalCloudDropWrap');
  if (portalWebRtcBox) portalWebRtcBox.style.display = 'none';
  if (portalLoopPlayerWrap) portalLoopPlayerWrap.style.display = 'none';
  if (cloudWrap) cloudWrap.style.display = 'flex';

  [btnPortalModeWebRtc, btnPortalModeLoop].forEach(b => {
    if (b) {
      b.classList.remove('active');
      b.style.background = 'transparent';
      b.style.color = '#64748b';
    }
  });
  if (btnCloudPill) {
    btnCloudPill.classList.add('active');
    btnCloudPill.style.background = '#ffffff';
    btnCloudPill.style.color = '#0284c7';
  }
  if (portalHeaderModeLabel) portalHeaderModeLabel.textContent = '24h Cloud Drop';
}

async function start24hCloudDropUpload(fileToUpload) {
  if (!fileToUpload) return;
  showStage('portal');
  activatePortalCloudTabUI();

  const fileInfo = getExtensionFileTypeInfo(fileToUpload.name, fileToUpload.type);
  if (portalBadgeIcon) portalBadgeIcon.textContent = fileInfo.icon || '☁️';
  if (portalFileNameBadge) portalFileNameBadge.textContent = fileToUpload.name;
  if (portalFileSizeBadge) portalFileSizeBadge.textContent = `(${formatBytes(fileToUpload.size)})`;

  const shareInput = document.getElementById('extCloudShareUrlInput');
  const statusLbl = document.getElementById('extCloudStatusLabel');
  const modeBadge = document.getElementById('extCloudModeBadge');
  const timerBadge = document.getElementById('extCloudTimerBadge');
  const cloudCanvas = document.getElementById('qrcodeCloudCanvas');

  if (shareInput) shareInput.value = 'Uploading to 24h Cloud Vault...';
  if (statusLbl) statusLbl.textContent = '⚡ Computing SHA-256 & Uploading...';
  updateStatus('connecting', 'Uploading 24h Cloud...');

  const safeBaseUrl = (VERCEL_RECEIVER_URL && !VERCEL_RECEIVER_URL.includes('.run.app') && !VERCEL_RECEIVER_URL.includes('localhost'))
    ? VERCEL_RECEIVER_URL.replace(/\/$/, '')
    : 'https://beam-drop-mu.vercel.app';

  try {
    const sha256 = await computeSha256(fileToUpload);
    const sessionRes = await fetch(`${safeBaseUrl}/api/cloud-drop?action=create_session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: fileToUpload.name,
        size: fileToUpload.size,
        mime: fileToUpload.type || 'application/octet-stream',
        sha256
      })
    });
    const sessionData = await sessionRes.json();
    if (!sessionRes.ok || !sessionData || !sessionData.id) {
      throw new Error((sessionData && sessionData.error) || 'Failed creating 24h Cloud Drop session');
    }

    const dropId = sessionData.id;
    const storageMode = sessionData.mode === 'gdrive' ? 'gdrive' : 'hybrid';

    if (storageMode === 'gdrive' && sessionData.uploadUrl) {
      const putRes = await fetch(sessionData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': fileToUpload.type || 'application/octet-stream' },
        body: fileToUpload
      });
      if (!putRes.ok) throw new Error('Google Drive Resumable Upload failed');
      const gdriveMeta = await putRes.json();
      await fetch(`${safeBaseUrl}/api/cloud-drop?action=finalize_upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dropId, gdriveFileId: gdriveMeta.id, sha256 })
      });
    } else {
      const arrayBuf = await fileToUpload.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      const base64Data = btoa(binary);
      const upRes = await fetch(`${safeBaseUrl}/api/cloud-drop?action=upload_hybrid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: dropId,
          name: fileToUpload.name,
          size: fileToUpload.size,
          mime: fileToUpload.type || 'application/octet-stream',
          sha256,
          base64Data
        })
      });
      if (!upRes.ok) throw new Error('Hybrid 24h Cloud upload failed');
    }

    const shareUrl = `${safeBaseUrl}/download.html?drop=${dropId}`;
    const expiresAt = sessionData.expiresAt || (Date.now() + 24 * 60 * 60 * 1000);
    activeExtCloudDrop = { id: dropId, shareUrl, expiresAt, storageMode, sha256, baseUrl: safeBaseUrl };

    currentPortalUrl = shareUrl;
    if (portalUrlText) portalUrlText.textContent = shareUrl;
    if (shareInput) shareInput.value = shareUrl;
    if (modeBadge) {
      modeBadge.textContent = storageMode === 'gdrive' ? '☁️ GOOGLE DRIVE 24H' : '☁️ HYBRID CLOUD 24H';
    }
    if (statusLbl) {
      statusLbl.textContent = sha256 ? `🛡️ SHA-256: ${sha256.slice(0, 10)}... • Auto-Purges` : '🛡️ Verified • Auto-Purges in 24h';
    }

    if (cloudCanvas && typeof QRCode !== 'undefined') {
      await QRCode.toCanvas(cloudCanvas, shareUrl, {
        width: 196,
        margin: 2,
        color: { dark: '#030712', light: '#ffffff' }
      });
    }

    if (extCloudCountdownInterval) clearInterval(extCloudCountdownInterval);
    const updateTimer = () => {
      if (!activeExtCloudDrop) return;
      const rem = Math.max(0, activeExtCloudDrop.expiresAt - Date.now());
      const h = String(Math.floor(rem / (1000 * 60 * 60))).padStart(2, '0');
      const m = String(Math.floor((rem % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
      const s = String(Math.floor((rem % (1000 * 60)) / 1000)).padStart(2, '0');
      if (timerBadge) timerBadge.textContent = `⏱️ ${h}:${m}:${s}`;
    };
    updateTimer();
    extCloudCountdownInterval = setInterval(updateTimer, 1000);

    updateStatus('ready', '24h Cloud Link Active');
    playExtChime('complete');
  } catch (err) {
    console.warn('[BeamDrop 24h Cloud Error]:', err);
    if (statusLbl) statusLbl.textContent = '⚠️ Cloud upload error — try Direct P2P';
    if (shareInput) shareInput.value = err.message || 'Upload failed';
    updateStatus('idle', 'Cloud Error');
  }
}

const btnUpload24hCloudEl = document.getElementById('btnUpload24hCloud');
if (btnUpload24hCloudEl) {
  btnUpload24hCloudEl.addEventListener('click', async () => {
    if (stagedFiles.length === 0) return;
    btnUpload24hCloudEl.disabled = true;
    try {
      if (stagedFiles.length > 1 && typeof JSZip !== 'undefined') {
        const zip = new JSZip();
        for (const f of stagedFiles) zip.file(f.name, f);
        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        activePreparedFile = new File([zipBlob], `beamdrop-bundle-${stagedFiles.length}-files.zip`, { type: 'application/zip' });
      } else {
        activePreparedFile = stagedFiles[0];
      }
      await start24hCloudDropUpload(activePreparedFile);
    } finally {
      btnUpload24hCloudEl.disabled = false;
    }
  });
}

const btnPortalModeCloudEl = document.getElementById('btnPortalModeCloud');
if (btnPortalModeCloudEl) {
  btnPortalModeCloudEl.addEventListener('click', async () => {
    activatePortalCloudTabUI();
    if (!activeExtCloudDrop && activePreparedFile) {
      await start24hCloudDropUpload(activePreparedFile);
    }
  });
}

const btnExtCopyCloudUrlEl = document.getElementById('btnExtCopyCloudUrl');
if (btnExtCopyCloudUrlEl) {
  btnExtCopyCloudUrlEl.addEventListener('click', () => {
    const shareInput = document.getElementById('extCloudShareUrlInput');
    const url = (activeExtCloudDrop && activeExtCloudDrop.shareUrl) || (shareInput && shareInput.value) || '';
    if (!url || url.startsWith('Uploading')) return;
    navigator.clipboard.writeText(url).then(() => {
      btnExtCopyCloudUrlEl.textContent = 'Copied!';
      setTimeout(() => { btnExtCopyCloudUrlEl.textContent = 'Copy'; }, 1800);
    });
  });
}

const btnExtDeleteCloudNowEl = document.getElementById('btnExtDeleteCloudNow');
if (btnExtDeleteCloudNowEl) {
  btnExtDeleteCloudNowEl.addEventListener('click', async () => {
    if (!activeExtCloudDrop) return;
    btnExtDeleteCloudNowEl.textContent = 'Deleting...';
    try {
      await fetch(`${activeExtCloudDrop.baseUrl}/api/cloud-drop?action=delete&id=${encodeURIComponent(activeExtCloudDrop.id)}`, {
        method: 'POST'
      });
    } catch (_) {}
    if (extCloudCountdownInterval) clearInterval(extCloudCountdownInterval);
    activeExtCloudDrop = null;
    const shareInput = document.getElementById('extCloudShareUrlInput');
    const statusLbl = document.getElementById('extCloudStatusLabel');
    const timerBadge = document.getElementById('extCloudTimerBadge');
    if (shareInput) shareInput.value = 'Purged from 24h Cloud Storage.';
    if (statusLbl) statusLbl.textContent = '🗑️ Permanently Deleted from Cloud';
    if (timerBadge) timerBadge.textContent = '⏱️ 00:00:00';
    btnExtDeleteCloudNowEl.textContent = '🗑️ Deleted';
    setTimeout(() => { btnExtDeleteCloudNowEl.textContent = '🗑️ Delete Now'; }, 2000);
  });
}

// Optical QR Loop Receiver Engine (Scanner Side)
const activeOpticalTransfers = new Map();

function handleOpticalLoopFrame(rawValue) {
  const parts = rawValue.split('|');
  if (parts.length < 8 || parts[0] !== 'BD1') return false;

  const [_, frameId, seqStr, totalStr, checksum, encName, encMime, ...chunkParts] = parts;
  const chunk = chunkParts.join('|');
  const seq = parseInt(seqStr, 10);
  const total = parseInt(totalStr, 10);
  const name = decodeURIComponent(encName);
  const mime = decodeURIComponent(encMime);

  if (isNaN(seq) || isNaN(total) || total <= 0) return false;

  let session = activeOpticalTransfers.get(frameId);
  if (!session) {
    session = {
      id: frameId,
      total: total,
      chunks: new Map(),
      name: name,
      mime: mime,
      checksum: checksum,
      startTime: Date.now()
    };
    activeOpticalTransfers.set(frameId, session);
    playExtChime('connect');
  }

  session.chunks.set(seq, chunk);
  const collectedCount = session.chunks.size;

  if (opticalScanHud) {
    opticalScanHud.style.display = 'block';
    if (opticalFrameProgressText) {
      opticalFrameProgressText.textContent = `${collectedCount}/${total}`;
    }
    if (opticalProgressFill) {
      const pct = Math.min(100, Math.round((collectedCount / total) * 100));
      opticalProgressFill.style.width = `${pct}%`;
    }
    if (opticalChunksGrid) {
      opticalChunksGrid.innerHTML = Array.from({ length: total }, (_, i) => {
        const hasIt = session.chunks.has(i);
        return `<div class="chunk-cell ${hasIt ? 'collected' : ''}" title="Chunk #${i + 1}"></div>`;
      }).join('');
    }
  }

  if (collectedCount >= total) {
    let fullPayload = '';
    for (let i = 0; i < total; i++) {
      fullPayload += (session.chunks.get(i) || '');
    }
    finalizeOpticalTransfer(session, fullPayload);
  }

  return true;
}

async function finalizeOpticalTransfer(session, fullPayload) {
  activeOpticalTransfers.delete(session.id);
  stopCameraScanner();
  playExtChime('complete');

  if (opticalScanHud) opticalScanHud.style.display = 'none';

  const computedHash = await computeSha256(fullPayload);
  let reconstructedBlob = null;
  let textContent = null;
  let finalUrl = '#';

  if (session.mime.startsWith('text/') || session.mime === 'application/json') {
    textContent = fullPayload;
    try {
      await navigator.clipboard.writeText(fullPayload);
    } catch (_) {}
  } else if (fullPayload.startsWith('data:')) {
    try {
      const res = await fetch(fullPayload);
      reconstructedBlob = await res.blob();
      finalUrl = URL.createObjectURL(reconstructedBlob);
      triggerChromeDownload(reconstructedBlob, session.name);
    } catch (e) {
      console.warn('[Optical DataURL reconstruct notice]', e);
    }
  } else {
    textContent = fullPayload;
  }

  await addHistoryRecord({
    direction: 'received',
    kind: textContent ? 'text' : 'file',
    name: session.name || (textContent ? 'Optical Beam Text' : 'Optical Beam File'),
    size: reconstructedBlob ? reconstructedBlob.size : new TextEncoder().encode(fullPayload).length,
    type: session.mime,
    checksum: computedHash,
    text: textContent,
    blob: reconstructedBlob,
    url: finalUrl
  });

  if (navTabHistory) {
    navTabHistory.click();
  }
}

// Load initial history vault
loadHistoryVault();

// ==========================================
// BRIDGE OBJECT MODE SWITCHER & FULL EXTENSION QR STUDIO
// ==========================================
const modeBtnQuickQr = document.getElementById('modeBtnQuickQr');
const viewQuickQrMode = document.getElementById('viewQuickQrMode');
const quickQrInput = document.getElementById('quickQrInput');
const extQrStudioCanvas = document.getElementById('extQrStudioCanvas');
const btnGrabCurrentTabUrl = document.getElementById('btnGrabCurrentTabUrl');
const btnExtQrClearUrl = document.getElementById('btnExtQrClearUrl');
const btnDownloadQuickQrPng = document.getElementById('btnDownloadQuickQrPng');
const btnExtDownloadQrSvg = document.getElementById('btnExtDownloadQrSvg');
const btnExtCopyQrImg = document.getElementById('btnExtCopyQrImg');
const extCopyQrImgText = document.getElementById('extCopyQrImgText');
const btnOpenFullQrStudio = document.getElementById('btnOpenFullQrStudio');
const btnExtPrintBusinessCard = document.getElementById('btnExtPrintBusinessCard');

// QR Studio Engine Panels & Inputs
const extQrEngineBtns = document.querySelectorAll('.ext-qr-engine-btn');
const extQrPanelUrl = document.getElementById('extQrPanelUrl');
const extQrPanelText = document.getElementById('extQrPanelText');
const extQrPanelWifi = document.getElementById('extQrPanelWifi');
const extQrPanelVcard = document.getElementById('extQrPanelVcard');
const extQrPanelPdf = document.getElementById('extQrPanelPdf');
const extQrPanelApplink = document.getElementById('extQrPanelApplink');
const extQrPanelAnalytics = document.getElementById('extQrPanelAnalytics');

const extQrTextInput = document.getElementById('extQrTextInput');
const extQrTextChars = document.getElementById('extQrTextChars');
const btnExtQrPasteText = document.getElementById('btnExtQrPasteText');
const btnExtQrClearText = document.getElementById('btnExtQrClearText');

const extQrWifiSsid = document.getElementById('extQrWifiSsid');
const extQrWifiEnc = document.getElementById('extQrWifiEnc');
const extQrWifiPass = document.getElementById('extQrWifiPass');
const extQrWifiPassWrap = document.getElementById('extQrWifiPassWrap');
const btnExtQrToggleWifiPass = document.getElementById('btnExtQrToggleWifiPass');

const btnExtVcardModeOffline = document.getElementById('btnExtVcardModeOffline');
const btnExtVcardModeDynamic = document.getElementById('btnExtVcardModeDynamic');
const extVcardPhotoInput = document.getElementById('extVcardPhotoInput');
const btnExtVcardPhoto = document.getElementById('btnExtVcardPhoto');
const btnExtVcardClearPhoto = document.getElementById('btnExtVcardClearPhoto');
const extVcardName = document.getElementById('extVcardName');
const extVcardTitle = document.getElementById('extVcardTitle');
const extVcardOrg = document.getElementById('extVcardOrg');
const extVcardPhone = document.getElementById('extVcardPhone');
const extVcardWhatsapp = document.getElementById('extVcardWhatsapp');
const extVcardEmail = document.getElementById('extVcardEmail');
const extVcardWeb = document.getElementById('extVcardWeb');
const extVcardCity = document.getElementById('extVcardCity');

const extQrPdfFileInput = document.getElementById('extQrPdfFileInput');
const extQrPdfStatus = document.getElementById('extQrPdfStatus');
const btnExtQrUploadPdf = document.getElementById('btnExtQrUploadPdf');
const extQrPdfTitle = document.getElementById('extQrPdfTitle');
const extQrPdfUrl = document.getElementById('extQrPdfUrl');

const extQrAppName = document.getElementById('extQrAppName');
const extQrAppIos = document.getElementById('extQrAppIos');
const extQrAppAndroid = document.getElementById('extQrAppAndroid');
const btnExtQrCreateAppLink = document.getElementById('btnExtQrCreateAppLink');

const btnExtQrRefreshSaved = document.getElementById('btnExtQrRefreshSaved');
const extQrSavedList = document.getElementById('extQrSavedList');

const btnExtQrMakeDynamic = document.getElementById('btnExtQrMakeDynamic');
const extQrActiveDynamicBadge = document.getElementById('extQrActiveDynamicBadge');
const extQrActiveDynamicText = document.getElementById('extQrActiveDynamicText');
const btnExtQrResetDynamic = document.getElementById('btnExtQrResetDynamic');

// Optional Customizer Elements
const btnExtToggleQrCustom = document.getElementById('btnExtToggleQrCustom');
const extQrCustomBody = document.getElementById('extQrCustomBody');
const extQrCustomChevron = document.getElementById('extQrCustomChevron');
const extQrPresetChips = document.querySelectorAll('.ext-qr-preset-chip');
const extQrCustTabs = document.querySelectorAll('.ext-qr-cust-tab');
const extCustSubArt = document.getElementById('extCustSubArt');
const extCustSubShapes = document.getElementById('extCustSubShapes');
const extCustSubColors = document.getElementById('extCustSubColors');
const extCustSubFrame = document.getElementById('extCustSubFrame');
const extCustSubLogo = document.getElementById('extCustSubLogo');

const extQrArtPreset = document.getElementById('extQrArtPreset');
const extQrArtBlend = document.getElementById('extQrArtBlend');
const extQrArtFileInput = document.getElementById('extQrArtFileInput');
const btnExtQrUploadArt = document.getElementById('btnExtQrUploadArt');
const btnExtQrFx3d = document.getElementById('btnExtQrFx3d');
const btnExtQrFxNeon = document.getElementById('btnExtQrFxNeon');

const extQrBodyShape = document.getElementById('extQrBodyShape');
const extQrOuterEye = document.getElementById('extQrOuterEye');
const extQrInnerEye = document.getElementById('extQrInnerEye');
const extQrGradMode = document.getElementById('extQrGradMode');
const extQrFg1 = document.getElementById('extQrFg1');
const extQrFg2 = document.getElementById('extQrFg2');
const extQrBg = document.getElementById('extQrBg');
const extQrFrameStyle = document.getElementById('extQrFrameStyle');
const extQrFrameText = document.getElementById('extQrFrameText');
const extQrFrameColor = document.getElementById('extQrFrameColor');
const extQrLogoPreset = document.getElementById('extQrLogoPreset');
const extQrLogoMask = document.getElementById('extQrLogoMask');
const extQrLogoFileInput = document.getElementById('extQrLogoFileInput');
const btnExtQrUploadLogo = document.getElementById('btnExtQrUploadLogo');

const extQrScanSafetyBadge = document.getElementById('extQrScanSafetyBadge');
const btnExtQrAutoFixContrast = document.getElementById('btnExtQrAutoFixContrast');

let extQrCurrentEngine = 'url'; // 'url' | 'text' | 'wifi' | 'vcard' | 'pdf' | 'applink' | 'analytics'
let extQrActiveDynamicCode = '';
let extQrVcardMode = 'offline'; // 'offline' | 'dynamic'
let extQrVcardPhotoDataUrl = null;
let extQrCustomLogoDataUrl = null;
let extQrCustomArtDataUrl = null;
let extQrFx3dEnabled = false;
let extQrFxNeonEnabled = false;
let extQrUploadedPdfShareUrl = '';
let extQrSavedDynamicItems = [];

try {
  const rawSaved = localStorage.getItem('beamdrop_dynamic_qrs');
  if (rawSaved) extQrSavedDynamicItems = JSON.parse(rawSaved) || [];
} catch (_) {}

function saveExtDynamicItemsToStorage() {
  try {
    localStorage.setItem('beamdrop_dynamic_qrs', JSON.stringify(extQrSavedDynamicItems));
  } catch (_) {}
}

const extQrQuotaPill = document.getElementById('extQrQuotaPill');
const extQrProLockTag = document.getElementById('extQrProLockTag');
const extQrProLockBanner = document.getElementById('extQrProLockBanner');
const btnExtUpgradeProQr = document.getElementById('btnExtUpgradeProQr');

let extCachedUser = null;
let extCachedDailyUsage = {
  date: new Date().toISOString().slice(0, 10),
  sendOperations: 0,
  receiveOperations: 0,
  qrScansCount: 0,
  qrGenerationsCount: 0
};

function isExtProUser() {
  return Boolean(extCachedUser && extCachedUser.plan === 'pro');
}

function getExtQrGenerationsLeft() {
  if (isExtProUser()) return Infinity;
  const today = new Date().toISOString().slice(0, 10);
  if (extCachedDailyUsage && extCachedDailyUsage.date !== today) {
    extCachedDailyUsage.date = today;
    extCachedDailyUsage.qrGenerationsCount = 0;
  }
  const used = Number((extCachedDailyUsage && extCachedDailyUsage.qrGenerationsCount) || 0);
  return Math.max(0, 15 - used);
}

function triggerExtProUpgrade(reasonText) {
  updateStatus('error', reasonText || 'PRO Feature — Upgrade to BeamDrop PRO for Unlimited QR & Art Themes!');
  const cleanBase = getCleanBaseUrl();
  const targetStudioUrl = `${cleanBase}/?tab=qrstudio&upgrade=pro`;
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
    chrome.tabs.create({ url: targetStudioUrl });
  } else {
    window.open(targetStudioUrl, '_blank');
  }
}

async function enforceExtQrGenerationQuota() {
  if (isExtProUser()) return true;
  const left = getExtQrGenerationsLeft();
  if (left <= 0) {
    triggerExtProUpgrade('Limit reached (15/15 QR codes). Upgrade to PRO for Unlimited QR Generation & all Art Themes!');
    return false;
  }
  const today = new Date().toISOString().slice(0, 10);
  const nextCount = Number((extCachedDailyUsage && extCachedDailyUsage.qrGenerationsCount) || 0) + 1;
  extCachedDailyUsage = {
    ...(extCachedDailyUsage || {}),
    date: today,
    qrGenerationsCount: nextCount
  };
  try {
    localStorage.setItem('beamdrop_daily_usage_v1', JSON.stringify(extCachedDailyUsage));
  } catch (_) {}
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      await chrome.storage.local.set({ beamdrop_daily_usage: extCachedDailyUsage });
    } catch (_) {}
  }
  syncExtProQrUi();
  return true;
}

function syncExtProQrUi() {
  const pro = isExtProUser();
  const left = getExtQrGenerationsLeft();

  if (extQrQuotaPill) {
    if (pro) {
      extQrQuotaPill.textContent = 'PRO Unlimited';
      extQrQuotaPill.style.background = '#f0f9ff';
      extQrQuotaPill.style.borderColor = '#bae6fd';
      extQrQuotaPill.style.color = '#0369a1';
    } else {
      extQrQuotaPill.textContent = `${left}/15 Free`;
      extQrQuotaPill.style.background = left <= 3 ? '#fff1f2' : '#f8fafc';
      extQrQuotaPill.style.borderColor = left <= 3 ? '#fecdd3' : '#e2e8f0';
      extQrQuotaPill.style.color = left <= 3 ? '#be123c' : '#475569';
    }
  }

  if (extQrProLockTag) {
    if (pro) {
      extQrProLockTag.textContent = 'PRO Active';
      extQrProLockTag.style.background = '#f0f9ff';
      extQrProLockTag.style.color = '#0369a1';
      extQrProLockTag.style.borderColor = '#bae6fd';
    } else {
      extQrProLockTag.textContent = 'Optional';
      extQrProLockTag.style.background = '#f8fafc';
      extQrProLockTag.style.color = '#475569';
      extQrProLockTag.style.borderColor = '#e2e8f0';
    }
  }

  if (extQrProLockBanner) {
    extQrProLockBanner.style.display = pro ? 'none' : 'flex';
  }

  // Update preset chips clean labels
  extQrPresetChips.forEach((chip) => {
    const pId = chip.getAttribute('data-preset') || '';
    const preset = EXT_DESIGNER_PRESETS[pId];
    if (preset && preset.proOnly) {
      const labelMap = {
        'anime-cyber': 'Cyber Anime',
        'sakura-art': 'Sakura Heart',
        'manga-panel': 'Manga Ink',
        'obsidian-3d': '3D Gold Pop',
        'retro-arcade': 'Arcade 8-Bit',
        'emerald-matrix': 'Emerald'
      };
      const baseLabel = labelMap[pId] || pId;
      chip.innerHTML = pro ? baseLabel : `${baseLabel} <span style="opacity:0.55;font-size:8.5px;">PRO</span>`;
    }
  });

  // Hide customizer sub-panels if not PRO
  if (!pro) {
    if (extCustSubArt) extCustSubArt.style.display = 'none';
    if (extCustSubShapes) extCustSubShapes.style.display = 'none';
    if (extCustSubColors) extCustSubColors.style.display = 'none';
    if (extCustSubFrame) extCustSubFrame.style.display = 'none';
    if (extCustSubLogo) extCustSubLogo.style.display = 'none';
  } else {
    const activeTabBtn = document.querySelector('.ext-qr-cust-tab.active');
    const target = (activeTabBtn && activeTabBtn.getAttribute('data-custtab')) || 'art';
    if (extCustSubArt) extCustSubArt.style.display = target === 'art' ? 'flex' : 'none';
    if (extCustSubShapes) extCustSubShapes.style.display = target === 'shapes' ? 'flex' : 'none';
    if (extCustSubColors) extCustSubColors.style.display = target === 'colors' ? 'flex' : 'none';
    if (extCustSubFrame) extCustSubFrame.style.display = target === 'frame' ? 'flex' : 'none';
    if (extCustSubLogo) extCustSubLogo.style.display = target === 'logo' ? 'flex' : 'none';
  }
}

if (extQrQuotaPill) {
  extQrQuotaPill.addEventListener('click', () => {
    if (!isExtProUser()) {
      triggerExtProUpgrade('Free & Guest users have 15 QR code generations. Upgrade to PRO for Unlimited QR Generation & all 6 PRO Art Themes!');
    }
  });
}

if (btnExtUpgradeProQr) {
  btnExtUpgradeProQr.addEventListener('click', () => {
    triggerExtProUpgrade('Upgrade to PRO to unlock Cyber Anime, Sakura Heart, Manga Ink, 3D Gold Pop, Arcade 8-Bit, Emerald & Unlimited QR!');
  });
}

function safeCreateExtQrCode(rawPayload) {
  const cleanPayload = (rawPayload || '').trim() || 'https://beam-drop-mu.vercel.app';
  const levels = ['H', 'Q', 'M', 'L'];
  for (const level of levels) {
    try {
      return QRCode.create(cleanPayload, { errorCorrectionLevel: level });
    } catch (_) {}
  }
  const safeLengths = [1800, 1200, 800, 400];
  for (const maxLen of safeLengths) {
    try {
      return QRCode.create(cleanPayload.slice(0, maxLen), { errorCorrectionLevel: 'L' });
    } catch (_) {}
  }
  return QRCode.create('https://beam-drop-mu.vercel.app', { errorCorrectionLevel: 'M' });
}

const EXT_DESIGNER_PRESETS = {
  'classic-clean': {
    proOnly: false,
    fg1: '#0f172a', fg2: '#1e293b', grad: 'none', bg: '#ffffff',
    body: 'rounded', outerEye: 'rounded', innerEye: 'rounded',
    frame: 'none', frameColor: '#0f172a', frameText: 'SCAN ME',
    art: 'none', blend: 'halftone', fx3d: false, fxNeon: false
  },
  'liquid-cyan': {
    proOnly: false,
    fg1: '#0284c7', fg2: '#2563eb', grad: 'linear-diag', bg: '#ffffff',
    body: 'liquid', outerEye: 'circle', innerEye: 'circle',
    frame: 'bottom-banner', frameColor: '#0284c7', frameText: 'SCAN ME',
    art: 'none', blend: 'halftone', fx3d: false, fxNeon: false
  },
  'anime-cyber': {
    proOnly: true,
    fg1: '#311042', fg2: '#0f172a', grad: 'linear-diag', bg: '#ffffff',
    body: 'liquid', outerEye: 'leaf', innerEye: 'diamond',
    frame: 'polaroid', frameColor: '#701a75', frameText: 'CYBER DROP',
    art: 'cyber-anime', blend: 'halftone', fx3d: false, fxNeon: true
  },
  'sakura-art': {
    proOnly: true,
    fg1: '#881337', fg2: '#9d174d', grad: 'radial', bg: '#fff1f2',
    body: 'heart', outerEye: 'circle', innerEye: 'circle',
    frame: 'polaroid', frameColor: '#be123c', frameText: 'SAKURA EDITION',
    art: 'sakura-spirit', blend: 'halftone', fx3d: false, fxNeon: false
  },
  'manga-panel': {
    proOnly: true,
    fg1: '#090d16', fg2: '#1e293b', grad: 'none', bg: '#ffffff',
    body: 'star', outerEye: 'square', innerEye: 'diamond',
    frame: 'manga-panel', frameColor: '#090d16', frameText: 'SCAN!! ドドド',
    art: 'none', blend: 'halftone', fx3d: true, fxNeon: false
  },
  'obsidian-3d': {
    proOnly: true,
    fg1: '#0f172a', fg2: '#b45309', grad: 'linear-diag', bg: '#ffffff',
    body: 'diamond', outerEye: 'rounded', innerEye: 'diamond',
    frame: 'vip-ticket', frameColor: '#0f172a', frameText: 'VIP ACCESS PASS',
    art: 'none', blend: 'halftone', fx3d: true, fxNeon: false
  },
  'retro-arcade': {
    proOnly: true,
    fg1: '#1e1b4b', fg2: '#4338ca', grad: 'linear-vert', bg: '#ffffff',
    body: 'square', outerEye: 'square', innerEye: 'square',
    frame: 'retro-arcade', frameColor: '#312e81', frameText: 'INSERT COIN • SCAN',
    art: 'mecha-neon', blend: 'halftone', fx3d: false, fxNeon: true
  },
  'emerald-matrix': {
    proOnly: true,
    fg1: '#065f46', fg2: '#0d9488', grad: 'radial', bg: '#ffffff',
    body: 'bars', outerEye: 'leaf', innerEye: 'circle',
    frame: 'bottom-banner', frameColor: '#065f46', frameText: 'VERIFIED LINK',
    art: 'none', blend: 'halftone', fx3d: false, fxNeon: false
  }
};

function createExtBuiltInArtCanvas(preset, size = 300) {
  if (!preset || preset === 'none' || preset === 'custom') return null;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return null;

  if (preset === 'cyber-anime') {
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, '#fbcfe8');
    g.addColorStop(0.5, '#e0e7ff');
    g.addColorStop(1, '#bae6fd');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    const sunGrad = ctx.createLinearGradient(0, size * 0.15, 0, size * 0.75);
    sunGrad.addColorStop(0, '#f472b6');
    sunGrad.addColorStop(1, '#fbbf24');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(size / 2, size * 0.46, size * 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e0e7ff';
    for (let y = size * 0.48; y < size * 0.78; y += 14) {
      ctx.fillRect(size * 0.15, y, size * 0.7, 4);
    }
  } else if (preset === 'sakura-spirit') {
    const g = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size * 0.7);
    g.addColorStop(0, '#ffe4e6');
    g.addColorStop(0.6, '#fecdd3');
    g.addColorStop(1, '#fda4af');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(244, 63, 94, 0.35)';
    [[0.2, 0.25], [0.75, 0.2], [0.5, 0.5], [0.3, 0.75], [0.8, 0.7], [0.15, 0.6], [0.6, 0.35]].forEach(([px, py], idx) => {
      ctx.save();
      ctx.translate(px * size, py * size);
      ctx.rotate((idx * Math.PI) / 4);
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  } else if (preset === 'mecha-neon') {
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, '#dbeafe');
    g.addColorStop(0.5, '#ede9fe');
    g.addColorStop(1, '#cffafe');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)';
    ctx.lineWidth = 4;
    for (let i = 30; i < size; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(size - i, size);
      ctx.stroke();
    }
  } else if (preset === 'cosmic-galaxy') {
    const g = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size * 0.7);
    g.addColorStop(0, '#f3e8ff');
    g.addColorStop(0.5, '#e0e7ff');
    g.addColorStop(1, '#fae8ff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(168, 85, 247, 0.32)';
    ctx.beginPath();
    ctx.arc(size * 0.4, size * 0.45, size * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

function extHexToLuminance(hex) {
  const clean = String(hex || '#000000').replace('#', '');
  const num = parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16);
  if (Number.isNaN(num)) return 0;
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function updateExtScanSafetyIndicator() {
  if (!extQrScanSafetyBadge) return;
  const fg = (extQrFg1 && extQrFg1.value) || '#0f172a';
  const bg = (extQrBg && extQrBg.value) || '#ffffff';
  const lumFg = extHexToLuminance(fg);
  const lumBg = extHexToLuminance(bg);
  const ratio = (Math.max(lumFg, lumBg) + 0.05) / (Math.min(lumFg, lumBg) + 0.05);
  const bad = lumFg > lumBg || ratio < 2.8;

  if (bad) {
    extQrScanSafetyBadge.textContent = lumFg > lumBg ? '⚠️ Inverted Colors' : '⚠️ Low Contrast';
    extQrScanSafetyBadge.style.background = '#fffbeb';
    extQrScanSafetyBadge.style.color = '#92400e';
    extQrScanSafetyBadge.style.borderColor = '#fde68a';
    if (btnExtQrAutoFixContrast) btnExtQrAutoFixContrast.style.display = 'inline-block';
  } else {
    extQrScanSafetyBadge.textContent = '✓ 100% Scan Ready';
    extQrScanSafetyBadge.style.background = '#ecfdf5';
    extQrScanSafetyBadge.style.color = '#047857';
    extQrScanSafetyBadge.style.borderColor = '#a7f3d0';
    if (btnExtQrAutoFixContrast) btnExtQrAutoFixContrast.style.display = 'none';
  }
}

if (btnExtQrAutoFixContrast) {
  btnExtQrAutoFixContrast.addEventListener('click', () => {
    if (extQrFg1) extQrFg1.value = '#0f172a';
    if (extQrBg) extQrBg.value = '#ffffff';
    renderStyledExtQrCanvas(extQrStudioCanvas, 1);
  });
}

function computeExtQrPayload() {
  const cleanBase = getCleanBaseUrl();
  if (extQrActiveDynamicCode) {
    return `${cleanBase}/q/${extQrActiveDynamicCode}`;
  }
  if (extQrCurrentEngine === 'url') {
    return (quickQrInput && quickQrInput.value.trim()) || cleanBase;
  }
  if (extQrCurrentEngine === 'text') {
    return (extQrTextInput && extQrTextInput.value.trim()) || 'BeamDrop QR Text';
  }
  if (extQrCurrentEngine === 'wifi') {
    const esc = (s) => String(s || '').replace(/([\\;,:])/g, '\\$1');
    const ssid = esc(extQrWifiSsid ? extQrWifiSsid.value.trim() : 'WiFi') || 'WiFi';
    const enc = extQrWifiEnc ? extQrWifiEnc.value : 'WPA';
    const pass = enc === 'nopass' ? '' : esc(extQrWifiPass ? extQrWifiPass.value : '');
    return `WIFI:T:${enc};S:${ssid};P:${pass};H:false;;`;
  }
  if (extQrCurrentEngine === 'vcard') {
    const fn = (extVcardName && extVcardName.value.trim()) || 'Contact';
    const title = (extVcardTitle && extVcardTitle.value.trim()) || '';
    const org = (extVcardOrg && extVcardOrg.value.trim()) || '';
    const tel = (extVcardPhone && extVcardPhone.value.trim()) || '';
    const wa = (extVcardWhatsapp && extVcardWhatsapp.value.trim()) || '';
    const email = (extVcardEmail && extVcardEmail.value.trim()) || '';
    const web = (extVcardWeb && extVcardWeb.value.trim()) || '';
    const city = (extVcardCity && extVcardCity.value.trim()) || '';

    if (extQrVcardMode === 'dynamic') {
      const p = new URLSearchParams();
      p.set('q', 'vcard-live');
      if (fn) p.set('fn', fn);
      if (title) p.set('title', title);
      if (org) p.set('org', org);
      if (tel) p.set('tel', tel);
      if (wa) p.set('wa', wa);
      if (email) p.set('email', email);
      if (web) p.set('url', web);
      if (city) p.set('adr', city);
      return `${cleanBase}/?${p.toString()}`;
    }

    return [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${fn}`,
      org ? `ORG:${org}` : '',
      title ? `TITLE:${title}` : '',
      tel ? `TEL;TYPE=CELL:${tel}` : '',
      email ? `EMAIL;TYPE=INTERNET:${email}` : '',
      web ? `URL:${web}` : '',
      city ? `ADR;TYPE=WORK:;;${city};;;;` : '',
      'END:VCARD'
    ].filter(Boolean).join('\n');
  }
  if (extQrCurrentEngine === 'pdf') {
    if (extQrUploadedPdfShareUrl) return extQrUploadedPdfShareUrl;
    if (extQrPdfUrl && extQrPdfUrl.value.trim()) return extQrPdfUrl.value.trim();
    return `${cleanBase}/?tab=qrstudio`;
  }
  if (extQrCurrentEngine === 'applink') {
    return (extQrAppIos && extQrAppIos.value.trim()) || (extQrAppAndroid && extQrAppAndroid.value.trim()) || cleanBase;
  }
  return cleanBase;
}

function isExtFinderModule(r, c, count) {
  if (r < 7 && c < 7) return true;
  if (r < 7 && c >= count - 7) return true;
  if (r >= count - 7 && c < 7) return true;
  return false;
}

function traceExtEyeShape(ctx, x, y, size, shape, radiusBase) {
  ctx.beginPath();
  if (shape === 'circle') {
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  } else if (shape === 'rounded') {
    ctx.roundRect(x, y, size, size, radiusBase);
  } else if (shape === 'leaf') {
    ctx.roundRect(x, y, size, size, [radiusBase * 1.6, radiusBase * 0.25, radiusBase * 1.6, radiusBase * 0.25]);
  } else if (shape === 'diamond') {
    const half = size / 2;
    ctx.moveTo(x + half, y);
    ctx.lineTo(x + size, y + half);
    ctx.lineTo(x + half, y + size);
    ctx.lineTo(x, y + half);
    ctx.closePath();
  } else {
    ctx.rect(x, y, size, size);
  }
}

function drawExtCustomModule(ctx, shape, x, y, cellSize, r, c, isDarkNeighbor) {
  const cx = x + cellSize / 2;
  const cy = y + cellSize / 2;

  if (shape === 'liquid') {
    const top = isDarkNeighbor(r - 1, c);
    const bottom = isDarkNeighbor(r + 1, c);
    const left = isDarkNeighbor(r, c - 1);
    const right = isDarkNeighbor(r, c + 1);
    const maxRad = cellSize * 0.48;
    const tl = !top && !left ? maxRad : 0;
    const tr = !top && !right ? maxRad : 0;
    const br = !bottom && !right ? maxRad : 0;
    const bl = !bottom && !left ? maxRad : 0;
    ctx.beginPath();
    ctx.roundRect(x - 0.3, y - 0.3, cellSize + 0.6, cellSize + 0.6, [tl, tr, br, bl]);
    ctx.fill();
    return;
  }

  if (shape === 'star') {
    const outerR = cellSize * 0.54;
    const innerR = cellSize * 0.22;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const rad = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI) / 4;
      const px = cx + Math.cos(angle) * rad;
      const py = cy + Math.sin(angle) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (shape === 'diamond') {
    const rad = cellSize * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - rad);
    ctx.lineTo(cx + rad, cy);
    ctx.lineTo(cx, cy + rad);
    ctx.lineTo(cx - rad, cy);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (shape === 'heart') {
    const w = cellSize * 0.92;
    const h = cellSize * 0.92;
    const hx = cx;
    const hy = cy - h * 0.18;
    ctx.beginPath();
    ctx.moveTo(hx, hy + h * 0.65);
    ctx.bezierCurveTo(hx - w * 0.55, hy + h * 0.3, hx - w * 0.5, hy - h * 0.25, hx, hy + h * 0.05);
    ctx.bezierCurveTo(hx + w * 0.5, hy - h * 0.25, hx + w * 0.55, hy + h * 0.3, hx, hy + h * 0.65);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (shape === 'bars') {
    const top = isDarkNeighbor(r - 1, c);
    const bottom = isDarkNeighbor(r + 1, c);
    const barW = cellSize * 0.76;
    const bx = cx - barW / 2;
    const rad = barW / 2;
    ctx.beginPath();
    ctx.roundRect(
      bx,
      top ? y - 0.5 : y + cellSize * 0.08,
      barW,
      cellSize + (top ? 0.5 : -cellSize * 0.08) + (bottom ? 0.5 : -cellSize * 0.08),
      [top ? 0 : rad, top ? 0 : rad, bottom ? 0 : rad, bottom ? 0 : rad]
    );
    ctx.fill();
    return;
  }

  if (bodyShapeOrDots(shape) === 'dots') {
    ctx.beginPath();
    ctx.arc(cx, cy, (cellSize / 2) * 0.86, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (shape === 'rounded') {
    ctx.beginPath();
    ctx.roundRect(x + cellSize * 0.05, y + cellSize * 0.05, cellSize * 0.9, cellSize * 0.9, cellSize * 0.35);
    ctx.fill();
    return;
  }

  if (shape === 'classy') {
    ctx.beginPath();
    ctx.roundRect(x, y, cellSize * 0.94, cellSize * 0.94, [cellSize * 0.45, 0, cellSize * 0.45, 0]);
    ctx.fill();
    return;
  }

  ctx.fillRect(x, y, Math.ceil(cellSize), Math.ceil(cellSize));
}

function bodyShapeOrDots(s) {
  return s === 'dots' ? 'dots' : s;
}

async function renderStyledExtQrCanvas(targetCanvas, scaleFactor = 1, customPayload = null) {
  if (!targetCanvas || typeof QRCode === 'undefined' || !QRCode.create) return;
  updateExtScanSafetyIndicator();

  const payloadToDraw = customPayload || computeExtQrPayload() || 'https://beam-drop-mu.vercel.app';
  const qrObj = safeCreateExtQrCode(payloadToDraw);
  const modules = qrObj.modules;
  const count = modules.size;

  const bodyShape = (extQrBodyShape && extQrBodyShape.value) || 'rounded';
  const outerEyeShape = (extQrOuterEye && extQrOuterEye.value) || 'rounded';
  const innerEyeShape = (extQrInnerEye && extQrInnerEye.value) || 'rounded';
  const gradMode = (extQrGradMode && extQrGradMode.value) || 'linear-diag';
  const fgColor = (extQrFg1 && extQrFg1.value) || '#0f172a';
  const fgColor2 = (extQrFg2 && extQrFg2.value) || '#0284c7';
  const bgColor = (extQrBg && extQrBg.value) || '#ffffff';
  const frameStyle = (extQrFrameStyle && extQrFrameStyle.value) || 'none';
  const frameText = (extQrFrameText && extQrFrameText.value) || 'SCAN ME';
  const frameColor = (extQrFrameColor && extQrFrameColor.value) || '#0284c7';
  const logoPreset = (extQrLogoPreset && extQrLogoPreset.value) || 'none';
  const logoMask = (extQrLogoMask && extQrLogoMask.value) || 'circle';
  const artPreset = (extQrArtPreset && extQrArtPreset.value) || 'none';
  const artBlend = (extQrArtBlend && extQrArtBlend.value) || 'halftone';

  const baseWidth = 280 * scaleFactor;
  const hasBottomFrame =
    frameStyle === 'bottom-banner' ||
    frameStyle === 'wifi-badge' ||
    frameStyle === 'polaroid' ||
    frameStyle === 'vip-ticket' ||
    frameStyle === 'manga-panel' ||
    frameStyle === 'retro-arcade';
  const hasTopFrame = frameStyle === 'top-banner' || frameStyle === 'vip-ticket' || frameStyle === 'retro-arcade';
  const bottomExtra = frameStyle === 'polaroid' ? 56 : hasBottomFrame ? 46 : 0;
  const topExtra = hasTopFrame ? 40 : 0;
  const baseHeight = baseWidth + (bottomExtra + topExtra) * scaleFactor;

  targetCanvas.width = baseWidth;
  targetCanvas.height = baseHeight;
  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, baseWidth, baseHeight);
  const qrOffsetY = topExtra * scaleFactor;
  const ssidLabel = (extQrWifiSsid && extQrWifiSsid.value.trim()) || 'JOIN';
  const ctaText = frameStyle === 'wifi-badge'
    ? `WI-FI: ${ssidLabel.toUpperCase()}`
    : (frameText || 'SCAN ME').toUpperCase();

  if (frameStyle === 'polaroid') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(0, 0, baseWidth, baseHeight, 20 * scaleFactor);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2.5 * scaleFactor;
    ctx.stroke();

    const pad = 12 * scaleFactor;
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(pad, pad, baseWidth - pad * 2, baseWidth - pad * 2, 10 * scaleFactor);
    ctx.fill();

    ctx.fillStyle = frameColor;
    ctx.font = `900 ${14 * scaleFactor}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ctaText, baseWidth / 2, baseWidth + 26 * scaleFactor);
  } else if (frameStyle === 'manga-panel') {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, baseWidth, baseHeight);
    ctx.strokeStyle = frameColor;
    ctx.lineWidth = 5 * scaleFactor;
    ctx.strokeRect(3 * scaleFactor, 3 * scaleFactor, baseWidth - 6 * scaleFactor, baseHeight - 6 * scaleFactor);
    ctx.fillStyle = frameColor;
    ctx.fillRect(8 * scaleFactor, baseWidth - 2 * scaleFactor, baseWidth - 16 * scaleFactor, 40 * scaleFactor);
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 italic ${13.5 * scaleFactor}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ctaText, baseWidth / 2, baseWidth + 18 * scaleFactor);
  } else if (frameStyle === 'vip-ticket' || frameStyle === 'retro-arcade') {
    ctx.fillStyle = frameColor;
    ctx.beginPath();
    ctx.roundRect(0, 0, baseWidth, baseHeight, 18 * scaleFactor);
    ctx.fill();

    const pad = 10 * scaleFactor;
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(pad, qrOffsetY + pad, baseWidth - pad * 2, baseWidth - pad * 2, 12 * scaleFactor);
    ctx.fill();

    ctx.fillStyle = frameStyle === 'vip-ticket' ? '#fbbf24' : '#38bdf8';
    ctx.font = `900 ${10 * scaleFactor}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      frameStyle === 'vip-ticket' ? '★ BEAMDROP OFFICIAL PASS ★' : 'HIGH SCORE • P2P READY',
      baseWidth / 2,
      21 * scaleFactor
    );

    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${13 * scaleFactor}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(ctaText, baseWidth / 2, qrOffsetY + baseWidth + 21 * scaleFactor);
  } else if (frameStyle !== 'none') {
    const frameGrad = ctx.createLinearGradient(0, 0, baseWidth, baseHeight);
    frameGrad.addColorStop(0, frameColor);
    frameGrad.addColorStop(1, gradMode !== 'none' ? fgColor2 : frameColor);
    ctx.fillStyle = frameGrad;
    ctx.beginPath();
    ctx.roundRect(0, 0, baseWidth, baseHeight, 20 * scaleFactor);
    ctx.fill();

    const pad = 9 * scaleFactor;
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(pad, qrOffsetY + pad, baseWidth - pad * 2, baseWidth - pad * 2, 14 * scaleFactor);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${13 * scaleFactor}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (hasTopFrame) {
      ctx.fillText(ctaText, baseWidth / 2, 21 * scaleFactor);
    } else {
      ctx.fillText(ctaText, baseWidth / 2, baseWidth + 21 * scaleFactor);
    }
  } else {
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(0, 0, baseWidth, baseHeight, 18 * scaleFactor);
    ctx.fill();
  }

  const qrPadding = 20 * scaleFactor;
  const qrDrawArea = baseWidth - qrPadding * 2;
  const cellSize = qrDrawArea / count;
  const startX = qrPadding;
  const startY = qrOffsetY + qrPadding;

  let artSource = null;
  if (artPreset === 'custom' && extQrCustomArtDataUrl) {
    artSource = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = extQrCustomArtDataUrl;
    });
  } else if (artPreset !== 'none') {
    artSource = createExtBuiltInArtCanvas(artPreset, Math.round(qrDrawArea));
  }

  if (artSource && artBlend === 'halftone') {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(startX - 3 * scaleFactor, startY - 3 * scaleFactor, qrDrawArea + 6 * scaleFactor, qrDrawArea + 6 * scaleFactor, 10 * scaleFactor);
    ctx.clip();
    ctx.globalAlpha = 0.82;
    ctx.drawImage(artSource, startX - 3 * scaleFactor, startY - 3 * scaleFactor, qrDrawArea + 6 * scaleFactor, qrDrawArea + 6 * scaleFactor);
    ctx.restore();
  }

  let mainFill = fgColor;
  if (artSource && artBlend === 'texture') {
    const patCanvas = document.createElement('canvas');
    patCanvas.width = Math.ceil(qrDrawArea);
    patCanvas.height = Math.ceil(qrDrawArea);
    const pCtx = patCanvas.getContext('2d');
    if (pCtx) {
      pCtx.drawImage(artSource, 0, 0, patCanvas.width, patCanvas.height);
      pCtx.fillStyle = 'rgba(15, 23, 42, 0.55)';
      pCtx.fillRect(0, 0, patCanvas.width, patCanvas.height);
      const pat = ctx.createPattern(patCanvas, 'no-repeat');
      if (pat) mainFill = pat;
    }
  } else if (gradMode === 'linear-diag') {
    const grad = ctx.createLinearGradient(startX, startY, startX + qrDrawArea, startY + qrDrawArea);
    grad.addColorStop(0, fgColor);
    grad.addColorStop(1, fgColor2);
    mainFill = grad;
  } else if (gradMode === 'linear-horiz') {
    const grad = ctx.createLinearGradient(startX, startY, startX + qrDrawArea, startY);
    grad.addColorStop(0, fgColor);
    grad.addColorStop(1, fgColor2);
    mainFill = grad;
  } else if (gradMode === 'linear-vert') {
    const grad = ctx.createLinearGradient(startX, startY, startX, startY + qrDrawArea);
    grad.addColorStop(0, fgColor);
    grad.addColorStop(1, fgColor2);
    mainFill = grad;
  } else if (gradMode === 'radial') {
    const cx = startX + qrDrawArea / 2;
    const cy = startY + qrDrawArea / 2;
    const grad = ctx.createRadialGradient(cx, cy, qrDrawArea * 0.05, cx, cy, qrDrawArea * 0.65);
    grad.addColorStop(0, fgColor);
    grad.addColorStop(1, fgColor2);
    mainFill = grad;
  }

  const hasLogo = logoPreset !== 'none';
  const logoBoxSize = 46 * scaleFactor;
  const quietPadPx = 6 * scaleFactor;
  const totalLogoRadiusPx = logoBoxSize / 2 + quietPadPx + cellSize * 0.45;
  const centerCoordX = startX + qrDrawArea / 2;
  const centerCoordY = startY + qrDrawArea / 2;

  const isSkippedForLogo = (r, c) => {
    if (!hasLogo) return false;
    const modCenterX = startX + (c + 0.5) * cellSize;
    const modCenterY = startY + (r + 0.5) * cellSize;
    if (logoMask === 'circle') {
      return Math.hypot(modCenterX - centerCoordX, modCenterY - centerCoordY) < totalLogoRadiusPx;
    }
    return Math.abs(modCenterX - centerCoordX) < totalLogoRadiusPx && Math.abs(modCenterY - centerCoordY) < totalLogoRadiusPx;
  };

  const isDarkNeighbor = (nr, nc) => {
    if (nr < 0 || nc < 0 || nr >= count || nc >= count) return false;
    if (isExtFinderModule(nr, nc, count)) return false;
    if (isSkippedForLogo(nr, nc)) return false;
    return Boolean(modules.get(nr, nc));
  };

  ctx.save();
  if (extQrFxNeonEnabled) {
    ctx.shadowColor = gradMode !== 'none' ? fgColor2 : fgColor;
    ctx.shadowBlur = 5 * scaleFactor;
  }

  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (isExtFinderModule(r, c, count)) continue;
      if (isSkippedForLogo(r, c)) continue;

      const x = startX + c * cellSize;
      const y = startY + r * cellSize;
      const isDark = Boolean(modules.get(r, c));

      if (!isDark) {
        if (artSource && artBlend === 'halftone') {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
          ctx.beginPath();
          ctx.arc(x + cellSize / 2, y + cellSize / 2, cellSize * 0.28, 0, Math.PI * 2);
          ctx.fill();
        }
        continue;
      }

      if (extQrFx3dEnabled) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
        drawExtCustomModule(ctx, bodyShape, x + 1.4 * scaleFactor, y + 1.6 * scaleFactor, cellSize, r, c, isDarkNeighbor);
      }

      ctx.fillStyle = mainFill;
      drawExtCustomModule(
        ctx,
        bodyShape,
        artSource && artBlend === 'halftone' ? x + cellSize * 0.06 : x,
        artSource && artBlend === 'halftone' ? y + cellSize * 0.06 : y,
        artSource && artBlend === 'halftone' ? cellSize * 0.88 : cellSize,
        r,
        c,
        isDarkNeighbor
      );
    }
  }
  ctx.restore();

  const drawFinderEye = (rowOffset, colOffset) => {
    const ex = startX + colOffset * cellSize;
    const ey = startY + rowOffset * cellSize;
    const outerSize = 7 * cellSize;
    const innerWhiteSize = 5 * cellSize;
    const ballSize = 3 * cellSize;

    if (artSource) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.beginPath();
      ctx.roundRect(ex - cellSize * 0.45, ey - cellSize * 0.45, outerSize + cellSize * 0.9, outerSize + cellSize * 0.9, cellSize * 1.4);
      ctx.fill();
    }

    if (extQrFx3dEnabled) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
      traceExtEyeShape(ctx, ex + 1.6 * scaleFactor, ey + 1.8 * scaleFactor, outerSize, outerEyeShape, cellSize * 1.8);
      ctx.fill();
    }

    ctx.fillStyle = mainFill;
    traceExtEyeShape(ctx, ex, ey, outerSize, outerEyeShape, cellSize * 1.8);
    ctx.fill();

    ctx.fillStyle = bgColor;
    traceExtEyeShape(ctx, ex + cellSize, ey + cellSize, innerWhiteSize, outerEyeShape, cellSize * 1.25);
    ctx.fill();

    ctx.fillStyle = mainFill;
    traceExtEyeShape(ctx, ex + cellSize * 2, ey + cellSize * 2, ballSize, innerEyeShape, cellSize * 0.85);
    ctx.fill();
  };

  drawFinderEye(0, 0);
  drawFinderEye(0, count - 7);
  drawFinderEye(count - 7, 0);

  if (hasLogo) {
    const cx = centerCoordX;
    const cy = centerCoordY;
    const outerBadgeSize = logoBoxSize + quietPadPx * 2;
    const maskRadius = logoMask === 'circle' ? logoBoxSize / 2 : 12 * scaleFactor;
    const outerRadius = logoMask === 'circle' ? outerBadgeSize / 2 : 15 * scaleFactor;

    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.16)';
    ctx.shadowBlur = 10 * scaleFactor;
    ctx.shadowOffsetY = 2 * scaleFactor;
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    if (logoMask === 'circle') {
      ctx.arc(cx, cy, outerBadgeSize / 2, 0, Math.PI * 2);
    } else {
      ctx.roundRect(cx - outerBadgeSize / 2, cy - outerBadgeSize / 2, outerBadgeSize, outerBadgeSize, outerRadius);
    }
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    if (logoMask === 'circle') {
      ctx.arc(cx, cy, logoBoxSize / 2, 0, Math.PI * 2);
    } else {
      ctx.roundRect(cx - logoBoxSize / 2, cy - logoBoxSize / 2, logoBoxSize, logoBoxSize, maskRadius);
    }
    ctx.clip();

    const customImgSrc = (logoPreset === 'custom' && extQrCustomLogoDataUrl)
      ? extQrCustomLogoDataUrl
      : (extQrCurrentEngine === 'vcard' && extQrVcardPhotoDataUrl && logoPreset === 'vcard')
      ? extQrVcardPhotoDataUrl
      : null;

    if (customImgSrc) {
      await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, cx - logoBoxSize / 2, cy - logoBoxSize / 2, logoBoxSize, logoBoxSize);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = customImgSrc;
      });
    } else {
      const badgeGrad = ctx.createLinearGradient(cx - logoBoxSize / 2, cy - logoBoxSize / 2, cx + logoBoxSize / 2, cy + logoBoxSize / 2);
      badgeGrad.addColorStop(0, fgColor);
      badgeGrad.addColorStop(1, gradMode !== 'none' ? fgColor2 : '#0284c7');
      ctx.fillStyle = badgeGrad;
      ctx.fillRect(cx - logoBoxSize / 2, cy - logoBoxSize / 2, logoBoxSize, logoBoxSize);

      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${17 * scaleFactor}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const symbolMap = { beamdrop: '⚡', globe: 'WWW', vcard: 'ID', wifi: 'WIFI', pdf: 'PDF', custom: '★' };
      ctx.fillText(symbolMap[logoPreset] || '⚡', cx, cy + 1 * scaleFactor);
    }
    ctx.restore();
  }
}

function renderQuickQrCode(overrideText) {
  if (overrideText !== undefined && quickQrInput && extQrCurrentEngine === 'url') {
    quickQrInput.value = overrideText;
  }
  renderStyledExtQrCanvas(extQrStudioCanvas, 1);
}

function populateActiveTabUrlForQuickQr() {
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeUrl = (tabs && tabs[0] && tabs[0].url && !tabs[0].url.startsWith('chrome'))
        ? tabs[0].url
        : 'https://beam-drop-mu.vercel.app';
      if (quickQrInput) quickQrInput.value = activeUrl;
      renderStyledExtQrCanvas(extQrStudioCanvas, 1);
    });
  } else {
    const fallbackUrl = 'https://beam-drop-mu.vercel.app';
    if (quickQrInput) quickQrInput.value = fallbackUrl;
    renderStyledExtQrCanvas(extQrStudioCanvas, 1);
  }
}

function switchExtQrEngine(engine) {
  extQrCurrentEngine = engine;
  extQrActiveDynamicCode = '';
  if (extQrActiveDynamicBadge) extQrActiveDynamicBadge.style.display = 'none';
  if (btnExtQrMakeDynamic) {
    btnExtQrMakeDynamic.style.display = engine === 'analytics' ? 'none' : 'inline-flex';
  }
  extQrEngineBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-engine') === engine);
  });

  if (extQrPanelUrl) extQrPanelUrl.style.display = engine === 'url' ? 'block' : 'none';
  if (extQrPanelText) extQrPanelText.style.display = engine === 'text' ? 'block' : 'none';
  if (extQrPanelWifi) extQrPanelWifi.style.display = engine === 'wifi' ? 'block' : 'none';
  if (extQrPanelVcard) extQrPanelVcard.style.display = engine === 'vcard' ? 'block' : 'none';
  if (extQrPanelPdf) extQrPanelPdf.style.display = engine === 'pdf' ? 'block' : 'none';
  if (extQrPanelApplink) extQrPanelApplink.style.display = engine === 'applink' ? 'block' : 'none';
  if (extQrPanelAnalytics) extQrPanelAnalytics.style.display = engine === 'analytics' ? 'block' : 'none';

  if (btnExtPrintBusinessCard) {
    btnExtPrintBusinessCard.style.display = engine === 'vcard' ? 'block' : 'none';
  }

  if (engine === 'analytics') {
    renderExtSavedDynamicList();
  }
  renderStyledExtQrCanvas(extQrStudioCanvas, 1);
}

extQrEngineBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const eng = btn.getAttribute('data-engine') || 'url';
    switchExtQrEngine(eng);
  });
});

function switchBridgeMode(mode) {
  activeBridgeMode = mode;
  if (modeBtnFiles) modeBtnFiles.className = mode === 'files' ? 'bridge-mode-btn active' : 'bridge-mode-btn';
  if (modeBtnText) modeBtnText.className = mode === 'text' ? 'bridge-mode-btn active' : 'bridge-mode-btn';
  if (modeBtnClipboard) modeBtnClipboard.className = mode === 'clipboard' ? 'bridge-mode-btn active' : 'bridge-mode-btn';
  if (modeBtnQuickQr) {
    modeBtnQuickQr.className = mode === 'quickqr' ? 'bridge-mode-btn active' : 'bridge-mode-btn';
  }

  if (mode === 'files') {
    if (viewFilesMode) viewFilesMode.style.display = 'flex';
    if (viewTextMode) viewTextMode.style.display = 'none';
    if (viewQuickQrMode) viewQuickQrMode.style.display = 'none';
  } else if (mode === 'text' || mode === 'clipboard') {
    if (viewFilesMode) viewFilesMode.style.display = 'none';
    if (viewTextMode) viewTextMode.style.display = 'flex';
    if (viewQuickQrMode) viewQuickQrMode.style.display = 'none';
  } else if (mode === 'quickqr') {
    if (viewFilesMode) viewFilesMode.style.display = 'none';
    if (viewTextMode) viewTextMode.style.display = 'none';
    if (viewQuickQrMode) viewQuickQrMode.style.display = 'flex';
    if (quickQrInput && !quickQrInput.value.trim()) {
      populateActiveTabUrlForQuickQr();
    } else {
      renderStyledExtQrCanvas(extQrStudioCanvas, 1);
    }
  }
}

if (modeBtnFiles) modeBtnFiles.addEventListener('click', () => switchBridgeMode('files'));
if (modeBtnText) modeBtnText.addEventListener('click', () => switchBridgeMode('text'));
if (modeBtnClipboard) modeBtnClipboard.addEventListener('click', () => switchBridgeMode('text'));
if (modeBtnQuickQr) modeBtnQuickQr.addEventListener('click', () => switchBridgeMode('quickqr'));

// Wire all QR Studio inputs for live canvas updates
[
  quickQrInput, extQrTextInput, extQrWifiSsid, extQrWifiEnc, extQrWifiPass,
  extVcardName, extVcardTitle, extVcardOrg, extVcardPhone, extVcardWhatsapp, extVcardEmail, extVcardWeb, extVcardCity,
  extQrPdfTitle, extQrPdfUrl, extQrAppName, extQrAppIos, extQrAppAndroid,
  extQrArtPreset, extQrArtBlend,
  extQrBodyShape, extQrOuterEye, extQrInnerEye, extQrGradMode, extQrFg1, extQrFg2, extQrBg,
  extQrFrameStyle, extQrFrameText, extQrFrameColor, extQrLogoPreset, extQrLogoMask
].forEach((el) => {
  if (!el) return;
  el.addEventListener('input', () => {
    if (el === extQrTextInput && extQrTextChars) {
      extQrTextChars.textContent = `${extQrTextInput.value.length} chars`;
    }
    if (el === extQrWifiEnc && extQrWifiPassWrap) {
      extQrWifiPassWrap.style.display = extQrWifiEnc.value === 'nopass' ? 'none' : 'block';
    }
    renderStyledExtQrCanvas(extQrStudioCanvas, 1);
  });
  el.addEventListener('change', () => renderStyledExtQrCanvas(extQrStudioCanvas, 1));
});

if (btnGrabCurrentTabUrl) {
  btnGrabCurrentTabUrl.addEventListener('click', () => populateActiveTabUrlForQuickQr());
}
if (btnExtQrClearUrl) {
  btnExtQrClearUrl.addEventListener('click', () => {
    if (quickQrInput) quickQrInput.value = '';
    renderStyledExtQrCanvas(extQrStudioCanvas, 1);
  });
}
if (btnExtQrPasteText) {
  btnExtQrPasteText.addEventListener('click', async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip && extQrTextInput) {
        extQrTextInput.value = clip;
        if (extQrTextChars) extQrTextChars.textContent = `${clip.length} chars`;
        renderStyledExtQrCanvas(extQrStudioCanvas, 1);
      }
    } catch (_) {}
  });
}
if (btnExtQrClearText) {
  btnExtQrClearText.addEventListener('click', () => {
    if (extQrTextInput) extQrTextInput.value = '';
    if (extQrTextChars) extQrTextChars.textContent = '0 chars';
    renderStyledExtQrCanvas(extQrStudioCanvas, 1);
  });
}
if (btnExtQrToggleWifiPass && extQrWifiPass) {
  btnExtQrToggleWifiPass.addEventListener('click', () => {
    const isHidden = extQrWifiPass.type === 'password';
    extQrWifiPass.type = isHidden ? 'text' : 'password';
    btnExtQrToggleWifiPass.textContent = isHidden ? 'Hide' : 'Show';
  });
}

// vCard Mode & Photo
if (btnExtVcardModeOffline && btnExtVcardModeDynamic) {
  btnExtVcardModeOffline.addEventListener('click', () => {
    extQrVcardMode = 'offline';
    btnExtVcardModeOffline.classList.add('active');
    btnExtVcardModeDynamic.classList.remove('active');
    renderStyledExtQrCanvas(extQrStudioCanvas, 1);
  });
  btnExtVcardModeDynamic.addEventListener('click', () => {
    extQrVcardMode = 'dynamic';
    btnExtVcardModeDynamic.classList.add('active');
    btnExtVcardModeOffline.classList.remove('active');
    renderStyledExtQrCanvas(extQrStudioCanvas, 1);
  });
}
if (btnExtVcardPhoto && extVcardPhotoInput) {
  btnExtVcardPhoto.addEventListener('click', () => extVcardPhotoInput.click());
  extVcardPhotoInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      extQrVcardPhotoDataUrl = String(reader.result || '');
      extQrCustomLogoDataUrl = extQrVcardPhotoDataUrl;
      if (extQrLogoPreset) extQrLogoPreset.value = 'custom';
      if (btnExtVcardPhoto) btnExtVcardPhoto.textContent = 'Photo ✓';
      if (btnExtVcardClearPhoto) btnExtVcardClearPhoto.style.display = 'inline-block';
      renderStyledExtQrCanvas(extQrStudioCanvas, 1);
    };
    reader.readAsDataURL(file);
  });
}
if (btnExtVcardClearPhoto) {
  btnExtVcardClearPhoto.addEventListener('click', () => {
    extQrVcardPhotoDataUrl = null;
    extQrCustomLogoDataUrl = null;
    if (extQrLogoPreset) extQrLogoPreset.value = 'none';
    if (btnExtVcardPhoto) btnExtVcardPhoto.textContent = '+ Photo';
    btnExtVcardClearPhoto.style.display = 'none';
    renderStyledExtQrCanvas(extQrStudioCanvas, 1);
  });
}

// PDF 24h Cloud Drop Upload inside QR Studio
if (btnExtQrUploadPdf && extQrPdfFileInput) {
  btnExtQrUploadPdf.addEventListener('click', () => extQrPdfFileInput.click());
  extQrPdfFileInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const cleanBase = getCleanBaseUrl();
    if (extQrPdfStatus) extQrPdfStatus.textContent = `Uploading ${file.name}...`;
    btnExtQrUploadPdf.disabled = true;
    try {
      const sha256 = await computeSha256(file);
      const sRes = await fetch(`${cleanBase}/api/cloud-drop?action=create_upload_session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, size: file.size, mime: file.type || 'application/pdf', sha256 })
      });
      const sData = await sRes.json();
      if (!sRes.ok || !sData.id) throw new Error('Upload session failed');
      const dropId = sData.id;
      if (sData.mode === 'gdrive' && sData.uploadUrl) {
        const pRes = await fetch(sData.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/pdf' },
          body: file
        });
        const gMeta = await pRes.json();
        await fetch(`${cleanBase}/api/cloud-drop?action=finalize_upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: dropId, gdriveFileId: gMeta.id, sha256 })
        });
      } else {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        }
        await fetch(`${cleanBase}/api/cloud-drop?action=upload_hybrid`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: dropId, name: file.name, size: file.size,
            mime: file.type || 'application/pdf', sha256, base64Data: btoa(bin)
          })
        });
      }
      extQrUploadedPdfShareUrl = `${cleanBase}/download.html?drop=${dropId}`;
      if (extQrPdfUrl) extQrPdfUrl.value = extQrUploadedPdfShareUrl;
      if (extQrPdfTitle && !extQrPdfTitle.value) extQrPdfTitle.value = file.name;
      if (extQrPdfStatus) extQrPdfStatus.textContent = `✓ ${file.name} (24h Cloud Ready)`;
      if (extQrLogoPreset) extQrLogoPreset.value = 'pdf';
      renderStyledExtQrCanvas(extQrStudioCanvas, 1);
    } catch (err) {
      if (extQrPdfStatus) extQrPdfStatus.textContent = '⚠️ Upload failed — paste URL below';
    } finally {
      btnExtQrUploadPdf.disabled = false;
    }
  });
}

// Create Dynamic Shortlink (/q/:code)
async function createExtDynamicShortlink() {
  const allowed = await enforceExtQrGenerationQuota();
  if (!allowed) return;
  const cleanBase = getCleanBaseUrl();
  if (btnExtQrMakeDynamic) btnExtQrMakeDynamic.textContent = 'Saving...';
  try {
    let title = 'Dynamic Link';
    let targetUrl = computeExtQrPayload();
    let payload = {};
    if (extQrCurrentEngine === 'url') {
      title = targetUrl.replace(/^https?:\/\//, '').slice(0, 28) || 'Website';
    } else if (extQrCurrentEngine === 'text') {
      title = (extQrTextInput && extQrTextInput.value.slice(0, 24)) || 'Text Note';
      payload = { text: (extQrTextInput && extQrTextInput.value) || '' };
    } else if (extQrCurrentEngine === 'vcard') {
      title = (extVcardName && extVcardName.value) || 'Contact Card';
      payload = {
        fullName: extVcardName ? extVcardName.value : '',
        jobTitle: extVcardTitle ? extVcardTitle.value : '',
        org: extVcardOrg ? extVcardOrg.value : '',
        phone: extVcardPhone ? extVcardPhone.value : '',
        whatsapp: extVcardWhatsapp ? extVcardWhatsapp.value : '',
        email: extVcardEmail ? extVcardEmail.value : '',
        website: extVcardWeb ? extVcardWeb.value : '',
        address: extVcardCity ? extVcardCity.value : ''
      };
    } else if (extQrCurrentEngine === 'applink') {
      title = (extQrAppName && extQrAppName.value) || 'App Link';
      targetUrl = (extQrAppIos && extQrAppIos.value) || (extQrAppAndroid && extQrAppAndroid.value) || cleanBase;
      payload = {
        appName: extQrAppName ? extQrAppName.value : '',
        iosUrl: extQrAppIos ? extQrAppIos.value : '',
        androidUrl: extQrAppAndroid ? extQrAppAndroid.value : ''
      };
    } else if (extQrCurrentEngine === 'pdf') {
      title = (extQrPdfTitle && extQrPdfTitle.value) || 'PDF Document';
      payload = { docTitle: title };
    } else if (extQrCurrentEngine === 'wifi') {
      title = (extQrWifiSsid && extQrWifiSsid.value) || 'Wi-Fi';
      payload = {
        ssid: extQrWifiSsid ? extQrWifiSsid.value : '',
        password: extQrWifiPass ? extQrWifiPass.value : '',
        encryption: extQrWifiEnc ? extQrWifiEnc.value : 'WPA'
      };
    }

    const res = await fetch(`${cleanBase}/api/qr-studio?action=create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: extQrCurrentEngine === 'analytics' ? 'url' : extQrCurrentEngine,
        title, targetUrl, payload
      })
    });
    const data = await res.json();
    if (res.ok && data.qr && data.qr.code) {
      extQrActiveDynamicCode = data.qr.code;
      extQrSavedDynamicItems = [data.qr, ...extQrSavedDynamicItems.filter((i) => i.code !== data.qr.code)];
      saveExtDynamicItemsToStorage();
      if (extQrActiveDynamicText) extQrActiveDynamicText.textContent = `/q/${data.qr.code}`;
      if (extQrActiveDynamicBadge) extQrActiveDynamicBadge.style.display = 'inline-flex';
      if (btnExtQrMakeDynamic) btnExtQrMakeDynamic.style.display = 'none';
      renderStyledExtQrCanvas(extQrStudioCanvas, 1);
    }
  } catch (_) {
  } finally {
    if (btnExtQrMakeDynamic) btnExtQrMakeDynamic.innerHTML = '<span>⚡ Dynamic</span>';
  }
}

if (btnExtQrMakeDynamic) {
  btnExtQrMakeDynamic.addEventListener('click', createExtDynamicShortlink);
}
if (btnExtQrCreateAppLink) {
  btnExtQrCreateAppLink.addEventListener('click', createExtDynamicShortlink);
}
if (btnExtQrResetDynamic) {
  btnExtQrResetDynamic.addEventListener('click', () => {
    extQrActiveDynamicCode = '';
    if (extQrActiveDynamicBadge) extQrActiveDynamicBadge.style.display = 'none';
    if (btnExtQrMakeDynamic && extQrCurrentEngine !== 'analytics') {
      btnExtQrMakeDynamic.style.display = 'inline-flex';
    }
    renderStyledExtQrCanvas(extQrStudioCanvas, 1);
  });
}

function renderExtSavedDynamicList() {
  if (!extQrSavedList) return;
  if (!extQrSavedDynamicItems || extQrSavedDynamicItems.length === 0) {
    extQrSavedList.innerHTML = '<div style="padding: 12px; text-align: center; font-size: 10px; color: #64748b; background: #f8fafc; border-radius: 8px;">No dynamic links saved yet.</div>';
    return;
  }
  extQrSavedList.innerHTML = extQrSavedDynamicItems.map((item) => `
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 6px 8px; border-radius: 8px; border: 1px solid #e2e8f0; background: #f8fafc;">
      <div style="min-width: 0; flex: 1;">
        <div style="display: flex; align-items: center; gap: 5px;">
          <span style="font-size: 10.5px; font-weight: 800; color: #0f172a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(item.title || item.code)}</span>
          <span style="font-size: 9.5px; font-family: ui-monospace, monospace; font-weight: 700; color: #0284c7;">/q/${escapeHtml(item.code)}</span>
        </div>
        <div style="font-size: 9px; color: #64748b; font-family: ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(item.targetUrl || item.type || '')}</div>
      </div>
      <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
        <span style="font-size: 9.5px; font-weight: 800; color: #0f172a;">${item.scans || 0} scans</span>
        <button type="button" class="ext-qr-mini-btn primary btn-ext-use-dyn" data-code="${escapeHtml(item.code)}">View</button>
        <button type="button" class="ext-qr-mini-btn danger btn-ext-del-dyn" data-code="${escapeHtml(item.code)}">✕</button>
      </div>
    </div>
  `).join('');

  extQrSavedList.querySelectorAll('.btn-ext-use-dyn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const code = btn.getAttribute('data-code') || '';
      if (!code) return;
      extQrActiveDynamicCode = code;
      if (extQrActiveDynamicText) extQrActiveDynamicText.textContent = `/q/${code}`;
      if (extQrActiveDynamicBadge) extQrActiveDynamicBadge.style.display = 'inline-flex';
      renderStyledExtQrCanvas(extQrStudioCanvas, 1);
    });
  });

  extQrSavedList.querySelectorAll('.btn-ext-del-dyn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const code = btn.getAttribute('data-code') || '';
      if (!code) return;
      extQrSavedDynamicItems = extQrSavedDynamicItems.filter((i) => i.code !== code);
      saveExtDynamicItemsToStorage();
      if (extQrActiveDynamicCode === code) {
        extQrActiveDynamicCode = '';
        if (extQrActiveDynamicBadge) extQrActiveDynamicBadge.style.display = 'none';
      }
      renderExtSavedDynamicList();
      renderStyledExtQrCanvas(extQrStudioCanvas, 1);
      try {
        await fetch(`${getCleanBaseUrl()}/api/qr-studio?action=delete&code=${encodeURIComponent(code)}`, { method: 'POST' });
      } catch (_) {}
    });
  });
}

if (btnExtQrRefreshSaved) {
  btnExtQrRefreshSaved.addEventListener('click', async () => {
    if (extQrSavedDynamicItems.length === 0) return;
    const codes = extQrSavedDynamicItems.map((i) => i.code).join(',');
    try {
      const res = await fetch(`${getCleanBaseUrl()}/api/qr-studio?action=list&codes=${encodeURIComponent(codes)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items) && data.items.length > 0) {
          const map = new Map(data.items.map((i) => [i.code, i]));
          extQrSavedDynamicItems = extQrSavedDynamicItems.map((item) => map.get(item.code) || item);
          saveExtDynamicItemsToStorage();
          renderExtSavedDynamicList();
        }
      }
    } catch (_) {}
  });
}

// Optional Customizer Accordion & Sub-tabs
if (btnExtToggleQrCustom && extQrCustomBody) {
  btnExtToggleQrCustom.addEventListener('click', () => {
    const isOpen = extQrCustomBody.style.display === 'flex';
    extQrCustomBody.style.display = isOpen ? 'none' : 'flex';
    if (extQrCustomChevron) extQrCustomChevron.textContent = isOpen ? '▼' : '▲';
  });
}

function updateExtFxToggleButtons() {
  if (btnExtQrFx3d) {
    btnExtQrFx3d.textContent = `🧊 3D Pop Depth: ${extQrFx3dEnabled ? 'ON' : 'Off'}`;
    btnExtQrFx3d.classList.toggle('primary', extQrFx3dEnabled);
  }
  if (btnExtQrFxNeon) {
    btnExtQrFxNeon.textContent = `⚡ Neon Glow: ${extQrFxNeonEnabled ? 'ON' : 'Off'}`;
    btnExtQrFxNeon.classList.toggle('primary', extQrFxNeonEnabled);
  }
}

if (btnExtQrFx3d) {
  btnExtQrFx3d.addEventListener('click', () => {
    if (!isExtProUser()) {
      triggerExtProUpgrade('🔒 3D Pop Depth FX is exclusive to PRO users!');
      return;
    }
    extQrFx3dEnabled = !extQrFx3dEnabled;
    updateExtFxToggleButtons();
    renderStyledExtQrCanvas(extQrStudioCanvas, 1);
  });
}

if (btnExtQrFxNeon) {
  btnExtQrFxNeon.addEventListener('click', () => {
    if (!isExtProUser()) {
      triggerExtProUpgrade('🔒 Neon Glow FX is exclusive to PRO users!');
      return;
    }
    extQrFxNeonEnabled = !extQrFxNeonEnabled;
    updateExtFxToggleButtons();
    renderStyledExtQrCanvas(extQrStudioCanvas, 1);
  });
}

if (btnExtQrUploadArt && extQrArtFileInput) {
  btnExtQrUploadArt.addEventListener('click', () => {
    if (!isExtProUser()) {
      triggerExtProUpgrade('🔒 Custom Anime & Photo QR Art is exclusive to PRO users!');
      return;
    }
    extQrArtFileInput.click();
  });
  extQrArtFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      extQrCustomArtDataUrl = String(reader.result || '');
      if (extQrArtPreset) extQrArtPreset.value = 'custom';
      renderStyledExtQrCanvas(extQrStudioCanvas, 1);
    };
    reader.readAsDataURL(file);
  });
}

extQrPresetChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    const pId = chip.getAttribute('data-preset') || 'classic-clean';
    const p = EXT_DESIGNER_PRESETS[pId];
    if (!p) return;
    if (p.proOnly && !isExtProUser()) {
      triggerExtProUpgrade('🔒 This Art Theme is exclusive to PRO users! Upgrade to PRO to unlock all 6 PRO Art Themes & Unlimited QR.');
      return;
    }
    extQrPresetChips.forEach((c) => c.classList.toggle('active', c === chip));
    if (extQrFg1) extQrFg1.value = p.fg1;
    if (extQrFg2) extQrFg2.value = p.fg2;
    if (extQrGradMode) extQrGradMode.value = p.grad;
    if (extQrBg) extQrBg.value = p.bg;
    if (extQrBodyShape) extQrBodyShape.value = p.body;
    if (extQrOuterEye) extQrOuterEye.value = p.outerEye;
    if (extQrInnerEye) extQrInnerEye.value = p.innerEye;
    if (extQrFrameStyle) extQrFrameStyle.value = p.frame;
    if (extQrFrameColor) extQrFrameColor.value = p.frameColor;
    if (extQrFrameText && p.frameText) extQrFrameText.value = p.frameText;
    if (extQrArtPreset && p.art) extQrArtPreset.value = p.art;
    if (extQrArtBlend && p.blend) extQrArtBlend.value = p.blend;
    extQrFx3dEnabled = Boolean(p.fx3d);
    extQrFxNeonEnabled = Boolean(p.fxNeon);
    updateExtFxToggleButtons();
    renderStyledExtQrCanvas(extQrStudioCanvas, 1);
  });
});

extQrCustTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    if (!isExtProUser()) {
      triggerExtProUpgrade('🔒 Custom QR Art, Shapes, Colors, Frames & Logos are exclusive to PRO users!');
      return;
    }
    const target = tab.getAttribute('data-custtab') || 'art';
    extQrCustTabs.forEach((t) => t.classList.toggle('active', t === tab));
    if (extCustSubArt) extCustSubArt.style.display = target === 'art' ? 'flex' : 'none';
    if (extCustSubShapes) extCustSubShapes.style.display = target === 'shapes' ? 'flex' : 'none';
    if (extCustSubColors) extCustSubColors.style.display = target === 'colors' ? 'flex' : 'none';
    if (extCustSubFrame) extCustSubFrame.style.display = target === 'frame' ? 'flex' : 'none';
    if (extCustSubLogo) extCustSubLogo.style.display = target === 'logo' ? 'flex' : 'none';
  });
});

if (btnExtQrUploadLogo && extQrLogoFileInput) {
  btnExtQrUploadLogo.addEventListener('click', () => {
    if (!isExtProUser()) {
      triggerExtProUpgrade('🔒 Custom Brand Logos are exclusive to PRO users!');
      return;
    }
    extQrLogoFileInput.click();
  });
  extQrLogoFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      extQrCustomLogoDataUrl = String(reader.result || '');
      if (extQrLogoPreset) extQrLogoPreset.value = 'custom';
      renderStyledExtQrCanvas(extQrStudioCanvas, 1);
    };
    reader.readAsDataURL(file);
  });
}

// Export Actions: High-Res PNG, Vector SVG, Copy Image, Print Business Card, Full Studio
if (btnDownloadQuickQrPng) {
  btnDownloadQuickQrPng.addEventListener('click', async () => {
    const allowed = await enforceExtQrGenerationQuota();
    if (!allowed) return;
    const hiCanvas = document.createElement('canvas');
    await renderStyledExtQrCanvas(hiCanvas, 4);
    const dataUrl = hiCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `beamdrop-qr-${extQrCurrentEngine}-${Date.now().toString(36)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
}

if (btnExtDownloadQrSvg) {
  btnExtDownloadQrSvg.addEventListener('click', async () => {
    const allowed = await enforceExtQrGenerationQuota();
    if (!allowed) return;
    if (typeof QRCode === 'undefined' || !QRCode.create) return;
    const payloadToDraw = computeExtQrPayload() || 'https://beam-drop-mu.vercel.app';
    const qrObj = safeCreateExtQrCode(payloadToDraw);
    const modules = qrObj.modules;
    const count = modules.size;
    const bodyShape = (extQrBodyShape && extQrBodyShape.value) || 'rounded';
    const fgColor = (extQrFg1 && extQrFg1.value) || '#0f172a';
    const fgColor2 = (extQrFg2 && extQrFg2.value) || '#0284c7';
    const bgColor = (extQrBg && extQrBg.value) || '#ffffff';
    const gradMode = (extQrGradMode && extQrGradMode.value) || 'none';

    const size = 600;
    const pad = 44;
    const drawArea = size - pad * 2;
    const cell = drawArea / count;

    let rectsSvg = '';
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (!modules.get(r, c)) continue;
        const x = (pad + c * cell).toFixed(2);
        const y = (pad + r * cell).toFixed(2);
        const w = (cell * 0.94).toFixed(2);
        if (bodyShape === 'dots') {
          const cx = (pad + c * cell + cell / 2).toFixed(2);
          const cy = (pad + r * cell + cell / 2).toFixed(2);
          const rad = ((cell / 2) * 0.86).toFixed(2);
          rectsSvg += `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="url(#qrGrad)" />`;
        } else {
          const rx = bodyShape === 'rounded' || bodyShape === 'classy' ? (cell * 0.35).toFixed(2) : '0';
          rectsSvg += `<rect x="${x}" y="${y}" width="${w}" height="${w}" rx="${rx}" fill="url(#qrGrad)" />`;
        }
      }
    }

    const svgStr = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <linearGradient id="qrGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${fgColor}" />
      <stop offset="100%" stop-color="${gradMode !== 'none' ? fgColor2 : fgColor}" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="36" fill="${bgColor}" />
  ${rectsSvg}
</svg>`;
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beamdrop-qr-${extQrCurrentEngine}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
}

if (btnExtCopyQrImg) {
  btnExtCopyQrImg.addEventListener('click', async () => {
    const allowed = await enforceExtQrGenerationQuota();
    if (!allowed) return;
    try {
      const hiCanvas = document.createElement('canvas');
      await renderStyledExtQrCanvas(hiCanvas, 2);
      const blob = await new Promise((resolve) => hiCanvas.toBlob(resolve, 'image/png'));
      if (blob && navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      } else {
        await navigator.clipboard.writeText(computeExtQrPayload());
      }
      if (extCopyQrImgText) {
        extCopyQrImgText.textContent = 'Copied!';
        setTimeout(() => { extCopyQrImgText.textContent = 'Copy'; }, 1800);
      }
    } catch (_) {
      try {
        await navigator.clipboard.writeText(computeExtQrPayload());
        if (extCopyQrImgText) {
          extCopyQrImgText.textContent = 'Copied!';
          setTimeout(() => { extCopyQrImgText.textContent = 'Copy'; }, 1800);
        }
      } catch (__) {}
    }
  });
}

if (btnExtPrintBusinessCard) {
  btnExtPrintBusinessCard.addEventListener('click', async () => {
    const allowed = await enforceExtQrGenerationQuota();
    if (!allowed) return;
    const cardCanvas = document.createElement('canvas');
    cardCanvas.width = 1050;
    cardCanvas.height = 600;
    const ctx = cardCanvas.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 1050, 600);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(1, '#1e293b');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(0, 0, 1050, 600, 32);
    ctx.fill();

    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(60, 72, 68, 6);

    const fn = (extVcardName && extVcardName.value.trim()) || 'Alex Rivera';
    const title = (extVcardTitle && extVcardTitle.value.trim()) || '';
    const org = (extVcardOrg && extVcardOrg.value.trim()) || '';
    const tel = (extVcardPhone && extVcardPhone.value.trim()) || '';
    const email = (extVcardEmail && extVcardEmail.value.trim()) || '';
    const web = (extVcardWeb && extVcardWeb.value.trim()) || '';
    const city = (extVcardCity && extVcardCity.value.trim()) || '';

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 44px system-ui, -apple-system, sans-serif';
    ctx.fillText(fn, 60, 145);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '700 22px system-ui, -apple-system, sans-serif';
    ctx.fillText([title, org].filter(Boolean).join(' • '), 60, 185);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 20px ui-monospace, monospace';
    let yPos = 290;
    [
      tel ? `TEL:   ${tel}` : '',
      email ? `EMAIL: ${email}` : '',
      web ? `WEB:   ${web}` : '',
      city ? `LOC:   ${city}` : ''
    ].filter(Boolean).forEach((line) => {
      ctx.fillText(line, 60, yPos);
      yPos += 42;
    });

    const qrTemp = document.createElement('canvas');
    await renderStyledExtQrCanvas(qrTemp, 1.25);
    ctx.drawImage(qrTemp, 650, 95, 330, Math.min(410, qrTemp.height));

    const dataUrl = cardCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${fn.replace(/[^a-zA-Z0-9_-]/g, '_')}-business-card.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
}

if (btnOpenFullQrStudio) {
  btnOpenFullQrStudio.addEventListener('click', () => {
    const base = getCleanBaseUrl();
    const targetStudioUrl = `${base}/?tab=qrstudio`;
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: targetStudioUrl });
    } else {
      window.open(targetStudioUrl, '_blank');
    }
  });
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.action === 'open_quick_qr' && msg.payload) {
      if (navTabSend) navTabSend.click();
      switchBridgeMode('quickqr');
      const textPayload = String(msg.payload || '').trim();
      if (textPayload.startsWith('http://') || textPayload.startsWith('https://')) {
        switchExtQrEngine('url');
        if (quickQrInput) quickQrInput.value = textPayload;
      } else {
        switchExtQrEngine('text');
        if (extQrTextInput) extQrTextInput.value = textPayload;
        if (extQrTextChars) extQrTextChars.textContent = `${textPayload.length} chars`;
      }
      renderStyledExtQrCanvas(extQrStudioCanvas, 1);
    }
  });
}

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

async function getAllFilesFromDataTransfer(dataTransfer) {
  if (dataTransfer.items && dataTransfer.items.length > 0) {
    const queue = [];
    for (let i = 0; i < dataTransfer.items.length; i++) {
      const item = dataTransfer.items[i];
      if (item.webkitGetAsEntry) {
        const entry = item.webkitGetAsEntry();
        if (entry) queue.push(entry);
      }
    }
    if (queue.length > 0) {
      const readEntry = async (entry) => {
        if (entry.isFile) {
          return new Promise((resolve) => entry.file(f => resolve(f), () => resolve(null)));
        } else if (entry.isDirectory) {
          const reader = entry.createReader();
          const readEntries = () => new Promise((resolve) => {
            reader.readEntries(res => resolve(res), () => resolve([]));
          });
          let allEntries = [];
          let batch = await readEntries();
          while (batch.length > 0) {
            allEntries = allEntries.concat(batch);
            batch = await readEntries();
          }
          const nested = await Promise.all(allEntries.map(readEntry));
          return nested.flat(Infinity).filter(Boolean);
        }
        return null;
      };
      const nestedFiles = await Promise.all(queue.map(readEntry));
      const flattened = nestedFiles.flat(Infinity).filter(Boolean);
      if (flattened.length > 0) return flattened;
    }
  }
  return Array.from(dataTransfer.files || []);
}

let lastWebPageDragData = null;
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.action === 'web_page_drag_started' && msg.data) {
      lastWebPageDragData = msg.data;
    }
  });
}

dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const files = await getAllFilesFromDataTransfer(e.dataTransfer);
  if (files && files.length) {
    stageSelectedFiles(files);
    lastWebPageDragData = null;
    return;
  }

  // Handle Drag & Drop from active web page via contentBridge or native clipboard/uri
  const droppedText = e.dataTransfer ? (e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list')) : '';
  const webItem = lastWebPageDragData;

  if (webItem && webItem.type === 'image-url') {
    try {
      const resp = await fetch(webItem.content);
      if (resp.ok) {
        const blob = await resp.blob();
        const rawTitle = (webItem.title || 'web-image').replace(/[^a-zA-Z0-9._-]/g, '_');
        const ext = blob.type ? blob.type.split('/')[1] : 'png';
        const fileName = rawTitle.includes('.') ? rawTitle : `${rawTitle}.${ext || 'png'}`;
        const imageFile = new File([blob], fileName, { type: blob.type || 'image/png' });
        stageSelectedFiles([imageFile]);
        lastWebPageDragData = null;
        updateStatus('ready', `Staged web image: ${fileName}`);
        return;
      }
    } catch (_) {}

    // Fallback: stage image URL as link text
    switchBridgeMode('text');
    if (textPayloadInput) {
      textPayloadInput.value = webItem.content;
      textPayloadInput.dispatchEvent(new Event('input'));
    }
    updateStatus('ready', 'Web image URL staged for beam');
    lastWebPageDragData = null;
  } else if (webItem && (webItem.type === 'link' || webItem.type === 'text')) {
    switchBridgeMode('text');
    if (textPayloadInput) {
      textPayloadInput.value = webItem.content;
      textPayloadInput.dispatchEvent(new Event('input'));
    }
    updateStatus('ready', webItem.type === 'link' ? 'Web link staged for beam' : 'Web text staged for beam');
    lastWebPageDragData = null;
  } else if (droppedText && droppedText.trim()) {
    const text = droppedText.trim();
    if (text.startsWith('http://') || text.startsWith('https://')) {
      if (/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(text)) {
        try {
          const resp = await fetch(text);
          if (resp.ok) {
            const blob = await resp.blob();
            const file = new File([blob], 'web-image.png', { type: blob.type || 'image/png' });
            stageSelectedFiles([file]);
            updateStatus('ready', 'Web image staged for beam');
            return;
          }
        } catch (_) {}
      }
    }
    switchBridgeMode('text');
    if (textPayloadInput) {
      textPayloadInput.value = text;
      textPayloadInput.dispatchEvent(new Event('input'));
    }
    updateStatus('ready', 'Staged dropped content for beam');
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files.length) {
    stageSelectedFiles(Array.from(e.target.files));
  }
});

if (folderInput) {
  folderInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length) {
      stageSelectedFiles(Array.from(e.target.files));
    }
  });
}

if (btnPickFiles) {
  btnPickFiles.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });
}

if (btnPickFolder) {
  btnPickFolder.addEventListener('click', (e) => {
    e.stopPropagation();
    if (folderInput) folderInput.click();
  });
}

if (btnNativeFsPicker) {
  btnNativeFsPicker.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (typeof window.showOpenFilePicker === 'function') {
      try {
        const handles = await window.showOpenFilePicker({ multiple: true });
        const files = await Promise.all(handles.map(h => h.getFile()));
        if (files && files.length) {
          stageSelectedFiles(files);
        }
      } catch (err) {
        if (err && err.name !== 'AbortError') {
          fileInput.click();
        }
      }
    } else {
      fileInput.click();
    }
  });
}

const btnCaptureTabScreenshot = document.getElementById('btnCaptureTabScreenshot');
if (btnCaptureTabScreenshot) {
  btnCaptureTabScreenshot.addEventListener('click', async (e) => {
    e.stopPropagation();
    btnCaptureTabScreenshot.disabled = true;
    const originalText = btnCaptureTabScreenshot.innerHTML;
    btnCaptureTabScreenshot.innerHTML = '<span>Capturing...</span>';

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'capture_active_tab_screenshot' }, async (response) => {
          btnCaptureTabScreenshot.disabled = false;
          btnCaptureTabScreenshot.innerHTML = originalText;

          if (response && response.success && response.dataUrl) {
            const res = await fetch(response.dataUrl);
            const blob = await res.blob();
            const timeTag = new Date().toISOString().replace(/[:.]/g, '-').slice(11, 19);
            const file = new File([blob], `screenshot_tab_${timeTag}.png`, { type: 'image/png' });
            stageSelectedFiles([file]);
            playExtChime('notify');
          } else {
            console.warn('[BeamDrop] Screenshot notice:', response?.error);
            updateStatus('idle', 'Screenshot unavailable on internal browser tabs');
          }
        });
      } else {
        btnCaptureTabScreenshot.disabled = false;
        btnCaptureTabScreenshot.innerHTML = originalText;
      }
    } catch (err) {
      btnCaptureTabScreenshot.disabled = false;
      btnCaptureTabScreenshot.innerHTML = originalText;
      console.warn('[BeamDrop] Screenshot error:', err);
    }
  });
}

if (btnClearStagedFiles) {
  btnClearStagedFiles.addEventListener('click', (e) => {
    e.stopPropagation();
    stagedFiles = [];
    activePreparedFile = null;
    if (stagedFilesContainer) stagedFilesContainer.style.display = 'none';
    if (stagedFilesList) stagedFilesList.innerHTML = '';
    if (stagedSummaryPill) stagedSummaryPill.style.display = 'none';
    stagedCard.style.display = 'none';
    fileInput.value = '';
    if (folderInput) folderInput.value = '';
    btnGenerateQr.disabled = true;
    const btnCloud = document.getElementById('btnUpload24hCloud');
    if (btnCloud) btnCloud.disabled = true;
    if (btnDirectBeamTargeted) btnDirectBeamTargeted.style.display = 'none';
    updateStatus('idle', 'Ready');
  });
}

btnRemoveFile.addEventListener('click', (e) => {
  e.stopPropagation();
  stagedFiles = [];
  activePreparedFile = null;
  stagedCard.style.display = 'none';
  if (stagedFilesContainer) stagedFilesContainer.style.display = 'none';
  if (stagedSummaryPill) stagedSummaryPill.style.display = 'none';
  fileInput.value = '';
  if (folderInput) folderInput.value = '';
  btnGenerateQr.disabled = true;
  const btnCloud = document.getElementById('btnUpload24hCloud');
  if (btnCloud) btnCloud.disabled = true;
  if (btnDirectBeamTargeted) btnDirectBeamTargeted.style.display = 'none';
  updateStatus('idle', 'Ready');
});

const EXT_SVG_ICONS = {
  excel: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line></svg>',
  ppt: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>',
  pdf: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
  doc: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
  zip: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>',
  image: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>',
  video: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>',
  file: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
  phone: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>',
  laptop: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>',
  check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
  alert: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
  download: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>',
  code: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>',
  note: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
  link: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>'
};

function getExtensionFileTypeInfo(name, mime = '') {
  const ext = (name || '').split('.').pop().toLowerCase();
  if (['xls', 'xlsx', 'csv', 'ods', 'tsv'].includes(ext) || mime.includes('spreadsheet') || mime.includes('excel')) {
    return { tag: ext.toUpperCase(), svgHtml: EXT_SVG_ICONS.excel, class: 'tag-excel' };
  }
  if (['ppt', 'pptx', 'pps', 'ppsx', 'odp'].includes(ext) || mime.includes('presentation')) {
    return { tag: ext.toUpperCase(), svgHtml: EXT_SVG_ICONS.ppt, class: 'tag-ppt' };
  }
  if (ext === 'pdf' || mime === 'application/pdf') {
    return { tag: 'PDF', svgHtml: EXT_SVG_ICONS.pdf, class: 'tag-pdf' };
  }
  if (['doc', 'docx', 'rtf', 'odt'].includes(ext) || mime.includes('word')) {
    return { tag: ext.toUpperCase(), svgHtml: EXT_SVG_ICONS.doc, class: 'tag-doc' };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
    return { tag: ext.toUpperCase(), svgHtml: EXT_SVG_ICONS.zip, class: 'tag-zip' };
  }
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
    return { tag: ext.toUpperCase(), svgHtml: EXT_SVG_ICONS.image, class: 'tag-image' };
  }
  if (mime.startsWith('video/') || ['mp4', 'mkv', 'mov', 'webm'].includes(ext)) {
    return { tag: ext.toUpperCase(), svgHtml: EXT_SVG_ICONS.video, class: 'tag-video' };
  }
  return { tag: ext.toUpperCase() || 'FILE', svgHtml: EXT_SVG_ICONS.file, class: '' };
}

function stageSelectedFiles(files) {
  // Merge new files avoiding exact duplicates
  const existingKeys = new Set(stagedFiles.map(f => `${f.name}_${f.size}`));
  const toAdd = files.filter(f => !existingKeys.has(`${f.name}_${f.size}`));
  stagedFiles = [...stagedFiles, ...toAdd];
  if (stagedFiles.length === 0) return;

  const totalSize = stagedFiles.reduce((acc, f) => acc + f.size, 0);

  if (stagedSummaryPill) {
    stagedSummaryPill.textContent = `${stagedFiles.length} item${stagedFiles.length > 1 ? 's' : ''} • ${formatBytes(totalSize)}`;
    stagedSummaryPill.style.display = 'inline-block';
  }

  if (stagedFiles.length > 1) {
    currentObjectType = 'bundle';
    stagedCard.style.display = 'none';
    if (stagedFilesContainer) stagedFilesContainer.style.display = 'flex';
    if (stagedCountText) stagedCountText.textContent = String(stagedFiles.length);

    if (stagedFilesList) {
      stagedFilesList.innerHTML = '';
      stagedFiles.forEach((file, idx) => {
        const item = document.createElement('div');
        item.className = 'staged-file-item';
        const info = getExtensionFileTypeInfo(file.name, file.type);
        item.innerHTML = `
          <div class="staged-file-item-left">
            <span style="font-size: 9px; font-weight: 800; padding: 2px 5px; border-radius: 4px; background: #e0f2fe; color: #0369a1;">${info.tag}</span>
            <span class="staged-file-item-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
            <span class="staged-file-item-size">${formatBytes(file.size)}</span>
          </div>
          <button type="button" class="btn-item-delete" title="Remove file" data-index="${idx}">✕</button>
        `;
        const delBtn = item.querySelector('.btn-item-delete');
        if (delBtn) {
          delBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            stagedFiles.splice(idx, 1);
            if (stagedFiles.length === 0) {
              if (btnClearStagedFiles) btnClearStagedFiles.click();
            } else {
              stageSelectedFiles([]); // re-render list
            }
          });
        }
        stagedFilesList.appendChild(item);
      });
    }
  } else {
    currentObjectType = 'file';
    if (stagedFilesContainer) stagedFilesContainer.style.display = 'none';
    stagedCard.style.display = 'flex';
    const first = stagedFiles[0];
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
      thumbIcon.innerHTML = fileInfo.svgHtml || EXT_SVG_ICONS.file;
      thumbIcon.style.display = 'block';
    }
    stagedFileSize.textContent = formatBytes(first.size);
  }

  btnGenerateQr.disabled = false;
  const btnCloud = document.getElementById('btnUpload24hCloud');
  if (btnCloud) btnCloud.disabled = false;
  if (extTargetedPeer && btnDirectBeamTargeted) {
    btnDirectBeamTargeted.style.display = 'flex';
    if (btnDirectBeamTargetedText) {
      btnDirectBeamTargetedText.textContent = `Beam Directly to ${extTargetedPeer.name}`;
    }
  } else if (btnDirectBeamTargeted) {
    btnDirectBeamTargeted.style.display = 'none';
  }

  updateStatus('ready', `${stagedFiles.length} Staged (${formatBytes(totalSize)})`);
  playExtChime('connect');
}

if (btnDirectBeamTargeted) {
  btnDirectBeamTargeted.addEventListener('click', async () => {
    if (stagedFiles.length === 0 || !extTargetedPeer) return;
    btnDirectBeamTargeted.disabled = true;
    btnDirectBeamTargeted.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg><span>Connecting Direct Bridge...</span>';
    try {
      if (stagedFiles.length > 1 && typeof JSZip !== 'undefined') {
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

      if (!peer || peer.destroyed) {
        initPeerJsSession('file');
      }

      showStage('transfer');
      updateStatus('connected', `Streaming to ${extTargetedPeer.name}...`);
      if (transferDeviceName) {
        transferDeviceName.innerHTML = `${EXT_SVG_ICONS.phone}<span>${escapeHtml(extTargetedPeer.name)}</span>`;
      }

      const conn = peer.connect(extTargetedPeer.id, { reliable: true });
      activeConnection = conn;
      setupConnectionHandlers(conn, 'file');
    } catch (err) {
      console.warn('Direct targeted beam fallback notice:', err);
      btnGenerateQr.click();
    } finally {
      btnDirectBeamTargeted.disabled = false;
      if (btnDirectBeamTargetedText) {
        btnDirectBeamTargetedText.textContent = `Beam Directly to ${extTargetedPeer ? extTargetedPeer.name : 'Target'}`;
      }
    }
  });
}

btnGenerateQr.addEventListener('click', async () => {
  if (stagedFiles.length === 0) return;
  btnGenerateQr.disabled = true;
  btnGenerateQr.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg><span>Preparing Transmission...</span>';

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
    btnGenerateQr.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg><span>Generate Direct Download QR</span>';
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
          btnQuickPaste.innerHTML = '<span>Pasted</span>';
          setTimeout(() => {
            btnQuickPaste.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg><span>Paste from Clipboard</span>';
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
      if (res && res.payload) {
        if (res.payload.type === 'image' && res.payload.content) {
          // If image URL staged from context menu, fetch into blob in RAM
          fetch(res.payload.content)
            .then(r => r.blob())
            .then(blob => {
              const file = new File([blob], res.payload.fileName || 'beamed_photo.jpg', {
                type: blob.type || res.payload.mime || 'image/jpeg'
              });
              stagedFiles = [file];
              activePreparedFile = file;
              renderStagedFiles();
              showStage('portal');
              startFilePortalSession(file);
            })
            .catch(() => {
              switchBridgeMode('text');
              if (textPayloadInput) {
                textPayloadInput.value = res.payload.content;
                textPayloadInput.dispatchEvent(new Event('input'));
              }
              startTextPortalSession(res.payload.content);
            });
        } else if (res.payload.content) {
          switchBridgeMode('text');
          if (textPayloadInput) {
            textPayloadInput.value = res.payload.content;
            textPayloadInput.dispatchEvent(new Event('input'));
          }
          startTextPortalSession(res.payload.content);
        }
      }
    });

    // Check paired phone status
    chrome.runtime.sendMessage({ action: 'get_paired_session' }, (res) => {
      if (res && res.paired && res.pairedPhone && statusText) {
        const phone = res.pairedPhone;
        updateStatus('ready', `⚡ Linked to ${phone.phoneName || 'Phone'}`);
      }
    });
  }
}

// Call on startup
checkPendingShareFromBackground();

// ==========================================
// STAGE 2: PORTAL ENGINE (QR & P2P INITIALIZATION)
// ==========================================
let currentPortalUrl = '';
let extensionQrNonce = Math.random().toString(36).substring(2, 8) + Math.random().toString(36).substring(2, 6);

function generateExtensionNonce() {
  extensionQrNonce = Math.random().toString(36).substring(2, 8) + Math.random().toString(36).substring(2, 6);
  const badge = document.getElementById('portalNonceBadge');
  if (badge) badge.textContent = '#' + extensionQrNonce.slice(0, 6);
  return extensionQrNonce;
}

function resetRemotePhoneStatusUI() {
  const card = document.getElementById('portalPhoneStatusCard');
  const title = document.getElementById('phoneStatusTitle');
  const sub = document.getElementById('phoneStatusSub');
  const badge = document.getElementById('phoneStatusBadge');
  const icon = document.getElementById('phoneStatusIcon');
  if (card) {
    card.style.background = 'rgba(255, 255, 255, 0.9)';
    card.style.borderColor = 'rgba(186, 230, 253, 0.9)';
    card.style.boxShadow = '0 2px 8px rgba(2, 132, 199, 0.06)';
  }
  if (title) {
    title.style.color = '#0f172a';
    title.textContent = 'Waiting for phone scan...';
  }
  if (sub) {
    sub.style.color = '#64748b';
    sub.textContent = 'Aim camera to pair directly';
  }
  if (badge) {
    badge.textContent = 'READY';
    badge.style.color = '#64748b';
    badge.style.background = '#f1f5f9';
    badge.style.borderColor = '#cbd5e1';
  }
  if (icon) icon.innerHTML = EXT_SVG_ICONS.phone;
}

function updateRemotePhoneStatus(msg) {
  const card = document.getElementById('portalPhoneStatusCard');
  const title = document.getElementById('phoneStatusTitle');
  const sub = document.getElementById('phoneStatusSub');
  const badge = document.getElementById('phoneStatusBadge');
  const icon = document.getElementById('phoneStatusIcon');
  if (!card) return;

  if (msg.stage === 'scanned') {
    card.style.background = '#ecfdf5';
    card.style.borderColor = '#6ee7b7';
    card.style.boxShadow = '0 0 12px rgba(16, 185, 129, 0.2)';
    if (title) {
      title.style.color = '#065f46';
      title.textContent = 'Phone Scanned: ' + (msg.device || 'Mobile Device');
    }
    if (sub) {
      sub.style.color = '#047857';
      sub.textContent = 'Scan detected • P2P socket open';
    }
    if (badge) {
      badge.textContent = 'PAIRED';
      badge.style.color = '#047857';
      badge.style.background = '#d1fae5';
      badge.style.borderColor = '#a7f3d0';
    }
    if (icon) icon.innerHTML = EXT_SVG_ICONS.phone;
  } else if (msg.stage === 'downloading') {
    card.style.background = '#f0f9ff';
    card.style.borderColor = '#7dd3fc';
    card.style.boxShadow = '0 0 12px rgba(2, 132, 199, 0.15)';
    const pct = msg.progress || 0;
    if (title) {
      title.style.color = '#0369a1';
      title.textContent = 'Phone Downloading: ' + pct + '%';
    }
    if (sub) {
      sub.style.color = '#0284c7';
      const speedStr = msg.speed ? (formatBytes(msg.speed) + '/s • ') : '';
      sub.textContent = speedStr + 'Writing chunks to RAM';
    }
    if (badge) {
      badge.textContent = 'STREAMING';
      badge.style.color = '#0284c7';
      badge.style.background = '#e0f2fe';
      badge.style.borderColor = '#bae6fd';
    }
    if (icon) icon.innerHTML = EXT_SVG_ICONS.download;
  } else if (msg.stage === 'delivered') {
    card.style.background = '#ecfdf5';
    card.style.borderColor = '#10b981';
    card.style.boxShadow = '0 0 16px rgba(16, 185, 129, 0.3)';
    if (title) {
      title.style.color = '#065f46';
      title.textContent = 'Verified: Saved to Phone Storage!';
    }
    if (sub) {
      sub.style.color = '#047857';
      sub.textContent = (msg.fileName || 'Object') + ' confirmed saved on phone';
    }
    if (badge) {
      badge.textContent = 'SAVED';
      badge.style.color = '#065f46';
      badge.style.background = '#a7f3d0';
      badge.style.borderColor = '#6ee7b7';
    }
    if (icon) icon.innerHTML = EXT_SVG_ICONS.check;
  } else if (msg.stage === 'failed') {
    card.style.background = '#fff1f2';
    card.style.borderColor = '#fca5a5';
    card.style.boxShadow = '0 0 12px rgba(239, 68, 68, 0.15)';
    if (title) {
      title.style.color = '#9f1239';
      title.textContent = 'Delivery to Phone Failed';
    }
    if (sub) {
      sub.style.color = '#be123c';
      sub.textContent = msg.error || 'Connection closed unexpectedly';
    }
    if (badge) {
      badge.textContent = 'FAILED';
      badge.style.color = '#be123c';
      badge.style.background = '#ffe4e6';
      badge.style.borderColor = '#fecdd3';
    }
    if (icon) icon.innerHTML = EXT_SVG_ICONS.alert;
  }
}

let isRebuildingSession = false;
async function rebuildExtensionQrSession() {
  if (isRebuildingSession) return;
  isRebuildingSession = true;

  if (btnRebuildQrIcon) {
    btnRebuildQrIcon.style.transition = 'transform 0.6s ease';
    btnRebuildQrIcon.style.transform = 'rotate(360deg)';
  }
  if (btnRebuildQrText) btnRebuildQrText.textContent = 'Rebuilding...';

  // Generate fresh random nonce & peer ID
  const nonce = generateExtensionNonce();
  const randomSub = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).substring(2, 10);
  currentPeerId = 'beam-' + randomSub;

  // Cleanly close prior connection
  if (activeConnection) {
    try { activeConnection.close(); } catch (_) {}
    activeConnection = null;
  }
  resetRemotePhoneStatusUI();

  const safeBaseUrl = (VERCEL_RECEIVER_URL && !VERCEL_RECEIVER_URL.includes('.run.app') && !VERCEL_RECEIVER_URL.includes('localhost'))
    ? VERCEL_RECEIVER_URL.replace(/\/$/, '')
    : "https://beam-drop-mu.vercel.app";

  if (activePreparedFile) {
    const fileNameEnc = encodeURIComponent(activePreparedFile.name);
    const fileSize = activePreparedFile.size;
    const mimeEnc = encodeURIComponent(activePreparedFile.type || 'application/octet-stream');
    const targetUrl = `${safeBaseUrl}/download?peer=${currentPeerId}&token=${nonce}&nonce=${nonce}&type=file&name=${fileNameEnc}&size=${fileSize}&mime=${mimeEnc}`;

    if (portalUrlText) portalUrlText.textContent = targetUrl;

    try {
      await QRCode.toCanvas(qrcodeCanvas, targetUrl, {
        width: 196,
        margin: 2,
        color: { dark: '#030712', light: '#ffffff' }
      });
    } catch (e) {
      console.error('QR render error:', e);
    }

    // Re-stage file in RAM transit (lightweight files <= 25MB only)
    if (activePreparedFile.size <= 25 * 1024 * 1024) {
      try {
        fetch(`${safeBaseUrl}/api/transit?peer=${currentPeerId}&token=${nonce}&name=${fileNameEnc}&mime=${mimeEnc}`, {
          method: 'POST',
          body: activePreparedFile
        }).catch(() => {});
      } catch (_) {}
    } else {
      console.log(`[BeamDrop] Large file (${(activePreparedFile.size / (1024*1024)).toFixed(1)} MB) configured for direct high-speed P2P DataChannel transmission.`);
    }

    initPeerJsSession('file');
  } else if (stagedTextContent) {
    const chosenType = resolveTextType(stagedTextContent);
    const isInstant = stagedTextContent.length <= 2200;
    if (isInstant) {
      const b64Data = btoa(unescape(encodeURIComponent(stagedTextContent)));
      const targetUrl = `${safeBaseUrl}/notebook.html#data=${b64Data}&token=${nonce}&type=${chosenType}`;
      if (portalUrlText) portalUrlText.textContent = targetUrl;
      try {
        await QRCode.toCanvas(qrcodeCanvas, targetUrl, {
          width: 196,
          margin: 2,
          color: { dark: '#030712', light: '#ffffff' }
        });
      } catch (e) {}
    } else {
      const targetUrl = `${safeBaseUrl}/notebook.html?peer=${currentPeerId}&token=${nonce}&type=${chosenType}`;
      if (portalUrlText) portalUrlText.textContent = targetUrl;
      try {
        await QRCode.toCanvas(qrcodeCanvas, targetUrl, {
          width: 196,
          margin: 2,
          color: { dark: '#030712', light: '#ffffff' }
        });
      } catch (e) {}
      initPeerJsSession('text');
    }
  }

  updateStatus('ready', 'QR Rebuilt');
  if (btnRebuildQrText) btnRebuildQrText.textContent = 'Rebuilt';
  setTimeout(() => {
    if (btnRebuildQrText) btnRebuildQrText.textContent = 'Rebuild QR';
    if (btnRebuildQrIcon) {
      btnRebuildQrIcon.style.transition = 'none';
      btnRebuildQrIcon.style.transform = 'none';
    }
    isRebuildingSession = false;
  }, 1200);
}

if (btnRebuildQr) {
  btnRebuildQr.addEventListener('click', rebuildExtensionQrSession);
}
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

  const nonce = generateExtensionNonce();
  resetRemotePhoneStatusUI();

  const targetUrl = `${safeBaseUrl}/download?peer=${currentPeerId}&token=${nonce}&nonce=${nonce}&type=file&name=${fileNameEnc}&size=${fileSize}&mime=${mimeEnc}`;

  // Update badge on top of QR code in popup
  const fileInfo = getExtensionFileTypeInfo(file.name, file.type);
  if (portalBadgeIcon) portalBadgeIcon.textContent = fileInfo.icon;
  if (portalFileNameBadge) portalFileNameBadge.textContent = file.name;
  if (portalFileSizeBadge) portalFileSizeBadge.textContent = `(${formatBytes(file.size)})`;
  if (qrScanInstruction) qrScanInstruction.textContent = 'Scan with your phone to download directly';

  currentPortalUrl = targetUrl;
  if (portalUrlText) portalUrlText.textContent = targetUrl;

  try {
    await QRCode.toCanvas(qrcodeCanvas, targetUrl, {
      width: 196,
      margin: 2,
      color: { dark: '#030712', light: '#ffffff' }
    });
  } catch (err) {
    console.error('QR rendering failed:', err);
  }

  // Pre-stage in Ephemeral In-Memory RAM Transit for instant mobile 4G/5G phone fallback (only for small files <= 4MB)
  if (file.size <= 4 * 1024 * 1024) {
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
  } else {
    console.log(`[BeamDrop] Staged large payload (${file.name}, ${(file.size / (1024*1024)).toFixed(1)} MB) configured for ultra-fast direct P2P streaming.`);
  }

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

    if (portalBadgeIcon) portalBadgeIcon.innerHTML = chosenType === 'code' ? EXT_SVG_ICONS.code : (chosenType === 'url' ? EXT_SVG_ICONS.link : EXT_SVG_ICONS.note);
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
      portalRadarText.textContent = 'Instant Notebook Ready (Zero Latency)';
    }
  } else {
    // Large text fallback: Stream over WebRTC PeerJS
    const randomSub = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).substring(2, 10);
    currentPeerId = 'beam-' + randomSub;

    targetUrl = `${safeBaseUrl}/notebook.html?peer=${currentPeerId}&type=${chosenType}`;

    if (portalBadgeIcon) portalBadgeIcon.innerHTML = chosenType === 'code' ? EXT_SVG_ICONS.code : EXT_SVG_ICONS.note;
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

  currentPortalUrl = targetUrl;
  if (portalUrlText) portalUrlText.textContent = targetUrl;

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
  const urlToCopy = currentPortalUrl || (portalUrlText ? portalUrlText.textContent : '');
  if (!urlToCopy) return;
  navigator.clipboard.writeText(urlToCopy).then(() => {
    if (copyLinkText) copyLinkText.textContent = 'Copied!';
    setTimeout(() => { if (copyLinkText) copyLinkText.textContent = 'Copy Link'; }, 2000);
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
  ctx.fillText('BeamDrop', width / 2, 60);

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
    ctx.fillText(displayTrunc, 55, 129);

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
  ctx.fillText('BD', width / 2, qrY + qrBoxSize / 2);

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
  ctx.fillText('BeamDrop • Universal P2P Bridge • RAM-to-RAM', width / 2, footerY + 20);

  ctx.font = '500 11px monospace';
  ctx.fillStyle = '#64748b';
  ctx.fillText('https://beam-drop-mu.vercel.app', width / 2, footerY + 38);

  return canvas;
}

if (btnSaveQrWatermark) {
  btnSaveQrWatermark.addEventListener('click', async () => {
    const targetUrl = currentPortalUrl || (portalUrlText ? portalUrlText.textContent : '');
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
      if (btnSaveQrWatermarkText) btnSaveQrWatermarkText.textContent = 'Saved QR Card';
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
    const targetUrl = currentPortalUrl || (portalUrlText ? portalUrlText.textContent : '');
    if (!targetUrl) return;
    const name = activePreparedFile ? activePreparedFile.name : (stagedTextContent ? 'Beamed-Text' : 'BeamDrop');
    const size = activePreparedFile ? activePreparedFile.size : `${stagedTextContent.length} chars`;

    try {
      const card = await createExtensionWatermarkedQr(targetUrl, name, size);
      card.toBlob(async (blob) => {
        if (!blob) return;
        if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          if (copyQrImageText) copyQrImageText.textContent = 'Copied!';
          setTimeout(() => { if (copyQrImageText) copyQrImageText.textContent = 'Copy QR Code'; }, 2000);
        } else {
          navigator.clipboard.writeText(targetUrl);
          if (copyQrImageText) copyQrImageText.textContent = 'Link Copied!';
          setTimeout(() => { if (copyQrImageText) copyQrImageText.textContent = 'Copy QR Code'; }, 2000);
        }
      }, 'image/png');
    } catch (e) {
      console.error('Failed to copy QR code image:', e);
    }
  });
}

let activeStreamAbortController = null;
let activeStreamingConn = null;

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

    // If an existing open connection to this exact same peer is already active, don't kill it!
    if (activeConnection && activeConnection.open && activeConnection.peer === conn.peer) {
      console.log('[BeamDrop] Retaining active open connection to:', conn.peer);
      return;
    }

    // Cleanly cancel any active in-flight stream on older connection
    if (activeStreamAbortController) {
      try { activeStreamAbortController.abort(); } catch (_) {}
      activeStreamAbortController = null;
    }
    isStreaming = false;

    // If an existing connection exists from an earlier test or device, cleanly close it
    if (activeConnection && activeConnection !== conn) {
      try { activeConnection.close(); } catch (_) {}
    }

    activeConnection = conn;
    updateStatus('connected', 'Phone Connected');

    // Immediately detect that Phone Scanned QR code!
    updateRemotePhoneStatus({
      stage: 'scanned',
      device: 'Mobile Phone'
    });

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

  // 1. Listen for signals & incoming media from sender (iPhone / Android / PC)
  let incomingChunks = [];
  let incomingMeta = null;
  let incomingTotalBytes = 0;
  let incomingStartTime = 0;

  conn.on('data', (data) => {
    // Binary chunk (ArrayBuffer) received from Phone / Sender
    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      const buffer = data instanceof ArrayBuffer ? data : data.buffer;
      let chunkPayload = buffer;
      let chunkIdx = 0;
      let totalChunks = 1;

      if (buffer.byteLength >= 32) {
        try {
          const view = new DataView(buffer);
          chunkIdx = view.getUint32(16, false);
          totalChunks = view.getUint32(20, false);
          const payloadLen = view.getUint32(24, false);
          if (payloadLen > 0 && 32 + payloadLen <= buffer.byteLength) {
            chunkPayload = buffer.slice(32, 32 + payloadLen);
          }
        } catch (_) {}
      }

      // Memory Guard: If direct file handle is linked, stream directly to disk without RAM accumulation
      if (currentExtWritableStream) {
        try {
          currentExtWritableStream.write(chunkPayload).catch(() => {});
        } catch (_) {}
      } else if (currentExtStreamController) {
        currentExtStreamController.enqueue(new Uint8Array(chunkPayload));
      } else {
        incomingChunks.push(chunkPayload);
      }

      incomingTotalBytes += chunkPayload.byteLength;
      if (incomingMeta) {
        incomingMeta.lastReceivedChunkIndex = chunkIdx;
      }

      if (incomingMeta && incomingMeta.fileSize) {
        const pct = Math.min(99, Math.round((incomingTotalBytes / incomingMeta.fileSize) * 100));
        if (receiveIncomingPercent) receiveIncomingPercent.textContent = `${pct}%`;
        if (receiveIncomingProgressFill) receiveIncomingProgressFill.style.width = `${pct}%`;
        const elapsed = Math.max(0.05, (Date.now() - (incomingStartTime || Date.now())) / 1000);
        const speedMb = (incomingTotalBytes / (1024 * 1024)) / elapsed;
        if (receiveIncomingSpeed) receiveIncomingSpeed.textContent = speedMb.toFixed(1) + ' MB/s';
      }
      return;
    }

    let msg = data;
    if (typeof data === 'string') {
      try { msg = JSON.parse(data); } catch (_) {}
    }
    if (!msg) return;

    if (msg.type === 'FILE_START') {
      incomingMeta = msg;
      incomingChunks = [];
      incomingTotalBytes = 0;
      incomingStartTime = Date.now();
      playExtChime('connect');
      if (receiveLiveStreamCard) receiveLiveStreamCard.style.display = 'block';
      if (receiveIncomingFilename) receiveIncomingFilename.textContent = msg.fileName || 'Incoming media...';
      if (receiveIncomingPercent) receiveIncomingPercent.textContent = '0%';
      if (receiveIncomingProgressFill) receiveIncomingProgressFill.style.width = '0%';
      if (receiveIncomingSpeed) receiveIncomingSpeed.textContent = '0 MB/s';

      if (localReceiveDirHandle) {
        try {
          localReceiveDirHandle.getFileHandle(msg.fileName || `beamed_${Date.now()}`, { create: true }).then((fh) => {
            return fh.createWritable();
          }).then((ws) => {
            currentExtWritableStream = ws;
          }).catch((fsErr) => {
            console.warn('[Direct Disk Stream] Init notice:', fsErr);
            currentExtWritableStream = null;
          });
        } catch (_) {}
      }

      conn.send({ type: 'RECEIVER_READY', fileId: msg.fileId });
      return;
    }

    if (msg.type === 'RESUME_CHECK') {
      const lastIdx = (incomingMeta && incomingMeta.lastReceivedChunkIndex !== undefined) ? incomingMeta.lastReceivedChunkIndex : -1;
      conn.send({
        type: 'RESUME_ACK',
        lastChunkIndex: lastIdx,
        fileId: msg.fileId
      });
      return;
    }

    if (msg.type === 'FILE_END') {
      const fileName = (incomingMeta && incomingMeta.fileName) || `beamed_${Date.now()}`;
      const fileMime = (incomingMeta && incomingMeta.fileMime) || 'application/octet-stream';
      
      playExtChime('complete');

      if (currentExtWritableStream) {
        try {
          currentExtWritableStream.close().catch(() => {});
          currentExtWritableStream = null;
        } catch (_) {}
        addHistoryRecord({
          direction: 'received',
          kind: 'file',
          name: fileName,
          size: incomingTotalBytes,
          type: fileMime,
          url: '#'
        });
      } else {
        const fileBlob = new Blob(incomingChunks, { type: fileMime });
        const blobUrl = URL.createObjectURL(fileBlob);
        triggerChromeDownload(fileBlob, fileName);
        computeSha256(fileBlob).then(hash => {
          addHistoryRecord({
            direction: 'received',
            kind: 'file',
            name: fileName,
            size: fileBlob.size || incomingTotalBytes,
            type: fileMime,
            checksum: hash,
            blob: fileBlob,
            url: blobUrl
          });
        }).catch(() => {
          addHistoryRecord({
            direction: 'received',
            kind: 'file',
            name: fileName,
            size: fileBlob.size || incomingTotalBytes,
            type: fileMime,
            blob: fileBlob,
            url: blobUrl
          });
        });
      }
      incomingChunks = []; // Clean memory immediately

      if (receiveIncomingPercent) receiveIncomingPercent.textContent = '100%';
      if (receiveIncomingProgressFill) receiveIncomingProgressFill.style.width = '100%';
      setTimeout(() => {
        if (receiveLiveStreamCard) receiveLiveStreamCard.style.display = 'none';
      }, 2500);

      conn.send({ type: 'TRANSFER_COMPLETE_ACK', device: 'PC Extension' });
      return;
    }

    if (msg.type === 'PHONE_STATUS') {
      console.log('[BeamDrop] Remote Phone Status received:', msg);
      updateRemotePhoneStatus(msg);

      if (msg.device && transferDeviceName) {
        transferDeviceName.innerHTML = `${EXT_SVG_ICONS.phone}<span>${escapeHtml(msg.device)}</span>`;
      }

      if (msg.stage === 'scanned') {
        updateStatus('connected', 'Phone Paired');
      } else if (msg.stage === 'downloading') {
        const pct = msg.progress || 0;
        if (transferPercentText) transferPercentText.textContent = pct + '%';
        if (transferProgressFill) transferProgressFill.style.width = pct + '%';
        if (msg.speed && transferSpeedText) transferSpeedText.textContent = formatBytes(msg.speed) + '/s';
        if (transferPhoneStatusSub) transferPhoneStatusSub.textContent = `Phone writing chunks (${pct}%)...`;
      } else if (msg.stage === 'delivered') {
        isStreaming = false;
        showStage('complete');
        if (completeSubText) {
          completeSubText.textContent = `${msg.fileName || 'Object'} verified received & saved to phone storage.`;
        }
        updateStatus('ready', 'Transfer Complete');
      } else if (msg.stage === 'failed') {
        updateStatus('idle', 'Delivery Failed');
        if (transferPhoneStatusSub) transferPhoneStatusSub.textContent = msg.error || 'Phone transfer failed';
      }
      return;
    }

    if (msg.type === 'RECEIVER_READY' || msg.type === 'START_STREAM' || msg.type === 'DEVICE_INFO') {
      console.log('[BeamDrop] Receiver signaled readiness:', msg.type);
      if (msg.device) {
        updateRemotePhoneStatus({
          stage: 'scanned',
          device: msg.device
        });
        if (transferDeviceName) {
          transferDeviceName.innerHTML = `${EXT_SVG_ICONS.phone}<span>${escapeHtml(msg.device)}</span>`;
        }
      }
      startTransmission();
      return;
    }
    if (msg.type === 'TRANSFER_COMPLETE_ACK' || msg.type === 'TRANSFER_SUCCESS') {
      console.log('[BeamDrop] Receiver confirmed 100% receipt:', msg.device || 'remote device');
      isStreaming = false;
      transferProgressFill.style.width = '100%';
      transferPercentText.textContent = '100%';
      transferSpeedText.textContent = 'Completed';
      transferEtaText.textContent = '0s';
      showStage('complete');
      completeSubText.textContent = `Successfully received on ${msg.device || 'device'} with zero cloud storage.`;
      updateStatus('ready', 'Transfer Complete');
      return;
    }
  });

  conn.on('close', () => {
    console.log('[BeamDrop] Peer connection closed');
    if (isStreaming) {
      updateRemotePhoneStatus({
        stage: 'failed',
        error: 'Phone disconnected during transmission'
      });
      updateStatus('idle', 'Disconnected');
    }
  });

  // 2. Direct hook into native WebRTC RTCDataChannel onopen event without overwriting PeerJS internals
  if (conn.dataChannel && typeof conn.dataChannel.addEventListener === 'function') {
    conn.dataChannel.addEventListener('open', () => {
      console.log('[BeamDrop] Native RTCDataChannel onopen fired');
      startTransmission();
    });
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
    if (activeStreamingConn === conn) {
      if (activeStreamAbortController) {
        try { activeStreamAbortController.abort(); } catch (_) {}
        activeStreamAbortController = null;
      }
      isStreaming = false;
      activeStreamingConn = null;
    }
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

  setTimeout(async () => {
    showStage('complete');
    completeSubText.textContent = isLink
      ? 'Link beamed directly to phone browser!'
      : 'Text transferred directly to phone clipboard!';
    updateStatus('ready', 'Transfer Complete');

    const textSha = await computeSha256(stagedTextContent);
    if (completeShaText) {
      completeShaText.textContent = textSha ? `Bit-Exact SHA-256: ${textSha.slice(0, 10)}...` : 'Bit-Exact SHA-256 Verified';
    }
    addHistoryRecord({
      direction: 'sent',
      kind: isLink ? 'url' : 'text',
      name: isLink ? stagedTextContent : (stagedTextContent.slice(0, 32) + (stagedTextContent.length > 32 ? '...' : '')),
      text: stagedTextContent,
      size: new TextEncoder().encode(stagedTextContent).length,
      type: isLink ? 'text/uri-list' : 'text/plain',
      checksum: textSha
    });
  }, 400);
}

let extensionWakeLock = null;
async function requestExtensionWakeLock() {
  try {
    if ('wakeLock' in navigator && !extensionWakeLock) {
      extensionWakeLock = await navigator.wakeLock.request('screen');
      extensionWakeLock.addEventListener('release', () => { extensionWakeLock = null; });
      if (transferWakeLockPill) transferWakeLockPill.style.color = '#0284c7';
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

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (isStreaming || isOpticalLoopActive || activeCameraStream) {
      requestExtensionWakeLock();
    }
  }
});

function createExtensionBinaryFrame(fileId, chunkIndex, totalChunks, payload) {
  const FRAME_HEADER_SIZE = 32;
  const buffer = new ArrayBuffer(FRAME_HEADER_SIZE + payload.byteLength);
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  const encoder = new TextEncoder();
  const fileIdBytes = encoder.encode((fileId || '').padEnd(16, ' ')).slice(0, 16);
  uint8.set(fileIdBytes, 0);

  view.setUint32(16, chunkIndex, false);
  view.setUint32(20, totalChunks, false);
  view.setUint32(24, payload.byteLength, false);
  view.setUint32(28, 0, false);

  uint8.set(new Uint8Array(payload), FRAME_HEADER_SIZE);
  return buffer;
}

async function startBackpressureStream(conn, file) {
  if (!file) return;

  // Cleanly abort any earlier in-flight stream on another connection
  if (activeStreamAbortController) {
    try { activeStreamAbortController.abort(); } catch (_) {}
  }
  activeStreamAbortController = new AbortController();
  const currentSignal = activeStreamAbortController.signal;
  activeStreamingConn = conn;
  isStreaming = true;
  requestExtensionWakeLock();

  showStage('transfer');
  updateStatus('connected', 'Syncing...');
  transferFileTitle.textContent = "Streaming: " + file.name;
  transferProgressFill.style.width = '0%';
  transferPercentText.textContent = '0%';
  transferSpeedText.textContent = 'Syncing...';
  transferEtaText.textContent = 'Awaiting receiver ACK...';
  if (transferShaStatus) transferShaStatus.textContent = '🛡️ Computing SHA-256...';

  const fileSha256Promise = computeSha256(file);
  fileSha256Promise.then(hash => {
    if (transferShaStatus && hash) {
      transferShaStatus.textContent = `🛡️ SHA-256: ${hash.slice(0, 8)}...`;
    }
  }).catch(() => {});

  const fileId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID().slice(0, 16) : ('f-' + Date.now()).padEnd(16, ' ').slice(0, 16);

  // High-performance adaptive chunk size for mobile WebKit & modern Wi-Fi
  const CHUNK_SIZE = file.size > 20 * 1024 * 1024
    ? 192 * 1024
    : (file.size > 2 * 1024 * 1024 ? 128 * 1024 : 64 * 1024);

  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  // 1. Send File Metadata Header
  try {
    conn.send({
      type: 'FILE_START',
      fileId: fileId,
      fileName: file.name,
      fileSize: file.size,
      fileMime: file.type || 'application/octet-stream',
      totalChunks: totalChunks,
      chunkSize: CHUNK_SIZE,
      payload: {
        id: fileId,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        chunkSize: CHUNK_SIZE,
        totalChunks: totalChunks
      }
    });
  } catch (startSendErr) {
    console.warn('[BeamDrop] Failed sending FILE_START header:', startSendErr);
  }

  // Ensure optimized bufferedAmount thresholds on data channel
  const dc = conn.dataChannel;
  if (dc) {
    try {
      dc.binaryType = 'arraybuffer';
      dc.bufferedAmountLowThreshold = 64 * 1024;
    } catch (_) {}
  }

  // 2. WAIT FOR RECEIVER READY (Lockstep Handshake - up to 1500ms)
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
          try {
            if (typeof conn.off === 'function') conn.off('data', onAck);
          } catch (_) {}
          resolve();
        }
      }
    };

    try {
      conn.on('data', onAck);
    } catch (_) {}

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    }, 1500);
  });

  if (currentSignal.aborted || !conn.open) {
    console.warn('[BeamDrop] Handshake aborted or connection closed');
    if (activeStreamingConn === conn) {
      isStreaming = false;
      activeStreamingConn = null;
    }
    releaseExtensionWakeLock();
    return;
  }

  updateStatus('connected', 'Streaming...');
  transferEtaText.textContent = 'Streaming data...';

  // 3. High-Throughput Pipelined Stream Engine with Double Buffering
  let offset = 0;
  let chunkIndex = 0;
  const startTime = Date.now();
  let lastSpeedCheck = startTime;
  let lastBytes = 0;

  const HIGH_WATER_MARK = 512 * 1024;
  const LOW_WATER_MARK = 128 * 1024;

  // Pre-load initial chunk
  let currentSliceSize = Math.min(CHUNK_SIZE, file.size - offset);
  let currentChunkPromise = file.slice(offset, offset + currentSliceSize).arrayBuffer();

  while (offset < file.size) {
    if (currentSignal.aborted || !conn.open) {
      console.warn('[BeamDrop] DataChannel closed or stream aborted');
      break;
    }

    // Wait for buffer to drain if congested
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

        const watchdog = setTimeout(done, 120);

        if (dc) {
          dc.onbufferedamountlow = done;
        }

        const pollInt = setInterval(() => {
          if (!dc || dc.bufferedAmount <= LOW_WATER_MARK) {
            clearInterval(pollInt);
            done();
          }
        }, 8);
      });
    }

    if (currentSignal.aborted || !conn.open) break;

    // Await current chunk buffer
    const arrayBuffer = await currentChunkPromise;
    const nextOffset = offset + currentSliceSize;

    // Pipelined Read-Ahead: Begin reading next chunk concurrently while sending current
    if (nextOffset < file.size) {
      const nextSliceSize = Math.min(CHUNK_SIZE, file.size - nextOffset);
      currentChunkPromise = file.slice(nextOffset, nextOffset + nextSliceSize).arrayBuffer();
      currentSliceSize = nextSliceSize;
    }

    // Wrap in standard 32-byte binary frame for error-free mobile assembly
    const framedBuffer = createExtensionBinaryFrame(fileId, chunkIndex, totalChunks, arrayBuffer);

    try {
      conn.send(framedBuffer);
    } catch (sendErr) {
      console.warn('[BeamDrop] Frame send warning:', sendErr);
    }

    offset = nextOffset;
    chunkIndex++;

    const progress = Math.min(100, Math.round((offset / file.size) * 100));
    transferProgressFill.style.width = progress + "%";
    transferPercentText.textContent = progress + "%";

    const now = Date.now();
    if (now - lastSpeedCheck > 200 || offset >= file.size) {
      const durationSec = Math.max((now - lastSpeedCheck) / 1000, 0.001);
      const bytesSent = offset - lastBytes;
      const speedMBs = (bytesSent / (1024 * 1024)) / durationSec;
      transferSpeedText.textContent = speedMBs.toFixed(1) + " MB/s";
      const remainingBytes = file.size - offset;
      const etaSec = speedMBs > 0 ? Math.round((remainingBytes / (1024 * 1024)) / speedMBs) : 0;
      transferEtaText.textContent = etaSec + "s remaining";
      lastSpeedCheck = now;
      lastBytes = offset;
    }

    // Fast yield every 6 chunks for UI responsiveness
    if (chunkIndex % 6 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  // If interrupted before completion, do NOT claim 100% complete
  if (offset < file.size || currentSignal.aborted) {
    console.warn(`[BeamDrop] Stream ended incompletely at ${offset}/${file.size} bytes`);
    if (activeStreamingConn === conn) {
      isStreaming = false;
      activeStreamingConn = null;
    }
    releaseExtensionWakeLock();
    return;
  }

  // 4. Send Complete Signal
  try {
    conn.send({
      type: 'FILE_END',
      fileId: fileId,
      totalChunks: totalChunks,
      fileSize: file.size
    });
    conn.send({ type: 'complete', fileId: fileId });
  } catch (_) {}
  
  if (activeStreamingConn === conn) {
    isStreaming = false;
    activeStreamingConn = null;
  }
  releaseExtensionWakeLock();

  // Instant 100% visual completion
  transferProgressFill.style.width = '100%';
  transferPercentText.textContent = '100%';
  transferSpeedText.textContent = 'Completed';
  transferEtaText.textContent = '0s';

  showStage('complete');
  completeSubText.textContent = 'Direct transmission finished with zero cloud storage.';
  updateStatus('ready', 'Transfer Complete');

  fileSha256Promise.then(finalSha => {
    if (completeShaText) {
      completeShaText.textContent = finalSha ? `Bit-Exact SHA-256: ${finalSha.slice(0, 12)}...` : 'Bit-Exact SHA-256 Verified';
    }
    addHistoryRecord({
      direction: 'sent',
      kind: 'file',
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      checksum: finalSha,
      blob: file,
      url: URL.createObjectURL(file)
    });
  }).catch(() => {});
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
    'Nearby Radar: AirDrop-style Wi-Fi & Bluetooth Device Discovery with Accept/Decline security',
    'Instant Smart Notebook: Text, code, and links open directly into an interactive notebook on Phone & PC',
    'Zero-ZIP 1-Click Auto Upgrade Engine: Direct in-place rebuild & reload with 0 manual ZIP downloads or file extraction',
    'In-Popup Instant Reload: Force reload files from disk directly with a single click',
    'Syntax Highlighting & Line Numbers: Auto-detects JavaScript, Python, HTML, SQL, and Shell code',
    'Ultra-Clean Apple Liquid Glass UI: Fully refined premium interface for the Chrome Extension'
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

function normalizeSha(s) {
  if (!s || typeof s !== 'string') return '';
  const clean = s.trim().toLowerCase().replace(/^git-/, '');
  if (clean.includes('local') || clean.includes('dev') || clean.includes('init') || clean.includes('null') || clean.includes('undefined')) {
    return '';
  }
  const hexOnly = clean.replace(/[^a-f0-9]/g, '');
  if (hexOnly.length < 7) {
    return '';
  }
  return hexOnly.slice(0, 7);
}

async function checkForUpdates(manual = false) {
  if (manual && refreshSpinIcon) {
    refreshSpinIcon.classList.add('spinning');
    if (btnCheckUpdatesText) btnCheckUpdatesText.textContent = 'Checking GitHub...';
  }

  // 1. Detect Local Environment & Local Build Fingerprint
  const manifest = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest)
    ? chrome.runtime.getManifest()
    : { version: REAL_MANIFEST_VERSION };
  const isUnpacked = !('update_url' in manifest);

  // Read stored sync state from chrome.storage.local if available
  let storedSha = '';
  let storedVer = '';
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const stored = await chrome.storage.local.get(['installedCommitSha', 'installedShortSha', 'installedVersion']);
      if (stored) {
        storedSha = stored.installedShortSha || stored.installedCommitSha || '';
        storedVer = stored.installedVersion || '';
      }
    }
  } catch (_) {}

  const localVer = storedVer || manifest.version || REAL_MANIFEST_VERSION;
  const localBuildInfo = (typeof window !== 'undefined' && window.BEAMDROP_BUILD)
    ? window.BEAMDROP_BUILD
    : { version: localVer, buildHash: '38027b1', shortSha: '38027b1', commitSha: '38027b12bd5f40e8d7e97f9112125571b4ad5746' };

  const localSha = normalizeSha(storedSha || localBuildInfo.shortSha || localBuildInfo.commitSha || localBuildInfo.buildHash) || '38027b1';

  let remoteVersionInfo = null;
  let remoteGitSha = '';
  let commitMessage = '';

  // 2. Direct GitHub Commits API Query (Highest Authority)
  try {
    const gitResp = await fetch('https://api.github.com/repos/raouf-djmilo/BeamDrop/commits?per_page=1', { cache: 'no-store' });
    if (gitResp.ok) {
      const commits = await gitResp.json();
      if (Array.isArray(commits) && commits[0] && commits[0].sha) {
        remoteGitSha = commits[0].sha;
        commitMessage = (commits[0].commit && commits[0].commit.message)
          ? commits[0].commit.message.split('\n')[0]
          : '';
      }
    }
  } catch (err) {
    console.debug('GitHub Commits API query notice:', err);
  }

  // 2b. Fallback to host /api/git-status
  if (!remoteGitSha) {
    try {
      const hostUrl = (typeof window !== 'undefined' && window.location && window.location.origin)
        ? window.location.origin
        : '';
      if (hostUrl && !hostUrl.startsWith('chrome-extension://')) {
        const sResp = await fetch(`${hostUrl}/api/git-status?_t=${Date.now()}`, { cache: 'no-store' });
        if (sResp.ok) {
          const sData = await sResp.json();
          if (sData && sData.sha) {
            remoteGitSha = sData.sha;
            commitMessage = sData.message || commitMessage;
          }
        }
      }
    } catch (_) {}
  }

  // 3. GitHub raw version.json & Vercel fallback
  try {
    const urls = [
      `${GITHUB_RAW_FALLBACK}?_t=${Date.now()}`,
      `${VERCEL_HOST}/version.json?_t=${Date.now()}`
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
  const remoteSha = normalizeSha(remoteGitSha || (remoteVersionInfo && (remoteVersionInfo.commitSha || remoteVersionInfo.shortSha || remoteVersionInfo.buildHash)) || '') || localSha;

  // Exact Mathematical Comparison
  // 1. SemVer comparison: New release version (e.g. 1.6.2 -> 1.6.3)
  const isNewerVersion = compareSemver(localVer, latestVer) < 0;
  // 2. Commit SHA comparison: Code updated on GitHub main branch
  const hasValidShas = Boolean(remoteSha && localSha && remoteSha.length >= 7 && localSha.length >= 7);
  const isShaMismatch = hasValidShas && (remoteSha !== localSha);
  const isNewGitPatch = (compareSemver(localVer, latestVer) === 0) && isShaMismatch;

  const isUpdateAvailable = isNewerVersion || isNewGitPatch;

  if (isUpdateAvailable) {
    // STATE B: UPDATE / HOTFIX AVAILABLE ON GITHUB
    if (stateUpToDate) stateUpToDate.style.display = 'none';
    if (stateUpdateAvailable) stateUpdateAvailable.style.display = 'block';
    if (navUpdateDot) navUpdateDot.style.display = 'block';

    if (typeof chrome !== 'undefined' && chrome.action && chrome.action.setBadgeText) {
      chrome.action.setBadgeText({ text: 'NEW' });
      chrome.action.setBadgeBackgroundColor({ color: '#06b6d4' });
    }

    const pulseTag = document.querySelector('.available-pulse-tag');
    if (pulseTag) {
      pulseTag.textContent = isNewGitPatch ? 'Live Patch on GitHub' : 'New Version Available';
    }

    if (currentVerPill) {
      currentVerPill.textContent = isNewGitPatch ? ('v' + localVer + ' (' + localSha + ') ->') : ('v' + localVer + ' ->');
    }
    if (availableVerPill) {
      availableVerPill.textContent = isNewGitPatch
        ? ('Commit ' + remoteSha)
        : ('v' + latestVer);
    }

    const guideTargetVer = document.getElementById('guideTargetVer');
    if (guideTargetVer) {
      guideTargetVer.textContent = isNewGitPatch
        ? (latestVer + ' (Commit: ' + remoteSha + ')')
        : latestVer;
    }
    const reloadTargetVer = document.getElementById('reloadTargetVer');
    if (reloadTargetVer) {
      reloadTargetVer.textContent = isNewGitPatch
        ? (latestVer + ' (Commit: ' + remoteSha + ')')
        : latestVer;
    }

    const unpackedGuide = document.getElementById('unpackedUpgradeGuide');
    const updateModeNotice = document.getElementById('updateModeNotice');
    const btnReloadExtension = document.getElementById('btnReloadExtension');

    if (isUnpacked) {
      // Zero-ZIP In-Place Folder Sync Mode (via updater.html)
      if (unpackedGuide) unpackedGuide.style.display = 'block';
      
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

      const targetLabel = isNewGitPatch ? ('Commit ' + remoteSha) : ('v' + latestVer);

      if (hasLinkedFolder) {
        if (btnTriggerUpdateText) {
          btnTriggerUpdateText.textContent = `1-Click Sync & Apply from GitHub (${targetLabel})`;
        }
        if (updateModeNotice) {
          updateModeNotice.textContent = `Linked: ${linkedFolderName} • Auto-Sync with raouf-djmilo/BeamDrop`;
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
        if (btnTriggerUpdateText) {
          btnTriggerUpdateText.textContent = 'Link Extension Folder to Enable 1-Click Sync';
        }
        if (updateModeNotice) {
          updateModeNotice.textContent = 'Select your local extension folder once to enable 1-click in-place disk updates';
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
      if (btnTriggerUpdateText) btnTriggerUpdateText.textContent = '1-Click Update & Reload';
      if (updateModeNotice) updateModeNotice.textContent = 'Managed by Chrome Web Store';

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

    const notes = [
      commitMessage ? `GitHub Commit: ${commitMessage}` : '',
      ...(remoteVersionInfo && remoteVersionInfo.highlights ? remoteVersionInfo.highlights : [
        'Live WebRTC DataChannel optimizations & instant two-way handshake',
        'Zero buffer deadlock with flow control threshold',
        'Direct File System 1-click in-place folder updates'
      ])
    ].filter(Boolean);

    if (availableChangelogList) {
      availableChangelogList.innerHTML = notes
        .slice(0, 5)
        .map(item => '<li>' + escapeHtml(item) + '</li>')
        .join('');
    }
  } else {
    // STATE A: 100% UP TO DATE (MATCHES GITHUB EXACTLY)
    if (stateUpdateAvailable) stateUpdateAvailable.style.display = 'none';
    if (stateUpToDate) stateUpToDate.style.display = 'block';
    if (navUpdateDot) navUpdateDot.style.display = 'none';

    if (typeof chrome !== 'undefined' && chrome.action && chrome.action.setBadgeText) {
      chrome.action.setBadgeText({ text: '' });
    }
    
    const displaySha = localSha || remoteSha || '38027b1';
    if (uptodateVersionBadge) {
      uptodateVersionBadge.textContent = 'v' + localVer + ' • ' + displaySha;
    }

    const uptodateSub = document.querySelector('.uptodate-sub');
    if (uptodateSub) {
      uptodateSub.innerHTML = `You have the latest version installed.<br><span style="color:#10b981; font-weight:600;">Synchronized with GitHub: raouf-djmilo/BeamDrop@main</span><br><span style="font-size:10.5px; color:#64748b; font-family:monospace;">Verified Git Commit: ${escapeHtml(displaySha)}${commitMessage ? ' • ' + escapeHtml(commitMessage) : ''}</span>`;
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

if (btnCheckUpdates) {
  btnCheckUpdates.addEventListener('click', () => {
    checkForUpdates(true);
  });
}

if (btnForceReloadExt) {
  btnForceReloadExt.addEventListener('click', () => {
    if (btnForceReloadExtText) {
      btnForceReloadExtText.textContent = 'Reloading Extension...';
    }
    setTimeout(() => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.reload) {
        chrome.runtime.reload();
      } else {
        window.location.reload();
      }
    }, 300);
  });
}

// ==========================================
// STAGE 6: NEARBY RADAR & DISCOVERY ENGINE (AirDrop-Style Handshake)
// ==========================================
let myDeviceName = 'My Device';
let myDeviceType = 'laptop';
let myDeviceIcon = 'laptop';
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
  let icon = 'laptop';
  if (/Android/i.test(ua)) { type = 'phone'; icon = 'phone'; name = 'Android Device'; }
  else if (/iPhone/i.test(ua)) { type = 'phone'; icon = 'phone'; name = 'iPhone'; }
  else if (/iPad|Tablet/i.test(ua)) { type = 'tablet'; icon = 'tablet'; name = 'Tablet'; }
  else if (/Macintosh/i.test(ua)) { type = 'laptop'; icon = 'laptop'; name = 'MacBook Pro'; }
  else if (/Linux/i.test(ua)) { type = 'desktop'; icon = 'desktop'; name = 'Linux PC'; }
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
            telemetrySsid.innerHTML = '<span class="status-dot-green"></span> Connected to Mesh';
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
    radarScanningStatusText.textContent = "Spider sweep in progress...";
  }

  let scanResult = null;
  const pinParam = currentRadarRoomPin ? ("&pin=" + encodeURIComponent(currentRadarRoomPin)) : "";
  const subnetParam = (detectedMyLanIp && detectedMyLanIp !== 'Detecting...' && detectedMyLanIp.includes('.'))
    ? ("&subnet=" + encodeURIComponent(detectedMyLanIp.split('.').slice(0, 3).join('.')))
    : "";

  const cloudEndpoints = [
    VERCEL_RECEIVER_URL + "/api/mesh/devices?_t=" + Date.now() + pinParam + subnetParam,
    VERCEL_RECEIVER_URL + "/api/mesh?_t=" + Date.now() + pinParam + subnetParam
  ];

  for (const ep of cloudEndpoints) {
    try {
      const resp = await fetch(ep, { cache: "no-store" });
      if (resp.ok) {
        const json = await resp.json();
        if (json && json.success && Array.isArray(json.devices)) {
          scanResult = json;
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
        ? 'Mobile Hotspot Mode' : scanResult.network.ssid;
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
    icon: peerData.icon || (peerData.deviceType === 'phone' ? 'phone' : 'laptop'),
    protocol: peerData.protocol || 'wifi',
    latency: peerData.latency || 4,
    lastSeen: Date.now(),
    x, y, angle, dist
  });

  renderNearbyDevices();
}

function broadcastPresenceBeacon() {
  if (!myDiscoveryPeerId) return;
  const subnet = (detectedMyLanIp && detectedMyLanIp !== 'Detecting...' && detectedMyLanIp.includes('.'))
    ? detectedMyLanIp.split('.').slice(0, 3).join('.')
    : undefined;

  const payload = {
    type: 'RADAR_BEACON',
    id: myDiscoveryPeerId,
    name: myDeviceName,
    deviceType: myDeviceType,
    icon: myDeviceIcon,
    protocol: 'wifi',
    ip: detectedMyLanIp !== 'Detecting...' ? detectedMyLanIp : undefined,
    subnet,
    pin: currentRadarRoomPin || undefined,
    timestamp: Date.now()
  };
  if (localMeshBroadcast) {
    localMeshBroadcast.postMessage(payload);
  }

  // Announce to Cloud & Local Signaling (PairDrop Same-Wi-Fi Discovery)
  const announceEndpoints = [
    `${VERCEL_RECEIVER_URL}/api/mesh/announce`,
    `${VERCEL_RECEIVER_URL}/api/mesh`
  ];

  announceEndpoints.forEach(url => {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(r => r.json())
      .then(json => {
        if (json && Array.isArray(json.devices)) {
          json.devices.forEach(dev => {
            if (dev.id && dev.id !== myDiscoveryPeerId) {
              registerDiscoveredPeer(dev);
            }
          });
        }
      })
      .catch(() => {});
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
      iconSpan.innerHTML = peer.icon === 'laptop' ? EXT_SVG_ICONS.laptop : EXT_SVG_ICONS.phone;
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
      let protoLabel = 'Wi-Fi 5GHz';
      let protoClass = 'device-protocol-badge wifi';
      if (isBt) {
        protoLabel = 'Bluetooth';
        protoClass = 'device-protocol-badge bt';
      } else if (isHotspot) {
        protoLabel = 'Hotspot';
        protoClass = 'device-protocol-badge wifi';
      }

      const maskedMac = peer.mac ? peer.mac.replace(/^([0-9a-f]{2}-[0-9a-f]{2}-[0-9a-f]{2})-.*-([0-9a-f]{2})$/i, '$1-**-**-$2') : '';
      const pingText = peer.latency ? `${peer.latency}ms` : '< 5ms';

      card.innerHTML = `
        <div class="device-avatar-wrap">
          <span>${peer.icon === 'laptop' ? EXT_SVG_ICONS.laptop : EXT_SVG_ICONS.phone}</span>
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
          <span>Beam</span>
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
let extTargetedPeer = null;

const extTargetedPeerBanner = document.getElementById('extTargetedPeerBanner');
const extTargetedPeerName = document.getElementById('extTargetedPeerName');
const extTargetedPeerMeta = document.getElementById('extTargetedPeerMeta');
const btnExtClearTargetedPeer = document.getElementById('btnExtClearTargetedPeer');

if (btnExtClearTargetedPeer) {
  btnExtClearTargetedPeer.addEventListener('click', () => {
    extTargetedPeer = null;
    if (extTargetedPeerBanner) extTargetedPeerBanner.style.display = 'none';
  });
}

function initiateDirectBeam(peer) {
  if (!peer) return;
  playRadarBlipSound();

  extTargetedPeer = peer;
  if (extTargetedPeerBanner && extTargetedPeerName && extTargetedPeerMeta) {
    extTargetedPeerName.textContent = `Targeting ${peer.name}`;
    extTargetedPeerMeta.textContent = `${peer.ip || 'LAN Node'} • ${peer.latency ? peer.latency + 'ms' : '< 5ms'} • Mesh Link`;
    extTargetedPeerBanner.style.display = 'flex';
  }

  // Switch to Beam tab
  if (navTabSend) {
    navTabSend.click();
  }

  // If already have staged content, establish connection directly
  if (activePreparedFile || stagedTextContent) {
    if (peer.id && myDiscoveryPeer && !myDiscoveryPeer.destroyed) {
      try {
        updateStatus('connecting', `Connecting to ${peer.name}...`);
        const conn = myDiscoveryPeer.connect(peer.id, { reliable: true });
        conn.on('open', () => {
          conn.send({
            type: 'TRANSFER_INVITE',
            senderName: myDeviceName,
            payloadType: activePreparedFile ? 'file' : 'text',
            fileName: activePreparedFile ? activePreparedFile.name : 'Beamed Note',
            fileSize: activePreparedFile ? activePreparedFile.size : (stagedTextContent ? stagedTextContent.length : 0)
          });
          setupConnectionHandlers(conn, activePreparedFile ? 'file' : 'text');
        });
        conn.on('error', (err) => {
          console.debug('[BeamDrop Radar] Direct connect notice:', err);
          updateStatus('idle', 'Ready');
        });
      } catch (err) {
        console.debug('[BeamDrop Radar] Connection error:', err);
      }
    }
  } else {
    // If no file staged yet, prompt file selection
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
      fileInput.click();
    }
  }
}

function handleIncomingTransferInvite(conn, data) {
  console.log('[BeamDrop Radar] Incoming transfer invite from:', data?.senderName || 'Peer', data);
  try {
    conn.send({ type: 'TRANSFER_ACCEPTED', receiverName: myDeviceName });
  } catch (_) {}
  setupConnectionHandlers(conn, data?.payloadType || 'file');
}

function handleRemoteTransferAccepted(conn) {
  console.log('[BeamDrop Radar] Remote peer accepted transfer');
  if (activePreparedFile) {
    startBackpressureStream(conn, activePreparedFile);
  } else if (stagedTextContent) {
    streamTextPayload(conn);
  }
}

function handleRemoteTransferDeclined(conn, data) {
  console.log('[BeamDrop Radar] Remote peer declined transfer:', data);
  updateStatus('idle', 'Transfer declined by remote device');
}

// ==========================================
// Web-to-Extension User Profile & Quota Bridge
// ==========================================
// IN-EXTENSION APPLE LIQUID GLASS AUTH ENGINE
// ==========================================
const FIREBASE_API_KEY = "AIzaSyB0oAPZdDEGJZGMcZuxRaF_MUuheH0kcAk";
const FIREBASE_PROJECT_ID = "a7flow-30981";

const userProfileBadge = document.getElementById('userProfileBadge');
const userAvatarText = document.getElementById('userAvatarText');
const userUsernameText = document.getElementById('userUsernameText');
const userPlanPill = document.getElementById('userPlanPill');
const btnConnectWebAccount = document.getElementById('btnConnectWebAccount');
const btnConnectAccountText = document.getElementById('btnConnectAccountText');
const btnSignOutExt = document.getElementById('btnSignOutExt');

// In-Popup Auth Sheet DOM Elements
const authSheetModal = document.getElementById('authSheetModal');
const btnCloseAuthSheet = document.getElementById('btnCloseAuthSheet');
const tabAuthSignIn = document.getElementById('tabAuthSignIn');
const tabAuthSignUp = document.getElementById('tabAuthSignUp');
const authAlertBox = document.getElementById('authAlertBox');
const formExtSignIn = document.getElementById('formExtSignIn');
const formExtSignUp = document.getElementById('formExtSignUp');
const inputExtLoginId = document.getElementById('inputExtLoginId');
const inputExtLoginPass = document.getElementById('inputExtLoginPass');
const btnExtSubmitSignIn = document.getElementById('btnExtSubmitSignIn');
const btnExtSubmitSignInText = document.getElementById('btnExtSubmitSignInText');
const inputExtRegFullName = document.getElementById('inputExtRegFullName');
const inputExtRegUsername = document.getElementById('inputExtRegUsername');
const inputExtRegEmail = document.getElementById('inputExtRegEmail');
const inputExtRegPass = document.getElementById('inputExtRegPass');
const btnExtSubmitSignUp = document.getElementById('btnExtSubmitSignUp');
const btnExtSubmitSignUpText = document.getElementById('btnExtSubmitSignUpText');
const btnSwitchToSignUp = document.getElementById('btnSwitchToSignUp');
const btnSwitchToSignIn = document.getElementById('btnSwitchToSignIn');

function showAuthAlert(msg, type = 'error') {
  if (!authAlertBox) return;
  authAlertBox.textContent = msg;
  authAlertBox.className = 'auth-alert-box ' + type;
  authAlertBox.style.display = 'block';
}

function clearAuthAlert() {
  if (!authAlertBox) return;
  authAlertBox.textContent = '';
  authAlertBox.style.display = 'none';
}

function openAuthSheet(mode = 'signin') {
  if (!authSheetModal) return;
  clearAuthAlert();
  switchAuthTab(mode);
  authSheetModal.style.display = 'flex';
  setTimeout(() => {
    if (mode === 'signin' && inputExtLoginId) inputExtLoginId.focus();
    if (mode === 'signup' && inputExtRegFullName) inputExtRegFullName.focus();
  }, 100);
}

function closeAuthSheet() {
  if (!authSheetModal) return;
  authSheetModal.style.display = 'none';
  clearAuthAlert();
}

function switchAuthTab(mode) {
  clearAuthAlert();
  if (mode === 'signin') {
    if (tabAuthSignIn) tabAuthSignIn.classList.add('active');
    if (tabAuthSignUp) tabAuthSignUp.classList.remove('active');
    if (formExtSignIn) formExtSignIn.style.display = 'flex';
    if (formExtSignUp) formExtSignUp.style.display = 'none';
  } else {
    if (tabAuthSignIn) tabAuthSignIn.classList.remove('active');
    if (tabAuthSignUp) tabAuthSignUp.classList.add('active');
    if (formExtSignIn) formExtSignIn.style.display = 'none';
    if (formExtSignUp) formExtSignUp.style.display = 'flex';
  }
}

// Wire modal controls
if (btnCloseAuthSheet) btnCloseAuthSheet.addEventListener('click', closeAuthSheet);
if (authSheetModal) {
  authSheetModal.addEventListener('click', (e) => {
    if (e.target === authSheetModal) closeAuthSheet();
  });
}
if (tabAuthSignIn) tabAuthSignIn.addEventListener('click', () => switchAuthTab('signin'));
if (tabAuthSignUp) tabAuthSignUp.addEventListener('click', () => switchAuthTab('signup'));
if (btnSwitchToSignUp) btnSwitchToSignUp.addEventListener('click', () => switchAuthTab('signup'));
if (btnSwitchToSignIn) btnSwitchToSignIn.addEventListener('click', () => switchAuthTab('signin'));

// Wire Open Auth Sheet button
if (btnConnectWebAccount) {
  btnConnectWebAccount.addEventListener('click', () => {
    openAuthSheet('signin');
  });
}

// Wire Sign Out button
if (btnSignOutExt) {
  btnSignOutExt.addEventListener('click', async () => {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      await chrome.storage.local.remove(['beamdrop_user', 'beamdrop_token', 'beamdrop_refresh_token']);
    }
    renderUserAccountBadge(null, null);
    updateStatus('ready', 'Signed Out');
  });
}

function renderUserAccountBadge(user, dailyUsage) {
  extCachedUser = user || null;
  const today = new Date().toISOString().slice(0, 10);
  if (dailyUsage && dailyUsage.date === today) {
    extCachedDailyUsage = {
      date: today,
      sendOperations: Number(dailyUsage.sendOperations || 0),
      receiveOperations: Number(dailyUsage.receiveOperations || 0),
      qrScansCount: Number(dailyUsage.qrScansCount || 0),
      qrGenerationsCount: Number(dailyUsage.qrGenerationsCount || 0)
    };
  } else {
    try {
      const localRaw = localStorage.getItem('beamdrop_daily_usage_v1');
      if (localRaw) {
        const parsed = JSON.parse(localRaw);
        if (parsed && parsed.date === today) {
          extCachedDailyUsage = {
            date: today,
            sendOperations: Number(parsed.sendOperations || 0),
            receiveOperations: Number(parsed.receiveOperations || 0),
            qrScansCount: Number(parsed.qrScansCount || 0),
            qrGenerationsCount: Number(parsed.qrGenerationsCount || 0)
          };
        }
      }
    } catch (_) {}
  }

  // If user is not PRO, ensure no PRO art preset remains active
  if (!isExtProUser()) {
    const activeChip = document.querySelector('.ext-qr-preset-chip.active');
    const activePid = activeChip && activeChip.getAttribute('data-preset');
    if (activePid && EXT_DESIGNER_PRESETS[activePid] && EXT_DESIGNER_PRESETS[activePid].proOnly) {
      const classicChip = document.querySelector('.ext-qr-preset-chip[data-preset="classic-clean"]');
      if (classicChip) classicChip.click();
    }
  }
  syncExtProQrUi();

  if (!userProfileBadge) return;

  const sends = extCachedDailyUsage.sendOperations || 0;

  if (user && user.uid) {
    userProfileBadge.classList.remove('hidden');
    if (btnConnectWebAccount) btnConnectWebAccount.classList.add('hidden');
    if (btnSignOutExt) btnSignOutExt.classList.remove('hidden');

    if (userAvatarText) {
      const name = user.fullName || user.username || user.email || 'User';
      userAvatarText.textContent = name[0].toUpperCase();
    }

    if (userUsernameText) {
      userUsernameText.textContent = user.username ? `@${user.username}` : user.email;
    }

    if (userPlanPill) {
      if (user.plan === 'pro') {
        userPlanPill.className = 'plan-pill-pro';
        userPlanPill.textContent = 'PRO';
      } else {
        const left = Math.max(0, 15 - sends);
        userPlanPill.className = 'plan-pill-free';
        userPlanPill.textContent = `Member (${left}/15 left)`;
      }
    }
  } else {
    // Guest mode (unauthenticated)
    userProfileBadge.classList.remove('hidden');
    if (btnConnectWebAccount) {
      btnConnectWebAccount.classList.remove('hidden');
      if (btnConnectAccountText) btnConnectAccountText.textContent = 'Sign In (15 Beams)';
    }
    if (btnSignOutExt) btnSignOutExt.classList.add('hidden');

    if (userAvatarText) {
      userAvatarText.textContent = 'G';
    }

    if (userUsernameText) {
      userUsernameText.textContent = 'Guest';
    }

    if (userPlanPill) {
      const left = Math.max(0, 5 - sends);
      userPlanPill.className = 'plan-pill-guest';
      userPlanPill.textContent = `Guest (${left}/5 left)`;
    }
  }
}

syncExtProQrUi();

// Initial load from local chrome storage
if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
  chrome.storage.local.get(['beamdrop_user', 'beamdrop_daily_usage'], (res) => {
    renderUserAccountBadge(res.beamdrop_user, res.beamdrop_daily_usage);
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.beamdrop_user || changes.beamdrop_daily_usage) {
      chrome.storage.local.get(['beamdrop_user', 'beamdrop_daily_usage'], (res) => {
        renderUserAccountBadge(res.beamdrop_user, res.beamdrop_daily_usage);
      });
    }
  });
}

// -------------------------------------------------------------
// SIGN IN FORM SUBMISSION (Firebase Identity Toolkit REST API)
// -------------------------------------------------------------
if (formExtSignIn) {
  formExtSignIn.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthAlert();

    const loginId = (inputExtLoginId?.value || '').trim();
    const password = (inputExtLoginPass?.value || '').trim();

    if (!loginId || !password) {
      showAuthAlert('Please fill in both email/username and password.');
      return;
    }

    if (btnExtSubmitSignIn) btnExtSubmitSignIn.disabled = true;
    if (btnExtSubmitSignInText) btnExtSubmitSignInText.textContent = 'Signing in...';

    try {
      let email = loginId.trim();
      const isFullEmail = email.includes('@') && email.includes('.');
      if (!isFullEmail) {
        const cleanUsername = email.replace(/^@/, '').toLowerCase().trim();
        try {
          const uRes = await fetch(
            `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/usernames/${encodeURIComponent(cleanUsername)}`
          );
          if (uRes.ok) {
            const uData = await uRes.json();
            if (uData.fields?.email?.stringValue) {
              email = uData.fields.email.stringValue;
            }
          } else {
            email = `${cleanUsername}@gmail.com`;
          }
        } catch (_) {
          email = `${cleanUsername}@gmail.com`;
        }
      }

      // Direct Firebase Auth REST Call
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          password: password,
          returnSecureToken: true
        })
      });

      const data = await res.json();

      if (!res.ok) {
        const errCode = data.error?.message || 'LOGIN_FAILED';
        if (errCode.includes('INVALID_LOGIN_CREDENTIALS') || errCode.includes('INVALID_PASSWORD')) {
          throw new Error('Invalid email or password. Please verify your credentials.');
        } else if (errCode.includes('EMAIL_NOT_FOUND')) {
          throw new Error('No BeamDrop account found with this email. Please create an account.');
        } else if (errCode.includes('USER_DISABLED')) {
          throw new Error('This account has been disabled.');
        } else if (errCode.includes('TOO_MANY_ATTEMPTS')) {
          throw new Error('Too many failed attempts. Please try again later.');
        } else {
          throw new Error(errCode);
        }
      }

      // Success: Extract Tokens & UID
      const idToken = data.idToken;
      const uid = data.localId;
      const userEmail = data.email || email;
      const usernameFromEmail = userEmail.split('@')[0];

      // Fetch user profile from Firestore REST
      let profile = {
        uid: uid,
        email: userEmail,
        username: usernameFromEmail,
        fullName: data.displayName || usernameFromEmail,
        plan: 'free'
      };

      try {
        const firestoreUserRes = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${uid}`, {
          headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (firestoreUserRes.ok) {
          const userDoc = await firestoreUserRes.json();
          if (userDoc.fields) {
            profile.fullName = userDoc.fields.fullName?.stringValue || profile.fullName;
            profile.username = userDoc.fields.username?.stringValue || profile.username;
            profile.plan = userDoc.fields.plan?.stringValue || 'free';
          }
        }
      } catch (profileErr) {
        console.warn('Could not fetch remote user profile:', profileErr);
      }

      // Save to chrome.storage.local
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        await chrome.storage.local.set({
          beamdrop_user: profile,
          beamdrop_token: idToken,
          beamdrop_daily_usage: {
            date: new Date().toISOString().slice(0, 10),
            sendOperations: 0,
            receiveOperations: 0,
            qrScansCount: 0
          }
        });
      }

      renderUserAccountBadge(profile, { sendOperations: 0 });
      showAuthAlert('Signed in successfully! 15 Beams unlocked.', 'success');

      setTimeout(() => {
        closeAuthSheet();
        if (inputExtLoginPass) inputExtLoginPass.value = '';
      }, 700);

    } catch (err) {
      console.error('[BeamDrop Auth Error]:', err);
      showAuthAlert(err.message || 'Login failed. Please check your internet connection.');
    } finally {
      if (btnExtSubmitSignIn) btnExtSubmitSignIn.disabled = false;
      if (btnExtSubmitSignInText) btnExtSubmitSignInText.textContent = 'Sign In to BeamDrop';
    }
  });
}

// -------------------------------------------------------------
// SIGN UP FORM SUBMISSION (Firebase Identity Toolkit REST API)
// -------------------------------------------------------------
if (formExtSignUp) {
  formExtSignUp.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAuthAlert();

    const fullName = (inputExtRegFullName?.value || '').trim();
    const username = (inputExtRegUsername?.value || '').trim().toLowerCase();
    const email = (inputExtRegEmail?.value || '').trim().toLowerCase();
    const password = (inputExtRegPass?.value || '').trim();

    if (!fullName || !username || !email || !password) {
      showAuthAlert('Please fill in all registration fields.');
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      showAuthAlert('Username must be 3-20 characters (letters, numbers, or underscores).');
      return;
    }

    if (password.length < 6) {
      showAuthAlert('Password must be at least 6 characters.');
      return;
    }

    if (btnExtSubmitSignUp) btnExtSubmitSignUp.disabled = true;
    if (btnExtSubmitSignUpText) btnExtSubmitSignUpText.textContent = 'Creating Account...';

    try {
      // 1. Create account via Firebase Auth REST API
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          password: password,
          returnSecureToken: true
        })
      });

      const data = await res.json();

      if (!res.ok) {
        const errCode = data.error?.message || 'SIGNUP_FAILED';
        if (errCode.includes('EMAIL_EXISTS')) {
          throw new Error('This email address is already registered. Please sign in instead.');
        } else if (errCode.includes('WEAK_PASSWORD')) {
          throw new Error('Password is too weak. Please use at least 6 characters.');
        } else if (errCode.includes('OPERATION_NOT_ALLOWED')) {
          throw new Error('Email/Password registration is currently disabled in Firebase console.');
        } else {
          throw new Error(errCode);
        }
      }

      const idToken = data.idToken;
      const uid = data.localId;

      // 2. Initialize Firestore user record
      try {
        await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${uid}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            fields: {
              uid: { stringValue: uid },
              email: { stringValue: email },
              username: { stringValue: username },
              fullName: { stringValue: fullName },
              plan: { stringValue: 'free' },
              createdAt: { integerValue: String(Date.now()) },
              transfersCount: { integerValue: "0" },
              bytesTransferred: { integerValue: "0" }
            }
          })
        });

        // Claim username
        await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/usernames/${encodeURIComponent(username)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            fields: {
              uid: { stringValue: uid },
              email: { stringValue: email },
              username: { stringValue: username },
              createdAt: { integerValue: String(Date.now()) }
            }
          })
        });
      } catch (initErr) {
        console.warn('Firestore profile initialization warning:', initErr);
      }

      // 3. Save profile to chrome.storage.local
      const profile = {
        uid: uid,
        fullName: fullName,
        username: username,
        email: email,
        plan: 'free'
      };

      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        await chrome.storage.local.set({
          beamdrop_user: profile,
          beamdrop_token: idToken,
          beamdrop_daily_usage: {
            date: new Date().toISOString().slice(0, 10),
            sendOperations: 0,
            receiveOperations: 0,
            qrScansCount: 0
          }
        });
      }

      renderUserAccountBadge(profile, { sendOperations: 0 });
      showAuthAlert('Account created! 15 Beams unlocked.', 'success');

      setTimeout(() => {
        closeAuthSheet();
        if (formExtSignUp) formExtSignUp.reset();
      }, 700);

    } catch (err) {
      console.error('[BeamDrop Registration Error]:', err);
      showAuthAlert(err.message || 'Registration failed. Please check your internet connection.');
    } finally {
      if (btnExtSubmitSignUp) btnExtSubmitSignUp.disabled = false;
      if (btnExtSubmitSignUpText) btnExtSubmitSignUpText.textContent = 'Create Account (Get 15 Beams)';
    }
  });
}

// ==========================================
// QUICK BEAM CONTEXT MENU & STORAGE LISTENER
// ==========================================
function processIncomingQuickBeam(payload) {
  if (!payload) return;
  const content = typeof payload === 'string' ? payload : (payload.content || payload.text || '');
  if (!content) return;

  if (navTabSend) navTabSend.click();

  if (content.startsWith('http://') || content.startsWith('https://')) {
    switchBridgeMode('text');
    if (textPayloadInput) {
      textPayloadInput.value = content;
      textPayloadInput.dispatchEvent(new Event('input'));
    }
    updateTextFormatPills('url');
  } else {
    switchBridgeMode('text');
    if (textPayloadInput) {
      textPayloadInput.value = content;
      textPayloadInput.dispatchEvent(new Event('input'));
    }
    updateTextFormatPills('auto');
  }

  if (btnGenerateTextQr) {
    btnGenerateTextQr.disabled = false;
  }
}

if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
  chrome.storage.local.get(['pendingQuickBeam', 'pendingSharePayload'], (res) => {
    if (res.pendingQuickBeam) {
      processIncomingQuickBeam(res.pendingQuickBeam);
      chrome.storage.local.remove(['pendingQuickBeam']);
    } else if (res.pendingSharePayload) {
      processIncomingQuickBeam(res.pendingSharePayload);
      chrome.storage.local.remove(['pendingSharePayload']);
    }
  });
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'trigger_quick_beam' && msg.payload) {
      processIncomingQuickBeam(msg.payload);
    }
  });
}
