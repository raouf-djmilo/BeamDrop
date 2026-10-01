/**
 * PayPal Automated Subscriptions Webhook Handler (Vercel Serverless Function)
 * Route: /api/paypal/webhook
 *
 * Handles:
 * - Cryptographic signature verification via PayPal API
 * - Automatic Firestore activation on BILLING.SUBSCRIPTION.ACTIVATED & PAYMENT.SALE.COMPLETED
 * - Automatic Firestore downgrade on BILLING.SUBSCRIPTION.CANCELLED / SUSPENDED / EXPIRED
 */

import admin from 'firebase-admin';

// Initialize Firebase Admin lazily for serverless execution
let dbAdmin = null;

function getFirestoreAdmin() {
  if (dbAdmin) return dbAdmin;

  if (admin.apps && admin.apps.length > 0) {
    dbAdmin = admin.firestore();
    return dbAdmin;
  }

  let serviceAccount = null;

  // 1. Check for FIREBASE_SERVICE_ACCOUNT in env (raw JSON or base64)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      if (raw.startsWith('{')) {
        serviceAccount = JSON.parse(raw);
      } else {
        serviceAccount = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
      }
    } catch (e) {
      console.error('[PayPal Webhook] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', e);
    }
  }

  // 2. Check for individual env vars if set
  if (!serviceAccount && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID || 'a7flow-30981',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    };
  }

  if (serviceAccount) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      dbAdmin = admin.firestore();
      console.log('[PayPal Webhook] Firebase Admin initialized with service account.');
      return dbAdmin;
    } catch (err) {
      console.error('[PayPal Webhook] Firebase Admin init error:', err);
    }
  }

  // 3. Fallback: try default application credentials
  try {
    admin.initializeApp();
    dbAdmin = admin.firestore();
    console.log('[PayPal Webhook] Firebase Admin initialized with default credentials.');
    return dbAdmin;
  } catch (err) {
    console.warn('[PayPal Webhook] Firebase Admin default init skipped (set FIREBASE_SERVICE_ACCOUNT in Vercel):', err.message);
  }

  return null;
}

/**
 * Fetch PayPal OAuth2 Client Credentials Access Token
 */
async function getPayPalAccessToken(clientId, clientSecret, isSandbox) {
  const baseUrl = isSandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`PayPal OAuth Token error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Verify Webhook Signature with PayPal's Official API
 */
async function verifyPayPalSignature(req, body, isSandbox) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID || '05486845E62826438';
  const clientId = process.env.PAYPAL_CLIENT_ID || process.env.VITE_PAYPAL_CLIENT_ID || 'AZaa0Jw_idNMwP82IGj2BbJpBG4CzvZ5hDnKvlGyRqV3Uh8PS9KG88HlcEnEljXev-Rvv2D4t89SWzX0';
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || 'EOFIYr2tviLPQ6Szr4Mc5EQUBffNfQvKnH-J4ruX9fV6obAAwLZ-1TqAO9-lfK-qNZG8Fzw75LgPbia2';

  // If webhook ID is not yet provided, log warning but proceed so user can configure
  if (!webhookId) {
    console.warn('[PayPal Webhook] PAYPAL_WEBHOOK_ID not set. Signature check bypassed for initial setup.');
    return { verified: true, bypass: true };
  }

  if (!clientSecret) {
    console.warn('[PayPal Webhook] PAYPAL_CLIENT_SECRET missing.');
    return { verified: false, error: 'Missing PayPal Client Secret' };
  }

  try {
    const accessToken = await getPayPalAccessToken(clientId, clientSecret, isSandbox);
    const baseUrl = isSandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

    const verificationPayload = {
      auth_algo: req.headers['paypal-auth-algo'],
      cert_url: req.headers['paypal-cert-url'],
      transmission_id: req.headers['paypal-transmission-id'],
      transmission_sig: req.headers['paypal-transmission-sig'],
      transmission_time: req.headers['paypal-transmission-time'],
      webhook_id: webhookId,
      webhook_event: typeof body === 'string' ? JSON.parse(body) : body
    };

    const verifyRes = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(verificationPayload)
    });

    const verifyData = await verifyRes.json();
    return {
      verified: verifyData.verification_status === 'SUCCESS',
      status: verifyData.verification_status,
      details: verifyData
    };
  } catch (err) {
    console.error('[PayPal Webhook] Verification exception:', err);
    return { verified: false, error: err.message };
  }
}

/**
 * Fetch Subscription Details from PayPal API to retrieve custom_id (Firebase UID)
 */
async function fetchPayPalSubscription(subscriptionId, isSandbox) {
  const clientId = process.env.PAYPAL_CLIENT_ID || process.env.VITE_PAYPAL_CLIENT_ID || 'AZaa0Jw_idNMwP82IGj2BbJpBG4CzvZ5hDnKvlGyRqV3Uh8PS9KG88HlcEnEljXev-Rvv2D4t89SWzX0';
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || 'EOFIYr2tviLPQ6Szr4Mc5EQUBffNfQvKnH-J4ruX9fV6obAAwLZ-1TqAO9-lfK-qNZG8Fzw75LgPbia2';

  try {
    const accessToken = await getPayPalAccessToken(clientId, clientSecret, isSandbox);
    const baseUrl = isSandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

    const res = await fetch(`${baseUrl}/v1/billing/subscriptions/${subscriptionId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[PayPal Webhook] Could not fetch subscription detail from PayPal:', err.message);
  }
  return null;
}

/**
 * Update Firestore user subscription record
 */
async function updateUserInFirestore(uid, data) {
  const db = getFirestoreAdmin();
  if (!db) {
    console.warn(`[PayPal Webhook] Firestore Admin not initialized. Cannot persist update for user ${uid}. Ensure FIREBASE_SERVICE_ACCOUNT is set in Vercel.`);
    return false;
  }

  try {
    // 1. Update user profile document
    const userRef = db.collection('users').doc(uid);
    await userRef.set(data, { merge: true });

    // 2. If subscription ID is provided, record in subscriptions collection
    if (data.subscriptionId) {
      const subRef = db.collection('subscriptions').doc(data.subscriptionId);
      await subRef.set({
        uid,
        ...data,
        updatedAt: Date.now()
      }, { merge: true });
    }

    console.log(`[PayPal Webhook] Successfully updated Firestore for user ${uid}:`, data.plan || data.subscriptionStatus);
    return true;
  } catch (err) {
    console.error(`[PayPal Webhook] Firestore write error for user ${uid}:`, err);
    return false;
  }
}

/**
 * Find UID associated with subscription ID in Firestore
 */
async function findUidBySubscriptionId(subscriptionId) {
  const db = getFirestoreAdmin();
  if (!db || !subscriptionId) return null;

  try {
    const subDoc = await db.collection('subscriptions').doc(subscriptionId).get();
    if (subDoc.exists && subDoc.data()?.uid) {
      return subDoc.data().uid;
    }

    // Query users collection where subscriptionId matches
    const userQuery = await db.collection('users').where('subscriptionId', '==', subscriptionId).limit(1).get();
    if (!userQuery.empty) {
      return userQuery.docs[0].id;
    }
  } catch (err) {
    console.warn('[PayPal Webhook] Error looking up subscription UID:', err);
  }

  return null;
}

/**
 * Main Webhook Handler
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Health-check / endpoint discovery via GET
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'active',
      endpoint: '/api/paypal/webhook',
      service: 'BeamDrop Automated PayPal Engine',
      hasWebhookId: Boolean(process.env.PAYPAL_WEBHOOK_ID),
      hasAdminSdk: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT),
      timestamp: new Date().toISOString()
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isSandbox = (process.env.PAYPAL_MODE || '').toLowerCase() === 'sandbox';

  // Parse body
  let event = req.body;
  if (typeof event === 'string') {
    try {
      event = JSON.parse(event);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }
  }

  if (!event || !event.event_type) {
    return res.status(400).json({ error: 'Missing PayPal event_type' });
  }

  const eventType = event.event_type;
  const resource = event.resource || {};

  console.log(`[PayPal Webhook] Received Event: ${eventType} (ID: ${event.id})`);

  // Verify Signature
  const verification = await verifyPayPalSignature(req, event, isSandbox);
  if (!verification.verified && !verification.bypass) {
    console.error('[PayPal Webhook] Signature verification failed:', verification);
    return res.status(400).json({
      error: 'Invalid PayPal Webhook signature',
      details: verification
    });
  }

  const yearlyPlanId = process.env.VITE_PAYPAL_PLAN_YEARLY || process.env.PAYPAL_PLAN_YEARLY || '';

  try {
    // -------------------------------------------------------------
    // IDEMPOTENCY GUARD: Prevent duplicate event processing & double writes
    // -------------------------------------------------------------
    const db = getFirestoreAdmin();
    if (db && event.id) {
      try {
        const eventRef = db.collection('processed_webhook_events').doc(event.id);
        const eventSnap = await eventRef.get();
        if (eventSnap.exists) {
          console.log(`[PayPal Webhook] Idempotency: Event ${event.id} already processed. Skipping duplicate.`);
          return res.status(200).json({ received: true, duplicate: true, eventId: event.id });
        }
        await eventRef.set({
          eventId: event.id,
          eventType,
          receivedAt: Date.now()
        });
      } catch (idempotencyErr) {
        console.warn('[PayPal Webhook] Idempotency tracking note:', idempotencyErr.message);
      }
    }

    // -------------------------------------------------------------
    // EVENT 1 & 2: Subscription Activated or Payment Sale Completed
    // -------------------------------------------------------------
    if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED' || eventType === 'PAYMENT.SALE.COMPLETED') {
      let uid = resource.custom_id || resource.custom;
      const subscriptionId = resource.id || resource.billing_agreement_id;
      const planId = resource.plan_id;

      // If uid not in sale payload, fetch subscription from PayPal API or Firestore
      if (!uid && subscriptionId) {
        uid = await findUidBySubscriptionId(subscriptionId);
        if (!uid) {
          const subDetail = await fetchPayPalSubscription(subscriptionId, isSandbox);
          if (subDetail?.custom_id) {
            uid = subDetail.custom_id;
          }
        }
      }

      if (uid) {
        const isYearly = Boolean(yearlyPlanId && planId === yearlyPlanId);
        await updateUserInFirestore(uid, {
          plan: 'pro',
          tier: 'pro',
          subscriptionId: subscriptionId || null,
          subscriptionStatus: 'ACTIVE',
          billingCycle: isYearly ? 'yearly' : 'monthly',
          planId: planId || null,
          updatedAt: Date.now()
        });
      } else {
        console.warn('[PayPal Webhook] Could not determine user UID for activated subscription:', subscriptionId);
      }
    }

    // -------------------------------------------------------------
    // EVENT 3: Subscription Suspended (Payment Failed -> 3-day Grace Period)
    // -------------------------------------------------------------
    else if (eventType === 'BILLING.SUBSCRIPTION.SUSPENDED') {
      const subscriptionId = resource.id;
      let uid = resource.custom_id;
      if (!uid && subscriptionId) uid = await findUidBySubscriptionId(subscriptionId);

      if (uid) {
        const gracePeriodUntil = Date.now() + 3 * 24 * 60 * 60 * 1000; // 3 Days Grace Period
        await updateUserInFirestore(uid, {
          subscriptionStatus: 'PAST_DUE',
          gracePeriodUntil,
          updatedAt: Date.now()
        });
        console.log(`[PayPal Webhook] 3-Day Grace Period granted to user ${uid} following subscription suspension.`);
      }
    }

    // -------------------------------------------------------------
    // EVENT 4 & 5: Subscription Cancelled or Expired
    // -------------------------------------------------------------
    else if (
      eventType === 'BILLING.SUBSCRIPTION.CANCELLED' ||
      eventType === 'BILLING.SUBSCRIPTION.EXPIRED'
    ) {
      const subscriptionId = resource.id;
      let uid = resource.custom_id;

      if (!uid && subscriptionId) {
        uid = await findUidBySubscriptionId(subscriptionId);
      }

      if (uid) {
        await updateUserInFirestore(uid, {
          plan: 'free',
          tier: 'free',
          subscriptionStatus: eventType.replace('BILLING.SUBSCRIPTION.', ''),
          updatedAt: Date.now()
        });
      } else {
        console.warn('[PayPal Webhook] Could not determine user UID for cancelled/suspended subscription:', subscriptionId);
      }
    }

    // Return 200 OK to PayPal so it marks the event as delivered
    return res.status(200).json({
      received: true,
      eventType,
      id: event.id
    });
  } catch (err) {
    console.error('[PayPal Webhook] Processing error:', err);
    // Still return 200 to prevent PayPal from aggressively retrying broken requests, but include status
    return res.status(200).json({
      received: true,
      error: err.message
    });
  }
}
