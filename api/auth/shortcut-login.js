/**
 * iOS Shortcuts Native Authentication Endpoint
 * Route: /api/auth/shortcut-login
 * 
 * Enables native iOS Ask-for-Input dialogs to authenticate without opening Safari.
 * Verifies account against Firebase Auth REST API, resolves usernames,
 * checks subscription tier in Firestore, and returns clear validation states.
 */

import admin from 'firebase-admin';

const FIREBASE_API_KEY =
  process.env.VITE_FIREBASE_API_KEY ||
  process.env.FIREBASE_API_KEY ||
  'AIzaSyB0oAPZdDEGJZGMcZuxRaF_MUuheH0kcAk';

const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ||
  'a7flow-30981';

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
      projectId: FIREBASE_PROJECT_ID,
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'active',
      service: 'BeamDrop iOS Shortcut Auth Bridge',
      endpoint: '/api/auth/shortcut-login'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, code: 'METHOD_NOT_ALLOWED', message: 'Method Not Allowed' });
  }

  // Parse Body
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {
      return res.status(400).json({ success: false, code: 'INVALID_JSON', message: 'Invalid JSON request payload' });
    }
  }

  const loginInput = (body?.loginInput || body?.username || body?.email || '').trim();
  const password = (body?.password || '').trim();

  if (!loginInput || !password) {
    return res.status(400).json({
      success: false,
      code: 'MISSING_CREDENTIALS',
      message: 'يرجى إدخال اسم المستخدم أو البريد الإلكتروني وكلمة المرور (Please enter username/email and password).'
    });
  }

  try {
    let email = loginInput;
    const db = getFirestoreAdmin();

    // 1. Resolve username to email if input does not contain '@'
    if (!loginInput.includes('@')) {
      const cleanUsername = loginInput.toLowerCase();
      let resolved = false;

      if (db) {
        try {
          const userDoc = await db.collection('usernames').doc(cleanUsername).get();
          if (userDoc.exists && userDoc.data()?.email) {
            email = userDoc.data().email;
            resolved = true;
          }
        } catch (_) {}
      }

      // If not resolved from database, try common pattern or Firestore REST
      if (!resolved) {
        try {
          const restRes = await fetch(
            `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/usernames/${encodeURIComponent(cleanUsername)}`
          );
          if (restRes.ok) {
            const data = await restRes.json();
            if (data.fields?.email?.stringValue) {
              email = data.fields.email.stringValue;
              resolved = true;
            }
          }
        } catch (_) {}
      }

      // If still not resolved, try cleanUsername@gmail.com
      if (!resolved) {
        email = `${cleanUsername}@gmail.com`;
      }
    }

    // 2. Authenticate against Firebase Identity Toolkit REST API
    const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
    const authResponse = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        password: password,
        returnSecureToken: true
      })
    });

    const authData = await authResponse.json();

    if (!authResponse.ok) {
      const errCode = authData.error?.message || 'AUTH_ERROR';

      if (errCode.includes('EMAIL_NOT_FOUND')) {
        return res.status(404).json({
          success: false,
          code: 'USER_NOT_FOUND',
          message: `الحساب "${loginInput}" غير مسجل! افتح الموقع وسجل حسابك مجاناً (Account not found).`
        });
      }

      if (errCode.includes('INVALID_PASSWORD') || errCode.includes('INVALID_LOGIN_CREDENTIALS')) {
        return res.status(401).json({
          success: false,
          code: 'WRONG_PASSWORD',
          message: 'كلمة المرور غير صحيحة، يرجى التأكد من كتابتها بشكل صحيح (Incorrect password).'
        });
      }

      if (errCode.includes('USER_DISABLED')) {
        return res.status(403).json({
          success: false,
          code: 'USER_DISABLED',
          message: 'تم تعطيل هذا الحساب. يرجى التواصل مع الدعم الفني.'
        });
      }

      return res.status(401).json({
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: 'بيانات تسجيل الدخول غير صحيحة. تأكد من الإيميل وكلمة المرور.'
      });
    }

    // 3. User authenticated successfully -> Fetch Firestore Profile for Tier & Quota Limits
    const uid = authData.localId;
    let plan = 'free';
    let username = loginInput.includes('@') ? (loginInput.split('@')[0]) : loginInput;
    let fullName = authData.displayName || username;

    if (db) {
      try {
        const profileDoc = await db.collection('users').doc(uid).get();
        if (profileDoc.exists) {
          const p = profileDoc.data();
          plan = (p?.plan === 'pro' || p?.tier === 'pro') ? 'pro' : 'free';
          username = p?.username || username;
          fullName = p?.fullName || fullName;
        }
      } catch (_) {}
    } else {
      // Fallback: Query via Firestore REST with User ID Token
      try {
        const profileRes = await fetch(
          `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${uid}`,
          { headers: { Authorization: `Bearer ${authData.idToken}` } }
        );
        if (profileRes.ok) {
          const docData = await profileRes.json();
          if (docData.fields) {
            plan = docData.fields.plan?.stringValue === 'pro' ? 'pro' : 'free';
            username = docData.fields.username?.stringValue || username;
            fullName = docData.fields.fullName?.stringValue || fullName;
          }
        }
      } catch (_) {}
    }

    const isPro = plan === 'pro';

    // 4. Return clean, structured session for iOS Shortcut
    return res.status(200).json({
      success: true,
      uid: uid,
      email: authData.email || email,
      username: username,
      fullName: fullName,
      tier: isPro ? 'pro' : 'free',
      plan: isPro ? 'pro' : 'free',
      isPro: isPro,
      dailyQuota: isPro ? 9999 : 15,
      idToken: authData.idToken,
      refreshToken: authData.refreshToken,
      message: isPro
        ? 'تم الدخول بنجاح! حسابك PRO مفعل (عمليات نقل غير محدودة وبأعلى سرعة).'
        : 'تم الدخول بنجاح! خطتك مجانية (تم رفع الحد إلى 15 عملية نقل يومياً).'
    });

  } catch (error) {
    console.error('[Shortcut Login Error]:', error);
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'تعذر الاتصال بالخادم، يرجى المحاولة بعد قليل.'
    });
  }
}
