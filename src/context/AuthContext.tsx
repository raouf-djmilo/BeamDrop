import React, { createContext, useContext, useEffect, useState } from 'react';

declare const chrome: any;
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
  updatePassword
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  DailyUsageMetrics,
  OperationTypeQuota,
  UserPlan,
  UserTier,
  PLAN_LIMITS,
  resolveTier,
  getTodayDateString,
  getLocalDailyUsage,
  setLocalDailyUsage,
  trackOperation,
  QuotaCheckResult
} from '../utils/quotaEngine';

export interface UserProfile {
  uid: string;
  fullName: string;
  username: string;
  email: string;
  plan: UserPlan;
  createdAt: string | number;
  photoURL?: string;
  transfersCount?: number;
  bytesTransferred?: number;
}

export interface TransferRecord {
  id: string;
  userId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  direction: 'sent' | 'received';
  createdAt: string;
}

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  transfersHistory: TransferRecord[];
  dailyUsage: DailyUsageMetrics;
  plan: UserPlan;
  userTier: UserTier;
  remainingQuota: { sends: number; receives: number; scans: number };
  signUpWithEmail: (fullName: string, username: string, email: string, pass: string) => Promise<void>;
  signInWithEmailOrUsername: (emailOrUsername: string, pass: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  recordTransfer: (fileName: string, fileSize: number, fileType: string, direction: 'sent' | 'received') => Promise<void>;
  trackOp: (type: OperationTypeQuota, bytes?: number) => Promise<QuotaCheckResult>;
  activateProSubscription: (subscriptionId?: string, billingCycle?: 'monthly' | 'yearly') => Promise<void>;
  updateUserPassword: (newPass: string) => Promise<void>;
  syncWithExtension: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [transfersHistory, setTransfersHistory] = useState<TransferRecord[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsageMetrics>(() => getLocalDailyUsage());

  const plan: UserPlan = userProfile?.plan || 'free';
  const userTier: UserTier = resolveTier(currentUser?.uid, plan);
  const limits = PLAN_LIMITS[userTier];

  const remainingQuota = {
    sends: userTier === 'pro' ? Infinity : Math.max(0, limits.maxSends - (dailyUsage.sendOperations || 0)),
    receives: userTier === 'pro' ? Infinity : Math.max(0, limits.maxReceives - (dailyUsage.receiveOperations || 0)),
    scans: userTier === 'pro' ? Infinity : Math.max(0, limits.maxScans - (dailyUsage.qrScansCount || 0))
  };

  // Broadcast authentication & quota sync to Web and Chrome Extension Bridge
  const syncWithExtension = () => {
    try {
      const payload = {
        type: 'BEAMDROP_AUTH_SYNC',
        user: userProfile
          ? {
              uid: userProfile.uid,
              fullName: userProfile.fullName,
              username: userProfile.username,
              email: userProfile.email,
              plan: userProfile.plan
            }
          : null,
        dailyUsage
      };

      if (typeof window !== 'undefined') {
        window.postMessage(payload, '*');
        if (userProfile) {
          localStorage.setItem('beamdrop_auth_user', JSON.stringify(userProfile));
        } else {
          localStorage.removeItem('beamdrop_auth_user');
        }
      }

      // If Chrome Extension API is present (e.g. injected or externally connectable)
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        chrome.storage.local.set({
          beamdrop_user: payload.user,
          beamdrop_daily_usage: dailyUsage
        });
      }
    } catch (_) {}
  };

  // Listen for extension handshake requests
  useEffect(() => {
    const handleWindowMessage = (event: MessageEvent) => {
      if (event.data?.type === 'BEAMDROP_AUTH_REQUEST') {
        syncWithExtension();
      }
    };
    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [userProfile, dailyUsage]);

  // Sync whenever profile or dailyUsage changes
  useEffect(() => {
    syncWithExtension();
  }, [userProfile, dailyUsage]);

  // Listen to Auth state changes
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        try {
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            const profile: UserProfile = {
              uid: user.uid,
              fullName: data.fullName || user.displayName || 'BeamDrop User',
              username: data.username || (user.email ? user.email.split('@')[0] : 'user'),
              email: data.email || user.email || '',
              plan: data.plan === 'pro' ? 'pro' : 'free',
              createdAt: data.createdAt || Date.now(),
              photoURL: user.photoURL || data.photoURL,
              transfersCount: data.transfersCount || 0,
              bytesTransferred: data.bytesTransferred || 0
            };
            setUserProfile(profile);
          } else {
            // First time Google sign-in fallback profile creation
            const baseUsername = (user.email ? user.email.split('@')[0] : 'user')
              .replace(/[^a-zA-Z0-9_]/g, '')
              .toLowerCase();
            const fallbackUsername = (baseUsername.length >= 3 ? baseUsername : `user_${baseUsername}`) +
              '_' + Math.floor(1000 + Math.random() * 9000);

            const newProfile: UserProfile = {
              uid: user.uid,
              fullName: user.displayName || 'BeamDrop User',
              username: fallbackUsername,
              email: user.email || '',
              plan: 'free',
              createdAt: Date.now(),
              photoURL: user.photoURL || undefined,
              transfersCount: 0,
              bytesTransferred: 0
            };

            await setDoc(userDocRef, newProfile);
            await setDoc(doc(db, 'usernames', fallbackUsername.toLowerCase()), {
              username: fallbackUsername.toLowerCase(),
              uid: user.uid,
              email: user.email || '',
              createdAt: Date.now()
            });

            setUserProfile(newProfile);
          }
        } catch (err) {
          console.error('Error fetching user profile:', err);
        }
      } else {
        setUserProfile(null);
        setTransfersHistory([]);
      }
      setIsLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Listen to User Document in real-time (instant update when PayPal Webhook activates Pro)
  useEffect(() => {
    if (!currentUser) return;

    const userDocRef = doc(db, 'users', currentUser.uid);
    const unsubUserDoc = onSnapshot(
      userDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserProfile((prev) => ({
            uid: currentUser.uid,
            fullName: data.fullName || currentUser.displayName || prev?.fullName || 'BeamDrop User',
            username: data.username || prev?.username || (currentUser.email ? currentUser.email.split('@')[0] : 'user'),
            email: data.email || currentUser.email || prev?.email || '',
            plan: data.plan === 'pro' || data.tier === 'pro' ? 'pro' : 'free',
            createdAt: data.createdAt || prev?.createdAt || Date.now(),
            photoURL: currentUser.photoURL || data.photoURL || prev?.photoURL,
            transfersCount: data.transfersCount || 0,
            bytesTransferred: data.bytesTransferred || 0
          }));
        }
      },
      (err) => {
        console.warn('Realtime user profile snapshot warning:', err);
      }
    );

    return () => unsubUserDoc();
  }, [currentUser]);

  // Listen to User Transfers subcollection when authenticated
  useEffect(() => {
    if (!currentUser) {
      setTransfersHistory([]);
      return;
    }

    const transfersCollection = collection(db, 'users', currentUser.uid, 'transfers');
    const unsubTransfers = onSnapshot(
      transfersCollection,
      (snapshot) => {
        const records: TransferRecord[] = [];
        snapshot.forEach((d) => {
          records.push({ id: d.id, ...d.data() } as TransferRecord);
        });
        records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setTransfersHistory(records);
      },
      (error) => {
        console.warn('Could not listen to user transfers:', error);
      }
    );

    return () => unsubTransfers();
  }, [currentUser]);

  // Listen to Firestore Daily Usage in real-time when authenticated
  useEffect(() => {
    const today = getTodayDateString();

    if (!currentUser) {
      setDailyUsage(getLocalDailyUsage(today));
      return;
    }

    const usageDocRef = doc(db, 'users', currentUser.uid, 'daily_usage', today);
    const unsubUsage = onSnapshot(
      usageDocRef,
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          const updated: DailyUsageMetrics = {
            date: today,
            sendOperations: Number(d.sendOperations || 0),
            receiveOperations: Number(d.receiveOperations || 0),
            qrScansCount: Number(d.qrScansCount || 0),
            bytesTransferred: Number(d.bytesTransferred || 0),
            lastActivity: Number(d.lastActivity || Date.now())
          };
          setDailyUsage(updated);
          setLocalDailyUsage(updated);
        } else {
          setDailyUsage(getLocalDailyUsage(today));
        }
      },
      (err) => {
        console.warn('Daily usage snapshot warning:', err);
      }
    );

    return () => unsubUsage();
  }, [currentUser]);

  // Listen to local storage quota updates from other components
  useEffect(() => {
    const handleQuotaEvent = (e: Event) => {
      const customEvent = e as CustomEvent<DailyUsageMetrics>;
      if (customEvent.detail) {
        setDailyUsage(customEvent.detail);
      }
    };
    window.addEventListener('beamdrop:quota_update', handleQuotaEvent);
    return () => window.removeEventListener('beamdrop:quota_update', handleQuotaEvent);
  }, []);

  // Track operation via Quota Engine
  const trackOp = async (type: OperationTypeQuota, bytes = 0): Promise<QuotaCheckResult> => {
    const res = await trackOperation({
      type,
      bytes,
      uid: currentUser?.uid || null,
      plan: userProfile?.plan || 'free'
    });
    setDailyUsage(getLocalDailyUsage());
    return res;
  };

  // Sign Up with Full Name, unique Username, Email & Password
  const signUpWithEmail = async (fullName: string, username: string, email: string, pass: string) => {
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    // 1. Check username validity
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanUsername)) {
      throw new Error('Username must be 3-30 characters with letters, numbers, or underscores.');
    }

    // 2. Check if username is already taken in Firestore
    const usernameDocRef = doc(db, 'usernames', cleanUsername);
    try {
      const usernameSnap = await getDoc(usernameDocRef);
      if (usernameSnap.exists()) {
        throw new Error(`Username "@${cleanUsername}" is already taken. Please choose another.`);
      }
    } catch (err: any) {
      if (err.message && err.message.includes('already taken')) throw err;
      handleFirestoreError(err, OperationType.GET, `usernames/${cleanUsername}`);
    }

    // 3. Create Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
    const user = userCredential.user;

    await updateProfile(user, { displayName: fullName.trim() });

    // 4. Concurrently create records in Firestore
    const newProfile: UserProfile = {
      uid: user.uid,
      fullName: fullName.trim(),
      username: cleanUsername,
      email: cleanEmail,
      plan: 'free',
      createdAt: Date.now(),
      transfersCount: 0,
      bytesTransferred: 0
    };

    try {
      await setDoc(doc(db, 'users', user.uid), newProfile);
      await setDoc(usernameDocRef, {
        username: cleanUsername,
        uid: user.uid,
        email: cleanEmail,
        createdAt: Date.now()
      });
      setUserProfile(newProfile);
      try {
        const known = JSON.parse(localStorage.getItem('beamdrop_known_usernames') || '{}');
        known[cleanUsername] = cleanEmail;
        localStorage.setItem('beamdrop_known_usernames', JSON.stringify(known));
      } catch (_) {}
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  // Sign In with Email OR Username
  const signInWithEmailOrUsername = async (emailOrUsername: string, pass: string) => {
    const input = emailOrUsername.trim();
    let targetEmail = input;

    if (!input.includes('@')) {
      // Input is a username: resolve email via cache or Firestore
      const cleanUsername = input.toLowerCase();

      // 1. Check local cache first (instant, works offline, bypasses unauthenticated Firestore restrictions)
      let resolvedEmail: string | null = null;
      try {
        const known = JSON.parse(localStorage.getItem('beamdrop_known_usernames') || '{}');
        if (known[cleanUsername]) {
          resolvedEmail = known[cleanUsername];
        }
        const cachedUser = JSON.parse(localStorage.getItem('beamdrop_auth_user') || 'null');
        if (cachedUser?.username?.toLowerCase() === cleanUsername && cachedUser?.email) {
          resolvedEmail = cachedUser.email;
        }
      } catch (_) {}

      // 2. If not found in cache, attempt Firestore lookup
      if (!resolvedEmail) {
        try {
          const usernameSnap = await getDoc(doc(db, 'usernames', cleanUsername));
          if (usernameSnap.exists() && usernameSnap.data()?.email) {
            resolvedEmail = usernameSnap.data().email;
            try {
              const known = JSON.parse(localStorage.getItem('beamdrop_known_usernames') || '{}');
              known[cleanUsername] = resolvedEmail;
              localStorage.setItem('beamdrop_known_usernames', JSON.stringify(known));
            } catch (_) {}
          }
        } catch (lookupErr: any) {
          // If Firestore denies access or rules not deployed, log warning and try graceful fallbacks
          console.warn(`Firestore username lookup for "${cleanUsername}" unavailable, trying fallback:`, lookupErr.message || lookupErr);
        }
      }

      if (resolvedEmail) {
        targetEmail = resolvedEmail;
      } else {
        // 3. Fallback resolution: Try authenticating as cleanUsername@gmail.com
        // When users type their username without domain (e.g. "a7flowdzd"), this seamlessly verifies their account
        try {
          const res = await signInWithEmailAndPassword(auth, `${cleanUsername}@gmail.com`, pass);
          if (res.user) {
            try {
              const known = JSON.parse(localStorage.getItem('beamdrop_known_usernames') || '{}');
              known[cleanUsername] = `${cleanUsername}@gmail.com`;
              localStorage.setItem('beamdrop_known_usernames', JSON.stringify(known));
            } catch (_) {}
            return;
          }
        } catch (tryGmailErr: any) {
          // If password was incorrect, propagate that specific error
          if (tryGmailErr.code === 'auth/wrong-password' || tryGmailErr.code === 'auth/invalid-credential') {
            throw tryGmailErr;
          }
          // Otherwise inform user cleanly
          throw new Error(`Could not find an account for username "@${cleanUsername}". Please sign in with your full email address (e.g. ${cleanUsername}@gmail.com).`);
        }
      }
    }

    const cred = await signInWithEmailAndPassword(auth, targetEmail, pass);
    if (cred.user && !input.includes('@')) {
      try {
        const known = JSON.parse(localStorage.getItem('beamdrop_known_usernames') || '{}');
        known[input.toLowerCase()] = targetEmail.toLowerCase();
        localStorage.setItem('beamdrop_known_usernames', JSON.stringify(known));
      } catch (_) {}
    }
  };

  // Sign In with Google
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  // Sign Out
  const signOutUser = async () => {
    await signOut(auth);
    setUserProfile(null);
    setTransfersHistory([]);
  };

  // Record a completed transfer and increment aggregate user stats
  const recordTransfer = async (
    fileName: string,
    fileSize: number,
    fileType: string,
    direction: 'sent' | 'received'
  ) => {
    if (!currentUser) return;

    try {
      const transfersCollection = collection(db, 'users', currentUser.uid, 'transfers');
      await addDoc(transfersCollection, {
        userId: currentUser.uid,
        fileName,
        fileSize,
        fileType: fileType || 'application/octet-stream',
        direction,
        createdAt: new Date().toISOString()
      });

      // Update aggregate user stats
      const userRef = doc(db, 'users', currentUser.uid);
      const newCount = (userProfile?.transfersCount || 0) + 1;
      const newBytes = (userProfile?.bytesTransferred || 0) + fileSize;

      await updateDoc(userRef, {
        transfersCount: newCount,
        bytesTransferred: newBytes
      });

      setUserProfile((prev) =>
        prev
          ? {
              ...prev,
              transfersCount: newCount,
              bytesTransferred: newBytes
            }
          : null
      );
    } catch (err) {
      console.warn('Could not record transfer in Firestore:', err);
    }
  };

  // Instant Pro subscription activation (for PayPal / Card subscription or simulation)
  const activateProSubscription = async (subscriptionId?: string, billingCycle: 'monthly' | 'yearly' = 'yearly') => {
    if (!currentUser) return;
    try {
      const subId = subscriptionId || `sub_instant_${Date.now()}`;
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        plan: 'pro',
        tier: 'pro',
        subscriptionId: subId,
        subscriptionStatus: 'ACTIVE',
        billingCycle,
        updatedAt: Date.now()
      });

      try {
        const subRef = doc(db, 'subscriptions', currentUser.uid);
        await setDoc(
          subRef,
          {
            uid: currentUser.uid,
            subscriptionId: subId,
            status: 'ACTIVE',
            billingCycle,
            plan: 'pro',
            updatedAt: Date.now()
          },
          { merge: true }
        );
      } catch (_) {}

      setUserProfile((prev) => (prev ? { ...prev, plan: 'pro' } : null));
      syncWithExtension();
    } catch (err) {
      console.warn('Could not update plan to pro:', err);
    }
  };

  // Update User Password (for setting or changing password across Web, Extension & Shortcuts)
  const updateUserPassword = async (newPass: string) => {
    if (!auth.currentUser) throw new Error('You must be signed in to change password.');
    if (!newPass || newPass.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    await updatePassword(auth.currentUser, newPass);

    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        passwordUpdatedAt: Date.now()
      });
    } catch (_) {}
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        isLoading,
        transfersHistory,
        dailyUsage,
        plan,
        userTier,
        remainingQuota,
        signUpWithEmail,
        signInWithEmailOrUsername,
        signInWithGoogle,
        signOutUser,
        recordTransfer,
        trackOp,
        activateProSubscription,
        updateUserPassword,
        syncWithExtension
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
