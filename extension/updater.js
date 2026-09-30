/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BeamDrop Extension Direct In-Place Folder Updater (Zero-ZIP)
 * File System Access API Clean In-Place Disk Synchronization
 */

const VERCEL_HOST = "https://beam-drop-mu.vercel.app";

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

  // 4. Handle ?action=sync
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('action') === 'sync') {
    setTimeout(async () => {
      if (currentDirHandle) {
        log('⚡ Auto-initiating clean sync on stored folder...');
        executeCleanSync(currentDirHandle);
      }
    }, 500);
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

        // Directly execute clean overwrite on chosen folder
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

// 2. 1-Click Action: Overwrite previously stored folder
if (btnSyncOverwrite) {
  btnSyncOverwrite.addEventListener('click', async () => {
    if (!currentDirHandle) {
      btnSelectAndSync ? btnSelectAndSync.click() : null;
      return;
    }
    await executeCleanSync(currentDirHandle);
  });
}

// 3. Core Engine: Clean Old Files & Overwrite with Fresh Package
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

    // Request write permission
    if (window.BeamDropFolderStore) {
      const perm = await window.BeamDropFolderStore.requestPermission(dirHandle, true);
      if (perm !== 'granted') {
        throw new Error('Write permission was denied by user. Please grant permission in Chrome prompt.');
      }
    }

    // Step 1: Clean old files in the directory ("Remove all fiche")
    log('🧹 Cleaning old extension files from folder...');
    updateProgress(15, 'Removing old files from directory...');
    let cleanedCount = 0;
    try {
      for await (const [name, handle] of dirHandle.entries()) {
        // Protect .git or system folders
        if (name === '.git') continue;
        try {
          await dirHandle.removeEntry(name, { recursive: true });
          cleanedCount++;
          log(`🗑️ Cleaned: ${name}`);
        } catch (delErr) {
          console.debug('Skip entry delete:', name, delErr);
        }
      }
      log(`✓ Cleaned ${cleanedCount} old entries from folder`);
    } catch (cleanErr) {
      console.warn('Folder clean notice (will overwrite):', cleanErr);
    }

    // Step 2: Download latest package bundle from Vercel into RAM
    log('⚡ Downloading latest extension package from cloud into RAM...');
    updateProgress(35, 'Downloading fresh extension package in RAM...');

    const zipResp = await fetch(`${VERCEL_HOST}/extension.zip?_t=${Date.now()}`, { cache: 'no-store' });
    if (!zipResp.ok) {
      throw new Error(`Failed to download update bundle: status ${zipResp.status}`);
    }

    const zipBuffer = await zipResp.arrayBuffer();
    log(`✓ Downloaded latest bundle (${Math.round(zipBuffer.byteLength / 1024)} KB)`);
    updateProgress(50, 'Extracting 25 fresh files in RAM...');

    // Load JSZip
    if (typeof JSZip === 'undefined') {
      await loadScript('libs/jszip.min.js');
    }

    const zip = await JSZip.loadAsync(zipBuffer);
    const entries = Object.keys(zip.files).filter(p => !zip.files[p].dir);
    log(`✓ Found ${entries.length} fresh files to write to disk`);

    // Step 3: Write fresh files directly to disk ("Wa yaqom bi wahd jadid")
    let written = 0;
    for (const relPath of entries) {
      const zipEntry = zip.files[relPath];
      const fileData = await zipEntry.async('uint8array');

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
      const pct = 50 + Math.round((written / entries.length) * 48);
      updateProgress(pct, `Writing: ${relPath}`);
      log(`✓ Written fresh: ${relPath}`);
    }

    updateProgress(100, '✓ All files cleanly updated! Reloading extension...');
    log('✅ SUCCESS: All extension files cleanly replaced on disk!');
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

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
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
