import JSZip from 'jszip';
import manifestJsonRaw from '../../extension/manifest.json?raw';
import popupHtmlRaw from '../../extension/popup.html?raw';
import popupJsRaw from '../../extension/popup.js?raw';
import styleCssRaw from '../../extension/style.css?raw';
import backgroundJsRaw from '../../extension/background.js?raw';
import updateBatRaw from '../../extension/update.bat?raw';
import updateShRaw from '../../extension/update.sh?raw';
import folderStoreJsRaw from '../../extension/folderStore.js?raw';
import updaterHtmlRaw from '../../extension/updater.html?raw';
import updaterJsRaw from '../../extension/updater.js?raw';
import buildInfoJsRaw from '../../extension/buildInfo.js?raw';

export interface ExtensionFile {
  name: string;
  path: string;
  language: string;
  description: string;
  content: string;
}

export const getExtensionFiles = (receiverBaseUrl: string = 'https://beam-drop-mu.vercel.app'): ExtensionFile[] => {
  let cleanUrl = (receiverBaseUrl || 'https://beam-drop-mu.vercel.app').replace(/\/$/, '');
  if (cleanUrl.includes('.run.app') || cleanUrl.includes('localhost') || cleanUrl.includes('127.0.0.1')) {
    cleanUrl = 'https://beam-drop-mu.vercel.app';
  }

  // Ensure receiver URL in popupJs matches cleanUrl
  const processedPopupJs = popupJsRaw.replace(
    /(?:let|const)\s+VERCEL_RECEIVER_URL\s*=\s*["'][^"']+["'];/,
    `let VERCEL_RECEIVER_URL = "${cleanUrl}";`
  );

  const processedBackgroundJs = backgroundJsRaw.replace(
    /(?:let|const)\s+DEFAULT_VERCEL_URL\s*=\s*["'][^"']+["'];/,
    `const DEFAULT_VERCEL_URL = "${cleanUrl}";`
  );

  return [
    {
      name: 'manifest.json',
      path: 'manifest.json',
      language: 'json',
      description: 'Chrome Manifest V3 configuration',
      content: manifestJsonRaw
    },
    {
      name: 'popup.html',
      path: 'popup.html',
      language: 'html',
      description: 'Extension Popup UI with Clean 2-State Updater & Watermarked QR Card',
      content: popupHtmlRaw
    },
    {
      name: 'popup.js',
      path: 'popup.js',
      language: 'javascript',
      description: 'P2P WebRTC engine, Excel/PPT/PDF file staging, and Watermarked QR generation',
      content: processedPopupJs
    },
    {
      name: 'style.css',
      path: 'style.css',
      language: 'css',
      description: 'Cyber-sleek dark theme styling matching web app',
      content: styleCssRaw
    },
    {
      name: 'background.js',
      path: 'background.js',
      language: 'javascript',
      description: 'Manifest V3 Service Worker for context menus & notifications',
      content: processedBackgroundJs
    },
    {
      name: 'update.bat',
      path: 'update.bat',
      language: 'bat',
      description: 'Windows 1-Click Fast Auto-Updater Script (Double click to update files)',
      content: updateBatRaw
    },
    {
      name: 'update.sh',
      path: 'update.sh',
      language: 'bash',
      description: 'Mac/Linux Fast Auto-Updater Script',
      content: updateShRaw
    },
    {
      name: 'folderStore.js',
      path: 'folderStore.js',
      language: 'javascript',
      description: 'Persistent Folder Handle Store (IndexedDB) with permission management',
      content: folderStoreJsRaw
    },
    {
      name: 'updater.html',
      path: 'updater.html',
      language: 'html',
      description: 'Zero-ZIP In-Place Folder Updater GUI',
      content: updaterHtmlRaw
    },
    {
      name: 'updater.js',
      path: 'updater.js',
      language: 'javascript',
      description: 'File System Access API In-Place Disk Synchronizer',
      content: updaterJsRaw
    },
    {
      name: 'buildInfo.js',
      path: 'buildInfo.js',
      language: 'javascript',
      description: 'Build Fingerprint and local version info',
      content: buildInfoJsRaw
    }
  ];
};

export const generateExtensionZipBlob = async (receiverBaseUrl: string = 'https://beam-drop-mu.vercel.app'): Promise<Blob> => {
  const zip = new JSZip();
  const files = getExtensionFiles(receiverBaseUrl);

  for (const file of files) {
    zip.file(file.path, file.content);
  }

  // Include version.json in zip
  try {
    const vResp = await fetch('/version.json');
    if (vResp.ok) {
      const vText = await vResp.text();
      zip.file('version.json', vText);
    }
  } catch (e) {
    zip.file('version.json', JSON.stringify({ version: '1.5.2', name: 'BeamDrop' }, null, 2));
  }

  // Include bundled offline libraries
  try {
    const fetchFirstAvailable = async (paths: string[]) => {
      for (const p of paths) {
        try {
          const r = await fetch(p);
          if (r.ok) return await r.text();
        } catch (_) {}
      }
      return null;
    };

    const [qrText, peerText] = await Promise.all([
      fetchFirstAvailable(['/libs/qrcode.min.js', '/extension/qrcode.min.js', '/extension/libs/qrcode.min.js']),
      fetchFirstAvailable(['/libs/peerjs.min.js', '/extension/peerjs.min.js', '/extension/libs/peerjs.min.js'])
    ]);

    if (qrText) zip.file('qrcode.min.js', qrText);
    if (peerText) zip.file('peerjs.min.js', peerText);
  } catch (e) {
    console.warn('Could not fetch static extension libs:', e);
  }

  // Add icons
  const icons = zip.folder('icons');
  const createIconBlob = (size: number): Promise<Uint8Array> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, size, size);
        grad.addColorStop(0, '#06b6d4');
        grad.addColorStop(1, '#3b82f6');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(0, 0, size, size, size * 0.2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        const s = size / 128;
        ctx.moveTo(72 * s, 16 * s);
        ctx.lineTo(24 * s, 72 * s);
        ctx.lineTo(60 * s, 72 * s);
        ctx.lineTo(52 * s, 112 * s);
        ctx.lineTo(100 * s, 56 * s);
        ctx.lineTo(64 * s, 56 * s);
        ctx.closePath();
        ctx.fill();
      }

      canvas.toBlob((blob) => {
        if (blob) {
          blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
        } else {
          resolve(new Uint8Array());
        }
      }, 'image/png');
    });
  };

  const [icon16, icon48, icon128] = await Promise.all([
    createIconBlob(16),
    createIconBlob(48),
    createIconBlob(128)
  ]);

  icons?.file('icon16.png', icon16);
  icons?.file('icon48.png', icon48);
  icons?.file('icon128.png', icon128);

  return await zip.generateAsync({ type: 'blob' });
};
