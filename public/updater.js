/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BeamDrop Extension Studio - Liquid Glass Direct File Injector
 * 3-Button Architecture: Select Folder -> Clean Folder -> Inject All Files
 */

const VERCEL_HOST = "https://beam-drop-mu.vercel.app";

const INJECT_FILES = [
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
  'peerjs.min.js',
  'qrcode.min.js',
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

const btnStep1Select = document.getElementById('btnStep1Select');
const btnStep2Clean = document.getElementById('btnStep2Clean');
const btnStep3Inject = document.getElementById('btnStep3Inject');
const btnMasterSync = document.getElementById('btnMasterSync');

const syncProgressWrap = document.getElementById('syncProgressWrap');
const syncProgressLabel = document.getElementById('syncProgressLabel');
const syncProgressPercent = document.getElementById('syncProgressPercent');
const syncProgressFill = document.getElementById('syncProgressFill');
const logStream = document.getElementById('logStream');
const toastSuccess = document.getElementById('toastSuccess');

let currentDirHandle = null;
let currentFolderName = '';

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  displayLocalBuildInfo();
  initFolderState();
  checkCloudStatus();
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
      const data = await resp.json();
      const versionStr = data.version || data.latestVersion || '1.6.2';
      const hashStr = data.buildHash || 'latest';
      
      if (cloudVer) cloudVer.textContent = `v${versionStr} (Latest)`;
      if (buildHashText) buildHashText.textContent = hashStr;
      if (appVerBadge) appVerBadge.textContent = `v${versionStr}`;
    }
  } catch (err) {
    if (cloudVer) cloudVer.textContent = 'v1.6.2 (Ready)';
  }
}

async function initFolderState() {
  try {
    if (window.BeamDropFolderStore) {
      const data = await window.BeamDropFolderStore.getFolderData();
      if (data && data.handle) {
        currentDirHandle = data.handle;
        currentFolderName = data.folderName || data.handle.name || 'EXTN';
        showFolderLinked(currentFolderName);
        return;
      }
    }
  } catch (err) {
    console.warn('initFolderState:', err);
  }
  showFolderNotLinked();
}

function showFolderLinked(name) {
  const safeName = escapeHtml(name || 'EXTN');
  if (linkedFolderStatus) {
    linkedFolderStatus.className = 'folder-pill';
    linkedFolderStatus.innerHTML = `<span>🟢 Linked Folder: <strong>${safeName}</strong></span> <span style="color:#059669; font-weight:700;">✓ Ready</span>`;
  }
}

function showFolderNotLinked() {
  currentDirHandle = null;
  currentFolderName = '';
  if (linkedFolderStatus) {
    linkedFolderStatus.className = 'folder-pill not-linked';
    linkedFolderStatus.innerHTML = `<span>📁 <strong>No folder selected yet</strong></span> <span style="font-size:11px; opacity:0.85;">Click Step 1 below</span>`;
  }
}

// ─────────────────────────────────────────────────────────────
// BUTTON 1: SELECT EXTENSION FOLDER
// ─────────────────────────────────────────────────────────────
if (btnStep1Select) {
  btnStep1Select.addEventListener('click', async () => {
    try {
      if (typeof window.showDirectoryPicker !== 'function') {
        alert('File System Access API is not supported in this browser window.');
        return;
      }

      showLogStream();
      log('📁 Opening native folder picker...');

      const handle = await window.showDirectoryPicker({
        id: 'beamdrop-extension-dir',
        mode: 'readwrite'
      });

      if (handle) {
        currentDirHandle = handle;
        currentFolderName = handle.name || 'EXTN';

        if (window.BeamDropFolderStore) {
          await window.BeamDropFolderStore.saveFolderHandle(handle);
        }

        showFolderLinked(currentFolderName);
        log(`✓ Successfully linked folder: "${currentFolderName}"`);
        showToast(`✓ Folder "${currentFolderName}" linked! Now click Step 2 or Step 3.`);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Directory link failed:', err);
        log(`❌ Error: ${err.message}`);
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────
// BUTTON 2: CLEAN FOLDER (REMOVE OLD FILES)
// ─────────────────────────────────────────────────────────────
if (btnStep2Clean) {
  btnStep2Clean.addEventListener('click', async () => {
    if (!currentDirHandle) {
      alert('Please click Step 1 first to select your extension folder!');
      btnStep1Select ? btnStep1Select.click() : null;
      return;
    }
    await executeCleanFolder(currentDirHandle);
  });
}

async function executeCleanFolder(dirHandle) {
  showLogStream();
  showProgress('🧹 Cleaning old files from folder...', 10);
  log('⚡ Requesting write permissions for cleaning...');

  try {
    if (window.BeamDropFolderStore) {
      const perm = await window.BeamDropFolderStore.requestPermission(dirHandle, true);
      if (perm !== 'granted') {
        throw new Error('Write permission was denied. Please click Allow in Chrome prompt.');
      }
    }

    log('🧹 Removing old files from directory...');
    let cleanedCount = 0;

    for await (const [name] of dirHandle.entries()) {
      if (name === '.git') continue;
      try {
        await dirHandle.removeEntry(name, { recursive: true });
        cleanedCount++;
        log(`🗑️ Removed: ${name}`);
      } catch (e) {
        console.warn('Could not remove entry:', name, e);
      }
    }

    showProgress(`✓ Cleaned ${cleanedCount} old items from folder!`, 100);
    log(`✅ SUCCESS: Cleaned ${cleanedCount} items! Folder is now ready for Step 3 (Inject).`);
    showToast(`✓ Cleaned ${cleanedCount} files! Ready to Inject.`);
  } catch (err) {
    console.error('Clean failed:', err);
    log(`❌ Clean Error: ${err.message}`);
    showProgress('Cleaning failed: ' + err.message, 0);
  }
}

// ─────────────────────────────────────────────────────────────
// BUTTON 3: INJECT ALL 21 EXTENSION FILES (DIRECT CLOUD STREAM)
// ─────────────────────────────────────────────────────────────
if (btnStep3Inject) {
  btnStep3Inject.addEventListener('click', async () => {
    if (!currentDirHandle) {
      alert('Please click Step 1 first to select your extension folder!');
      btnStep1Select ? btnStep1Select.click() : null;
      return;
    }
    await executeInjectFiles(currentDirHandle);
  });
}

async function executeInjectFiles(dirHandle) {
  showLogStream();
  showProgress('⚡ Starting Direct Cloud Stream Injection...', 5);
  log(`🚀 Starting Direct Cloud Stream for ${INJECT_FILES.length} files...`);

  try {
    if (window.BeamDropFolderStore) {
      const perm = await window.BeamDropFolderStore.requestPermission(dirHandle, true);
      if (perm !== 'granted') {
        throw new Error('Write permission was denied. Please click Allow in Chrome prompt.');
      }
    }

    let written = 0;
    const total = INJECT_FILES.length;

    for (let i = 0; i < total; i++) {
      const fname = INJECT_FILES[i];
      const fileUrl = `${VERCEL_HOST}/extension/${fname}?_t=${Date.now()}`;

      try {
        log(`⬇️ Fetching: ${fname}...`);
        const resp = await fetch(fileUrl, { cache: 'no-store' });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status} for ${fname}`);
        }

        const arrayBuffer = await resp.arrayBuffer();

        // Handle subdirectories (icons/, libs/)
        const pathParts = fname.split(/[/\\]/);
        let targetDir = dirHandle;

        for (let p = 0; p < pathParts.length - 1; p++) {
          const subDirName = pathParts[p];
          if (subDirName) {
            targetDir = await targetDir.getDirectoryHandle(subDirName, { create: true });
          }
        }

        const fileName = pathParts[pathParts.length - 1];
        const fileHandle = await targetDir.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(arrayBuffer);
        await writable.close();

        written++;
        const pct = Math.round((written / total) * 100);
        showProgress(`Injecting: ${fname} (${written}/${total})`, pct);
        log(`✓ Injected [${written}/${total}]: ${fname} (${arrayBuffer.byteLength} B)`);
      } catch (fileErr) {
        log(`⚠️ Warning on ${fname}: ${fileErr.message}`);
      }
    }

    showProgress('✅ All files injected successfully! Reloading...', 100);
    log(`🎉 SUCCESS: All ${written} files cleanly injected into folder!`);
    showToast('✓ Complete! Extension files injected and ready.');

    setTimeout(() => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.reload) {
        chrome.runtime.reload();
      } else {
        window.location.reload();
      }
    }, 1000);

  } catch (err) {
    console.error('Inject failed:', err);
    log(`❌ Inject Error: ${err.message}`);
    showProgress('Injection failed: ' + err.message, 0);
  }
}

// ─────────────────────────────────────────────────────────────
// MASTER 1-CLICK SYNC: SELECT + CLEAN + INJECT
// ─────────────────────────────────────────────────────────────
if (btnMasterSync) {
  btnMasterSync.addEventListener('click', async () => {
    try {
      if (!currentDirHandle) {
        if (typeof window.showDirectoryPicker !== 'function') {
          alert('File System Access API is not supported in this browser window.');
          return;
        }

        showLogStream();
        log('📁 [Master Sync] Step 1: Requesting folder...');
        const handle = await window.showDirectoryPicker({
          id: 'beamdrop-extension-dir',
          mode: 'readwrite'
        });

        if (!handle) return;
        currentDirHandle = handle;
        currentFolderName = handle.name || 'EXTN';
        if (window.BeamDropFolderStore) {
          await window.BeamDropFolderStore.saveFolderHandle(handle);
        }
        showFolderLinked(currentFolderName);
      }

      // Execute Clean
      await executeCleanFolder(currentDirHandle);

      // Execute Inject
      await executeInjectFiles(currentDirHandle);

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Master sync failed:', err);
        log(`❌ Master Sync Error: ${err.message}`);
      }
    }
  });
}

// UI Helpers
function showProgress(label, pct) {
  if (syncProgressWrap) syncProgressWrap.style.display = 'flex';
  if (syncProgressLabel) syncProgressLabel.textContent = label;
  if (syncProgressPercent) syncProgressPercent.textContent = `${pct}%`;
  if (syncProgressFill) syncProgressFill.style.width = `${pct}%`;
}

function showLogStream() {
  if (logStream) logStream.style.display = 'block';
}

function log(msg) {
  if (!logStream) return;
  const div = document.createElement('div');
  div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logStream.appendChild(div);
  logStream.scrollTop = logStream.scrollHeight;
}

function showToast(msg) {
  if (!toastSuccess) return;
  toastSuccess.textContent = msg;
  toastSuccess.style.display = 'block';
  setTimeout(() => {
    toastSuccess.style.display = 'none';
  }, 4000);
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
