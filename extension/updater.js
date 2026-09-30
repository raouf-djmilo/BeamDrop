/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BeamDrop Extension Direct In-Place Folder Updater (Zero-ZIP)
 */

const VERCEL_BASE = "https://beam-drop-mu.vercel.app";

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

let currentDirHandle = null;
let remoteVersionData = null;

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
  displayLocalBuildInfo();
  await checkCloudStatus();
  await initFolderState();
});

function displayLocalBuildInfo() {
  const localBuild = (typeof window !== 'undefined' && window.BEAMDROP_BUILD)
    ? window.BEAMDROP_BUILD
    : { version: '1.6.2', buildHash: 'local-init' };
  
  if (installedVer) installedVer.textContent = `v${localBuild.version} (${localBuild.buildHash.slice(0, 8)})`;
  if (appVerBadge) appVerBadge.textContent = `v${localBuild.version}`;
}

async function checkCloudStatus() {
  try {
    const resp = await fetch(`${VERCEL_BASE}/version.json?_t=${Date.now()}`, { cache: 'no-store' });
    if (resp.ok) {
      remoteVersionData = await resp.json();
      if (cloudVer) cloudVer.textContent = `v${remoteVersionData.version || '1.6.2'}`;
      if (buildHashText) buildHashText.textContent = remoteVersionData.buildHash || 'latest';
    }
  } catch (err) {
    if (cloudVer) cloudVer.textContent = 'Unavailable';
    if (buildHashText) buildHashText.textContent = 'Offline';
  }
}

async function initFolderState() {
  try {
    if (window.BeamDropFolderStore) {
      currentDirHandle = await window.BeamDropFolderStore.getFolderHandle();
      if (currentDirHandle) {
        const hasPerm = await window.BeamDropFolderStore.verifyPermission(currentDirHandle, false);
        if (hasPerm) {
          showFolderLinked(currentDirHandle.name);
          return;
        }
      }
    }
  } catch (_) {}
  showFolderNotLinked();
}

function showFolderLinked(name) {
  if (linkedFolderStatus) {
    linkedFolderStatus.className = 'folder-pill';
    linkedFolderStatus.innerHTML = `<span>🟢</span> <span>Linked Folder: <strong>${name}</strong></span>`;
  }
  if (btnLinkFolder) btnLinkFolder.style.display = 'none';
  if (btnSyncOverwrite) btnSyncOverwrite.style.display = 'flex';
  if (btnChangeFolder) btnChangeFolder.style.display = 'flex';
}

function showFolderNotLinked() {
  if (linkedFolderStatus) {
    linkedFolderStatus.className = 'folder-pill not-linked';
    linkedFolderStatus.innerHTML = `<span>⚠️</span> <span>No local folder linked yet</span>`;
  }
  if (btnLinkFolder) btnLinkFolder.style.display = 'flex';
  if (btnSyncOverwrite) btnSyncOverwrite.style.display = 'none';
  if (btnChangeFolder) btnChangeFolder.style.display = 'none';
}

// 1. Link Folder
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
      await window.BeamDropFolderStore.saveFolderHandle(handle);
      showFolderLinked(handle.name);
      log(`Linked directory: ${handle.name}`);
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Directory link failed:', err);
      alert('Could not link folder: ' + err.message);
    }
  }
});

if (btnChangeFolder) {
  btnChangeFolder.addEventListener('click', async () => {
    try {
      const handle = await window.showDirectoryPicker({
        id: 'beamdrop-extension-dir',
        mode: 'readwrite'
      });
      if (handle) {
        currentDirHandle = handle;
        await window.BeamDropFolderStore.saveFolderHandle(handle);
        showFolderLinked(handle.name);
      }
    } catch (_) {}
  });
}

// 2. Direct In-Place Sync & Overwrite
btnSyncOverwrite.addEventListener('click', async () => {
  if (!currentDirHandle) return;

  btnSyncOverwrite.disabled = true;
  if (btnChangeFolder) btnChangeFolder.disabled = true;
  if (syncProgressWrap) syncProgressWrap.style.display = 'flex';
  if (logStream) {
    logStream.style.display = 'block';
    logStream.innerHTML = '';
  }

  try {
    log('⚡ Verifying folder write permissions...');
    const hasPerm = await window.BeamDropFolderStore.verifyPermission(currentDirHandle, true);
    if (!hasPerm) {
      throw new Error('Permission to write to directory was denied by user.');
    }

    log('⚡ Fetching extension source bundle...');
    updateProgress(10, 'Fetching package bundle...');

    // Fetch extension.zip bundle into ArrayBuffer
    const zipResp = await fetch(`${VERCEL_BASE}/extension.zip?_t=${Date.now()}`, { cache: 'no-store' });
    if (!zipResp.ok) {
      throw new Error('Failed to fetch update bundle from Vercel: ' + zipResp.status);
    }

    const zipBuffer = await zipResp.arrayBuffer();
    log(`✓ Bundle downloaded in RAM (${Math.round(zipBuffer.byteLength / 1024)} KB)`);
    updateProgress(25, 'Unpacking files in memory...');

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
      const pct = 25 + Math.round((written / entries.length) * 65);
      updateProgress(pct, `Writing: ${relPath}`);
      log(`✓ Overwritten: ${relPath}`);
    }

    updateProgress(95, 'Finalizing sync...');
    log('⚡ All files written directly to disk. Reloading extension...');

    setTimeout(() => {
      updateProgress(100, '✓ Complete! Extension reloaded.');
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.reload) {
        chrome.runtime.reload();
      } else {
        window.location.reload();
      }
    }, 600);

  } catch (err) {
    console.error('In-place update failed:', err);
    log(`❌ Error: ${err.message}`);
    updateProgress(0, 'Update failed: ' + err.message);
    btnSyncOverwrite.disabled = false;
    if (btnChangeFolder) btnChangeFolder.disabled = false;
  }
});

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

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}
