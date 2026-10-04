/**
 * Serverless Dynamic QR Code Vault Generator
 * Route: /api/vault/qr
 * 
 * Generates high-resolution PNG QR code for Native iOS Quick Look / Shortcuts
 * without requiring the user to open Safari.
 * Records quota usage in Firestore and returns raw image/png buffer.
 */

import QRCode from 'qrcode';
import admin from 'firebase-admin';

// Initialize Firebase Admin lazily if credentials exist
let dbAdmin = null;

function getFirestoreAdmin() {
  if (dbAdmin) return dbAdmin;
  if (admin.apps && admin.apps.length > 0) {
    dbAdmin = admin.firestore();
    return dbAdmin;
  }

  let serviceAccount = null;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      serviceAccount = raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    } catch (_) {}
  } else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID || 'a7flow-30981',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    };
  }

  if (serviceAccount) {
    try {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      dbAdmin = admin.firestore();
      return dbAdmin;
    } catch (_) {}
  }

  try {
    admin.initializeApp();
    dbAdmin = admin.firestore();
    return dbAdmin;
  } catch (_) {}

  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const user = (req.query.user || req.query.uid || req.query.peer || 'mobile_vault').trim();
  const format = (req.query.format || 'png').toLowerCase();
  const today = new Date().toISOString().split('T')[0];

  // 1. Record QR Generation in Firestore for analytics & quota tracking
  try {
    const db = getFirestoreAdmin();
    if (db && user && user !== 'mobile_vault') {
      const usageRef = db.collection('users').doc(user).collection('daily_usage').doc(today);
      await usageRef.set({
        qrScansCount: admin.firestore.FieldValue.increment(1),
        lastActivity: Date.now()
      }, { merge: true }).catch(() => {});
    }
  } catch (_) {}

  // 2. Build target beam URL: When a sender scans this QR, it immediately opens BeamDrop sender targeting this receiver
  const host = req.headers.host || 'beam-drop-mu.vercel.app';
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const targetUrl = `${protocol}://${host}/?target=${encodeURIComponent(user)}&action=send`;

  try {
    // 3. Generate high-resolution luxury PNG QR code
    const qrBuffer = await QRCode.toBuffer(targetUrl, {
      type: 'png',
      width: 720,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#0369a1', // BeamDrop Electric Blue
        light: '#ffffff'
      }
    });

    if (format === 'json') {
      const b64 = qrBuffer.toString('base64');
      return res.status(200).json({
        success: true,
        user,
        targetUrl,
        dataUrl: `data:image/png;base64,${b64}`
      });
    }

    // 4. Return PNG binary directly so iOS Quick Look renders immediately in native window
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', qrBuffer.length);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Content-Disposition', `inline; filename="beamdrop-qr-${user}.png"`);
    return res.status(200).send(qrBuffer);

  } catch (err) {
    console.error('[Vault QR API Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate QR Vault' });
  }
}
