/**
 * BeamDrop QR Studio — Dynamic QR Routing & Real-Time Scan Analytics Engine
 * Supports:
 * - Dynamic URL Shortlinks (/q/:code) with live destination editing
 * - Multi-Store Smart App Links (auto-detects iOS / Android / Desktop)
 * - Digital vCard Interactive Profiles & .vcf generation
 * - PDF Showcase & 24h Cloud Drop document portals
 * - Scan telemetry (total scans, OS breakdown, timestamps)
 */

if (!global.__BEAMDROP_DYNAMIC_QRS__) {
  global.__BEAMDROP_DYNAMIC_QRS__ = new Map();
}

const dynamicQrStore = global.__BEAMDROP_DYNAMIC_QRS__;

function detectDeviceOs(userAgent = '') {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'iOS';
  if (/android/.test(ua)) return 'Android';
  if (/macintosh|mac os x/.test(ua)) return 'macOS';
  if (/windows/.test(ua)) return 'Windows';
  if (/linux/.test(ua)) return 'Linux';
  return 'Other';
}

function generateShortCode(len = 6) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const action = (req.query?.action || req.body?.action || '').toString();

    // 1. CREATE DYNAMIC QR
    if (req.method === 'POST' && (action === 'create' || !action)) {
      const {
        type = 'url',
        title = 'Untitled QR',
        targetUrl = '',
        payload = {},
        customCode = '',
        design = {}
      } = req.body || {};

      let code = (customCode || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
      if (!code || dynamicQrStore.has(code)) {
        code = generateShortCode(6);
      }

      const now = Date.now();
      const record = {
        code,
        type, // 'url' | 'vcard' | 'wifi' | 'pdf' | 'applink' | 'text'
        title: String(title || 'BeamDrop Dynamic QR').slice(0, 140),
        targetUrl: String(targetUrl || '').trim(),
        payload: payload || {},
        design: design || {},
        createdAt: now,
        updatedAt: now,
        scans: 0,
        lastScannedAt: null,
        osBreakdown: {
          iOS: 0,
          Android: 0,
          Desktop: 0
        },
        recentScans: []
      };

      dynamicQrStore.set(code, record);

      return res.status(200).json({
        ok: true,
        qr: record
      });
    }

    // 2. UPDATE DYNAMIC QR DESTINATION OR PAYLOAD (Live edit without changing QR image)
    if ((req.method === 'POST' || req.method === 'PUT') && action === 'update') {
      const { code, title, targetUrl, payload } = req.body || {};
      if (!code || !dynamicQrStore.has(code)) {
        return res.status(404).json({ error: 'Dynamic QR code not found' });
      }

      const existing = dynamicQrStore.get(code);
      if (typeof title === 'string' && title.trim()) {
        existing.title = title.trim().slice(0, 140);
      }
      if (typeof targetUrl === 'string') {
        existing.targetUrl = targetUrl.trim();
      }
      if (payload && typeof payload === 'object') {
        existing.payload = { ...existing.payload, ...payload };
      }
      existing.updatedAt = Date.now();
      dynamicQrStore.set(code, existing);

      return res.status(200).json({
        ok: true,
        qr: existing
      });
    }

    // 3. DELETE DYNAMIC QR
    if ((req.method === 'POST' || req.method === 'DELETE') && action === 'delete') {
      const code = (req.query?.code || req.body?.code || '').toString().trim();
      if (code && dynamicQrStore.has(code)) {
        dynamicQrStore.delete(code);
      }
      return res.status(200).json({ ok: true, deleted: code });
    }

    // 4. RESOLVE & TRACK SCAN FOR DYNAMIC QR
    if (req.method === 'GET' && (action === 'get' || action === 'resolve')) {
      const code = (req.query?.code || '').toString().trim();
      const track = req.query?.track === '1' || req.query?.track === 'true';

      if (!code || !dynamicQrStore.has(code)) {
        return res.status(404).json({ error: 'Dynamic QR not found or expired' });
      }

      const record = dynamicQrStore.get(code);
      const ua = req.headers['user-agent'] || '';
      const detectedOs = detectDeviceOs(ua);

      if (track) {
        record.scans = (record.scans || 0) + 1;
        record.lastScannedAt = Date.now();
        if (detectedOs === 'iOS') {
          record.osBreakdown.iOS = (record.osBreakdown.iOS || 0) + 1;
        } else if (detectedOs === 'Android') {
          record.osBreakdown.Android = (record.osBreakdown.Android || 0) + 1;
        } else {
          record.osBreakdown.Desktop = (record.osBreakdown.Desktop || 0) + 1;
        }
        record.recentScans.unshift({
          timestamp: Date.now(),
          os: detectedOs
        });
        if (record.recentScans.length > 25) {
          record.recentScans = record.recentScans.slice(0, 25);
        }
        dynamicQrStore.set(code, record);
      }

      // Compute smart destination for Multi-Store App Link
      let resolvedRedirectUrl = record.targetUrl;
      if (record.type === 'applink' && record.payload) {
        if (detectedOs === 'iOS' && record.payload.iosUrl) {
          resolvedRedirectUrl = record.payload.iosUrl;
        } else if (detectedOs === 'Android' && record.payload.androidUrl) {
          resolvedRedirectUrl = record.payload.androidUrl;
        } else if (record.payload.fallbackUrl) {
          resolvedRedirectUrl = record.payload.fallbackUrl;
        }
      }

      return res.status(200).json({
        ok: true,
        detectedOs,
        resolvedRedirectUrl,
        qr: record
      });
    }

    // 5. BATCH LIST DYNAMIC QRS BY CODES
    if (req.method === 'GET' && action === 'list') {
      const codesParam = (req.query?.codes || '').toString().trim();
      const requestedCodes = codesParam
        ? codesParam.split(',').map((c) => c.trim()).filter(Boolean)
        : Array.from(dynamicQrStore.keys());

      const items = [];
      for (const c of requestedCodes) {
        if (dynamicQrStore.has(c)) {
          items.push(dynamicQrStore.get(c));
        }
      }

      return res.status(200).json({
        ok: true,
        items
      });
    }

    return res.status(200).json({
      ok: true,
      service: 'BeamDrop QR Studio Engine',
      activeCount: dynamicQrStore.size
    });
  } catch (err) {
    console.error('[QR Studio API Error]:', err);
    return res.status(500).json({
      error: err?.message || 'Internal QR Studio server error'
    });
  }
}
