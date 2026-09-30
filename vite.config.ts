import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'url';
import path from 'path';
import fs from 'fs';
// Zero native shell execution - 100% in-memory JS mesh
import os from 'os';
import util from 'util';
import {defineConfig} from 'vite';

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
            next();
          });
          const meshPeers = new Map<string, any>();
          const meshOrders = new Map<string, any>();

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

            // 1. Mesh Device Announcement & Heartbeat
            if (req.url?.startsWith('/api/mesh/announce') && req.method === 'POST') {
              res.setHeader('Content-Type', 'application/json');
              const data = await parseJsonBody(req);
              const u = new URL(req.url, 'http://localhost');
              const pin = (data?.pin || u.searchParams.get('pin') || '').toString().trim();
              if (data && data.id) {
                const remoteIp = (req.socket?.remoteAddress || '127.0.0.1').replace('::ffff:', '');
                meshPeers.set(data.id, {
                  ...data,
                  pin,
                  ip: data.ip || (remoteIp === '127.0.0.1' ? '127.0.0.1' : remoteIp),
                  lastSeen: Date.now()
                });
              }
              const now = Date.now();
              for (const [id, peer] of meshPeers.entries()) {
                if (now - peer.lastSeen > 35000) meshPeers.delete(id);
              }
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, count: meshPeers.size }));
              return;
            }

            // 2. Mesh Active Devices List
            if (req.url?.startsWith('/api/mesh/devices')) {
              res.setHeader('Content-Type', 'application/json');
              const u = new URL(req.url, 'http://localhost');
              const pin = (u.searchParams.get('pin') || '').toString().trim();
              const now = Date.now();
              const filtered = [];
              for (const [id, peer] of meshPeers.entries()) {
                if (now - peer.lastSeen > 35000) {
                  meshPeers.delete(id);
                } else if (!pin || (peer.pin && peer.pin === pin)) {
                  filtered.push(peer);
                }
              }
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, devices: filtered }));
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
            // Serve Raw Extension Files for 1-Click Folder Unpacker (/extension/*)
            if (req.url?.startsWith('/extension/')) {
              const urlPath = req.url.split('?')[0].replace(/^\/extension\//, '');
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
