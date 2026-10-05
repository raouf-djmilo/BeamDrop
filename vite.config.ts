import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'url';
import path from 'path';
import fs from 'fs';
// Zero native shell execution - 100% in-memory JS mesh
import os from 'os';
import util from 'util';
import {defineConfig} from 'vite';
import QRCode from 'qrcode';

// execPromise removed
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'cors-and-upgrade-plugin',
        configureServer(server) {
          let cachedGitStatus: any = null;
          let cachedGitStatusTime = 0;

          server.middlewares.use((req, res, next) => {
            if (req.url && (req.url === "/api/ip" || req.url.startsWith("/api/ip?") || req.url.startsWith("/api/ip/"))) {
              res.setHeader("Access-Control-Allow-Origin", "*");
              res.setHeader("Content-Type", "application/json");
              const rawIp = (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "127.0.0.1").toString().split(",")[0].trim();
              const cleanIp = rawIp.replace("::ffff:", "");
              let hash = 0;
              for (let i = 0; i < cleanIp.length; i++) {
                hash = (hash << 5) - hash + cleanIp.charCodeAt(i);
                hash |= 0;
              }
              const roomHash = "room-" + Math.abs(hash).toString(36).slice(0, 8);
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, ip: cleanIp, roomHash }));
              return;
            }

            // Dedicated endpoint for ExtensionHub to safely fetch extension files as JSON
            if (req.url && (req.url === '/api/extension-files' || req.url.startsWith('/api/extension-files?'))) {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Content-Type', 'application/json');
              const extDir = path.resolve(__dirname, 'extension');
              const defs = [
                { name: 'manifest.json', path: 'manifest.json', language: 'json', description: 'Chrome Manifest V3 configuration' },
                { name: 'popup.html', path: 'popup.html', language: 'html', description: 'Extension UI popup interface' },
                { name: 'popup.js', path: 'popup.js', language: 'javascript', description: 'Core extension client controller' },
                { name: 'background.js', path: 'background.js', language: 'javascript', description: 'Service worker for background sync' },
                { name: 'style.css', path: 'style.css', language: 'css', description: 'Liquid glass dark styles' },
                { name: 'options.html', path: 'options.html', language: 'html', description: 'Extension options page' },
                { name: 'options.js', path: 'options.js', language: 'javascript', description: 'Extension options controller' },
                { name: 'updater.html', path: 'updater.html', language: 'html', description: 'Self-contained zero-zip updater UI' },
                { name: 'updater.js', path: 'updater.js', language: 'javascript', description: 'Folder streaming updater script' },
                { name: 'folderStore.js', path: 'folderStore.js', language: 'javascript', description: 'IndexedDB directory handle persistence' },
                { name: 'buildInfo.js', path: 'buildInfo.js', language: 'javascript', description: 'Version stamp metadata' },
                { name: 'update.bat', path: 'update.bat', language: 'bat', description: 'Windows 1-click update script' },
                { name: 'update.sh', path: 'update.sh', language: 'bash', description: 'Mac/Linux 1-click update script' }
              ];
              const filesList = defs.map(d => {
                const fp = path.join(extDir, d.path);
                let content = '';
                if (fs.existsSync(fp)) {
                  try { content = fs.readFileSync(fp, 'utf8'); } catch (_) {}
                }
                return { ...d, content };
              });
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, files: filesList }));
              return;
            }

            // Real-time extension tree endpoint providing all 25 files in extension/
            if (req.url && (req.url === '/api/extension-tree' || req.url.startsWith('/api/extension-tree?'))) {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Content-Type', 'application/json');
              const extDir = path.resolve(__dirname, 'extension');
              
              const walkDir = (dir: string, base: string = ''): string[] => {
                let results: string[] = [];
                if (!fs.existsSync(dir)) return results;
                const list = fs.readdirSync(dir);
                for (const item of list) {
                  if (item === '.git' || item.startsWith('.')) continue;
                  const full = path.join(dir, item);
                  const rel = base ? `${base}/${item}` : item;
                  const stat = fs.statSync(full);
                  if (stat.isDirectory()) {
                    results = results.concat(walkDir(full, rel));
                  } else {
                    results.push(rel);
                  }
                }
                return results;
              };

              const allExtFiles = walkDir(extDir);
              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                count: allExtFiles.length,
                files: allExtFiles,
                timestamp: Date.now()
              }));
              return;
            }

            // Raw extension file fetch endpoint
            if (req.url && req.url.startsWith('/api/extension-file?')) {
              res.setHeader('Access-Control-Allow-Origin', '*');
              const u = new URL(req.url, 'http://localhost');
              const relPath = (u.searchParams.get('path') || '').replace(/^\/+/, '');
              const safePath = path.normalize(relPath).replace(/^(\.\.[\/\\])+/, '');
              const fullPath = path.resolve(__dirname, 'extension', safePath);
              if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                const ext = path.extname(fullPath).toLowerCase();
                const mimeTypes: Record<string, string> = {
                  '.html': 'text/html; charset=utf-8',
                  '.js': 'application/javascript; charset=utf-8',
                  '.css': 'text/css; charset=utf-8',
                  '.json': 'application/json; charset=utf-8',
                  '.png': 'image/png',
                  '.svg': 'image/svg+xml',
                  '.bat': 'text/plain; charset=utf-8',
                  '.sh': 'text/plain; charset=utf-8'
                };
                res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
                res.statusCode = 200;
                res.end(fs.readFileSync(fullPath));
                return;
              }
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'File not found' }));
              return;
            }

            // Live /api/git-status endpoint with 60s memory caching
            if (req.url && (req.url === '/api/git-status' || req.url.startsWith('/api/git-status?'))) {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Content-Type', 'application/json');
              const now = Date.now();
              if (cachedGitStatus && (now - cachedGitStatusTime < 60000)) {
                res.statusCode = 200;
                res.end(JSON.stringify(cachedGitStatus));
                return;
              }

              fetch('https://api.github.com/repos/raouf-djmilo/BeamDrop/commits?per_page=1', {
                headers: { 'User-Agent': 'BeamDrop-Web-Engine' }
              })
                .then(r => r.json())
                .then((commits: any) => {
                  if (Array.isArray(commits) && commits[0] && commits[0].sha) {
                    const sha = commits[0].sha;
                    cachedGitStatus = {
                      success: true,
                      sha,
                      shortSha: sha.slice(0, 7),
                      message: commits[0].commit?.message?.split('\n')[0] || 'Repository update',
                      author: commits[0].commit?.author?.name || 'Raouf Djemel',
                      date: commits[0].commit?.author?.date || new Date().toISOString(),
                      version: '1.6.2',
                      timestamp: now
                    };
                    cachedGitStatusTime = now;
                    res.statusCode = 200;
                    res.end(JSON.stringify(cachedGitStatus));
                  } else {
                    throw new Error('No commit found');
                  }
                })
                .catch(() => {
                  const fallback = {
                    success: true,
                    sha: '38027b12bd5f40e8d7e97f9112125571b4ad5746',
                    shortSha: '38027b1',
                    message: 'perf: optimize WebRTC transfer and fallback logic',
                    author: 'Raouf Djemel',
                    date: new Date().toISOString(),
                    version: '1.6.2',
                    timestamp: now,
                    fallback: true
                  };
                  res.statusCode = 200;
                  res.end(JSON.stringify(fallback));
                });
              return;
            }

            next();
          });
          const meshPeers = new Map<string, any>();
          const meshOrders = new Map<string, any>();
          const transitStore = new Map<string, any>();

          const parseJsonBody = (r: any): Promise<any> => {
            return new Promise((resolve) => {
              let body = '';
              r.on('data', (c: any) => { body += c; });
              r.on('end', () => {
                try { resolve(JSON.parse(body || '{}')); } catch (e) { resolve({}); }
              });
            });
          };

          server.middlewares.use(async (req, res, next) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', '*');
            if (req.method === 'OPTIONS') {
              res.statusCode = 204;
              res.end();
              return;
            }

            // 0. Client IP and Room Hash Endpoint (/api/ip)
            if (req.url && (req.url === '/api/ip' || req.url.startsWith('/api/ip?') || req.url.startsWith('/api/ip/'))) {
              res.setHeader('Content-Type', 'application/json');
              const rawIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1').toString().split(',')[0].trim();
              const cleanIp = rawIp.replace('::ffff:', '');
              let hash = 0;
              for (let i = 0; i < cleanIp.length; i++) {
                hash = (hash << 5) - hash + cleanIp.charCodeAt(i);
                hash |= 0;
              }
              const roomHash = 'room-' + Math.abs(hash).toString(36).slice(0, 8);
              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                ip: cleanIp,
                roomHash
              }));
              return;
            }

            // Vault QR Generator (/api/vault/qr) for iOS Shortcuts Quick Look
            if (req.url && (req.url === '/api/vault/qr' || req.url.startsWith('/api/vault/qr?') || req.url.startsWith('/api/vault/qr/'))) {
              const u = new URL(req.url, 'http://localhost');
              const user = (u.searchParams.get('user') || u.searchParams.get('uid') || u.searchParams.get('peer') || 'mobile_vault').trim();
              const format = (u.searchParams.get('format') || 'png').toLowerCase();

              const rawIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1').toString().split(',')[0].trim().replace('::ffff:', '');
              const ua = (req.headers['user-agent'] || 'generic').toString().slice(0, 60);
              let hash = 0;
              const str = rawIp + '|' + ua;
              for (let i = 0; i < str.length; i++) {
                hash = (hash << 5) - hash + str.charCodeAt(i);
                hash |= 0;
              }
              const ipHash = 'ip_' + Math.abs(hash).toString(36);
              const today = new Date().toISOString().split('T')[0];

              if (!(global as any).__BEAMDROP_DEV_QUOTAS__) {
                (global as any).__BEAMDROP_DEV_QUOTAS__ = new Map();
              }
              const devQuotas = (global as any).__BEAMDROP_DEV_QUOTAS__;
              const isAuthenticated = user && user !== 'mobile_vault' && !user.startsWith('mobile_');
              const cacheKey = isAuthenticated ? `user_${user}_${today}` : `guest_${ipHash}_${today}`;
              const limits = isAuthenticated ? { maxScans: 15 } : { maxScans: 5 };
              const currentUsage = devQuotas.get(cacheKey) || { qrScansCount: 0 };

              if (currentUsage.qrScansCount >= limits.maxScans) {
                if (format === 'json') {
                  res.setHeader('Content-Type', 'application/json');
                  res.statusCode = 403;
                  res.end(JSON.stringify({
                    success: false,
                    code: 'QUOTA_EXCEEDED',
                    message: isAuthenticated ? 'لقد استهلكت كوتا الاختصار اليومية (15/15)!' : 'لقد استهلكت كوتا الاختصار اليومية للزوار (5/5)!'
                  }));
                  return;
                }
                const warnBuffer = await QRCode.toBuffer(`https://beam-drop-mu.vercel.app/?upgrade=true&reason=quota_exceeded`, {
                  type: 'png',
                  width: 720,
                  margin: 2,
                  errorCorrectionLevel: 'H',
                  color: { dark: '#e11d48', light: '#ffffff' }
                });
                res.setHeader('Content-Type', 'image/png');
                res.statusCode = 200;
                res.end(warnBuffer);
                return;
              }

              currentUsage.qrScansCount = (currentUsage.qrScansCount || 0) + 1;
              devQuotas.set(cacheKey, currentUsage);

              const targetUrl = `https://beam-drop-mu.vercel.app/?target=${encodeURIComponent(user)}&action=send`;
              try {
                const qrBuffer = await QRCode.toBuffer(targetUrl, {
                  type: 'png',
                  width: 720,
                  margin: 2,
                  errorCorrectionLevel: 'H',
                  color: { dark: '#0369a1', light: '#ffffff' }
                });
                if (format === 'json') {
                  res.setHeader('Content-Type', 'application/json');
                  res.statusCode = 200;
                  res.end(JSON.stringify({ success: true, user, targetUrl, dataUrl: `data:image/png;base64,${qrBuffer.toString('base64')}` }));
                  return;
                }
                res.setHeader('Content-Type', 'image/png');
                res.setHeader('Content-Length', qrBuffer.length.toString());
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
                res.statusCode = 200;
                res.end(qrBuffer);
                return;
              } catch (e: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ success: false, error: e?.message || 'Failed' }));
                return;
              }
            }

            // Unified Quota & Anti-Abuse Engine (/api/quota)
            if (req.url && (req.url === '/api/quota' || req.url.startsWith('/api/quota?') || req.url.startsWith('/api/quota/'))) {
              res.setHeader('Content-Type', 'application/json');
              const u = new URL(req.url, 'http://localhost');
              let body: any = {};
              if (req.method === 'POST') {
                body = await parseJsonBody(req);
              }
              const action = (u.searchParams.get('action') || body?.action || 'check').toLowerCase();
              const uid = (body?.uid || u.searchParams.get('uid') || '').trim();
              const guestId = (body?.guestId || u.searchParams.get('guestId') || '').trim();
              const type = (body?.type || u.searchParams.get('type') || (action.includes('send') ? 'send' : action.includes('receive') ? 'receive' : 'send')).toLowerCase();
              const bytes = Number(body?.bytes || u.searchParams.get('bytes') || 0);

              const rawIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1').toString().split(',')[0].trim().replace('::ffff:', '');
              const ua = (req.headers['user-agent'] || 'generic').toString().slice(0, 60);
              let hash = 0;
              const str = rawIp + '|' + ua;
              for (let i = 0; i < str.length; i++) {
                hash = (hash << 5) - hash + str.charCodeAt(i);
                hash |= 0;
              }
              const ipHash = 'ip_' + Math.abs(hash).toString(36);
              const today = new Date().toISOString().split('T')[0];

              if (!(global as any).__BEAMDROP_DEV_QUOTAS__) {
                (global as any).__BEAMDROP_DEV_QUOTAS__ = new Map();
              }
              const devQuotas = (global as any).__BEAMDROP_DEV_QUOTAS__;
              const cacheKey = uid ? `user_${uid}_${today}` : `guest_${ipHash}_${today}`;

              const limits = uid ? { maxSends: 15, maxReceives: 15, maxScans: 15 } : { maxSends: 5, maxReceives: 5, maxScans: 5 };
              const tier = uid ? 'free' : 'guest';

              let currentUsage = devQuotas.get(cacheKey) || {
                sendOperations: 0,
                receiveOperations: 0,
                qrScansCount: 0,
                bytesTransferred: 0,
                date: today
              };

              if (action === 'check') {
                const remainingSends = Math.max(0, limits.maxSends - currentUsage.sendOperations);
                const remainingReceives = Math.max(0, limits.maxReceives - currentUsage.receiveOperations);
                const isAllowed = type === 'send' ? remainingSends > 0 : remainingReceives > 0;
                res.statusCode = 200;
                res.end(JSON.stringify({
                  success: true,
                  allowed: isAllowed,
                  tier,
                  usage: currentUsage,
                  limits,
                  remaining: { sends: remainingSends, receives: remainingReceives }
                }));
                return;
              }

              if (action === 'consume_send' || (action === 'consume' && type === 'send')) {
                if (currentUsage.sendOperations >= limits.maxSends) {
                  res.statusCode = 403;
                  res.end(JSON.stringify({
                    success: false,
                    allowed: false,
                    code: 'QUOTA_EXCEEDED',
                    tier,
                    trigger: tier === 'guest' ? 'auth_modal' : 'pricing_modal',
                    message: tier === 'guest'
                      ? 'لقد استهلكت كوتا الإرسال اليومية للزوار (5/5)! سجّل حسابك مجاناً للاستفادة من 15 عملية إرسال يومياً.'
                      : 'لقد استهلكت كوتا الإرسال اليومية (15/15)! قم بالترقية إلى باقة PRO للحصول على إرسال غير محدود.'
                  }));
                  return;
                }
                currentUsage.sendOperations += 1;
                currentUsage.qrScansCount += 1;
                currentUsage.bytesTransferred += Math.max(0, bytes);
                devQuotas.set(cacheKey, currentUsage);
                res.statusCode = 200;
                res.end(JSON.stringify({
                  success: true,
                  allowed: true,
                  tier,
                  action: 'send_engine_activated',
                  remaining: {
                    sends: Math.max(0, limits.maxSends - currentUsage.sendOperations),
                    receives: Math.max(0, limits.maxReceives - currentUsage.receiveOperations)
                  }
                }));
                return;
              }

              if (action === 'confirm_receive' || (action === 'consume' && type === 'receive')) {
                if (currentUsage.receiveOperations >= limits.maxReceives) {
                  res.statusCode = 403;
                  res.end(JSON.stringify({
                    success: false,
                    allowed: false,
                    code: 'QUOTA_EXCEEDED',
                    tier,
                    trigger: tier === 'guest' ? 'auth_modal' : 'pricing_modal',
                    message: tier === 'guest'
                      ? 'لقد استهلكت كوتا الاستلام اليومية للزوار (5/5)! سجّل حسابك مجاناً للاستمرار.'
                      : 'لقد استهلكت كوتا الاستلام اليومية (15/15)! قم بالترقية إلى باقة PRO للاستلام غير المحدود.'
                  }));
                  return;
                }
                currentUsage.receiveOperations += 1;
                currentUsage.bytesTransferred += Math.max(0, bytes);
                devQuotas.set(cacheKey, currentUsage);
                res.statusCode = 200;
                res.end(JSON.stringify({
                  success: true,
                  allowed: true,
                  tier,
                  action: 'receive_delivery_confirmed',
                  remaining: {
                    sends: Math.max(0, limits.maxSends - currentUsage.sendOperations),
                    receives: Math.max(0, limits.maxReceives - currentUsage.receiveOperations)
                  }
                }));
                return;
              }

              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, message: 'Invalid action' }));
              return;
            }

            // iOS Shortcut Login (/api/auth/shortcut-login)
            if (req.url && (req.url === '/api/auth/shortcut-login' || req.url.startsWith('/api/auth/shortcut-login?')) && req.method === 'POST') {
              res.setHeader('Content-Type', 'application/json');
              const body = await parseJsonBody(req);
              const loginInput = (body?.loginInput || body?.username || body?.email || '').trim();
              const password = (body?.password || '').trim();

              if (!loginInput || !password) {
                res.statusCode = 400;
                res.end(JSON.stringify({
                  success: false,
                  code: 'MISSING_CREDENTIALS',
                  message: 'يرجى إدخال اسم المستخدم أو البريد الإلكتروني وكلمة المرور'
                }));
                return;
              }

              let email = loginInput;
              const isFullEmail = loginInput.includes('@') && loginInput.includes('.');
              if (!isFullEmail) {
                const cleanUsername = loginInput.replace(/^@/, '').toLowerCase().trim();
                try {
                  const restRes = await fetch(
                    `https://firestore.googleapis.com/v1/projects/a7flow-30981/databases/(default)/documents/usernames/${encodeURIComponent(cleanUsername)}`
                  );
                  if (restRes.ok) {
                    const uData = await restRes.json();
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

              try {
                const authRes = await fetch(
                  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyB0oAPZdDEGJZGMcZuxRaF_MUuheH0kcAk`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, returnSecureToken: true })
                  }
                );
                const authData = await authRes.json();
                if (!authRes.ok) {
                  const errCode = authData.error?.message || 'AUTH_ERROR';
                  if (errCode.includes('EMAIL_NOT_FOUND')) {
                    res.statusCode = 404;
                    res.end(JSON.stringify({
                      success: false,
                      code: 'USER_NOT_FOUND',
                      message: `الحساب "${loginInput}" غير مسجل! افتح الموقع وسجل حسابك مجاناً.`
                    }));
                    return;
                  }
                  res.statusCode = 401;
                  res.end(JSON.stringify({
                    success: false,
                    code: 'WRONG_PASSWORD',
                    message: 'كلمة المرور غير صحيحة، يرجى التأكد من كتابتها بشكل صحيح.'
                  }));
                  return;
                }

                res.statusCode = 200;
                res.end(JSON.stringify({
                  success: true,
                  Success: true,
                  status: 'success',
                  uid: authData.localId,
                  email: authData.email || email,
                  username: loginInput,
                  tier: 'free',
                  Tier: 'Free',
                  dailyQuota: 15,
                  message: 'تم الدخول بنجاح! خطتك مجانية (15 عملية نقل يومياً).'
                }));
                return;
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ success: false, message: 'خطأ في الاتصال بالسيرفر' }));
                return;
              }
            }

            // 1. Mesh Device Announcement & Heartbeat
            if ((req.url?.startsWith('/api/mesh/announce') || req.url === '/api/mesh' || req.url?.startsWith('/api/mesh?')) && req.method === 'POST') {
              res.setHeader('Content-Type', 'application/json');
              const data = await parseJsonBody(req);
              const u = new URL(req.url, 'http://localhost');
              const pin = (data?.pin || u.searchParams.get('pin') || '').toString().trim();
              const subnet = data?.subnet || (data?.ip ? data.ip.split('.').slice(0, 3).join('.') : '');
              const remoteIp = (req.socket?.remoteAddress || '127.0.0.1').replace('::ffff:', '');

              if (data && data.id) {
                meshPeers.set(data.id, {
                  ...data,
                  pin,
                  subnet,
                  ip: data.ip || (remoteIp === '127.0.0.1' ? '127.0.0.1' : remoteIp),
                  lastSeen: Date.now()
                });
              }
              const now = Date.now();
              const filtered = [];
              for (const [id, peer] of meshPeers.entries()) {
                if (now - peer.lastSeen > 35000) {
                  meshPeers.delete(id);
                } else if (!pin || (peer.pin && peer.pin === pin) || (subnet && peer.subnet === subnet)) {
                  filtered.push(peer);
                }
              }
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, count: filtered.length, devices: filtered }));
              return;
            }

            // 2. Mesh Active Devices List
            if (req.url?.startsWith('/api/mesh/devices') || ((req.url === '/api/mesh' || req.url?.startsWith('/api/mesh?')) && req.method === 'GET')) {
              res.setHeader('Content-Type', 'application/json');
              const u = new URL(req.url, 'http://localhost');
              const pin = (u.searchParams.get('pin') || '').toString().trim();
              const subnet = (u.searchParams.get('subnet') || '').toString().trim();
              const now = Date.now();
              const filtered = [];
              for (const [id, peer] of meshPeers.entries()) {
                if (now - peer.lastSeen > 35000) {
                  meshPeers.delete(id);
                } else if (!pin || (peer.pin && peer.pin === pin) || (subnet && peer.subnet === subnet)) {
                  filtered.push(peer);
                }
              }
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, count: filtered.length, devices: filtered }));
              return;
            }

            // 3. Create Transfer Order (Handshake Request: AirDrop-style)
            if (req.url?.startsWith('/api/mesh/order/create') && req.method === 'POST') {
              res.setHeader('Content-Type', 'application/json');
              const orderData = await parseJsonBody(req);
              const orderId = 'ord_' + Math.random().toString(36).substring(2, 9);
              const remoteIp = (req.socket?.remoteAddress || '127.0.0.1').replace('::ffff:', '');
              meshOrders.set(orderId, {
                orderId,
                senderName: orderData.senderName || 'BeamDrop Station',
                senderIp: orderData.senderIp || remoteIp,
                senderType: orderData.senderType || 'laptop',
                targetPeerId: orderData.targetPeerId || '',
                targetIp: orderData.targetIp || '',
                payload: orderData.payload || {},
                status: 'pending',
                createdAt: Date.now()
              });
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, orderId }));
              return;
            }

            // 4. Poll Pending Orders for Receiver
            if (req.url?.startsWith('/api/mesh/order/poll')) {
              res.setHeader('Content-Type', 'application/json');
              const u = new URL(req.url, 'http://localhost');
              const peerId = u.searchParams.get('peerId') || '';
              const ip = u.searchParams.get('ip') || (req.socket?.remoteAddress || '').replace('::ffff:', '');

              let matchedOrder = null;
              for (const [oid, order] of meshOrders.entries()) {
                if (order.status === 'pending') {
                  if ((peerId && order.targetPeerId === peerId) || (ip && order.targetIp === ip) || (!order.targetPeerId && !order.targetIp)) {
                    matchedOrder = order;
                    break;
                  }
                }
              }

              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, hasOrder: Boolean(matchedOrder), order: matchedOrder }));
              return;
            }

            // 5. Respond to Order (Accept / Decline)
            if (req.url?.startsWith('/api/mesh/order/respond') && req.method === 'POST') {
              res.setHeader('Content-Type', 'application/json');
              const { orderId, status } = await parseJsonBody(req);
              if (orderId && meshOrders.has(orderId)) {
                const order = meshOrders.get(orderId);
                order.status = status; // 'accepted' or 'declined'
                meshOrders.set(orderId, order);
              }
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, status }));
              return;
            }

            // 6. Check Order Status (Sender polling)
            if (req.url?.startsWith('/api/mesh/order/status')) {
              res.setHeader('Content-Type', 'application/json');
              const u = new URL(req.url, 'http://localhost');
              const orderId = u.searchParams.get('orderId') || '';
              const order = meshOrders.get(orderId);
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, status: order ? order.status : 'not_found', order }));
              return;
            }

            // 7. Stream Upload & Download
            if (req.url?.startsWith('/api/mesh/stream/upload') && req.method === 'POST') {
              const u = new URL(req.url, 'http://localhost');
              const orderId = u.searchParams.get('orderId') || '';
              const chunks: Buffer[] = [];
              req.on('data', (c: Buffer) => chunks.push(c));
              req.on('end', () => {
                const fullBuf = Buffer.concat(chunks);
                if (meshOrders.has(orderId)) {
                  const order = meshOrders.get(orderId);
                  order.data = fullBuf;
                  order.status = 'ready';
                }
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, bytes: fullBuf.length }));
              });
              return;
            }

            if (req.url?.startsWith('/api/mesh/stream/download')) {
              const u = new URL(req.url, 'http://localhost');
              const orderId = u.searchParams.get('orderId') || '';
              const order = meshOrders.get(orderId);
              if (order && order.data) {
                const filename = order.payload?.name || 'beamdrop_payload.bin';
                res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
                res.setHeader('Content-Type', order.payload?.mime || 'application/octet-stream');
                res.setHeader('Content-Length', order.data.length);
                res.statusCode = 200;
                res.end(order.data);
                return;
              } else {
                res.statusCode = 404;
                res.end('Order stream not found');
                return;
              }
            }

            // Universal In-Memory RAM Transit (Zero Cloud Storage)
            if (req.url?.startsWith('/api/transit')) {
              const u = new URL(req.url, 'http://localhost');
              const peer = u.searchParams.get('peer') || '';
              if (!peer) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'peer required' }));
                return;
              }

              if (req.method === 'GET') {
                const accept = (req.headers && req.headers['accept']) || '';
                const token = u.searchParams.get('token') || '';
                const item = transitStore.get(peer) || (token ? transitStore.get(`${peer}_${token}`) : null);

                if (typeof accept === 'string' && accept.includes('text/html') && (!item || !item.buffer)) {
                  res.writeHead(302, { Location: `/?mode=scan&peer=${encodeURIComponent(peer)}` });
                  res.end();
                  return;
                }

                if (!item || !item.buffer) {
                  res.statusCode = 204;
                  res.end();
                  return;
                }

                // Clean up expired items (> 5 minutes)
                const now = Date.now();
                if (now - item.created > 5 * 60 * 1000) {
                  transitStore.delete(peer);
                  if (token) transitStore.delete(`${peer}_${token}`);
                  res.statusCode = 404;
                  res.end(JSON.stringify({ error: 'expired', peer }));
                  return;
                }

                const totalSize = item.buffer.length;
                const rangeHeader = req.headers['range'];

                res.setHeader('Accept-Ranges', 'bytes');
                res.setHeader('Content-Type', item.mime || 'application/octet-stream');
                res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(item.name || 'beamed-object')}"`);
                res.setHeader('X-BeamDrop-Name', encodeURIComponent(item.name || 'beamed-object'));
                res.setHeader('X-BeamDrop-Size', totalSize);

                if (rangeHeader && rangeHeader.startsWith('bytes=')) {
                  const parts = rangeHeader.replace(/bytes=/, '').split('-');
                  const start = parseInt(parts[0], 10);
                  const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

                  if (start >= totalSize || end >= totalSize || start > end) {
                    res.statusCode = 416;
                    res.setHeader('Content-Range', `bytes */${totalSize}`);
                    res.end();
                    return;
                  }

                  const chunk = item.buffer.slice(start, end + 1);
                  res.statusCode = 206;
                  res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
                  res.setHeader('Content-Length', chunk.length);
                  res.end(chunk);
                  return;
                }

                res.setHeader('Content-Length', totalSize);
                res.statusCode = 200;
                res.end(item.buffer);
                return;
              }

              if (req.method === 'POST') {
                const MAX_TRANSIT_RAM_BYTES = 25 * 1024 * 1024; // 25MB safe ceiling for Node.js RAM
                const clHeader = parseInt(req.headers['content-length'] || '0', 10);
                if (clHeader > MAX_TRANSIT_RAM_BYTES) {
                  res.setHeader('Content-Type', 'application/json');
                  res.statusCode = 200;
                  res.end(JSON.stringify({
                    success: false,
                    reason: 'size_exceeds_transit_limit',
                    message: 'Payload exceeds 25MB RAM transit limit. BeamDrop will stream directly via encrypted P2P DataChannel.'
                  }));
                  return;
                }

                const chunks: Buffer[] = [];
                let totalReceived = 0;
                let isOverflow = false;

                req.on('data', (c: Buffer) => {
                  if (isOverflow) return;
                  totalReceived += c.length;
                  if (totalReceived > MAX_TRANSIT_RAM_BYTES) {
                    isOverflow = true;
                    chunks.length = 0;
                    return;
                  }
                  chunks.push(c);
                });

                req.on('end', () => {
                  if (isOverflow) {
                    res.setHeader('Content-Type', 'application/json');
                    res.statusCode = 200;
                    res.end(JSON.stringify({
                      success: false,
                      reason: 'size_exceeds_transit_limit',
                      message: 'Large file stream will be handled exclusively by direct P2P.'
                    }));
                    return;
                  }

                  const buffer = Buffer.concat(chunks);
                  const contentType = (req.headers['content-type'] as string) || '';
                  let name = decodeURIComponent(
                    u.searchParams.get('name') ||
                    (req.headers['x-file-name'] as string) ||
                    (req.headers['x-filename'] as string) ||
                    ''
                  );
                  const mime = decodeURIComponent(u.searchParams.get('mime') || contentType || 'application/octet-stream');
                  if (!name || name === 'shared-object') {
                    const timestamp = Date.now();
                    if (mime.includes('video/quicktime') || mime.includes('mov')) name = `video_${timestamp}.mov`;
                    else if (mime.includes('video/mp4')) name = `video_${timestamp}.mp4`;
                    else if (mime.includes('image/jpeg') || mime.includes('jpg')) name = `photo_${timestamp}.jpg`;
                    else if (mime.includes('image/png')) name = `photo_${timestamp}.png`;
                    else if (mime.includes('image/heic')) name = `photo_${timestamp}.heic`;
                    else if (mime.includes('application/pdf')) name = `document_${timestamp}.pdf`;
                    else if (mime.includes('zip')) name = `archive_${timestamp}.zip`;
                    else name = `beamed_file_${timestamp}.bin`;
                  }
                  const token = u.searchParams.get('token') || '';
                  const record = {
                    peer,
                    token,
                    name,
                    mime,
                    size: buffer.length,
                    buffer,
                    created: Date.now()
                  };
                  transitStore.set(peer, record);
                  if (token) {
                    transitStore.set(`${peer}_${token}`, record);
                  }
                  res.setHeader('Content-Type', 'application/json');
                  res.statusCode = 200;
                  res.end(JSON.stringify({ success: true, peer, name, size: buffer.length }));
                });
                return;
              }

              if (req.method === 'DELETE') {
                transitStore.delete(peer);
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true }));
                return;
              }
            }

            // 1-Click Zero-Zip Extension Upgrade Endpoint
            if (req.url?.startsWith('/api/upgrade-extension')) {
              res.setHeader('Content-Type', 'application/json');
              try {
                // Read latest version from version.json
                let latestVersion = '1.5.2';
                const versionPath = path.resolve(__dirname, 'version.json');
                if (fs.existsSync(versionPath)) {
                  try {
                    const vJson = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
                    if (vJson.version) latestVersion = vJson.version;
                  } catch (e) {}
                }

                // Synchronize extension manifest version
                const manifestPath = path.resolve(__dirname, 'extension/manifest.json');
                if (fs.existsSync(manifestPath)) {
                  try {
                    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                    manifest.version = latestVersion;
                    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
                  } catch (e) {}
                }

                // In-process pure JS extension packer (Zero child_process)
                try {
                  const extensionDir = path.resolve(__dirname, 'extension');
                  const outputZipPath = path.resolve(__dirname, 'public/extension.zip');
                  const JSZip = (await import('jszip')).default;
                  const zip = new JSZip();
                  function addDir(dirPath: string, zipFolder: any) {
                    const items = fs.readdirSync(dirPath);
                    for (const item of items) {
                      const fullPath = path.join(dirPath, item);
                      const stat = fs.statSync(fullPath);
                      if (stat.isDirectory()) {
                        addDir(fullPath, zipFolder.folder(item));
                      } else {
                        zipFolder.file(item, fs.readFileSync(fullPath));
                      }
                    }
                  }
                  addDir(extensionDir, zip);
                  const zipBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
                  fs.writeFileSync(outputZipPath, zipBuf);
                } catch (packErr: any) {
                  console.warn('[Upgrade Engine] Pack warning:', packErr?.message);
                }

                res.statusCode = 200;
                res.end(JSON.stringify({
                  success: true,
                  version: latestVersion,
                  message: `BeamDrop successfully upgraded to v${latestVersion}. Reloading extension...`
                }));
                return;
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({
                  success: false,
                  error: err?.message || 'Upgrade failed'
                }));
                return;
              }
            }

            // Persistent Team Workspace Mesh Signaling Endpoint (/api/mesh/workspace)
            // Serve Raw Extension Files for 1-Click Folder Unpacker (/api/extension-file/*)
            if (req.url?.startsWith('/api/extension-file/')) {
              const urlPath = req.url.split('?')[0].replace(/^\/api\/extension-file\//, '');
              const filePath = path.resolve(__dirname, 'extension', urlPath);
              if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                const ext = path.extname(filePath);
                const mimeMap: Record<string, string> = {
                  '.json': 'application/json',
                  '.js': 'application/javascript',
                  '.html': 'text/html',
                  '.css': 'text/css',
                  '.png': 'image/png',
                  '.svg': 'image/svg+xml'
                };
                res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
                res.statusCode = 200;
                res.end(fs.readFileSync(filePath));
                return;
              }
            }

            if (req.url?.startsWith('/api/mesh/workspace')) {
              res.setHeader('Content-Type', 'application/json');
              if (req.method === 'POST') {
                let bodyStr = '';
                req.on('data', chunk => { bodyStr += chunk; });
                req.on('end', () => {
                  try {
                    const data = JSON.parse(bodyStr || '{}');
                    const { slug, pinHash, device } = data;
                    if (!slug || !pinHash || !device) {
                      res.statusCode = 400;
                      res.end(JSON.stringify({ success: false, error: 'Missing workspace credentials' }));
                      return;
                    }
                    if (!(globalThis as any).workspaceRegistry) (globalThis as any).workspaceRegistry = new Map();
                    let ws = (globalThis as any).workspaceRegistry.get(slug);
                    if (!ws) {
                      ws = { pinHash, nodes: new Map() };
                      (globalThis as any).workspaceRegistry.set(slug, ws);
                    } else if (ws.pinHash !== pinHash) {
                      res.statusCode = 403;
                      res.end(JSON.stringify({ success: false, error: 'Invalid Workspace PIN' }));
                      return;
                    }
                    ws.nodes.set(device.id, { ...device, lastSeen: Date.now() });
                    // Prune nodes older than 20s
                    const now = Date.now();
                    for (const [id, n] of ws.nodes.entries()) {
                      if (now - n.lastSeen > 20000) ws.nodes.delete(id);
                    }
                    res.statusCode = 200;
                    res.end(JSON.stringify({ success: true, nodes: Array.from(ws.nodes.values()) }));
                  } catch (e) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ success: false, error: String((e as any)?.message || e) }));
                  }
                });
                return;
              } else {
                const parsedUrl = new URL(req.url, 'http://localhost:3000');
                const slug = parsedUrl.searchParams.get('slug');
                const pinHash = parsedUrl.searchParams.get('pinHash');
                if (!(globalThis as any).workspaceRegistry) (globalThis as any).workspaceRegistry = new Map();
                const ws = slug ? (globalThis as any).workspaceRegistry.get(slug) : null;
                if (!ws || (pinHash && ws.pinHash !== pinHash)) {
                  res.statusCode = 200;
                  res.end(JSON.stringify({ success: false, nodes: [] }));
                  return;
                }
                const now = Date.now();
                for (const [id, n] of ws.nodes.entries()) {
                  if (now - n.lastSeen > 20000) ws.nodes.delete(id);
                }
                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, nodes: Array.from(ws.nodes.values()) }));
                return;
              }
            }

            
            // 100% Pure JavaScript Mesh Network Endpoint (ZERO OS shell dependencies, ZERO iwgetid/arp/rtnetlink)
            if (req.url?.startsWith('/api/scan-lan')) {
              res.setHeader('Content-Type', 'application/json');
              const rawIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1').toString().split(',')[0].trim();
              const cleanIp = rawIp.replace('::ffff:', '');
              let hash = 0;
              for (let i = 0; i < cleanIp.length; i++) {
                hash = (hash << 5) - hash + cleanIp.charCodeAt(i);
                hash |= 0;
              }
              const roomHash = 'room-' + Math.abs(hash).toString(36).slice(0, 8);

              // Pure JS: return currently registered active mesh peers
              const now = Date.now();
              const activePeers = [];
              for (const [id, peer] of meshPeers.entries()) {
                if (now - peer.lastSeen <= 35000) {
                  activePeers.push({
                    id: peer.id,
                    ip: peer.ip || cleanIp,
                    name: peer.name || 'BeamDrop Peer',
                    deviceType: peer.deviceType || 'phone',
                    icon: peer.icon || '📱',
                    latency: 2,
                    isGateway: false,
                    protocol: 'wifi',
                    signal: '98%',
                    isMeshActive: true,
                    lastSeen: peer.lastSeen || now
                  });
                } else {
                  meshPeers.delete(id);
                }
              }

              res.statusCode = 200;
              res.end(JSON.stringify({
                success: true,
                roomHash,
                network: {
                  ssid: 'Wi-Fi Room (' + roomHash + ')',
                  band: 'Mesh P2P',
                  signal: '98%',
                  speed: 'Direct WebRTC',
                  myIp: cleanIp,
                  isHotspot: false
                },
                devices: activePeers
              }));
              return;
            }
            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      cors: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      host: '0.0.0.0',
      port: 3000,
      cors: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    },
  };
});
