import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Initialize Firebase Analytics safely for web measurement
export let analytics: any = null;
if (typeof window !== 'undefined' && firebaseConfig.measurementId) {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {});
}

// Connect to Firestore (supports standard (default) database or custom named databases)
export const db = (firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)')
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test Connection on boot
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase connection: client appears offline.');
    }
    return false;
  }
}

// Initial silent ping
testFirestoreConnection().catch(() => {});

export interface AuthErrorDiagnosis {
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  isApiDisabled?: boolean;
  copyText?: string;
}

/**
 * Diagnoses Firebase Auth and Firestore errors and provides immediate actionable links
 * (e.g. Identity Toolkit API enablement in Google Cloud or provider enabling in Firebase Console).
 */
export function diagnoseFirebaseAuthError(error: any): AuthErrorDiagnosis {
  const code = error?.code || '';
  const rawMsg = error?.message || String(error);

  let parsedJson: any = null;
  try {
    if (rawMsg.includes('{') && rawMsg.includes('}')) {
      const jsonStr = rawMsg.slice(rawMsg.indexOf('{'), rawMsg.lastIndexOf('}') + 1);
      parsedJson = JSON.parse(jsonStr);
    }
  } catch (_) {}

  const currentProjectId = firebaseConfig.projectId || 'a7flow-30981';

  // 1. Google Cloud Identity Toolkit API not enabled
  if (
    code === 'auth/identity-toolkit-api-has-not-been-used' ||
    rawMsg.includes('identitytoolkit.googleapis.com') ||
    rawMsg.includes('Identity Toolkit API') ||
    (code === 'auth/operation-not-allowed' && rawMsg.includes('disabled'))
  ) {
    return {
      title: 'Identity Toolkit API Needs Activation',
      message:
        `Firebase Authentication is not yet activated on Google Cloud for project ${currentProjectId}. Click below to enable Identity Toolkit API, then retry.`,
      actionUrl:
        `https://console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=${currentProjectId}`,
      actionLabel: 'Enable Identity Toolkit API in Google Cloud',
      isApiDisabled: true
    };
  }

  // 2. Email/Password or Google provider disabled in Firebase Console
  if (code === 'auth/operation-not-allowed') {
    return {
      title: 'Sign-In Provider Disabled',
      message:
        'Email/Password or Google sign-in is not enabled in Firebase Console. Please enable them in Authentication > Sign-in method.',
      actionUrl: `https://console.firebase.google.com/project/${currentProjectId}/authentication/providers`,
      actionLabel: 'Open Sign-In Methods in Firebase Console',
      isApiDisabled: true
    };
  }

  // 3. Domain not authorized in Firebase OAuth
  if (code === 'auth/unauthorized-domain' || rawMsg.includes('auth/unauthorized-domain') || rawMsg.includes('unauthorized-domain')) {
    const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'beam-drop-mu.vercel.app';
    return {
      title: 'Google Sign-In: Domain Authorization Required',
      message:
        `The domain "${currentDomain}" is not in the Firebase OAuth authorized domains list for project "${currentProjectId}". Click below to add "${currentDomain}" in Firebase Console, or sign in using your Email/Password below.`,
      actionUrl: `https://console.firebase.google.com/project/${currentProjectId}/authentication/settings`,
      actionLabel: 'Add Domain in Firebase Console',
      copyText: currentDomain
    };
  }

  // 4. Firestore username lookup permission error
  if (
    parsedJson?.path?.includes('usernames') ||
    rawMsg.includes('usernames') ||
    (parsedJson?.error && parsedJson.error.includes('insufficient permissions')) ||
    rawMsg.includes('Missing or insufficient permissions')
  ) {
    return {
      title: 'Username Lookup Notice',
      message:
        `Could not resolve this username via Firestore rules. Please sign in directly with your full email address (e.g. name@domain.com) or create an account.`,
      actionUrl: `https://console.firebase.google.com/project/${currentProjectId}/firestore/rules`,
      actionLabel: 'Check Firestore Rules in Console',
      copyText: `match /usernames/{username} { allow get: if true; }`
    };
  }

  // 5. Invalid credentials / wrong password
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return {
      title: 'Incorrect Credentials',
      message: 'The password or account credentials you entered are incorrect. Please verify and try again.'
    };
  }

  // 6. Account not found
  if (code === 'auth/user-not-found' || rawMsg.includes('No account found')) {
    return {
      title: 'Account Not Found',
      message: 'No registered account found with this email or username. Please check your spelling or sign up for free.'
    };
  }

  // 7. Email already in use
  if (code === 'auth/email-already-in-use') {
    return {
      title: 'Email Already In Use',
      message: 'An account with this email address already exists. Please sign in instead.'
    };
  }

  // 8. Network error
  if (code === 'auth/network-request-failed') {
    return {
      title: 'Network Connection Issue',
      message: 'Could not connect to Firebase Auth servers. Please check your internet connection and try again.'
    };
  }

  return {
    title: 'Authentication Notice',
    message: rawMsg.startsWith('{') ? 'Authentication request could not be completed. Please verify your credentials or sign in with your email address.' : (rawMsg || 'An unexpected error occurred during authentication.')
  };
}
