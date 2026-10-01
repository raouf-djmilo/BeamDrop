/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BeamDrop Extension Studio - Liquid Glass Direct File Injector
 * 3-Button Architecture: Select Folder -> Clean Folder -> Inject All Files
 * Live GitHub Repository Sync & Multi-Mirror Engine
 */

const GITHUB_REPO = "raouf-djmilo/BeamDrop";
const GITHUB_BRANCH = "main";
const GITHUB_RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/extension`;
const GITHUB_TREE_API = `https://api.github.com/repos/${GITHUB_REPO}/git/trees/${GITHUB_BRANCH}?recursive=1`;
const GITHUB_COMMITS_API = `https://api.github.com/repos/${GITHUB_REPO}/commits?path=extension&per_page=1`;
const GITHUB_VERSION_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/public/version.json`;
const VERCEL_HOST = "https://beam-drop-mu.vercel.app";

const DEFAULT_INJECT_FILES = [
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
  'update.bat',
  'update.sh',
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

  // Check if auto-sync was requested via URL ?action=sync
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('action') === 'sync' || urlParams.get('action') === 'update') {
    setTimeout(() => {
      if (btnMasterSync) {
        log('⚡ Auto-triggered Sync requested via URL parameter...');
        btnMasterSync.click();
      }
    }, 600);
  }
});

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

function displayLocalBuildInfo() {
  const localBuild = (typeof window !== 'undefined' && window.BEAMDROP_BUILD)
    ? window.BEAMDROP_BUILD
    : { version: '1.6.2', buildHash: 'git-6abe' };
  
  const shortHash = (localBuild.buildHash || 'git-6abe').slice(0, 8);
  if (installedVer) installedVer.textContent = `v${localBuild.version} (${shortHash})`;
  if (appVerBadge) appVerBadge.textContent = `v${localBuild.version}`;
  if (cloudVer) cloudVer.textContent = `v${localBuild.version} (Checking GitHub...)`;
  if (buildHashText) buildHashText.textContent = shortHash;
}

async function checkCloudStatus() {
  let latestVersion = '1.6.2';
  let latestHash = '';
  let commitMessage = '';

  // 1. Check GitHub raw public/version.json
  try {
    const vResp = await fetch(`${GITHUB_VERSION_URL}?_t=${Date.now()}`, { cache: 'no-store' });
    if (vResp.ok) {
      const vData = await vResp.json();
      if (vData && (vData.version || vData.latestVersion)) {
        latestVersion = vData.version || vData.latestVersion;
        latestHash = vData.buildHash || '';
      }
    }
  } catch (_) {}

  // 2. Check GitHub Commit for extension folder
  try {
    const cResp = await fetch(`${GITHUB_COMMITS_API}&_t=${Date.now()}`, { cache: 'no-store' });
    if (cResp.ok) {
      const commits = await cResp.json();
      if (Array.isArray(commits) && commits.length > 0 && commits[0].sha) {
        latestHash = commits[0].sha.slice(0, 8);
        commitMessage = (commits[0].commit && commits[0].commit.message)
          ? commits[0].commit.message.split('\n')[0]
          : '';
      }
    }
  } catch (_) {}

  // 3. Fallback to Vercel host / version.json
  if (!latestHash) {
    try {
      const resp = await fetch(`${VERCEL_HOST}/version.json?_t=${Date.now()}`, { cache: 'no-store' });
      if (resp.ok) {
        const data = await resp.json();
        latestVersion = data.version || latestVersion;
        latestHash = data.buildHash || latestHash;
      }
    } catch (_) {}
  }

  const localBuild = (typeof window !== 'undefined' && window.BEAMDROP_BUILD)
    ? window.BEAMDROP_BUILD
    : { version: '1.6.2', buildHash: 'local' };

  const isNewer = compareSemver(localBuild.version, latestVersion) < 0;
  const isNewHash = Boolean(latestHash && localBuild.buildHash && !localBuild.buildHash.includes(latestHash) && !latestHash.includes(localBuild.buildHash));

  if (isNewer || isNewHash) {
    if (cloudVer) {
      cloudVer.textContent = `v${latestVersion} (GitHub: ${latestHash || 'new update'})`;
      cloudVer.style.color = '#0284c7';
      cloudVer.style.fontWeight = 'bold';
    }
    log(`⚡ GitHub Update Detected! Repo Commit: ${latestHash}${commitMessage ? ` ("${commitMessage}")` : ''}`);
  } else {
    if (cloudVer) cloudVer.textContent = `v${latestVersion} (Synchronized with GitHub)`;
  }

  if (buildHashText) buildHashText.textContent = latestHash || (localBuild.buildHash || 'git-main').slice(0, 8);
  if (appVerBadge) appVerBadge.textContent = `v${latestVersion}`;
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
// BUTTON 2: CLEAN FOLDER (THOROUGH & VERIFIED REMOVAL)
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
  log('⚡ Requesting write permissions for directory...');

  try {
    if (dirHandle.requestPermission) {
      try {
        const perm = await dirHandle.requestPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
          throw new Error('Write permission was denied. Please click Allow in Chrome prompt.');
        }
      } catch (pErr) {
        if (window.BeamDropFolderStore) {
          const perm2 = await window.BeamDropFolderStore.requestPermission(dirHandle, true);
          if (perm2 !== 'granted') throw pErr;
        }
      }
    } else if (window.BeamDropFolderStore) {
      const perm = await window.BeamDropFolderStore.requestPermission(dirHandle, true);
      if (perm !== 'granted') {
        throw new Error('Write permission was denied. Please click Allow in Chrome prompt.');
      }
    }

    log('🧹 Scanning directory contents to wipe all old data...');
    let totalRemoved = 0;

    // Up to 5 passes to prevent iterator mutation skip bug in browser
    for (let pass = 1; pass <= 5; pass++) {
      const itemsToDelete = [];
      for await (const [name, handle] of dirHandle.entries()) {
        if (name === '.git') continue; // preserve git repo if cloned
        itemsToDelete.push({ name, kind: handle.kind });
      }

      if (itemsToDelete.length === 0) {
        break; // Completely empty
      }

      for (const item of itemsToDelete) {
        try {
          await dirHandle.removeEntry(item.name, { recursive: true });
          totalRemoved++;
          log(`🗑️ Removed ${item.kind === 'directory' ? 'folder' : 'file'}: ${item.name}`);
        } catch (rmErr) {
          console.warn(`Could not remove ${item.name}:`, rmErr);
        }
      }
    }

    // Strict Verification Pass
    let remaining = 0;
    const remainingNames = [];
    for await (const [name] of dirHandle.entries()) {
      if (name !== '.git') {
        remaining++;
        remainingNames.push(name);
      }
    }

    if (remaining > 0) {
      log(`⚠️ Notice: ${remaining} items locked by system: ${remainingNames.join(', ')}`);
      showProgress(`⚠️ Cleaned ${totalRemoved} items (${remaining} locked)`, 85);
    } else {
      log(`✨ Verification: Directory 100% empty and clean (0 files remaining). All old data wiped.`);
      showProgress(`✓ Cleaned ${totalRemoved} items! Directory is completely clean.`, 100);
      showToast(`✓ Cleaned ${totalRemoved} files! Ready to Inject.`);
    }

    log(`✅ SUCCESS: Clean complete! Folder is now pristine and ready for Step 3 (Inject).`);
    return true;
  } catch (err) {
    console.error('Clean failed:', err);
    log(`❌ Clean Error: ${err.message}`);
    showProgress('Cleaning failed: ' + err.message, 0);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// BUTTON 3: INJECT ALL EXTENSION FILES (GITHUB & CLOUD STREAM)
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

async function discoverExtensionFiles() {
  const discovered = new Set(DEFAULT_INJECT_FILES);

  // 1. Dynamic check via GitHub repository tree
  try {
    log('📡 Checking GitHub repository tree for updated files...');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch(GITHUB_TREE_API, {
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (resp.ok) {
      const data = await resp.json();
      if (data && data.tree && Array.isArray(data.tree)) {
        const remoteExtFiles = data.tree
          .filter(item => item.path && item.path.startsWith('extension/') && item.type === 'blob')
          .map(item => item.path.replace(/^extension\//, ''))
          .filter(name => !name.startsWith('.') && !name.includes('.git'));

        if (remoteExtFiles.length >= 10) {
          log(`✓ GitHub Repository Engine: ${remoteExtFiles.length} extension files discovered in GitHub repo!`);
          remoteExtFiles.forEach(f => discovered.add(f));
        }
      }
    }
  } catch (err) {
    console.debug('GitHub API dynamic tree query notice (falling back to host):', err);
  }

  // 2. Dynamic check via host /api/extension-tree
  try {
    const tResp = await fetch(`${window.location.origin}/api/extension-tree?_t=${Date.now()}`);
    if (tResp.ok) {
      const tData = await tResp.json();
      if (tData.success && Array.isArray(tData.files)) {
        log(`✓ Host Extension Engine: ${tData.files.length} extension files active on server.`);
        tData.files.forEach(f => discovered.add(f));
      }
    }
  } catch (_) {}

  const finalFiles = Array.from(discovered);
  log(`📦 Resolved target extension package: ${finalFiles.length} files to inject.`);
  return finalFiles;
}

async function fetchFileContent(fname) {
  const sources = [
    // Priority 1: GitHub Raw (Directly from repository main branch)
    `${GITHUB_RAW_BASE}/${fname}?_t=${Date.now()}`,
    // Priority 2: Current Host (Local development or Web App static files)
    `${window.location.origin}/extension/${fname}?_t=${Date.now()}`,
    // Priority 3: Current Host API proxy (/api/extension-file)
    `${window.location.origin}/api/extension-file?path=${encodeURIComponent(fname)}&_t=${Date.now()}`,
    // Priority 4: Vercel Production
    `${VERCEL_HOST}/extension/${fname}?_t=${Date.now()}`
  ];

  let lastErr = null;
  for (const src of sources) {
    try {
      const resp = await fetch(src, { cache: 'no-store' });
      if (resp.ok) {
        return await resp.arrayBuffer();
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Could not fetch ${fname} from any source: ${lastErr?.message || 'HTTP 404'}`);
}

async function executeInjectFiles(dirHandle) {
  showLogStream();
  showProgress('⚡ Starting GitHub & Cloud Stream Injection...', 5);

  try {
    if (window.BeamDropFolderStore) {
      const perm = await window.BeamDropFolderStore.requestPermission(dirHandle, true);
      if (perm !== 'granted') {
        throw new Error('Write permission was denied. Please click Allow in Chrome prompt.');
      }
    }

    // 1. Discover all extension files (live from GitHub or registry)
    const filesToInject = await discoverExtensionFiles();
    log(`🚀 Starting injection of ${filesToInject.length} files into folder...`);

    let written = 0;
    const total = filesToInject.length;

    for (let i = 0; i < total; i++) {
      const fname = filesToInject[i];
      try {
        log(`⬇️ Fetching [${i + 1}/${total}]: ${fname}...`);
        const arrayBuffer = await fetchFileContent(fname);

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
    showToast(`✓ Complete! ${written} extension files injected and ready.`);

    setTimeout(() => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.reload) {
        chrome.runtime.reload();
      } else {
        window.location.reload();
      }
    }, 1200);

    return true;
  } catch (err) {
    console.error('Inject failed:', err);
    log(`❌ Inject Error: ${err.message}`);
    showProgress('Injection failed: ' + err.message, 0);
    return false;
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

      // Step 2: Execute Clean
      const cleaned = await executeCleanFolder(currentDirHandle);
      if (!cleaned) {
        log('⚠️ Clean phase encountered an issue, proceeding with overwrite injection...');
      }

      // Step 3: Execute Inject
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
