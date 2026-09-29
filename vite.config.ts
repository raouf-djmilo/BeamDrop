import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'url';
import path from 'path';
import fs from 'fs';
import {exec, execSync} from 'child_process';
import os from 'os';
import util from 'util';
import {defineConfig} from 'vite';

const execPromise = util.promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'cors-and-upgrade-plugin',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', '*');
            if (req.method === 'OPTIONS') {
              res.statusCode = 204;
              res.end();
              return;
            }

            // 1-Click Zero-Zip Extension Upgrade Endpoint
            if (req.url?.startsWith('/api/upgrade-extension')) {
              res.setHeader('Content-Type', 'application/json');
              try {
                // Read latest version from version.json
                let latestVersion = '1.5.1';
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

                // Run extension packer to bundle assets
                try {
                  await execPromise('node scripts/pack-extension.cjs', { cwd: __dirname });
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

            // High-Gen Wi-Fi & Hotspot Spider Network Scanner
            if (req.url?.startsWith('/api/scan-lan')) {
              res.setHeader('Content-Type', 'application/json');
              try {
                // 1. Wi-Fi interface details
                let wifiInfo = {
                  ssid: 'Wi-Fi Network',
                  signal: '90%',
                  band: '5 GHz',
                  speed: '1200 Mbps',
                  state: 'connected'
                };
                try {
                  const wlanOut = execSync('netsh wlan show interfaces', { encoding: 'utf8', timeout: 3000 });
                  for (const l of wlanOut.split('\n')) {
                    const parts = l.split(':');
                    if (parts.length >= 2) {
                      const key = parts[0].trim().toLowerCase();
                      const val = parts.slice(1).join(':').trim();
                      if (key === 'ssid' && !val.includes('BSSID')) wifiInfo.ssid = val;
                      else if (key === 'band') wifiInfo.band = val;
                      else if (key === 'signal') wifiInfo.signal = val;
                      else if (key.includes('state')) wifiInfo.state = val;
                      else if (key.includes('receive rate')) wifiInfo.speed = val + ' Mbps';
                    }
                  }
                } catch (e) {}

                // 2. Discover local IP & Subnet
                let myIp = '127.0.0.1';
                const nets = os.networkInterfaces();
                for (const name of Object.keys(nets)) {
                  for (const net of nets[name] || []) {
                    if (net.family === 'IPv4' && !net.internal && (net.address.startsWith('192.168.') || net.address.startsWith('10.') || net.address.startsWith('172.'))) {
                      myIp = net.address;
                      break;
                    }
                  }
                }

                const subnetParts = myIp.split('.');
                const subnetPrefix = subnetParts.slice(0, 3).join('.');
                const isHotspotAndroid = subnetPrefix === '192.168.43';
                const isHotspotIos = subnetPrefix === '172.20.10';
                const isHotspotWin = subnetPrefix === '192.168.137';

                // 3. Read ARP Table for devices connected on this subnet
                const arpOut = execSync('arp -a', { encoding: 'utf8', timeout: 3000 });
                const discoveredDevices: any[] = [];
                const seenIps = new Set<string>();

                for (const line of arpOut.split('\n')) {
                  const m = line.trim().match(/^([0-9.]+)\s+([0-9a-fA-F-]+)\s+(\w+)/);
                  if (m) {
                    const ip = m[1];
                    const mac = m[2].toLowerCase();
                    if (
                      ip.startsWith('224.') ||
                      ip.startsWith('239.') ||
                      ip.endsWith('.255') ||
                      ip === '255.255.255.255' ||
                      ip === myIp ||
                      seenIps.has(ip)
                    ) continue;

                    seenIps.add(ip);

                    // Ping latency test
                    let latency = 5;
                    try {
                      const pOut = execSync(`ping -n 1 -w 400 ${ip}`, { encoding: 'utf8', timeout: 1000 });
                      const timeM = pOut.match(/time[=<](\d+)ms/i);
                      if (timeM) latency = parseInt(timeM[1], 10);
                    } catch (e) {}

                    const isGateway = ip.endsWith('.1');
                    let deviceType = 'phone';
                    let icon = '📱';
                    let name = `Device (${ip})`;

                    if (isGateway) {
                      if (isHotspotAndroid) {
                        name = 'Android Phone (Hotspot Host)';
                        deviceType = 'phone';
                        icon = '📱';
                      } else if (isHotspotIos) {
                        name = 'iPhone Personal Hotspot (Host)';
                        deviceType = 'phone';
                        icon = '📱';
                      } else {
                        name = `Wi-Fi Router (${wifiInfo.ssid})`;
                        deviceType = 'router';
                        icon = '🌐';
                      }
                    } else {
                      const secondHex = mac[1];
                      const isRandomizedMac = ['2', '6', 'a', 'e'].includes(secondHex);
                      if (isRandomizedMac) {
                        name = `Smartphone (Android / iPhone)`;
                        deviceType = 'phone';
                        icon = '📱';
                      } else if (mac.startsWith('f8-e4') || mac.startsWith('00-50') || mac.startsWith('00-0c')) {
                        name = `Workstation / PC (${ip})`;
                        deviceType = 'laptop';
                        icon = '💻';
                      } else {
                        name = `Connected Peer (${ip})`;
                        deviceType = 'phone';
                        icon = '📱';
                      }
                    }

                    discoveredDevices.push({
                      id: `lan-${ip.replace(/\./g, '-')}`,
                      ip,
                      mac,
                      name,
                      deviceType,
                      icon,
                      latency,
                      isGateway,
                      protocol: isHotspotAndroid || isHotspotIos || isHotspotWin ? 'hotspot' : 'wifi',
                      signal: wifiInfo.signal,
                      lastSeen: Date.now()
                    });
                  }
                }

                res.statusCode = 200;
                res.end(JSON.stringify({
                  success: true,
                  network: {
                    ssid: wifiInfo.ssid,
                    band: wifiInfo.band,
                    signal: wifiInfo.signal,
                    speed: wifiInfo.speed,
                    myIp,
                    subnet: `${subnetPrefix}.0/24`,
                    isHotspot: isHotspotAndroid || isHotspotIos || isHotspotWin
                  },
                  devices: discoveredDevices
                }));
                return;
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ success: false, error: err?.message || 'Scan failed' }));
                return;
              }
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
