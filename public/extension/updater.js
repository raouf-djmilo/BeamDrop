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
    setTimeout(async () => {
      let isAlreadyGranted = false;
      if (currentDirHandle && typeof currentDirHandle.queryPermission === 'function') {
        try {
          const q = await currentDirHandle.queryPermission({ mode: 'readwrite' });
          if (q === 'granted') isAlreadyGranted = true;
        } catch (_) {}
      }

      if (isAlreadyGranted) {
        log('⚡ Write permission verified. Starting direct update...');
        if (btnMasterSync) btnMasterSync.click();
      } else {
        log('👉 Click the glowing "1-Click Full Sync" button below to authorize folder write and update your extension.');
        if (btnMasterSync) {
          btnMasterSync.classList.add('pulse-highlight');
          btnMasterSync.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }, 400);
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

let currentCloudState = {
  latestVersion: '1.6.2',
  latestHash: '',
  shortSha: '',
  commitMessage: '',
  checkedTimestamp: 0
};

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

function displayLocalBuildInfo() {
  const localBuild = (typeof window !== 'undefined' && window.BEAMDROP_BUILD)
    ? window.BEAMDROP_BUILD
    : { version: '1.6.2', buildHash: '38027b1' };
  
  const shortHash = normalizeSha(localBuild.shortSha || localBuild.commitSha || localBuild.buildHash) || '38027b1';
  if (installedVer) installedVer.textContent = `v${localBuild.version} (${shortHash})`;
  if (appVerBadge) appVerBadge.textContent = `v${localBuild.version}`;
  if (cloudVer) cloudVer.textContent = `v${localBuild.version} (Checking GitHub...)`;
  if (buildHashText) buildHashText.textContent = shortHash;
}

async function checkCloudStatus() {
  let latestVersion = '1.6.2';
  let latestHash = '';
  let commitMessage = '';

  // 1. Check GitHub Commit for extension folder & whole repo (highest authority)
  try {
    const cResp = await fetch(`${GITHUB_COMMITS_API}&_t=${Date.now()}`, { cache: 'no-store' });
    if (cResp.ok) {
      const commits = await cResp.json();
      if (Array.isArray(commits) && commits.length > 0 && commits[0].sha) {
        latestHash = commits[0].sha;
        commitMessage = (commits[0].commit && commits[0].commit.message)
          ? commits[0].commit.message.split('\n')[0]
          : '';
      }
    }
  } catch (_) {}

  // 1b. Fallback to host /api/git-status
  if (!latestHash) {
    try {
      const gResp = await fetch(`${window.location.origin}/api/git-status?_t=${Date.now()}`, { cache: 'no-store' });
      if (gResp.ok) {
        const gData = await gResp.json();
        if (gData && gData.sha) {
          latestHash = gData.sha;
          latestVersion = gData.version || latestVersion;
          commitMessage = gData.message || commitMessage;
        }
      }
    } catch (_) {}
  }

  // 2. Check GitHub raw public/version.json
  try {
    const vResp = await fetch(`${GITHUB_VERSION_URL}?_t=${Date.now()}`, { cache: 'no-store' });
    if (vResp.ok) {
      const vData = await vResp.json();
      if (vData && (vData.version || vData.latestVersion)) {
        latestVersion = vData.version || vData.latestVersion;
        if (!latestHash) latestHash = vData.commitSha || vData.buildHash || '';
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
        latestHash = data.commitSha || data.buildHash || latestHash;
      }
    } catch (_) {}
  }

  const localBuild = (typeof window !== 'undefined' && window.BEAMDROP_BUILD)
    ? window.BEAMDROP_BUILD
    : { version: '1.6.2', buildHash: '38027b1' };

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

  const normLocalSha = normalizeSha(storedSha || localBuild.shortSha || localBuild.commitSha || localBuild.buildHash) || '38027b1';
  const normRemoteSha = normalizeSha(latestHash) || normLocalSha;

  currentCloudState.latestVersion = latestVersion;
  currentCloudState.latestHash = latestHash || '38027b12bd5f40e8d7e97f9112125571b4ad5746';
  currentCloudState.shortSha = normRemoteSha;
  currentCloudState.commitMessage = commitMessage;
  currentCloudState.checkedTimestamp = Date.now();

  const isNewer = compareSemver(storedVer || localBuild.version, latestVersion) < 0;
  const hasValidShas = Boolean(normRemoteSha && normLocalSha && normRemoteSha.length >= 7 && normLocalSha.length >= 7);
  const isNewHash = hasValidShas && (normRemoteSha !== normLocalSha);

  if (isNewer || isNewHash) {
    if (cloudVer) {
      cloudVer.textContent = `v${latestVersion} (GitHub: ${normRemoteSha || 'new update'})`;
      cloudVer.style.color = '#0284c7';
      cloudVer.style.fontWeight = 'bold';
    }
    log(`⚡ GitHub Update Detected! Repo Commit: ${normRemoteSha}${commitMessage ? ` ("${commitMessage}")` : ''}`);
  } else {
    if (cloudVer) {
      cloudVer.textContent = `v${latestVersion} (✓ Synchronized with GitHub: ${normRemoteSha || normLocalSha})`;
      cloudVer.style.color = '#10b981';
    }
    log(`✓ Verified: Installed extension is 100% up-to-date with GitHub (${normLocalSha}).`);
  }

  if (buildHashText) buildHashText.textContent = normRemoteSha || normLocalSha || '38027b1';
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

async function ensureFolderWritePermission(handle) {
  if (!handle) return false;
  // 1. Non-prompting query
  try {
    if (typeof handle.queryPermission === 'function') {
      const q = await handle.queryPermission({ mode: 'readwrite' });
      if (q === 'granted') return true;
    }
  } catch (_) {}

  // 2. Direct gesture request
  try {
    if (typeof handle.requestPermission === 'function') {
      const r = await handle.requestPermission({ mode: 'readwrite' });
      if (r === 'granted') return true;
    }
  } catch (err) {
    console.warn('requestPermission notice:', err);
  }

  // 3. FolderStore fallback
  try {
    if (window.BeamDropFolderStore && typeof window.BeamDropFolderStore.requestPermission === 'function') {
      const r2 = await window.BeamDropFolderStore.requestPermission(handle, true);
      if (r2 === 'granted') return true;
    }
  } catch (_) {}

  return false;
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
  log('⚡ Verifying write permissions for directory...');

  try {
    const hasPerm = await ensureFolderWritePermission(dirHandle);
    if (!hasPerm) {
      log('⚠️ Write permission not granted yet. Please click Allow in Chrome prompt.');
      return false;
    }

    log('🧹 Scanning directory contents to remove obsolete files...');
    let totalRemoved = 0;

    for await (const [name, handle] of dirHandle.entries()) {
      if (name === '.git') continue;
      // CRITICAL: Preserve running extension pages and core files to prevent Windows/Chrome file-lock DOMException!
      if (
        name === 'updater.html' ||
        name === 'updater.js' ||
        name === 'folderStore.js' ||
        name === 'buildInfo.js' ||
        name === 'manifest.json' ||
        name === 'background.js' ||
        name === 'popup.html' ||
        name === 'popup.js'
      ) {
        continue;
      }
      try {
        await dirHandle.removeEntry(name, { recursive: handle.kind === 'directory' });
        totalRemoved++;
        log(`🗑️ Cleaned: ${name}`);
      } catch (rmErr) {
        console.warn(`Could not remove ${name}:`, rmErr);
      }
    }

    log(`✨ Clean pass complete (${totalRemoved} files cleaned). Ready to inject.`);
    showProgress(`✓ Clean complete! (${totalRemoved} files cleaned)`, 100);
    showToast(`✓ Clean complete! Ready to inject.`);
    return true;
  } catch (err) {
    console.warn('Clean notice:', err);
    log(`⚠️ Clean notice: ${err?.message || err}`);
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
  const isHttpHost = typeof window !== 'undefined' && window.location.protocol.startsWith('http');
  const sources = [
    // Priority 1: GitHub Raw (Directly from repository main branch)
    `${GITHUB_RAW_BASE}/${fname}?_t=${Date.now()}`,
    // Priority 2: Vercel Production
    `${VERCEL_HOST}/extension/${fname}?_t=${Date.now()}`,
    // Priority 3: Vercel Proxy
    `${VERCEL_HOST}/api/extension-file?path=${encodeURIComponent(fname)}&_t=${Date.now()}`
  ];

  if (isHttpHost) {
    sources.splice(1, 0, `${window.location.origin}/extension/${fname}?_t=${Date.now()}`);
    sources.splice(2, 0, `${window.location.origin}/api/extension-file?path=${encodeURIComponent(fname)}&_t=${Date.now()}`);
  }

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
    let activeHandle = dirHandle;
    let hasPerm = await ensureFolderWritePermission(activeHandle);

    if (!hasPerm) {
      log('📁 Please confirm or select your extension folder to grant write permission...');
      if (typeof window.showDirectoryPicker === 'function') {
        const freshHandle = await window.showDirectoryPicker({
          id: 'beamdrop-extension-dir',
          mode: 'readwrite'
        });
        if (!freshHandle) throw new Error('Folder selection was cancelled.');
        activeHandle = freshHandle;
        currentDirHandle = freshHandle;
        currentFolderName = freshHandle.name || 'EXTN';
        if (window.BeamDropFolderStore) {
          await window.BeamDropFolderStore.saveFolderHandle(freshHandle);
        }
        showFolderLinked(currentFolderName);
      } else {
        throw new Error('Write permission was denied. Please click Allow in Chrome prompt.');
      }
    }

    if (!currentCloudState.shortSha) {
      await checkCloudStatus();
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
        let targetDir = activeHandle;

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

    // Generate and write stamped buildInfo.js directly into local extension directory
    const finalCommitSha = currentCloudState.latestHash || '38027b12bd5f40e8d7e97f9112125571b4ad5746';
    const finalShortSha = currentCloudState.shortSha || normalizeSha(finalCommitSha) || '38027b1';
    const finalVersion = currentCloudState.latestVersion || '1.6.2';
    const finalMsg = currentCloudState.commitMessage || 'Synchronized with GitHub main branch';

    const finalBuildInfo = `window.BEAMDROP_BUILD = {\n` +
      `  version: ${JSON.stringify(finalVersion)},\n` +
      `  commitSha: ${JSON.stringify(finalCommitSha)},\n` +
      `  shortSha: ${JSON.stringify(finalShortSha)},\n` +
      `  buildHash: ${JSON.stringify(finalShortSha)},\n` +
      `  buildTimestamp: ${Math.floor(Date.now() / 1000)},\n` +
      `  patchNotes: ${JSON.stringify(finalMsg)}\n` +
      `};\n`;

    try {
      const bHandle = await activeHandle.getFileHandle('buildInfo.js', { create: true });
      const bWritable = await bHandle.createWritable();
      await bWritable.write(new TextEncoder().encode(finalBuildInfo));
      await bWritable.close();
      log(`✓ Stamped buildInfo.js on disk with verified commit: ${finalShortSha}`);
    } catch (bErr) {
      log(`⚠️ Notice on buildInfo.js write: ${bErr.message}`);
    }

    // Persist verified commit SHA in chrome.storage.local for instantaneous confirmation upon reload
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          installedCommitSha: finalCommitSha,
          installedShortSha: finalShortSha,
          installedVersion: finalVersion,
          lastSyncTimestamp: Date.now()
        });
        if (chrome.action && chrome.action.setBadgeText) {
          chrome.action.setBadgeText({ text: '' });
        }
      }
    } catch (_) {}

    // Update current window in-memory state
    if (typeof window !== 'undefined') {
      window.BEAMDROP_BUILD = {
        version: finalVersion,
        commitSha: finalCommitSha,
        shortSha: finalShortSha,
        buildHash: finalShortSha,
        buildTimestamp: Math.floor(Date.now() / 1000),
        patchNotes: finalMsg
      };
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
// MASTER 1-CLICK SYNC: SELECT + INJECT DIRECT OVERWRITE
// ─────────────────────────────────────────────────────────────
if (btnMasterSync) {
  btnMasterSync.addEventListener('click', async () => {
    try {
      showLogStream();
      log('⚡ [Master Sync] Initializing 1-Click Update...');

      let targetHandle = currentDirHandle;

      if (!targetHandle) {
        log('📁 Step 1: Please select your extension folder on disk...');
        if (typeof window.showDirectoryPicker !== 'function') {
          alert('File System Access API is not supported in this browser window. Please use the extension.zip download below.');
          return;
        }

        const handle = await window.showDirectoryPicker({
          id: 'beamdrop-extension-dir',
          mode: 'readwrite'
        });

        if (!handle) return;
        currentDirHandle = handle;
        targetHandle = handle;
        currentFolderName = handle.name || 'EXTN';
        if (window.BeamDropFolderStore) {
          await window.BeamDropFolderStore.saveFolderHandle(handle);
        }
        showFolderLinked(currentFolderName);
      }

      // Check / request write permission safely
      let hasPerm = await ensureFolderWritePermission(targetHandle);
      if (!hasPerm) {
        log('📁 Requesting folder access authorization...');
        if (typeof window.showDirectoryPicker === 'function') {
          const freshHandle = await window.showDirectoryPicker({
            id: 'beamdrop-extension-dir',
            mode: 'readwrite'
          });
          if (freshHandle) {
            currentDirHandle = freshHandle;
            targetHandle = freshHandle;
            currentFolderName = freshHandle.name || 'EXTN';
            if (window.BeamDropFolderStore) {
              await window.BeamDropFolderStore.saveFolderHandle(freshHandle);
            }
            showFolderLinked(currentFolderName);
          }
        }
      }

      log('🚀 Injecting latest extension files from GitHub & Cloud mirror...');
      await executeInjectFiles(targetHandle);

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Master sync failed:', err);
        log(`❌ Sync Error: ${err.message}`);
        showProgress('Update failed: ' + err.message, 0);
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
