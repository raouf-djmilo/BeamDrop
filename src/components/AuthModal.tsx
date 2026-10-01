import React, { useState } from 'react';
import {
  X,
  LogIn,
  UserPlus,
  Mail,
  Lock,
  User,
  AtSign,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Zap,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { diagnoseFirebaseAuthError, AuthErrorDiagnosis } from '../firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'login' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'login'
}) => {
  const { signInWithEmailOrUsername, signUpWithEmail, signInWithGoogle } = useAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'signup'>(defaultTab);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form state
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Status & Error
  const [error, setError] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<AuthErrorDiagnosis | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setError(null);
    setDiagnosis(null);
    setLoading(false);
    setLoginIdentifier('');
    setLoginPassword('');
    setFullName('');
    setUsername('');
    setEmail('');
    setSignupPassword('');
    setConfirmPassword('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Submit Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDiagnosis(null);

    if (!loginIdentifier.trim()) {
      setError('Please enter your email or username.');
      return;
    }
    if (!loginPassword) {
      setError('Please enter your password.');
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailOrUsername(loginIdentifier, loginPassword);
      handleClose();
    } catch (err: any) {
      console.error('Sign-in error:', err);
      const diag = diagnoseFirebaseAuthError(err);
      setDiagnosis(diag);
      setError(diag.message);
    } finally {
      setLoading(false);
    }
  };

  // Submit Signup
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDiagnosis(null);

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!username.trim()) {
      setError('Please choose a username.');
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username.trim())) {
      setError('Username must be 3-30 characters with letters, numbers, or underscores.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (signupPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (signupPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    try {
      setLoading(true);
      await signUpWithEmail(fullName, username, email, signupPassword);
      handleClose();
    } catch (err: any) {
      console.error('Sign-up error:', err);
      const diag = diagnoseFirebaseAuthError(err);
      setDiagnosis(diag);
      setError(diag.message);
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth
  const handleGoogleAuth = async () => {
    setError(null);
    setDiagnosis(null);
    try {
      setLoading(true);
      await signInWithGoogle();
      handleClose();
    } catch (err: any) {
      console.error('Google auth error:', err);
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        const diag = diagnoseFirebaseAuthError(err);
        setDiagnosis(diag);
        setError(diag.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-white/95 backdrop-blur-2xl rounded-3xl p-6 sm:p-7 shadow-2xl border border-sky-200/90 z-10 animate-fade-in"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-sky-50 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand & Title */}
        <div className="flex items-center space-x-2.5 mb-5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center shadow-md shadow-sky-500/25">
            <Zap className="w-4 h-4 text-white fill-white" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight leading-none">
              BeamDrop Account
            </h3>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Optional sync for transfers and profile identity
            </p>
          </div>
        </div>

        {/* Segmented Switcher Tabs */}
        <div className="bg-sky-50/80 p-1 rounded-2xl flex items-center mb-5 border border-sky-200/70">
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'login'
                ? 'bg-white text-slate-900 shadow-xs border border-sky-100'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LogIn className="w-3.5 h-3.5 text-sky-600" />
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('signup');
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'signup'
                ? 'bg-white text-slate-900 shadow-xs border border-sky-100'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5 text-sky-600" />
            <span>Create Account</span>
          </button>
        </div>

        {/* Error & Diagnostic Alert */}
        {error && (
          <div className="mb-4 p-3.5 rounded-2xl bg-rose-50/90 border border-rose-200/90 text-rose-800 text-xs space-y-2 animate-fade-in shadow-2xs">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="min-w-0 flex-1">
                {diagnosis?.title && (
                  <p className="font-bold text-rose-900 leading-tight mb-0.5">
                    {diagnosis.title}
                  </p>
                )}
                <p className="leading-relaxed text-slate-700 font-medium">
                  {error}
                </p>
              </div>
            </div>

            {/* Direct Action Link if Identity Toolkit or Providers need activation */}
            {diagnosis?.actionUrl && (
              <div className="pt-1.5 flex flex-wrap gap-2 items-center">
                <a
                  href={diagnosis.actionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[11px] transition-colors shadow-2xs"
                >
                  <span>{diagnosis.actionLabel || 'Fix in Console'}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                {diagnosis.copyText && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(diagnosis.copyText!);
                      setCopiedDomain(true);
                      setTimeout(() => setCopiedDomain(false), 2500);
                    }}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-rose-200 font-semibold text-[11px] transition-colors cursor-pointer shadow-2xs"
                  >
                    {copiedDomain ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-slate-600" />
                        <span>Copy "{diagnosis.copyText}"</span>
                      </>
                    )}
                  </button>
                )}

                {diagnosis.isApiDisabled && (
                  <a
                    href="https://console.firebase.google.com/?authuser=1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-rose-100 text-rose-800 border border-rose-200 font-medium text-[11px] transition-colors"
                  >
                    <span>Firebase Console</span>
                    <ExternalLink className="w-3 h-3 text-rose-500" />
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* Form 1: Sign In */}
        {activeTab === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Email or Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="name@gmail.com or @username"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-colors"
                  required
                />
                <AtSign className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-colors"
                  required
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-all shadow-xs active:scale-[0.99] flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>
        ) : (
          /* Form 2: Sign Up */
          <form onSubmit={handleSignup} className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Full Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. Raouf Djemel"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-colors"
                  required
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Unique Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. raouf99 (letters, numbers, _)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-colors font-mono"
                  required
                />
                <AtSign className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="name@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-colors"
                  required
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Min. 6 chars"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-colors"
                    required
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-colors"
                    required
                  />
                  <CheckCircle2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-all shadow-xs active:scale-[0.99] flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 mt-1"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Divider */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase">
            <span className="bg-white px-2 text-slate-400 font-semibold tracking-wider">
              Or continue with
            </span>
          </div>
        </div>

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={loading}
          className="w-full py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-semibold text-xs transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-2xs hover:border-slate-400"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Google Account</span>
        </button>
      </div>
    </div>
  );
};
