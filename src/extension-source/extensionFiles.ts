/**
 * BeamDrop Extension File Registry & Packaging Engine
 * Pure JSON/REST API driven - ZERO fragile ?raw static bundle imports
 */

export interface ExtensionFile {
  name: string;
  path: string;
  language: string;
  description: string;
  content: string;
}

// In-memory cached files populated from /api/extension-files
let cachedExtensionFiles: ExtensionFile[] | null = null;

const FALLBACK_MANIFEST = JSON.stringify({
  manifest_version: 3,
  name: "BeamDrop - Direct P2P Device Share",
  version: "1.6.2",
  description: "Lightning-fast direct Device-to-Device file, photo, video, and text transfer without servers or cloud storage using WebRTC and QR codes.",
  action: { default_popup: "popup.html" },
  background: { service_worker: "background.js", type: "module" },
  permissions: ["storage", "unlimitedStorage", "clipboardRead", "clipboardWrite", "sidePanel", "contextMenus", "notifications", "downloads", "alarms"]
}, null, 2);

const FALLBACK_POPUP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>BeamDrop</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app"></div>
  <script src="popup.js"></script>
</body>
</html>`;

const DEFAULT_FILES: ExtensionFile[] = [
  {
    name: 'manifest.json',
    path: 'manifest.json',
    language: 'json',
    description: 'Chrome Manifest V3 configuration',
    content: FALLBACK_MANIFEST
  },
  {
    name: 'popup.html',
    path: 'popup.html',
    language: 'html',
    description: 'Extension UI popup interface',
    content: FALLBACK_POPUP_HTML
  },
  {
    name: 'popup.js',
    path: 'popup.js',
    language: 'javascript',
    description: 'Core extension client controller',
    content: '// BeamDrop Extension Client Controller\n// Loaded from /api/extension-files'
  },
  {
    name: 'background.js',
    path: 'background.js',
    language: 'javascript',
    description: 'Service worker for background sync',
    content: '// BeamDrop Service Worker\n// Loaded from /api/extension-files'
  },
  {
    name: 'style.css',
    path: 'style.css',
    language: 'css',
    description: 'Liquid glass dark styles',
    content: '/* BeamDrop Liquid Glass Dark Styles */'
  },
  {
    name: 'updater.html',
    path: 'updater.html',
    language: 'html',
    description: 'Self-contained zero-zip updater UI',
    content: '<!DOCTYPE html><html><body>BeamDrop Updater</body></html>'
  },
  {
    name: 'updater.js',
    path: 'updater.js',
    language: 'javascript',
    description: 'Folder streaming updater script',
    content: '// BeamDrop Updater Script'
  },
  {
    name: 'folderStore.js',
    path: 'folderStore.js',
    language: 'javascript',
    description: 'IndexedDB directory handle persistence',
    content: '// Folder Storage Controller'
  },
  {
    name: 'buildInfo.js',
    path: 'buildInfo.js',
    language: 'javascript',
    description: 'Version stamp metadata',
    content: 'export const BUILD_INFO = { version: "1.6.2" };'
  },
  {
    name: 'update.bat',
    path: 'update.bat',
    language: 'bat',
    description: 'Windows 1-click update script',
    content: '@echo off\necho Updating BeamDrop Extension...\n'
  },
  {
    name: 'update.sh',
    path: 'update.sh',
    language: 'bash',
    description: 'Mac/Linux 1-click update script',
    content: '#!/bin/bash\necho "Updating BeamDrop Extension..."\n'
  }
];

export const fetchExtensionFiles = async (receiverBaseUrl: string = 'https://beam-drop-mu.vercel.app'): Promise<ExtensionFile[]> => {
  let cleanUrl = (receiverBaseUrl || 'https://beam-drop-mu.vercel.app').replace(/\/$/, '');
  if (cleanUrl.includes('.run.app') || cleanUrl.includes('localhost') || cleanUrl.includes('127.0.0.1')) {
    cleanUrl = 'https://beam-drop-mu.vercel.app';
  }

  try {
    const res = await fetch('/api/extension-files?_t=' + Date.now());
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.files)) {
        const mapped: ExtensionFile[] = data.files.map((f: ExtensionFile) => {
          let content = f.content || '';
          if (f.name === 'popup.js') {
            content = content.replace(
              /(?:let|const)\s+VERCEL_RECEIVER_URL\s*=\s*["'][^"']+["'];/,
              `let VERCEL_RECEIVER_URL = "${cleanUrl}";`
            );
          } else if (f.name === 'background.js') {
            content = content.replace(
              /(?:let|const)\s+DEFAULT_VERCEL_URL\s*=\s*["'][^"']+["'];/,
              `const DEFAULT_VERCEL_URL = "${cleanUrl}";`
            );
          }
          return { ...f, content };
        });
        cachedExtensionFiles = mapped;
        return mapped;
      }
    }
  } catch (err) {
    console.warn('[ExtensionFiles] Could not fetch extension files API:', err);
  }

  return cachedExtensionFiles ?? DEFAULT_FILES;
};

export const getExtensionFiles = (receiverBaseUrl: string = 'https://beam-drop-mu.vercel.app'): ExtensionFile[] => {
  if (cachedExtensionFiles && cachedExtensionFiles.length > 0) {
    return cachedExtensionFiles;
  }
  // Trigger async fetch in background to populate cache
  fetchExtensionFiles(receiverBaseUrl).catch(() => {});
  return DEFAULT_FILES;
};

export const generateExtensionZipBlob = async (_receiverBaseUrl?: string): Promise<Blob> => {
  // Directly download the pre-packaged zip asset from /extension.zip
  const res = await fetch('/extension.zip?_t=' + Date.now());
  if (res.ok) {
    return await res.blob();
  }
  throw new Error('Could not fetch extension archive (status ' + res.status + ')');
};
