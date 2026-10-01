import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// CRITICAL: The app must use firestoreDatabaseId from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
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
}

/**
 * Diagnoses Firebase Auth errors and provides immediate actionable links
 * (e.g. Identity Toolkit API enablement in Google Cloud or provider enabling in Firebase Console).
 */
export function diagnoseFirebaseAuthError(error: any): AuthErrorDiagnosis {
  const code = error?.code || '';
  const message = error?.message || String(error);

  // 1. Google Cloud Identity Toolkit API not enabled (project 1081762917738)
  if (
    code === 'auth/identity-toolkit-api-has-not-been-used' ||
    message.includes('identitytoolkit.googleapis.com') ||
    message.includes('Identity Toolkit API') ||
    message.includes('1081762917738') ||
    (code === 'auth/operation-not-allowed' && message.includes('disabled'))
  ) {
    return {
      title: 'Identity Toolkit API Needs Activation',
      message:
        'Firebase Authentication is not yet activated on Google Cloud for project 1081762917738. Click below to enable Identity Toolkit API, then retry.',
      actionUrl:
        'https://console.developers.google.com/apis/api/identitytoolkit.googleapis.com/overview?project=1081762917738',
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
      actionUrl: 'https://console.firebase.google.com/?authuser=1',
      actionLabel: 'Open Firebase Console Auth Settings',
      isApiDisabled: true
    };
  }

  // 3. Domain not authorized in Firebase OAuth
  if (code === 'auth/unauthorized-domain') {
    return {
      title: 'Unauthorized Domain',
      message:
        'This domain is not authorized for OAuth. Add it under Firebase Console > Authentication > Settings > Authorized domains.',
      actionUrl: 'https://console.firebase.google.com/?authuser=1',
      actionLabel: 'Open Authorized Domains in Firebase'
    };
  }

  // 4. Invalid credentials / wrong password
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return {
      title: 'Incorrect Credentials',
      message: 'The password or account credentials you entered are incorrect. Please verify and try again.'
    };
  }

  // 5. Account not found
  if (code === 'auth/user-not-found') {
    return {
      title: 'Account Not Found',
      message: 'No registered account found with this email or username. Please check your spelling or sign up.'
    };
  }

  // 6. Email already in use
  if (code === 'auth/email-already-in-use') {
    return {
      title: 'Email Already In Use',
      message: 'An account with this email address already exists. Please sign in instead.'
    };
  }

  // 7. Network error
  if (code === 'auth/network-request-failed') {
    return {
      title: 'Network Connection Issue',
      message: 'Could not connect to Firebase Auth servers. Please check your internet connection and try again.'
    };
  }

  return {
    title: 'Authentication Error',
    message: message || 'An unexpected error occurred during authentication.'
  };
}
