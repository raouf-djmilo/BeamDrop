/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BeamDrop Extension Direct In-Place Folder Updater (Zero-ZIP)
 * File System Access API In-Place Disk Synchronization
 */

const VERCEL_HOST = "https://beam-drop-mu.vercel.app";

const installedVer = document.getElementById('installedVer');
const cloudVer = document.getElementById('cloudVer');
const buildHashText = document.getElementById('buildHashText');
const appVerBadge = document.getElementById('appVerBadge');
const linkedFolderStatus = document.getElementById('linkedFolderStatus');
const linkedFolderName = document.getElementById('linkedFolderName');
const btnLinkFolder = document.getElementById('btnLinkFolder');
const btnSyncOverwrite = document.getElementById('btnSyncOverwrite');
const btnChangeFolder = document.getElementById('btnChangeFolder');
const syncProgressWrap = document.getElementById('syncProgressWrap');
const syncProgressLabel = document.getElementById('syncProgressLabel');
const syncProgressPercent = document.getElementById('syncProgressPercent');
const syncProgressFill = document.getElementById('syncProgressFill');
const logStream = document.getElementById('logStream');
const toastSuccess = document.getElementById('toastSuccess');

let currentDirHandle = null;
let currentFolderName = '';
let currentPermissionStatus = 'prompt'; // 'granted' | 'prompt' | 'denied' | 'none'
let remoteVersionData = null;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', async () => {
  displayLocalBuildInfo();
  
  // 1. Fetch live cloud build immediately via absolute production URL
  await checkCloudStatus();
  
  // 2. Initialize folder state and query permission without intrusive prompts
  await initFolderState();

  // 3. If opened from popup with action=sync, auto trigger if folder is already linked
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('action') === 'sync' && currentDirHandle) {
    setTimeout(() => {
      if (btnSyncOverwrite && !btnSyncOverwrite.disabled && btnSyncOverwrite.style.display !== 'none') {
        btnSyncOverwrite.click();
      }
    }, 400);
  }
});

function displayLocalBuildInfo() {
  const localBuild = (typeof window !== 'undefined' && window.BEAMDROP_BUILD)
    ? window.BEAMDROP_BUILD
    : { version: '1.6.2', buildHash: 'local-init' };
  
  const shortHash = (localBuild.buildHash || 'local').slice(0, 8);
  if (installedVer) installedVer.textContent = `v${localBuild.version} (${shortHash})`;
  if (appVerBadge) appVerBadge.textContent = `v${localBuild.version}`;
}

function getTargetBuildLabel() {
  if (remoteVersionData && remoteVersionData.buildHash) {
    return 'Patch ' + remoteVersionData.buildHash.slice(0, 8);
  }
  if (remoteVersionData && (remoteVersionData.version || remoteVersionData.latestVersion)) {
    return 'v' + (remoteVersionData.version || remoteVersionData.latestVersion);
  }
  return 'Latest Build';
}

async function checkCloudStatus() {
  if (cloudVer) cloudVer.textContent = 'Checking...';
  if (buildHashText) buildHashText.textContent = 'Checking...';

  try {
    const resp = await fetch(`${VERCEL_HOST}/version.json?_t=${Date.now()}`, { cache: 'no-store' });
    if (resp.ok) {
      remoteVersionData = await resp.json();
      const versionStr = remoteVersionData.version || remoteVersionData.latestVersion || '1.6.2';
      const hashStr = remoteVersionData.buildHash || 'latest';
      
      if (cloudVer) cloudVer.textContent = `v${versionStr}`;
      if (buildHashText) buildHashText.textContent = hashStr;
      if (appVerBadge) appVerBadge.textContent = `v${versionStr}`;
      
      updateSyncButtonLabel();
      return remoteVersionData;
    } else {
      throw new Error(`Cloud returned status ${resp.status}`);
    }
  } catch (err) {
    console.warn('Could not fetch cloud build info from Vercel:', err);
    if (cloudVer) cloudVer.textContent = 'Unavailable';
    if (buildHashText) buildHashText.textContent = 'Offline';
  }
}

async function initFolderState() {
  try {
    if (window.BeamDropFolderStore) {
      const data = await window.BeamDropFolderStore.getFolderData();
      if (data && data.handle) {
        currentDirHandle = data.handle;
        currentFolderName = data.folderName || data.handle.name || 'beamdrop-extension';
        
        // Query permission non-intrusively (does NOT prompt user)
        currentPermissionStatus = await window.BeamDropFolderStore.queryPermission(currentDirHandle, true);
        showFolderLinked(currentFolderName, currentPermissionStatus);
        return;
      }
    }
  } catch (err) {
    console.warn('initFolderState error:', err);
  }
  showFolderNotLinked();
}

function showFolderLinked(name, permStatus) {
  const safeName = escapeHtml(name || 'beamdrop-extension');

  if (linkedFolderStatus) {
    if (permStatus === 'granted') {
      linkedFolderStatus.className = 'folder-pill';
      linkedFolderStatus.innerHTML = `<span>🟢</span> <span>Linked Folder: <strong>${safeName}</strong></span>`;
    } else if (permStatus === 'prompt') {
      linkedFolderStatus.className = 'folder-pill';
      linkedFolderStatus.innerHTML = `<span>📁</span> <span>Linked Folder: <strong>${safeName}</strong> <span style="font-weight: normal; opacity: 0.85;">(Permission confirmation needed)</span></span>`;
    } else {
      linkedFolderStatus.className = 'folder-pill not-linked';
      linkedFolderStatus.innerHTML = `<span>⚠️</span> <span>Linked Folder: <strong>${safeName}</strong> (Permission denied)</span>`;
    }
  }

  if (btnLinkFolder) btnLinkFolder.style.display = 'none';
  if (btnSyncOverwrite) btnSyncOverwrite.style.display = 'flex';
  if (btnChangeFolder) btnChangeFolder.style.display = 'flex';

  updateSyncButtonLabel();
}

function showFolderNotLinked() {
  currentDirHandle = null;
  currentFolderName = '';
  currentPermissionStatus = 'none';

  if (linkedFolderStatus) {
    linkedFolderStatus.className = 'folder-pill not-linked';
    linkedFolderStatus.innerHTML = `<span>⚠️</span> <span>No local folder linked yet</span>`;
  }
  if (btnLinkFolder) {
    btnLinkFolder.style.display = 'flex';
    btnLinkFolder.innerHTML = `<span>📁 Link Local Extension Folder Once</span>`;
  }
  if (btnSyncOverwrite) btnSyncOverwrite.style.display = 'none';
  if (btnChangeFolder) btnChangeFolder.style.display = 'none';
}

function updateSyncButtonLabel() {
  if (!btnSyncOverwrite) return;
  const targetLabel = getTargetBuildLabel();

  if (currentPermissionStatus === 'prompt') {
    btnSyncOverwrite.innerHTML = `<span>⚡ Verify Permission & Sync to ${escapeHtml(targetLabel)}</span>`;
  } else if (currentPermissionStatus === 'denied') {
    btnSyncOverwrite.innerHTML = `<span>⚡ Re-authorize Permission & Sync</span>`;
  } else {
    btnSyncOverwrite.innerHTML = `<span>⚡ Sync & Overwrite to ${escapeHtml(targetLabel)}</span>`;
  }
}

// 1. Link Folder handler (User Gesture)
if (btnLinkFolder) {
  btnLinkFolder.addEventListener('click', async () => {
    try {
      if (typeof window.showDirectoryPicker !== 'function') {
        alert('File System Access API is not supported in this browser window.');
        return;
      }
      const handle = await window.showDirectoryPicker({
        id: 'beamdrop-extension-dir',
        mode: 'readwrite'
      });
      if (handle) {
        currentDirHandle = handle;
        currentFolderName = handle.name || 'beamdrop-extension';
        await window.BeamDropFolderStore.saveFolderHandle(handle);
        currentPermissionStatus = 'granted';
        showFolderLinked(currentFolderName, 'granted');
        log(`✓ Successfully linked folder: ${currentFolderName}`);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Directory link failed:', err);
        alert('Could not link folder: ' + err.message);
      }
    }
  });
}

// 2. Change Folder handler
if (btnChangeFolder) {
  btnChangeFolder.addEventListener('click', async () => {
    try {
      if (typeof window.showDirectoryPicker !== 'function') {
        alert('File System Access API is not supported in this browser window.');
        return;
      }
      const handle = await window.showDirectoryPicker({
        id: 'beamdrop-extension-dir',
        mode: 'readwrite'
      });
      if (handle) {
        currentDirHandle = handle;
        currentFolderName = handle.name || 'beamdrop-extension';
        await window.BeamDropFolderStore.saveFolderHandle(handle);
        currentPermissionStatus = 'granted';
        showFolderLinked(currentFolderName, 'granted');
        log(`✓ Switched to directory: ${currentFolderName}`);
      }
    } catch (_) {}
  });
}

// 3. Direct In-Place Sync & Overwrite (One-Click or Verify Permission & Sync)
if (btnSyncOverwrite) {
  btnSyncOverwrite.addEventListener('click', async () => {
    if (!currentDirHandle) {
      showFolderNotLinked();
      return;
    }

    btnSyncOverwrite.disabled = true;
    if (btnChangeFolder) btnChangeFolder.disabled = true;
    if (syncProgressWrap) syncProgressWrap.style.display = 'flex';
    if (logStream) {
      logStream.style.display = 'block';
      logStream.innerHTML = '';
    }

    try {
      log('⚡ Checking folder write permission...');
      updateProgress(5, 'Checking folder permissions...');

      // 1-Click Permission Re-grant:
      // If permission is 'prompt', requestPermission MUST execute inside this click handler
      const perm = await window.BeamDropFolderStore.queryPermission(currentDirHandle, true);
      if (perm !== 'granted') {
        log('⚡ Requesting readwrite permission from Chrome...');
        updateProgress(10, 'Awaiting user permission confirmation...');
        
        const reqStatus = await window.BeamDropFolderStore.requestPermission(currentDirHandle, true);
        if (reqStatus !== 'granted') {
          throw new Error('Permission to write to directory was denied by user.');
        }
        currentPermissionStatus = 'granted';
        showFolderLinked(currentFolderName, 'granted');
        log('✓ Permission granted to write files!');
      }

      log('⚡ Fetching extension source bundle from production Vercel server...');
      updateProgress(18, 'Downloading package bundle from Vercel...');

      // Fetch extension.zip bundle into ArrayBuffer using absolute production URL
      const zipResp = await fetch(`${VERCEL_HOST}/extension.zip?_t=${Date.now()}`, { cache: 'no-store' });
      if (!zipResp.ok) {
        throw new Error(`Failed to fetch update bundle from Vercel: status ${zipResp.status}`);
      }

      const zipBuffer = await zipResp.arrayBuffer();
      log(`✓ Bundle downloaded in RAM (${Math.round(zipBuffer.byteLength / 1024)} KB)`);
      updateProgress(30, 'Unpacking files in RAM...');

      // Dynamically load JSZip if needed
      if (typeof JSZip === 'undefined') {
        await loadScript('libs/jszip.min.js');
      }

      const zip = await JSZip.loadAsync(zipBuffer);
      const entries = Object.keys(zip.files).filter(p => !zip.files[p].dir);
      log(`✓ Found ${entries.length} files to overwrite on disk`);

      let written = 0;
      for (const relPath of entries) {
        const zipEntry = zip.files[relPath];
        const fileData = await zipEntry.async('uint8array');

        // Handle subdirectories (e.g., icons/icon16.png, libs/...)
        const pathParts = relPath.split(/[/\\]/);
        let targetDir = currentDirHandle;

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
        const pct = 30 + Math.round((written / entries.length) * 65);
        updateProgress(pct, `Writing: ${relPath}`);
        log(`✓ Overwritten: ${relPath}`);
      }

      updateProgress(98, 'Finalizing sync...');
      log('⚡ All files written directly to disk. Triggering extension reload...');

      // Success notification toast
      updateProgress(100, '✓ Files updated successfully! Extension reloaded.');
      showToast('✓ Files updated successfully! Extension reloaded.');

      setTimeout(() => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.reload) {
          chrome.runtime.reload();
        } else {
          window.location.reload();
        }
      }, 750);

    } catch (err) {
      console.error('In-place update failed:', err);
      log(`❌ Error: ${err.message}`);
      updateProgress(0, 'Update failed: ' + err.message);
      btnSyncOverwrite.disabled = false;
      if (btnChangeFolder) btnChangeFolder.disabled = false;

      if (err.message && err.message.toLowerCase().includes('permission')) {
        currentPermissionStatus = 'denied';
        showFolderLinked(currentFolderName, 'denied');
      }
    }
  });
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
