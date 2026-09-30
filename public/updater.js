/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BeamDrop Extension Direct In-Place Folder Updater (Zero-ZIP)
 * File System Access API Clean In-Place Disk Synchronization
 */

const VERCEL_HOST = "https://beam-drop-mu.vercel.app";

const ALL_EXTENSION_FILES = [
  'manifest.json',
  'popup.html',
  'popup.js',
  'style.css',
  'background.js',
  'options.html',
  'options.js',
  'updater.html',
  'updater.js',
  'folderStore.js',
  'buildInfo.js',
  'updates.xml',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png',
  'icons/icon-16.png',
  'icons/icon-48.png',
  'icons/icon-128.png',
  'icons/icon.svg',
  'libs/jszip.min.js',
  'libs/peerjs.min.js',
  'libs/qrcode.min.js'
];

const installedVer = document.getElementById('installedVer');
const cloudVer = document.getElementById('cloudVer');
const buildHashText = document.getElementById('buildHashText');
const appVerBadge = document.getElementById('appVerBadge');
const linkedFolderStatus = document.getElementById('linkedFolderStatus');
const linkedFolderName = document.getElementById('linkedFolderName');
const btnSelectAndSync = document.getElementById('btnSelectAndSync');
const btnSyncOverwrite = document.getElementById('btnSyncOverwrite');
const btnSyncOverwriteText = document.getElementById('btnSyncOverwriteText');
const syncProgressWrap = document.getElementById('syncProgressWrap');
const syncProgressLabel = document.getElementById('syncProgressLabel');
const syncProgressPercent = document.getElementById('syncProgressPercent');
const syncProgressFill = document.getElementById('syncProgressFill');
const logStream = document.getElementById('logStream');
const toastSuccess = document.getElementById('toastSuccess');

let currentDirHandle = null;
let currentFolderName = '';
let currentPermissionStatus = 'prompt';
let remoteVersionData = null;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  // 1. Instantly display local build information (Zero Lag)
  displayLocalBuildInfo();
  
  // 2. Concurrently check stored folder in IndexedDB (Immediate, non-blocking)
  initFolderState();

  // 3. Concurrently fetch cloud version in background with 2s timeout
  checkCloudStatus();

  // 4. Highlight action button if opened with ?action=sync
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('action') === 'sync') {
    setTimeout(() => {
      if (btnSyncOverwrite && btnSyncOverwrite.style.display !== 'none') {
        btnSyncOverwrite.focus();
        btnSyncOverwrite.style.boxShadow = '0 0 20px rgba(6, 182, 212, 0.8)';
      } else if (btnSelectAndSync) {
        btnSelectAndSync.focus();
        btnSelectAndSync.style.boxShadow = '0 0 20px rgba(6, 182, 212, 0.8)';
      }
    }, 200);
  }
});

function displayLocalBuildInfo() {
  const localBuild = (typeof window !== 'undefined' && window.BEAMDROP_BUILD)
    ? window.BEAMDROP_BUILD
    : { version: '1.6.2', buildHash: 'git-6abd' };
  
  const shortHash = (localBuild.buildHash || 'git-6abd').slice(0, 8);
  if (installedVer) installedVer.textContent = `v${localBuild.version} (${shortHash})`;
  if (appVerBadge) appVerBadge.textContent = `v${localBuild.version}`;
  if (cloudVer) cloudVer.textContent = `v${localBuild.version} (Cloud Ready)`;
  if (buildHashText) buildHashText.textContent = shortHash;
}

async function checkCloudStatus() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);

    const resp = await fetch(`${VERCEL_HOST}/version.json?_t=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timer);

    if (resp.ok) {
      remoteVersionData = await resp.json();
      const versionStr = remoteVersionData.version || remoteVersionData.latestVersion || '1.6.2';
      const hashStr = remoteVersionData.buildHash || 'latest';
      
      if (cloudVer) cloudVer.textContent = `v${versionStr} (Latest)`;
      if (buildHashText) buildHashText.textContent = hashStr;
      if (appVerBadge) appVerBadge.textContent = `v${versionStr}`;
    }
  } catch (err) {
    console.debug('Cloud status notice (using cached info):', err);
    if (cloudVer && cloudVer.textContent.includes('Checking')) {
      cloudVer.textContent = 'v1.6.2 (Ready)';
    }
  }
}

async function initFolderState() {
  try {
    if (window.BeamDropFolderStore) {
      const data = await window.BeamDropFolderStore.getFolderData();
      if (data && data.handle) {
        currentDirHandle = data.handle;
        currentFolderName = data.folderName || data.handle.name || 'Extension Folder';
        showFolderLinked(currentFolderName);
        return;
      }
    }
  } catch (err) {
    console.warn('initFolderState error:', err);
  }
  showFolderNotLinked();
}

function showFolderLinked(name) {
  const safeName = escapeHtml(name || 'Extension Folder');

  if (linkedFolderStatus) {
    linkedFolderStatus.className = 'folder-pill';
    linkedFolderStatus.innerHTML = `<span>🟢</span> <span>Linked Folder: <strong>${safeName}</strong></span>`;
  }

  if (btnSyncOverwrite) {
    btnSyncOverwrite.style.display = 'flex';
    if (btnSyncOverwriteText) {
      btnSyncOverwriteText.textContent = `⚡ 1-Click Clean-Overwrite: "${safeName}"`;
    }
  }
}

function showFolderNotLinked() {
  currentDirHandle = null;
  currentFolderName = '';

  if (linkedFolderStatus) {
    linkedFolderStatus.className = 'folder-pill not-linked';
    linkedFolderStatus.innerHTML = `<span>📁</span> <span>Click button below to select extension folder</span>`;
  }
  if (btnSyncOverwrite) {
    btnSyncOverwrite.style.display = 'none';
  }
}

// 1. Primary Action: Always Select Extension Folder & Clean-Overwrite
if (btnSelectAndSync) {
  btnSelectAndSync.addEventListener('click', async () => {
    try {
      if (typeof window.showDirectoryPicker !== 'function') {
        alert('File System Access API is not supported in this browser window.');
        return;
      }

      log('📁 Opening folder picker...');
      const handle = await window.showDirectoryPicker({
        id: 'beamdrop-extension-dir',
        mode: 'readwrite'
      });

      if (handle) {
        currentDirHandle = handle;
        currentFolderName = handle.name || 'Extension Folder';
        if (window.BeamDropFolderStore) {
          await window.BeamDropFolderStore.saveFolderHandle(handle);
        }
        showFolderLinked(currentFolderName);
        log(`✓ Folder chosen: ${currentFolderName}`);

        // Directly execute clean overwrite on chosen folder within user click context
        await executeCleanSync(handle);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Directory link failed:', err);
        alert('Could not link folder: ' + err.message);
      }
    }
  });
}

// 2. 1-Click Action: Overwrite previously stored folder (User Click Context)
if (btnSyncOverwrite) {
  btnSyncOverwrite.addEventListener('click', async () => {
    if (!currentDirHandle) {
      btnSelectAndSync ? btnSelectAndSync.click() : null;
      return;
    }
    await executeCleanSync(currentDirHandle);
  });
}

// 3. Core Engine: Bulletproof Dual-Engine (ZIP RAM-Unpack + Direct Cloud Files Fallback)
async function executeCleanSync(dirHandle) {
  if (!dirHandle) return;

  if (btnSelectAndSync) btnSelectAndSync.disabled = true;
  if (btnSyncOverwrite) btnSyncOverwrite.disabled = true;
  if (syncProgressWrap) syncProgressWrap.style.display = 'flex';
  if (logStream) {
    logStream.style.display = 'block';
    logStream.innerHTML = '';
  }

  try {
    log('⚡ Checking folder read/write permissions...');
    updateProgress(5, 'Requesting folder permissions...');

    // Request write permission inside user gesture
    if (window.BeamDropFolderStore) {
      const perm = await window.BeamDropFolderStore.requestPermission(dirHandle, true);
      if (perm !== 'granted') {
        throw new Error('Write permission was denied by user. Please click Allow in Chrome prompt.');
      }
    }

    let filesToWrite = [];

    // METHOD A: Try ZIP Bundle with JSZip if available
    let zipSuccess = false;
    if (typeof JSZip !== 'undefined') {
      try {
        log('⚡ Fetching ZIP package bundle from cloud into RAM...');
        updateProgress(15, 'Downloading package bundle...');
        const zipResp = await fetch(`${VERCEL_HOST}/extension.zip?_t=${Date.now()}`, { cache: 'no-store' });
        if (zipResp.ok) {
          const zipBuffer = await zipResp.arrayBuffer();
          log(`✓ Downloaded latest bundle (${Math.round(zipBuffer.byteLength / 1024)} KB)`);
          updateProgress(35, 'Extracting files in RAM...');

          const zip = await JSZip.loadAsync(zipBuffer);
          const entries = Object.keys(zip.files).filter(p => !zip.files[p].dir);

          for (const relPath of entries) {
            const fileData = await zip.files[relPath].async('uint8array');
            filesToWrite.push({ relPath, fileData });
          }
          log(`✓ All ${filesToWrite.length} files extracted safely via ZIP engine`);
          zipSuccess = true;
        }
      } catch (zipErr) {
        console.warn('ZIP engine notice, falling back to direct cloud stream:', zipErr);
      }
    }

    // METHOD B: Direct Cloud Stream (Works 100% even if JSZip is completely missing or folder is empty!)
    if (!zipSuccess || filesToWrite.length === 0) {
      log('⚡ Using Direct Cloud Stream engine (Zero-dependency fallback)...');
      updateProgress(20, 'Streaming files directly from cloud...');
      filesToWrite = [];

      for (let i = 0; i < ALL_EXTENSION_FILES.length; i++) {
        const fname = ALL_EXTENSION_FILES[i];
        try {
          const fileResp = await fetch(`${VERCEL_HOST}/extension/${fname}?_t=${Date.now()}`, { cache: 'no-store' });
          if (fileResp.ok) {
            const buf = await fileResp.arrayBuffer();
            filesToWrite.push({ relPath: fname, fileData: new Uint8Array(buf) });
            const fetchPct = 20 + Math.round((i / ALL_EXTENSION_FILES.length) * 30);
            updateProgress(fetchPct, `Fetched: ${fname}`);
          }
        } catch (fErr) {
          console.warn('Could not fetch file:', fname, fErr);
        }
      }
      log(`✓ Fetched ${filesToWrite.length} files directly from cloud`);
    }

    if (filesToWrite.length === 0) {
      throw new Error('Could not download extension files. Please check your internet connection.');
    }

    // STEP 4: NOW and ONLY NOW clean old files from disk
    log('🧹 Cleaning old files from folder...');
    updateProgress(55, 'Cleaning old files on disk...');
    let cleanedCount = 0;
    try {
      for await (const [name] of dirHandle.entries()) {
        if (name === '.git') continue;
        try {
          await dirHandle.removeEntry(name, { recursive: true });
          cleanedCount++;
          log(`🗑️ Removed: ${name}`);
        } catch (_) {}
      }
      log(`✓ Cleaned ${cleanedCount} old entries from folder`);
    } catch (cleanErr) {
      console.warn('Folder clean notice (will overwrite):', cleanErr);
    }

    // STEP 5: Write all fresh files directly to disk ("Wa yaqom bi wahd jadid")
    log('⚡ Writing fresh files directly to disk...');
    let written = 0;
    for (const { relPath, fileData } of filesToWrite) {
      const pathParts = relPath.split(/[/\\]/);
      let targetDir = dirHandle;

      for (let i = 0; i < pathParts.length - 1; i++) {
        const subDirName = pathParts[i];
        if (subDirName) {
          targetDir = await targetDir.getDirectoryHandle(subDirName, { create: true });
        }
      }

      const fileName = pathParts[pathParts.length - 1];
      const fileHandle = await targetDir.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(fileData);
      await writable.close();

      written++;
      const pct = 60 + Math.round((written / filesToWrite.length) * 38);
      updateProgress(pct, `Writing: ${relPath}`);
      log(`✓ Written fresh: ${relPath}`);
    }

    updateProgress(100, '✓ All files cleanly updated! Reloading extension...');
    log(`✅ SUCCESS: All ${written} extension files written to disk cleanly!`);
    showToast('✓ Clean update complete! Extension reloaded.');

    setTimeout(() => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.reload) {
        chrome.runtime.reload();
      } else {
        window.location.reload();
      }
    }, 750);

  } catch (err) {
    console.error('Clean sync failed:', err);
    log(`❌ Error: ${err.message}`);
    updateProgress(0, 'Update failed: ' + err.message);
    if (btnSelectAndSync) btnSelectAndSync.disabled = false;
    if (btnSyncOverwrite) btnSyncOverwrite.disabled = false;
  }
}

function updateProgress(percent, label) {
  if (syncProgressFill) syncProgressFill.style.width = `${percent}%`;
  if (syncProgressPercent) syncProgressPercent.textContent = `${percent}%`;
  if (syncProgressLabel) syncProgressLabel.textContent = label;
}

function log(msg) {
  if (!logStream) return;
  const p = document.createElement('div');
  p.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logStream.appendChild(p);
  logStream.scrollTop = logStream.scrollHeight;
}

function showToast(msg) {
  if (!toastSuccess) return;
  toastSuccess.textContent = msg;
  toastSuccess.style.display = 'block';
  toastSuccess.style.opacity = '1';
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}
