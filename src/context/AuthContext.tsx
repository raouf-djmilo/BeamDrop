import React, { createContext, useContext, useEffect, useState, useTransition } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile
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

export interface UserProfile {
  uid: string;
  fullName: string;
  username: string;
  email: string;
  createdAt: string;
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
  signUpWithEmail: (fullName: string, username: string, email: string, pass: string) => Promise<void>;
  signInWithEmailOrUsername: (emailOrUsername: string, pass: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  recordTransfer: (fileName: string, fileSize: number, fileType: string, direction: 'sent' | 'received') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [transfersHistory, setTransfersHistory] = useState<TransferRecord[]>([]);

  // Listen to Auth state changes
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Fetch or subscribe to user profile
        const userDocRef = doc(db, 'users', user.uid);
        try {
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            // First time Google sign-in fallback profile creation
            const fallbackUsername = (user.email ? user.email.split('@')[0] : 'user')
              .replace(/[^a-zA-Z0-9_]/g, '')
              .toLowerCase() + '_' + user.uid.slice(0, 4);

            const newProfile: UserProfile = {
              uid: user.uid,
              fullName: user.displayName || 'BeamDrop User',
              username: fallbackUsername,
              email: user.email || '',
              createdAt: new Date().toISOString(),
              photoURL: user.photoURL || undefined,
              transfersCount: 0,
              bytesTransferred: 0
            };

            await setDoc(userDocRef, newProfile);
            await setDoc(doc(db, 'usernames', fallbackUsername.toLowerCase()), {
              username: fallbackUsername.toLowerCase(),
              uid: user.uid,
              email: user.email || '',
              createdAt: new Date().toISOString()
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
        // Sort newest first
        records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setTransfersHistory(records);
      },
      (error) => {
        console.warn('Could not listen to user transfers:', error);
      }
    );

    return () => unsubTransfers();
  }, [currentUser]);

  // Sign Up with Full Name, unique Username, Email & Password
  const signUpWithEmail = async (fullName: string, username: string, email: string, pass: string) => {
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    // 1. Check username validity
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanUsername)) {
      throw new Error('Username must be 3-30 characters with letters, numbers, or underscores.');
    }

    // 2. Check if username is already taken
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

    // 4. Create user profile in Firestore
    const newProfile: UserProfile = {
      uid: user.uid,
      fullName: fullName.trim(),
      username: cleanUsername,
      email: cleanEmail,
      createdAt: new Date().toISOString(),
      transfersCount: 0,
      bytesTransferred: 0
    };

    try {
      await setDoc(doc(db, 'users', user.uid), newProfile);
      await setDoc(usernameDocRef, {
        username: cleanUsername,
        uid: user.uid,
        email: cleanEmail,
        createdAt: new Date().toISOString()
      });
      setUserProfile(newProfile);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  // Sign In with Email OR Username
  const signInWithEmailOrUsername = async (emailOrUsername: string, pass: string) => {
    const input = emailOrUsername.trim();
    let targetEmail = input;

    if (!input.includes('@')) {
      // Input is a username! Look up email from usernames collection
      const cleanUsername = input.toLowerCase();
      try {
        const usernameSnap = await getDoc(doc(db, 'usernames', cleanUsername));
        if (!usernameSnap.exists()) {
          throw new Error(`No account found with username "@${cleanUsername}". Check spelling or use your email.`);
        }
        targetEmail = usernameSnap.data()?.email;
        if (!targetEmail) {
          throw new Error('Could not find email linked to this username.');
        }
      } catch (err: any) {
        if (err.message && (err.message.includes('No account found') || err.message.includes('Could not find'))) {
          throw err;
        }
        handleFirestoreError(err, OperationType.GET, `usernames/${cleanUsername}`);
      }
    }

    await signInWithEmailAndPassword(auth, targetEmail, pass);
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

  // Record a completed transfer
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

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        isLoading,
        transfersHistory,
        signUpWithEmail,
        signInWithEmailOrUsername,
        signInWithGoogle,
        signOutUser,
        recordTransfer
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
