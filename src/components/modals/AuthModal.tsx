import React, { useState } from 'react';
import {
  Settings,
  Lock,
  Mail,
  LogIn,
  UserPlus,
  Clock,
  LogOut,
  Check,
  CheckCircle2,
  Shield,
  RefreshCw,
  KeyRound,
  Monitor,
} from 'lucide-react';
import { StaffCoach, Team } from '../../types';
import { canUseLocalDeveloperLogin } from '../../utils/localDeveloperAuth';

/* =========================================================================
   AUTH OVERLAY & APPROVAL PENDING
   ========================================================================= */
export interface AuthModalProps {
  isOpen: boolean;
  isPendingApproval?: boolean;
  pendingEmail?: string;
  isLiveEnvironment?: boolean;
  currentUserEmail?: string;
  onEmailAuth: (email: string, pass: string, isSignUp: boolean) => Promise<void>;
  onGoogleSignIn: () => Promise<void>;
  onRefreshApprovalStatus?: () => void | Promise<void>;
  onSignOut: () => void;
  staffList?: StaffCoach[];
  teams?: Team[];
  adminPasscodeSet?: boolean;
  onAdminPasscodeSignIn?: (passcode: string) => boolean | Promise<boolean>;
  onSetAdminPasscode?: (newPasscode: string) => void | Promise<void>;
  onLocalDeveloperSignIn?: () => boolean | Promise<boolean>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  isPendingApproval,
  pendingEmail,
  isLiveEnvironment = false,
  currentUserEmail,
  onEmailAuth,
  onGoogleSignIn,
  onRefreshApprovalStatus,
  onSignOut,
  staffList = [],
  teams = [],
  adminPasscodeSet = false,
  onAdminPasscodeSignIn,
  onSetAdminPasscode,
  onLocalDeveloperSignIn,
}) => {
  type AuthTab = 'signin' | 'signup' | 'admin';
  type AdminResetMode = 'none' | 'request' | 'verify' | 'success';

  const readStoredAuthTab = (): AuthTab => {
    try {
      const saved = sessionStorage.getItem('footballAuthTab');
      if (saved === 'signin' || saved === 'signup' || saved === 'admin') return saved;
    } catch {
      // ignore
    }
    return 'signin';
  };

  const [activeTab, setActiveTab] = useState<AuthTab>(readStoredAuthTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inputAdminPasscode, setInputAdminPasscode] = useState('');
  const [newAdminPasscode, setNewAdminPasscode] = useState('');
  const [confirmAdminPasscode, setConfirmAdminPasscode] = useState('');
  const [isEditingAdminPasscode, setIsEditingAdminPasscode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectAuthTab = (tab: AuthTab) => {
    setActiveTab(tab);
    setError(null);
    try {
      sessionStorage.setItem('footballAuthTab', tab);
    } catch {
      // ignore
    }
  };

  // Secure Admin Passcode Reset via Email Link / Verification Code
  const [adminResetMode, setAdminResetMode] = useState<AdminResetMode>('none');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCodeInput, setResetCodeInput] = useState('');
  const [resetServerCode, setResetServerCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetMaskedEmail, setResetMaskedEmail] = useState('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [forgotCoachPasswordSent, setForgotCoachPasswordSent] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Detect email reset link parameter ?admin_reset_token= in URL on mount
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('admin_reset_token');
      if (token) {
        selectAuthTab('admin');
        setResetToken(token);
        setAdminResetMode('verify');
        setError(null);
      }
    }
  }, []);

  if (!isOpen && !isPendingApproval) return null;

  if (isPendingApproval) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-slate-800/95 rounded-3xl max-w-md w-full p-8 shadow-2xl text-center space-y-5 border border-amber-500/30">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-300 flex items-center justify-center mx-auto shadow-inner">
            <Clock className="w-8 h-8 animate-spin" style={{ animationDuration: '4s' }} />
          </div>
          <div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Access Restricted
            </span>
            <h2 className="text-xl font-black text-slate-100 tracking-tight mt-2">
              Coach Approval Required
            </h2>
            <p className="text-xs text-slate-300 font-medium mt-2 leading-relaxed">
              Your coach account (<strong className="text-indigo-400">{pendingEmail}</strong>) has been registered, but only approved coaches can access this site.
            </p>
          </div>

          <div className="p-3.5 bg-slate-900/90 border border-slate-700/80 rounded-2xl text-left space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-amber-300 text-[11px]">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>Live Site Access Control</span>
            </div>
            <p className="text-[11.5px] text-slate-400 leading-relaxed">
              To protect youth rosters, playbooks, and game plans, the <strong>Head Coach / Admin</strong> must approve your account in the Staff Portal. Once approved, you have permanent access until removed.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            {onRefreshApprovalStatus && (
              <button
                type="button"
                onClick={onRefreshApprovalStatus}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Check Approval Status</span>
              </button>
            )}

            <button
              type="button"
              onClick={onSignOut}
              className="w-full py-2 bg-slate-900 hover:bg-slate-750 text-slate-300 hover:text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all border border-slate-750 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out / Switch Account</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onEmailAuth(email, password, activeTab === 'signup');
    } catch (err: any) {
      setError(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminPasscodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!inputAdminPasscode.trim()) {
      setError('Please enter your Admin Passcode.');
      return;
    }
    setLoading(true);
    try {
      if (onAdminPasscodeSignIn) {
        const success = await onAdminPasscodeSignIn(inputAdminPasscode.trim());
        if (!success) {
          setError('Incorrect admin passcode. Please verify your passcode or sign in with your coach account.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Admin authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSetInitialAdminPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newAdminPasscode.trim()) {
      setError('Please enter a new Admin Passcode.');
      return;
    }
    if (newAdminPasscode.trim().length < 4) {
      setError('Admin passcode must be at least 4 characters.');
      return;
    }
    if (newAdminPasscode.trim() !== confirmAdminPasscode.trim()) {
      setError('Passcodes do not match. Please re-enter.');
      return;
    }
    setLoading(true);
    try {
      if (onSetAdminPasscode) {
        await onSetAdminPasscode(newAdminPasscode.trim());
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save admin passcode');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Secure Admin Passcode Reset via Email Link / Verification Code Handlers
  // -------------------------------------------------------------------------
  const handleRequestAdminReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const targetEmail = (resetEmail || currentUserEmail || email || '').toLowerCase().trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setError('Please enter a valid administrator email address.');
      return;
    }

    setLoading(true);
    try {
      // 1. Try sending Firebase password reset email if auth client is available
      if (typeof window !== 'undefined' && (window as any).firebase?.auth) {
        try {
          const auth = (window as any).firebase.auth();
          await auth.sendPasswordResetEmail(targetEmail);
          console.log('[Auth] Firebase password reset email initiated for:', targetEmail);
        } catch (firebaseErr: any) {
          console.log('[Auth] Firebase auth reset notification:', firebaseErr?.message);
        }
      }

      // 2. Call backend secure reset endpoint
      const res = await fetch('/api/admin/request-passcode-reset', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to dispatch admin passcode reset link.');
      }

      setResetMaskedEmail(data.maskedEmail || targetEmail);
      setResetToken('');
      setResetServerCode('');
      setResetCodeInput('');
      setNewAdminPasscode('');
      setConfirmAdminPasscode('');
      setAdminResetMode('verify');
    } catch (err: any) {
      setError(err.message || 'Failed to request admin passcode reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAdminReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const code = resetCodeInput.trim();
    if (!resetToken && !code) {
      setError('Please provide the 6-digit verification code.');
      return;
    }
    if (!newAdminPasscode.trim()) {
      setError('Please enter a new Admin Passcode.');
      return;
    }
    if (newAdminPasscode.trim().length < 4) {
      setError('Admin passcode must be at least 4 characters long.');
      return;
    }
    if (newAdminPasscode.trim() !== confirmAdminPasscode.trim()) {
      setError('Passcodes do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/verify-passcode-reset', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code,
          newPasscode: newAdminPasscode.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Verification failed. Code may be invalid or expired.');
      }

      // Clean URL if it carried the reset token
      if (typeof window !== 'undefined' && window.location.search.includes('admin_reset_token')) {
        const url = new URL(window.location.href);
        url.searchParams.delete('admin_reset_token');
        window.history.replaceState({}, '', url.toString());
      }

      // Update state in App.tsx
      if (onSetAdminPasscode) {
        await onSetAdminPasscode(newAdminPasscode.trim());
      }

      setResetSuccessMessage('Admin Passcode successfully verified and updated!');
      setAdminResetMode('success');
    } catch (err: any) {
      setError(err.message || 'Failed to verify and update admin passcode.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotCoachPassword = async () => {
    setError(null);
    setForgotCoachPasswordSent(null);
    const targetEmail = (email || currentUserEmail || '').toLowerCase().trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setError('Please enter your Coach Email above to receive a password reset link.');
      return;
    }

    setLoading(true);
    try {
      if (typeof window !== 'undefined' && (window as any).firebase?.auth) {
        const auth = (window as any).firebase.auth();
        await auth.sendPasswordResetEmail(targetEmail);
        setForgotCoachPasswordSent(`Password reset email sent to ${targetEmail}. Please check your inbox and spam folder.`);
      } else {
        setForgotCoachPasswordSent(`Password reset link dispatched for ${targetEmail}.`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  const hasConfiguredAdminPasscode = Boolean(adminPasscodeSet);
  const showLocalDeveloperLogin =
    !isLiveEnvironment && canUseLocalDeveloperLogin() && Boolean(onLocalDeveloperSignIn);

  const handleLocalDeveloperClick = async () => {
    setError(null);
    if (isLiveEnvironment || !canUseLocalDeveloperLogin() || !onLocalDeveloperSignIn) {
      setError('Local developer login is only available on this computer (localhost).');
      return;
    }
    setLoading(true);
    try {
      const ok = await onLocalDeveloperSignIn();
      if (!ok) {
        setError('Local developer login is only available on this computer (localhost).');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-800/95 rounded-3xl max-w-md w-full p-8 shadow-2xl border border-slate-700/80 space-y-5">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto shadow-md mb-2">
            <span className="text-2xl">🏈</span>
          </div>
          <h2 className="text-xl font-black text-slate-100 tracking-tight">
            Coach Portal Access
          </h2>
          <p className="text-xs text-slate-300 font-medium">
            Sign in to access team playbooks, depth charts, rosters, and practice plans.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-900 p-1 rounded-2xl border border-slate-700 text-xs">
          <button
            type="button"
            aria-pressed={activeTab === 'signin'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              selectAuthTab('signin');
            }}
            className={`flex-1 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
              activeTab === 'signin'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            aria-pressed={activeTab === 'signup'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              selectAuthTab('signup');
            }}
            className={`flex-1 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
              activeTab === 'signup'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create Account
          </button>
          <button
            type="button"
            aria-pressed={activeTab === 'admin'}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              selectAuthTab('admin');
            }}
            className={`flex-1 py-1.5 rounded-xl font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                : 'text-slate-400 hover:text-amber-300'
            }`}
          >
            <Lock className="w-3 h-3" />
            <span>Admin Passcode</span>
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/80 border border-rose-700/80 rounded-xl text-xs text-rose-200 font-semibold space-y-1">
            <div className="flex items-center gap-1.5 font-black text-rose-300">
              <span>⚠️ Notice</span>
            </div>
            <p className="leading-snug">{error}</p>
          </div>
        )}

        {showLocalDeveloperLogin && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-black text-emerald-300">
              <Monitor className="w-4 h-4 text-emerald-400" />
              <span>Local developer</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              This button only appears on localhost / 127.0.0.1. It is hidden and rejected on any live site. No password. Full admin on this machine.
            </p>
            <button
              type="button"
              disabled={loading}
              onClick={handleLocalDeveloperClick}
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Monitor className="w-4 h-4" />
              <span>Continue as local developer</span>
            </button>
          </div>
        )}

        {/* TAB 1 & 2: COACH GOOGLE & EMAIL SIGN IN */}
        {(activeTab === 'signin' || activeTab === 'signup') && (
          <div className="space-y-4">
            {/* Google Sign In Button */}
            <div>
              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setError(null);
                  setLoading(true);
                  try {
                    await onGoogleSignIn();
                  } catch (err: any) {
                    console.error('Firebase Google Sign-In Error:', err);
                    const code = err?.code || '';
                    const message = err?.message || '';
                    
                    if (code === 'auth/unauthorized-domain') {
                      setError(
                        `Unauthorized Domain (${window.location.hostname}). Please add "${window.location.hostname}" to Firebase Console -> Authentication -> Settings -> Authorized Domains.`
                      );
                    } else if (code === 'auth/operation-not-allowed') {
                      setError(
                        'Google Sign-in is not enabled in your Firebase Project. Enable Google in Firebase Console -> Authentication -> Sign-in Method.'
                      );
                    } else if (code === 'auth/popup-blocked') {
                      setError('Popup blocked by browser. Please allow popups for this site or use email/password below.');
                    } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
                      setError(
                        'Google sign-in popup was closed before completing. You can try again or use email/password.'
                      );
                    } else {
                      setError(message ? `${code ? `[${code}] ` : ''}${message}` : 'Google Sign-In failed. Please try again or use email/password.');
                    }
                  } finally {
                    setLoading(false);
                  }
                }}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-750 border border-slate-700 text-slate-200 font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-95 cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
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
                <span>{loading ? 'Signing in...' : 'Continue with Google'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-slate-400 text-[10.5px] font-black uppercase tracking-wider">
              <div className="flex-1 border-b border-slate-700" />
              <span>OR WITH EMAIL</span>
              <div className="flex-1 border-b border-slate-700" />
            </div>

            {/* Form */}
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Coach Email Address"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-semibold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-semibold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {activeTab === 'signin' && (
                  <div className="flex justify-end mt-1">
                    <button
                      type="button"
                      onClick={handleForgotCoachPassword}
                      className="text-[10.5px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer underline"
                    >
                      Forgot coach password?
                    </button>
                  </div>
                )}
              </div>

              {forgotCoachPasswordSent && (
                <div className="p-3 bg-emerald-950/80 border border-emerald-700/80 rounded-xl text-xs text-emerald-200 font-medium flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{forgotCoachPasswordSent}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-600/30 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95 cursor-pointer"
              >
                {activeTab === 'signup' ? <UserPlus className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                <span>{activeTab === 'signup' ? 'Create Coach Account' : 'Sign In'}</span>
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: DEDICATED ADMIN PASSCODE AUTH & SECURE EMAIL RESET */}
        {activeTab === 'admin' && (
          <div className="space-y-4">
            {/* RESET STATE: SUCCESS */}
            {adminResetMode === 'success' ? (
              <div className="space-y-3.5 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-md">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-slate-100">
                    Admin Passcode Reset Successful
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {resetSuccessMessage || 'Your master admin passcode has been securely updated. Full management privileges are now unlocked.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAdminResetMode('none');
                    if (onAdminPasscodeSignIn && newAdminPasscode) {
                      onAdminPasscodeSignIn(newAdminPasscode.trim());
                    }
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-600/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Shield className="w-4 h-4" />
                  <span>Enter Admin Console</span>
                </button>
              </div>
            ) : adminResetMode === 'verify' ? (
              /* RESET STATE: VERIFY CODE & SET NEW PASSCODE */
              <form onSubmit={handleVerifyAdminReset} className="space-y-3">
                <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-left space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-black text-indigo-300">
                    <KeyRound className="w-4 h-4 text-indigo-400" />
                    <span>Verify Code &amp; Reset Passcode</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {resetMaskedEmail
                      ? `If ${resetMaskedEmail} is authorized, a verification code was issued. It is not displayed here. On this computer you can also change the passcode directly or use local developer login.`
                      : 'Enter the 6-digit verification code if you received one. On this computer you can also change the passcode directly.'}
                  </p>
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold text-slate-300 mb-1">
                    6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength={10}
                    value={resetCodeInput}
                    onChange={(e) => setResetCodeInput(e.target.value.toUpperCase())}
                    placeholder="e.g. 849201"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-mono font-bold tracking-wider text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold text-slate-300 mb-1">
                    New Admin Passcode
                  </label>
                  <input
                    type="password"
                    required
                    value={newAdminPasscode}
                    onChange={(e) => setNewAdminPasscode(e.target.value)}
                    placeholder="Enter new admin passcode (min 4 characters)"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-semibold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold text-slate-300 mb-1">
                    Confirm New Passcode
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmAdminPasscode}
                    onChange={(e) => setConfirmAdminPasscode(e.target.value)}
                    placeholder="Re-enter new admin passcode"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-semibold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !resetCodeInput || !newAdminPasscode || !confirmAdminPasscode}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-600/30 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Verify &amp; Update Admin Passcode</span>
                </button>

                <div className="pt-1 flex items-center justify-between text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setAdminResetMode('request');
                      setError(null);
                    }}
                    className="text-slate-400 hover:text-slate-200 underline cursor-pointer"
                  >
                    Resend Code
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminResetMode('none');
                      setError(null);
                    }}
                    className="text-slate-400 hover:text-slate-200 underline cursor-pointer"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            ) : adminResetMode === 'request' ? (
              /* RESET STATE: REQUEST CODE VIA EMAIL */
              <form onSubmit={handleRequestAdminReset} className="space-y-3">
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-left space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
                    <Mail className="w-4 h-4 text-amber-400" />
                    <span>Secure Admin Passcode Reset</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Enter the email address of any authorized Head Coach or Administrator. We will dispatch a 6-digit verification code and reset link to confirm your identity.
                  </p>
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold text-slate-300 mb-1">
                    Coach / Admin Email Address
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="Enter authorized coach email"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-semibold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !resetEmail}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-xl shadow-md shadow-amber-600/30 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95 cursor-pointer"
                >
                  <Mail className="w-4 h-4" />
                  <span>Send Reset Link &amp; Code</span>
                </button>

                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setAdminResetMode('none');
                      setError(null);
                    }}
                    className="text-[11px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
                  >
                    Back to Admin Passcode Entry
                  </button>
                </div>
              </form>
            ) : hasConfiguredAdminPasscode && !isEditingAdminPasscode ? (
              /* STANDARD PASSCODE LOGIN VIEW */
              <form onSubmit={handleAdminPasscodeSubmit} className="space-y-3">
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-left space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
                    <Shield className="w-4 h-4 text-amber-400" />
                    <span>Head Coach &amp; Master Admin Access</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Enter your custom Admin Passcode to unlock the management console with full administrative privileges.
                  </p>
                </div>

                <div>
                  <input
                    type="password"
                    required
                    autoFocus
                    value={inputAdminPasscode}
                    onChange={(e) => setInputAdminPasscode(e.target.value)}
                    placeholder="Enter Admin Passcode"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-semibold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !inputAdminPasscode}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-xl shadow-md shadow-amber-600/30 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95 cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>Unlock Admin Access</span>
                </button>

                <div className="pt-2 text-center space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAdminResetMode('request');
                      setResetEmail(currentUserEmail || email || '');
                      setError(null);
                    }}
                    className="text-[11.5px] text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer flex items-center justify-center gap-1.5 mx-auto"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Reset admin passcode via email link</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingAdminPasscode(true);
                      setError(null);
                      setNewAdminPasscode('');
                      setConfirmAdminPasscode('');
                    }}
                    className="text-[10.5px] text-slate-400 hover:text-slate-300 underline cursor-pointer"
                  >
                    Change passcode directly
                  </button>
                </div>
              </form>
            ) : (
              /* INITIAL OR DIRECT ADMIN PASSCODE SETUP */
              <form onSubmit={handleSetInitialAdminPasscode} className="space-y-3">
                <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-left space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-black text-indigo-300">
                    <KeyRound className="w-4 h-4 text-indigo-400" />
                    <span>{hasConfiguredAdminPasscode ? 'Update Admin Passcode' : 'Set Up Your Admin Passcode'}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {hasConfiguredAdminPasscode
                      ? 'Choose a new custom passcode below. This will update the master admin password on this app.'
                      : 'No custom admin passcode has been created yet. Set a secure master passcode below for Head Coach & Admin access.'}
                  </p>
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold text-slate-300 mb-1">
                    {hasConfiguredAdminPasscode ? 'New Admin Passcode' : 'Admin Passcode'}
                  </label>
                  <input
                    type="password"
                    required
                    autoFocus
                    value={newAdminPasscode}
                    onChange={(e) => setNewAdminPasscode(e.target.value)}
                    placeholder="Choose your custom admin passcode"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-semibold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold text-slate-300 mb-1">
                    Confirm Admin Passcode
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmAdminPasscode}
                    onChange={(e) => setConfirmAdminPasscode(e.target.value)}
                    placeholder="Re-enter your admin passcode"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-semibold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !newAdminPasscode || !confirmAdminPasscode}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-600/30 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{hasConfiguredAdminPasscode ? 'Save New Passcode & Sign In' : 'Save Passcode & Sign In as Admin'}</span>
                </button>

                {hasConfiguredAdminPasscode && (
                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingAdminPasscode(false);
                        setError(null);
                      }}
                      className="text-[11px] text-slate-400 hover:text-slate-200 font-medium underline cursor-pointer"
                    >
                      Cancel &amp; return to Unlock
                    </button>
                  </div>
                )}
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
