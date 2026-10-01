import { doc, getDoc, setDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';

export type OperationTypeQuota = 'send' | 'receive' | 'qr_scan';
export type UserTier = 'guest' | 'free' | 'pro';
// Backward compatibility alias
export type UserPlan = 'free' | 'pro';

export interface PlanLimits {
  maxSends: number;
  maxReceives: number;
  maxScans: number;
  maxTransitFileSize: number; // bytes
}

export const PLAN_LIMITS: Record<UserTier, PlanLimits> = {
  guest: {
    maxSends: 5,
    maxReceives: 5,
    maxScans: 5,
    maxTransitFileSize: 25 * 1024 * 1024 // 25 MB
  },
  free: {
    maxSends: 15,
    maxReceives: 15,
    maxScans: 15,
    maxTransitFileSize: 50 * 1024 * 1024 // 50 MB
  },
  pro: {
    maxSends: Infinity,
    maxReceives: Infinity,
    maxScans: Infinity,
    maxTransitFileSize: 100 * 1024 * 1024 // 100 MB (P2P Unlimited)
  }
};

export interface DailyUsageMetrics {
  date: string; // YYYY-MM-DD
  sendOperations: number;
  receiveOperations: number;
  qrScansCount: number;
  bytesTransferred: number;
  lastActivity: number;
}

export interface QuotaCheckResult {
  allowed: boolean;
  type: OperationTypeQuota;
  count: number;
  max: number;
  remaining: number;
  tier: UserTier;
  plan: UserPlan;
  trigger: 'auth_modal' | 'pricing_modal' | null;
  reason?: string;
}

/**
 * Generates or retrieves persistent device fingerprint for Guest tier
 */
export function getGuestUUID(): string {
  if (typeof window === 'undefined') return 'guest_default';
  try {
    let id = localStorage.getItem('beamdrop_guest_uuid');
    if (!id) {
      id = 'guest_' + Math.random().toString(36).slice(2, 9) + '_' + Date.now().toString(36);
      localStorage.setItem('beamdrop_guest_uuid', id);
    }
    return id;
  } catch (_) {
    return 'guest_fallback';
  }
}

/**
 * Returns today's ISO date string in YYYY-MM-DD format (local date)
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const LOCAL_STORAGE_KEY_PREFIX = 'beamdrop_daily_usage_';

/**
 * Read local cached daily usage
 */
export function getLocalDailyUsage(dateStr = getTodayDateString(), uid?: string | null): DailyUsageMetrics {
  const prefix = uid ? `${LOCAL_STORAGE_KEY_PREFIX}${uid}_` : `${LOCAL_STORAGE_KEY_PREFIX}guest_${getGuestUUID()}_`;
  try {
    const raw = localStorage.getItem(`${prefix}${dateStr}`) || localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${dateStr}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        date: dateStr,
        sendOperations: parsed.sendOperations || 0,
        receiveOperations: parsed.receiveOperations || 0,
        qrScansCount: parsed.qrScansCount || 0,
        bytesTransferred: parsed.bytesTransferred || 0,
        lastActivity: parsed.lastActivity || Date.now()
      };
    }
  } catch (_) {}

  return {
    date: dateStr,
    sendOperations: 0,
    receiveOperations: 0,
    qrScansCount: 0,
    bytesTransferred: 0,
    lastActivity: Date.now()
  };
}

/**
 * Save daily usage to local storage and sync to extension if available
 */
export function setLocalDailyUsage(usage: DailyUsageMetrics, uid?: string | null) {
  const prefix = uid ? `${LOCAL_STORAGE_KEY_PREFIX}${uid}_` : `${LOCAL_STORAGE_KEY_PREFIX}guest_${getGuestUUID()}_`;
  try {
    const serialized = JSON.stringify(usage);
    localStorage.setItem(`${prefix}${usage.date}`, serialized);
    // Legacy fallback key for extension & other windows
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${usage.date}`, serialized);

    // Broadcast event for active UI components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('beamdrop:quota_update', { detail: usage }));
      window.postMessage({ type: 'BEAMDROP_QUOTA_SYNC', usage }, '*');
    }
    // Sync with extension if chrome storage is accessible directly
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      chrome.storage.local.set({ beamdrop_daily_usage: usage });
    }
  } catch (_) {}
}

/**
 * Retrieve daily usage either from Firestore (if user is authenticated) or local guest cache
 */
export async function fetchDailyUsage(
  uid?: string | null,
  dateStr = getTodayDateString()
): Promise<DailyUsageMetrics> {
  const localUsage = getLocalDailyUsage(dateStr, uid);

  if (!uid) {
    return localUsage;
  }

  try {
    const docRef = doc(db, 'users', uid, 'daily_usage', dateStr);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      const firestoreUsage: DailyUsageMetrics = {
        date: dateStr,
        sendOperations: Number(data.sendOperations || 0),
        receiveOperations: Number(data.receiveOperations || 0),
        qrScansCount: Number(data.qrScansCount || 0),
        bytesTransferred: Number(data.bytesTransferred || 0),
        lastActivity: Number(data.lastActivity || Date.now())
      };
      // Keep local copy fresh
      setLocalDailyUsage(firestoreUsage, uid);
      return firestoreUsage;
    }
  } catch (err) {
    console.warn('Could not fetch daily usage from Firestore, using local cache:', err);
  }

  return localUsage;
}

/**
 * Resolves current tier: 'guest' (no account), 'free' (account), 'pro' (paid)
 */
export function resolveTier(uid?: string | null, plan: UserPlan = 'free'): UserTier {
  if (plan === 'pro') return 'pro';
  if (uid) return 'free';
  return 'guest';
}

/**
 * Check if the requested operation is allowed under the current 3-tier funnel
 */
export async function checkOperationQuota(
  type: OperationTypeQuota,
  uid?: string | null,
  plan: UserPlan = 'free'
): Promise<QuotaCheckResult> {
  const tier = resolveTier(uid, plan);
  const limits = PLAN_LIMITS[tier];

  // Pro users have unlimited access
  if (tier === 'pro') {
    return {
      allowed: true,
      type,
      count: 0,
      max: Infinity,
      remaining: Infinity,
      tier: 'pro',
      plan: 'pro',
      trigger: null
    };
  }

  const usage = await fetchDailyUsage(uid);
  let count = 0;
  let max = limits.maxSends;

  if (type === 'send') {
    count = usage.sendOperations;
    max = limits.maxSends;
  } else if (type === 'receive') {
    count = usage.receiveOperations;
    max = limits.maxReceives;
  } else if (type === 'qr_scan') {
    count = usage.qrScansCount;
    max = limits.maxScans;
  }

  const remaining = Math.max(0, max - count);
  const allowed = count < max;

  let trigger: 'auth_modal' | 'pricing_modal' | null = null;
  let reason: string | undefined = undefined;

  if (!allowed) {
    if (tier === 'guest') {
      trigger = 'auth_modal';
      reason = 'Khlass l-quota ta3 l-guest (5/5)! Creer compte batel dork w ddi 15 Beams f nhar!';
    } else {
      trigger = 'pricing_modal';
      reason = 'Daily limit of 15 beams reached. Upgrade to PRO ($4/mo) for unlimited transfers!';
    }
  }

  return {
    allowed,
    type,
    count,
    max,
    remaining,
    tier,
    plan: tier === 'pro' ? 'pro' : 'free',
    trigger,
    reason
  };
}

export interface TrackOperationParams {
  type: OperationTypeQuota;
  bytes?: number;
  uid?: string | null;
  plan?: UserPlan;
}

/**
 * Atomically records an operation in Firestore and local storage.
 * If quota is exceeded, rejects and broadcasts event for AuthModal or PricingModal.
 */
export async function trackOperation({
  type,
  bytes = 0,
  uid = null,
  plan = 'free'
}: TrackOperationParams): Promise<QuotaCheckResult> {
  const quota = await checkOperationQuota(type, uid, plan);

  if (!quota.allowed) {
    // Dispatch upgrade trigger event so UI can open AuthModal (for Guest) or PricingModal (for Free)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('beamdrop:quota_exceeded', {
          detail: { type, tier: quota.tier, quota, trigger: quota.trigger }
        })
      );
    }
    throw new Error(
      quota.reason || `Daily limit reached for ${type}. Upgrade to continue!`
    );
  }

  const dateStr = getTodayDateString();
  const fileBytes = Math.max(0, Number(bytes) || 0);

  // 1. Update local usage immediately for instantaneous UI updates
  const currentLocal = getLocalDailyUsage(dateStr, uid);
  const updatedLocal: DailyUsageMetrics = {
    date: dateStr,
    sendOperations: currentLocal.sendOperations + (type === 'send' ? 1 : 0),
    receiveOperations: currentLocal.receiveOperations + (type === 'receive' ? 1 : 0),
    qrScansCount: currentLocal.qrScansCount + (type === 'qr_scan' ? 1 : 0),
    bytesTransferred: currentLocal.bytesTransferred + fileBytes,
    lastActivity: Date.now()
  };
  setLocalDailyUsage(updatedLocal, uid);

  // 2. Atomically record in Cloud Firestore if authenticated
  if (uid) {
    try {
      const docRef = doc(db, 'users', uid, 'daily_usage', dateStr);
      await setDoc(
        docRef,
        {
          sendOperations: increment(type === 'send' ? 1 : 0),
          receiveOperations: increment(type === 'receive' ? 1 : 0),
          qrScansCount: increment(type === 'qr_scan' ? 1 : 0),
          bytesTransferred: increment(fileBytes),
          lastActivity: Date.now()
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Firestore atomic increment warning:', err);
    }
  }

  const newCount =
    type === 'send'
      ? updatedLocal.sendOperations
      : type === 'receive'
      ? updatedLocal.receiveOperations
      : updatedLocal.qrScansCount;

  return {
    allowed: true,
    type,
    count: newCount,
    max: quota.max,
    remaining: quota.tier === 'pro' ? Infinity : Math.max(0, quota.max - newCount),
    tier: quota.tier,
    plan: quota.plan,
    trigger: null
  };
}

/**
 * Validates file size for Transit Cloud uploads against tier limit
 */
export function validateTransitFileSize(
  fileSizeBytes: number,
  tier: UserTier = 'guest'
): { valid: boolean; maxBytes: number; message?: string } {
  const limits = PLAN_LIMITS[tier] || PLAN_LIMITS.guest;
  const maxBytes = limits.maxTransitFileSize;

  if (fileSizeBytes > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    return {
      valid: false,
      maxBytes,
      message: `File exceeds ${maxMb}MB cloud transit limit on the ${tier.toUpperCase()} tier. Use direct P2P for unlimited size or upgrade to Pro!`
    };
  }

  return { valid: true, maxBytes };
}
