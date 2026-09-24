import React, { useState, useRef } from 'react';
import {
  X,
  Copy,
  Printer,
  Filter,
  Settings,
  Lock,
  Mail,
  LogIn,
  UserPlus,
  Clock,
  LogOut,
  Check,
  AlertTriangle,
  Upload,
  FileJson,
  CheckSquare,
  Square,
  CheckCircle2,
  Layers,
  Dumbbell,
  Calendar,
  Users,
  BookOpen,
  Shield,
  Activity,
  FileText,
  Sparkles,
  RefreshCw,
  FolderTree,
  ChevronRight,
  Database,
  ArrowLeft,
  KeyRound,
  Monitor,
} from 'lucide-react';
import { FormationBoard, PracticePeriod, StaffCoach, Team, DrillFolder, SeasonConfig, ScheduleEvent, WeekState } from '../types';
import { getSeasonWeekList, getWeekDisplayLabelWithOpponent, formatWeekLabel } from '../utils/seasonWeekUtils';
import { summarizeHudlScoutBackup } from '../utils/remoteStateMerge';
import { canUseLocalDeveloperLogin } from '../utils/localDeveloperAuth';

/* =========================================================================
   1. AUTH OVERLAY & APPROVAL PENDING
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

/* =========================================================================
   2. COPY WEEK MODAL
   ========================================================================= */
export type CopyWeekMode = 'both' | 'formations_only' | 'positions_only';

interface CopyWeekModalProps {
  isOpen: boolean;
  currentWeek: string;
  activeTeamId?: string;
  teams?: Team[];
  seasonConfig?: SeasonConfig;
  scheduleEvents?: ScheduleEvent[];
  weeklyData?: Record<string, WeekState>;
  resolveWeekStateFn?: (
    wData: Record<string, WeekState>,
    teamId: string,
    week: string
  ) => WeekState;
  onClose: () => void;
  onExecuteCopy: (
    srcWeek: string,
    targetWeek: string,
    copyMode?: CopyWeekMode,
    srcTeamId?: string,
    showAlert?: boolean
  ) => void;
}

export const CopyWeekModal: React.FC<CopyWeekModalProps> = ({
  isOpen,
  currentWeek,
  activeTeamId = 'team_10u',
  teams = [],
  seasonConfig,
  scheduleEvents = [],
  weeklyData = {},
  resolveWeekStateFn,
  onClose,
  onExecuteCopy,
}) => {
  const [srcTeamId, setSrcTeamId] = useState<string>(activeTeamId);
  const [srcWeek, setSrcWeek] = useState<string>(() => {
    const num = parseInt(currentWeek, 10);
    if (!isNaN(num) && num > 1) return String(num - 1);
    if (currentWeek === '1') return '0';
    return '0';
  });
  const [targetWeek, setTargetWeek] = useState<string>(currentWeek);
  const [copyMode, setCopyMode] = useState<CopyWeekMode>('both');

  if (!isOpen) return null;

  const allWeeks = getSeasonWeekList(seasonConfig);

  // Compute live statistics for source week using resolved state
  const srcScopedKey = `${srcTeamId}__week_${srcWeek}`;
  const srcState = resolveWeekStateFn
    ? resolveWeekStateFn(weeklyData, srcTeamId, srcWeek)
    : (weeklyData[srcScopedKey] || weeklyData[srcWeek] || {
        formations: [],
        depthChart: {},
        scrimmageChart: {},
      });
  const srcFormCount = srcState.formations?.length || 0;
  const srcPlayerAssignmentCount = Object.values(srcState.depthChart || {}).reduce(
    (acc, list) => acc + (Array.isArray(list) ? list.length : 0),
    0
  );

  // Target stats
  const targetScopedKey = `${activeTeamId}__week_${targetWeek}`;
  const targetState = resolveWeekStateFn
    ? resolveWeekStateFn(weeklyData, activeTeamId, targetWeek)
    : (weeklyData[targetScopedKey] || weeklyData[targetWeek]);
  const targetFormCount = targetState?.formations?.length || 0;
  const targetPlayerCount = Object.values(targetState?.depthChart || {}).reduce(
    (acc, list) => acc + (Array.isArray(list) ? list.length : 0),
    0
  );

  const srcTeamName = teams.find((t) => t.id === srcTeamId)?.name || 'Active Team';
  const targetTeamName = teams.find((t) => t.id === activeTeamId)?.name || 'Active Team';

  const handleCopy = () => {
    if (srcWeek === targetWeek && srcTeamId === activeTeamId) {
      alert('Source week and Target week cannot be the same within the same squad.');
      return;
    }
    onExecuteCopy(srcWeek, targetWeek, copyMode, srcTeamId, true);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-850 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-700/80 my-8">
        <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Copy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-100">
                Copy Week Formations &amp; Depth Chart
              </h3>
              <p className="text-[11px] text-slate-400 font-semibold">
                Transfer playbook schemes and player assignments across any weeks
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-750 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs font-semibold">
          {/* Source Selection Group */}
          <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-750 space-y-3">
            <span className="text-[11px] font-black text-indigo-400 uppercase tracking-wider block">
              1. Source Selection (Copy From)
            </span>

            {teams.length > 1 && (
              <div>
                <label className="block text-slate-300 mb-1 font-bold text-[11px]">
                  Source Squad / Division:
                </label>
                <select
                  value={srcTeamId}
                  onChange={(e) => setSrcTeamId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-slate-300 mb-1 font-bold text-[11px]">
                Source Week:
              </label>
              <select
                value={srcWeek}
                onChange={(e) => setSrcWeek(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                {allWeeks.map((wk) => (
                  <option key={wk.key} value={wk.key}>
                    {getWeekDisplayLabelWithOpponent(wk.key, wk.label, scheduleEvents, srcTeamId)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
              <span>Source Payload:</span>
              <span className="font-bold text-indigo-300">
                {srcFormCount} Formation{srcFormCount === 1 ? '' : 's'} &bull; {srcPlayerAssignmentCount} Player Placement{srcPlayerAssignmentCount === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {/* Target Selection Group */}
          <div className="p-3.5 bg-slate-900/90 rounded-2xl border border-slate-750 space-y-3">
            <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider block">
              2. Target Selection (Copy To)
            </span>

            <div>
              <label className="block text-slate-300 mb-1 font-bold text-[11px]">
                Target Week ({targetTeamName}):
              </label>
              <select
                value={targetWeek}
                onChange={(e) => setTargetWeek(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                {allWeeks.map((wk) => (
                  <option key={wk.key} value={wk.key}>
                    {getWeekDisplayLabelWithOpponent(wk.key, wk.label, scheduleEvents, activeTeamId)}
                  </option>
                ))}
              </select>
            </div>

            {targetState && (
              <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-950/60 px-3 py-1.5 rounded-lg border border-slate-800">
                <span>Current Target Contents:</span>
                <span className="font-bold text-amber-300">
                  {targetFormCount} Formations &bull; {targetPlayerCount} Placed Players
                </span>
              </div>
            )}
          </div>

          {/* Copy Mode Options */}
          <div className="space-y-2">
            <span className="text-[11px] font-black text-slate-300 uppercase tracking-wider block">
              3. Choose What to Copy
            </span>

            <div className="grid grid-cols-1 gap-2">
              <label
                onClick={() => setCopyMode('both')}
                className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                  copyMode === 'both'
                    ? 'bg-indigo-600/15 border-indigo-500 text-slate-100 shadow-sm'
                    : 'bg-slate-900/60 border-slate-750 text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <input
                  type="radio"
                  name="copyMode"
                  checked={copyMode === 'both'}
                  onChange={() => setCopyMode('both')}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Formations &amp; Player Positions (Complete Depth Chart)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed font-normal">
                    Clones all formations, rows, position tags, plus all 1st (ST), 2nd (D2), and 3rd (D3) player assignments.
                  </p>
                </div>
              </label>

              <label
                onClick={() => setCopyMode('formations_only')}
                className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                  copyMode === 'formations_only'
                    ? 'bg-indigo-600/15 border-indigo-500 text-slate-100 shadow-sm'
                    : 'bg-slate-900/60 border-slate-750 text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <input
                  type="radio"
                  name="copyMode"
                  checked={copyMode === 'formations_only'}
                  onChange={() => setCopyMode('formations_only')}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                    <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>Formations Only (Fresh Blank Depth Chart)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed font-normal">
                    Copies all formation boards and slot structures, but starts with empty player slots for a clean weekly lineup.
                  </p>
                </div>
              </label>

              <label
                onClick={() => setCopyMode('positions_only')}
                className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                  copyMode === 'positions_only'
                    ? 'bg-indigo-600/15 border-indigo-500 text-slate-100 shadow-sm'
                    : 'bg-slate-900/60 border-slate-750 text-slate-300 hover:bg-slate-800/80'
                }`}
              >
                <input
                  type="radio"
                  name="copyMode"
                  checked={copyMode === 'positions_only'}
                  onChange={() => setCopyMode('positions_only')}
                  className="mt-1 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    <span>Player Positions Only (Apply to Target Formations)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed font-normal">
                    Preserves the target week's existing formation schemes, and maps player depth chart slots onto matching positions.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl text-indigo-200 text-[11px] leading-relaxed flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
            <span>
              Transferring from <strong className="text-white">{formatWeekLabel(srcWeek)}</strong> ({srcTeamName}) to{' '}
              <strong className="text-white">{formatWeekLabel(targetWeek)}</strong> ({targetTeamName}). Changes are saved to cloud &amp; synced in real-time across all coach screens.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-700/80">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleCopy}
            className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-600/30 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Execute Copy Week</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   3. SELECTIVE PRINT MODAL
   ========================================================================= */
interface SelectivePrintModalProps {
  isOpen: boolean;
  unit: 'offense' | 'defense' | 'st' | 'groups';
  formations: FormationBoard[];
  onClose: () => void;
  onPrintSelected: (selectedFormIds: string[]) => void;
}

export const SelectivePrintModal: React.FC<SelectivePrintModalProps> = ({
  isOpen,
  unit,
  formations,
  onClose,
  onPrintSelected,
}) => {
  const unitFormations = formations.filter((f) => f && f.unit === unit);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    unitFormations.map((f) => f.id)
  );

  if (!isOpen) return null;

  const toggleSelectAll = (select: boolean) => {
    if (select) setSelectedIds(unitFormations.map((f) => f.id));
    else setSelectedIds([]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-800/95 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-700/80">
        <div className="flex items-center justify-between border-b border-slate-700 pb-3">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-indigo-400" />
            <h3 className="font-black text-base text-slate-100">
              Select Boards to Print
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleSelectAll(true)}
            className="px-3 py-1 bg-slate-900 hover:bg-slate-750 text-slate-200 font-bold text-xs rounded-xl border border-slate-700"
          >
            Select All
          </button>
          <button
            onClick={() => toggleSelectAll(false)}
            className="px-3 py-1 bg-slate-900 hover:bg-slate-750 text-slate-200 font-bold text-xs rounded-xl border border-slate-700"
          >
            Clear All
          </button>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto border border-slate-700 p-3 rounded-2xl bg-slate-900/90">
          {unitFormations.map((f) => {
            const isChecked = selectedIds.includes(f.id);
            return (
              <label
                key={f.id}
                className="flex items-center gap-2.5 p-2.5 bg-slate-800 rounded-xl border border-slate-700 text-xs font-bold text-slate-200 cursor-pointer hover:border-slate-600 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds([...selectedIds, f.id]);
                    else setSelectedIds(selectedIds.filter((id) => id !== f.id));
                  }}
                  className="rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-slate-700"
                />
                <span>{f.name}</span>
              </label>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl border border-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onPrintSelected(selectedIds);
              onClose();
            }}
            disabled={selectedIds.length === 0}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/30 disabled:opacity-50 active:scale-95"
          >
            Print Selected ({selectedIds.length})
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   4. SCRIMMAGE MODALS (FILTER & PRINT)
   ========================================================================= */
interface ScrimmageFilterModalProps {
  isOpen: boolean;
  formations: FormationBoard[];
  currentFilters: string[] | null;
  onClose: () => void;
  onSaveFilters: (selectedIds: string[]) => void;
}

export const ScrimmageFilterModal: React.FC<ScrimmageFilterModalProps> = ({
  isOpen,
  formations,
  currentFilters,
  onClose,
  onSaveFilters,
}) => {
  const relevantForms = formations.filter(
    (f) => f && (f.unit === 'offense' || f.unit === 'defense')
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(
    currentFilters || relevantForms.map((f) => f.id)
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-800/95 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-700/80">
        <div className="flex items-center justify-between border-b border-slate-700 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-400" />
            <h3 className="font-black text-base text-slate-100">
              Filter Scrimmage Boards
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto border border-slate-700 p-3 rounded-2xl bg-slate-900/90">
          {relevantForms.map((f) => {
            const isChecked = selectedIds.includes(f.id);
            return (
              <label
                key={f.id}
                className="flex items-center gap-2.5 p-2.5 bg-slate-800 rounded-xl border border-slate-700 text-xs font-bold text-slate-200 cursor-pointer hover:border-slate-600 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds([...selectedIds, f.id]);
                    else setSelectedIds(selectedIds.filter((id) => id !== f.id));
                  }}
                  className="rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-slate-700"
                />
                <span>
                  [{f.unit.toUpperCase()}] {f.name}
                </span>
              </label>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl border border-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSaveFilters(selectedIds);
              onClose();
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/30 active:scale-95"
          >
            Save Filter
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   5. TEMPLATES MANAGER MODAL
   ========================================================================= */
interface TemplatesManagerModalProps {
  isOpen: boolean;
  templates: Record<string, PracticePeriod[]>;
  onClose: () => void;
  onRenameTemplate: (oldName: string, newName: string) => void;
  onDeleteTemplate: (name: string) => void;
  onSaveNewTemplate?: (name: string) => void;
}

export const TemplatesManagerModal: React.FC<TemplatesManagerModalProps> = ({
  isOpen,
  templates,
  onClose,
  onRenameTemplate,
  onDeleteTemplate,
  onSaveNewTemplate,
}) => {
  const [newTemplateName, setNewTemplateName] = React.useState('');

  if (!isOpen) return null;

  const handleCreateTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim()) return;
    if (onSaveNewTemplate) {
      onSaveNewTemplate(newTemplateName.trim());
      setNewTemplateName('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-800/95 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-700/80">
        <div className="flex items-center justify-between border-b border-slate-700 pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-indigo-400" />
            <h3 className="font-black text-base text-slate-100">
              Manage Practice Templates
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {onSaveNewTemplate && (
          <form onSubmit={handleCreateTemplate} className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              Save Active Practice as New Template
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g. Tuesday Full Pads / Pre-Game Walkthrough"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!newTemplateName.trim()}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer whitespace-nowrap"
              >
                Save
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2 max-h-64 overflow-y-auto border border-slate-700 p-3 rounded-2xl bg-slate-900/90">
          <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Saved Templates ({Object.keys(templates).length})
          </div>
          {Object.entries(templates).map(([name, periods]) => {
            const count = Array.isArray(periods) ? periods.length : 0;
            return (
              <div
                key={name}
                className="flex items-center justify-between p-2.5 bg-slate-800 rounded-xl border border-slate-700 text-xs font-bold text-slate-200"
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <span className="truncate">{name}</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 text-indigo-300 text-[10px] font-mono border border-slate-700/60 shrink-0">
                    {count} {count === 1 ? 'period' : 'periods'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const newName = prompt('Rename template:', name);
                      if (newName && newName.trim() && newName !== name) {
                        onRenameTemplate(name, newName.trim());
                      }
                    }}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-700 rounded-lg text-slate-300 text-[11px] border border-slate-700 cursor-pointer"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete template "${name}"?`)) onDeleteTemplate(name);
                    }}
                    className="p-1 hover:bg-rose-950/50 text-rose-400 rounded-lg cursor-pointer"
                    title="Delete template"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
          {Object.keys(templates).length === 0 && (
            <div className="text-center py-6 text-xs text-slate-400 italic">
              No saved templates yet. Click Save above to save your current plan as a reusable template.
            </div>
          )}
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   6. SELECTIVE IMPORT / RESTORE BACKUP MODAL
   ========================================================================= */
interface ModuleInfo {
  key: string;
  name: string;
  category: string;
  icon: React.ReactNode;
  countLabel: string;
  description: string;
  isAvailable: boolean;
}

export function unwrapBackupData(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw;
  if (raw.state && typeof raw.state === 'object') {
    return unwrapBackupData(raw.state);
  }
  if (raw.payloadToSave && typeof raw.payloadToSave === 'object') {
    return unwrapBackupData(raw.payloadToSave);
  }
  if (raw.backup && typeof raw.backup === 'object') {
    return unwrapBackupData(raw.backup);
  }
  if (raw.data && typeof raw.data === 'object' && !raw.weeklyData && !raw.depthChart && !raw.roster) {
    return unwrapBackupData(raw.data);
  }
  return raw;
}

export function inspectBackupModules(raw: any): ModuleInfo[] {
  if (!raw || typeof raw !== 'object') return [];
  const parsed = unwrapBackupData(raw);

  // Weekly data and depth chart detection
  const hasDirectDepthChart = Boolean(
    parsed.depthChart && typeof parsed.depthChart === 'object' && Object.keys(parsed.depthChart).length > 0
  );

  const rawEntries = Object.entries(parsed || {});
  const isRawDepthChartMap =
    !hasDirectDepthChart &&
    !parsed.weeklyData &&
    rawEntries.length > 0 &&
    rawEntries.every(
      ([k, v]) =>
        Array.isArray(v) &&
        !['cascadingDrills', 'practiceData', 'scheduleEvents', 'roster', 'savedCoaches', 'staffList', 'playDatabase'].includes(k)
    );

  const weekEntries = rawEntries.filter(
    ([k, v]: [string, any]) =>
      v && typeof v === 'object' && !Array.isArray(v) && (v.depthChart || v.formations || v.scrimmageChart)
  );
  const hasWeekDepthCharts = weekEntries.length > 0;

  const hasWeekly = Boolean(
    parsed.weeklyData ||
      hasDirectDepthChart ||
      isRawDepthChartMap ||
      hasWeekDepthCharts ||
      (parsed['0'] && parsed['0'].depthChart) ||
      (parsed.wk1 && parsed.wk1.depthChart)
  );

  let weekCount = 0;
  let directDCSlots = 0;
  if (parsed.weeklyData && typeof parsed.weeklyData === 'object') {
    const wSource = parsed.weeklyData;
    weekCount =
      Object.keys(wSource).filter(
        (k) =>
          k.toLowerCase().includes('week') ||
          k.toLowerCase().includes('wk') ||
          !isNaN(Number(k))
      ).length || Object.keys(wSource).length;
  } else if (hasWeekDepthCharts) {
    weekCount = weekEntries.length;
  } else if (hasDirectDepthChart) {
    directDCSlots = Object.keys(parsed.depthChart).length;
  } else if (isRawDepthChartMap) {
    directDCSlots = rawEntries.length;
  }

  // Practice plans
  const hasPractice = Array.isArray(parsed.practiceData) && parsed.practiceData.length > 0;
  const practiceCount = hasPractice ? parsed.practiceData.length : 0;

  // Practice templates
  const hasTemplates = Boolean(
    parsed.practiceTemplates &&
      typeof parsed.practiceTemplates === 'object' &&
      Object.keys(parsed.practiceTemplates).length > 0
  );
  const templateCount = hasTemplates ? Object.keys(parsed.practiceTemplates).length : 0;

  // Cascading drills
  const hasDrills = Array.isArray(parsed.cascadingDrills) && parsed.cascadingDrills.length > 0;
  let totalDrills = 0;
  let folderCount = 0;
  if (hasDrills) {
    const countDrills = (folders: DrillFolder[]) => {
      folders.forEach((f) => {
        folderCount++;
        totalDrills += f.drills?.length || 0;
        if (f.subfolders) countDrills(f.subfolders);
      });
    };
    countDrills(parsed.cascadingDrills);
  }

  // Default Formations & Offensive/Defensive Alignments
  let defaultCount = 0;
  if (Array.isArray(parsed.defaultFormations) && parsed.defaultFormations.length > 0) {
    defaultCount = parsed.defaultFormations.length;
  } else if (Array.isArray(parsed.formations) && parsed.formations.length > 0) {
    defaultCount = parsed.formations.length;
  } else if (Array.isArray(parsed.offensiveFormations) || Array.isArray(parsed.offenseFormations)) {
    defaultCount =
      (parsed.offensiveFormations?.length || 0) +
      (parsed.offenseFormations?.length || 0) +
      (parsed.defensiveFormations?.length || 0) +
      (parsed.defenseFormations?.length || 0);
  } else if (Array.isArray(parsed) && parsed.length > 0 && (parsed[0]?.positions || parsed[0]?.rows || parsed[0]?.unit)) {
    defaultCount = parsed.length;
  } else if (parsed.weeklyData && typeof parsed.weeklyData === 'object') {
    const fIds = new Set<string>();
    Object.values(parsed.weeklyData).forEach((wk: any) => {
      if (wk && Array.isArray(wk.formations)) {
        wk.formations.forEach((f: any) => {
          if (f?.id) fIds.add(f.id);
        });
      }
    });
    defaultCount = fIds.size;
  }
  const hasDefaults = defaultCount > 0;

  // Guides
  const hasGuides = Boolean(
    parsed.guideTree ||
      parsed.pdfGuidesTree ||
      parsed.guideOrder ||
      parsed.pdfGuidesOrder
  );

  // Staff & Coaches
  const hasStaff = Boolean(
    (Array.isArray(parsed.savedCoaches) && parsed.savedCoaches.length > 0) ||
      (Array.isArray(parsed.staffList) && parsed.staffList.length > 0) ||
      (Array.isArray(parsed.savedCoachesList) && parsed.savedCoachesList.length > 0)
  );
  const staffCount =
    (parsed.savedCoaches?.length || 0) +
    (parsed.staffList?.length || 0) +
    (parsed.savedCoachesList?.length || 0);

  // Master Plays
  const hasPlays = Boolean(
    parsed.masterPlayLibrary &&
      typeof parsed.masterPlayLibrary === 'object' &&
      Object.keys(parsed.masterPlayLibrary).length > 0
  );
  const playCount = hasPlays ? Object.keys(parsed.masterPlayLibrary).length : 0;

  // Schedule Events
  const hasSchedule = Array.isArray(parsed.scheduleEvents) && parsed.scheduleEvents.length > 0;
  const scheduleCount = hasSchedule ? parsed.scheduleEvents.length : 0;

  // Roster
  const hasRoster = Boolean(
    (Array.isArray(parsed.roster) && parsed.roster.length > 0) ||
    (Array.isArray(parsed.players) && parsed.players.length > 0)
  );
  const rosterCount = (parsed.roster || parsed.players || []).length;

  // Call Sheet Data
  const csObj = parsed.callSheetData || parsed.callSheet;
  const hasCallSheet = Boolean(
    csObj &&
    (Array.isArray(csObj.offenseSections) || Array.isArray(csObj.defenseSections)) &&
    ((csObj.offenseSections?.length || 0) + (csObj.defenseSections?.length || 0) > 0)
  );
  let callSheetSecCount = 0;
  let callSheetPlayCount = 0;
  if (hasCallSheet && csObj) {
    const allSecs = [...(csObj.offenseSections || []), ...(csObj.defenseSections || [])];
    callSheetSecCount = allSecs.length;
    allSecs.forEach((sec: any) => {
      callSheetPlayCount += (sec.plays || []).filter(Boolean).length;
    });
  }

  // Wristband Data
  const wbObj = parsed.wristbandData || parsed.wristband;
  const hasWristband = Boolean(
    wbObj &&
    Array.isArray(wbObj.wristbands) &&
    wbObj.wristbands.length > 0
  );
  const wristbandCount = hasWristband ? wbObj.wristbands.length : 0;
  let totalWbPlays = 0;
  if (hasWristband) {
    wbObj.wristbands.forEach((wb: any) => {
      (wb.columns || []).forEach((col: any) => {
        totalWbPlays += (col.plays || []).filter((p: any) => p && p.text && p.text.trim()).length;
      });
    });
  }

  // Game Day Play Database
  const hasPlayDb = Array.isArray(parsed.playDatabase) && parsed.playDatabase.length > 0;
  const playDbCount = hasPlayDb ? parsed.playDatabase.length : 0;
  const hudlSummary = summarizeHudlScoutBackup(parsed);

  return [
    {
      key: 'cascadingDrills',
      name: '💥 Master Drill Library',
      category: 'Training & Drills',
      icon: <Dumbbell className="w-5 h-5 text-emerald-400" />,
      countLabel: hasDrills ? `${totalDrills} drills • ${folderCount} categories` : 'Not found in file',
      description: 'All categorized exercises, agility circuits, tackling & blocking progressions',
      isAvailable: hasDrills,
    },
    {
      key: 'practiceData',
      name: '📋 Practice Plans & Schedules',
      category: 'Practice & Schedule',
      icon: <Calendar className="w-5 h-5 text-amber-400" />,
      countLabel: hasPractice ? `${practiceCount} practice plans` : 'Not found in file',
      description: 'Full timeline practices, station coaches, drill allocations, & notes',
      isAvailable: hasPractice,
    },
    {
      key: 'practiceTemplates',
      name: '⚡ Practice Period Templates',
      category: 'Practice & Schedule',
      icon: <Activity className="w-5 h-5 text-purple-400" />,
      countLabel: hasTemplates ? `${templateCount} period templates` : 'Not found in file',
      description: 'Saved custom period formats (e.g. 5-Station Tackle Circuit, Indy, Specials)',
      isAvailable: hasTemplates,
    },
    {
      key: 'weeklyData',
      name: '🏈 Weekly Game Plans & Depth Charts',
      category: 'Playbook Core',
      icon: <Layers className="w-5 h-5 text-indigo-400" />,
      countLabel: hasWeekly
        ? directDCSlots > 0
          ? `${directDCSlots} depth chart positions (Current Game Plan)`
          : `${weekCount} game weeks • Depth Charts`
        : 'Not found in file',
      description: 'Weekly offensive/defensive formation charts, player spot assignments, & notes',
      isAvailable: hasWeekly,
    },
    {
      key: 'defaultFormations',
      name: '📐 Default Formations & Alignments',
      category: 'Playbook Core',
      icon: <Shield className="w-5 h-5 text-sky-400" />,
      countLabel: hasDefaults ? `${defaultCount} base formations` : 'Not found in file',
      description: 'Base offensive and defensive field coordinates, positions, and alignments',
      isAvailable: hasDefaults,
    },
    {
      key: 'guideTree',
      name: '📖 Playbook PDF Guides & Structure',
      category: 'Playbook Core',
      icon: <BookOpen className="w-5 h-5 text-pink-400" />,
      countLabel: hasGuides ? 'Guides tree & order' : 'Not found in file',
      description: 'Playbook PDF documents, folder hierarchy, and custom manual ordering',
      isAvailable: hasGuides,
    },
    {
      key: 'staffList',
      name: '🧢 Coaching Staff & Directory',
      category: 'Administration',
      icon: <Users className="w-5 h-5 text-teal-400" />,
      countLabel: hasStaff ? `${staffCount} coaches/staff` : 'Not found in file',
      description: 'Saved coach names, station assignments, and team staff directory',
      isAvailable: hasStaff,
    },
    {
      key: 'masterPlayLibrary',
      name: '🎯 Master Play Library',
      category: 'Playbook Core',
      icon: <FileText className="w-5 h-5 text-cyan-400" />,
      countLabel: hasPlays ? `${playCount} play collections` : 'Not found in file',
      description: 'Offensive run/pass plays, defensive coverages, and play call sheets',
      isAvailable: hasPlays,
    },
    {
      key: 'scheduleEvents',
      name: '📅 Season Schedule & Calendar',
      category: 'Administration',
      icon: <Calendar className="w-5 h-5 text-rose-400" />,
      countLabel: hasSchedule ? `${scheduleCount} calendar events` : 'Not found in file',
      description: 'Games, practices, scrimmages, and location details',
      isAvailable: hasSchedule,
    },
    {
      key: 'callSheetData',
      name: '📑 Sideline Call Sheet',
      category: 'Game Day & Sideline',
      icon: <FileText className="w-5 h-5 text-emerald-400" />,
      countLabel: hasCallSheet ? `${callSheetSecCount} sections • ${callSheetPlayCount} plays` : 'Not found in file',
      description: 'Offensive & Defensive game day call sheet tables, scripts, & situational sections',
      isAvailable: hasCallSheet,
    },
    {
      key: 'wristbandData',
      name: '🔤 Player Wristband Cards',
      category: 'Game Day & Sideline',
      icon: <Square className="w-5 h-5 text-cyan-400" />,
      countLabel: hasWristband ? `${wristbandCount} wristband cards • ${totalWbPlays} plays` : 'Not found in file',
      description: 'Continuous-numbered wristband inserts, column colors, and player play assignments',
      isAvailable: hasWristband,
    },
    {
      key: 'playDatabase',
      name: '📚 Game Day Play Database',
      category: 'Playbook Core',
      icon: <Database className="w-5 h-5 text-indigo-400" />,
      countLabel: hasPlayDb ? `${playDbCount} game day plays` : 'Not found in file',
      description: 'Master catalog of tagged plays with personnel groupings, motions, and run/pass tags',
      isAvailable: hasPlayDb,
    },
    {
      key: 'hudlScout',
      name: 'Hudl Scout uploads',
      category: 'Scouting',
      icon: <FileText className="w-5 h-5 text-orange-400" />,
      countLabel: hudlSummary.isAvailable
        ? `${hudlSummary.playCount} plays • ${hudlSummary.weekCount} opponent weeks • ${hudlSummary.teamCount} our-team files`
        : 'Not found in file',
      description: 'Uploaded Hudl CSV/Excel scout reports for opponents and our team',
      isAvailable: hudlSummary.isAvailable,
    },
    {
      key: 'roster',
      name: '👥 Team Roster',
      category: 'Administration',
      icon: <Users className="w-5 h-5 text-blue-400" />,
      countLabel: hasRoster ? `${rosterCount} players` : 'Not found in file',
      description: 'Player roster names, jersey numbers, and primary position slots',
      isAvailable: hasRoster,
    },
  ];
}

interface ImportBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySelectiveImport: (
    parsedData: any,
    selectedOptions: Record<string, boolean>
  ) => void;
}

export const ImportBackupModal: React.FC<ImportBackupModalProps> = ({
  isOpen,
  onClose,
  onApplySelectiveImport,
}) => {
  const [step, setStep] = useState<'upload' | 'select'>('upload');
  const [parsedData, setParsedData] = useState<any>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');
  const [pastedText, setPastedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedModules, setSelectedModules] = useState<Record<string, boolean>>({});
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleProcessParsedData = (data: any, name = 'Backup File', sizeStr = '') => {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Parsed backup file is empty or not a valid object.');
      }
      const modules = inspectBackupModules(data);
      const availableModules = modules.filter((m) => m.isAvailable);

      if (availableModules.length === 0) {
        throw new Error('No compatible playbook modules found in this JSON backup.');
      }

      // Default all available modules to checked
      const initialSelection: Record<string, boolean> = {};
      modules.forEach((m) => {
        initialSelection[m.key] = m.isAvailable;
      });

      setParsedData(data);
      setFileName(name);
      setFileSize(sizeStr);
      setSelectedModules(initialSelection);
      setError(null);
      setStep('select');
    } catch (err: any) {
      setError(err.message || 'Failed to process backup file.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const sizeStr = `${(file.size / 1024).toFixed(1)} KB`;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        let text = evt.target?.result as string;
        if (text.charCodeAt(0) === 0xfeff) {
          text = text.slice(1);
        }
        text = text.trim();
        const parsed = JSON.parse(text);
        handleProcessParsedData(parsed, file.name, sizeStr);
      } catch (err: any) {
        setError(`Invalid JSON file: ${err.message}`);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const sizeStr = `${(file.size / 1024).toFixed(1)} KB`;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        let text = evt.target?.result as string;
        if (text.charCodeAt(0) === 0xfeff) {
          text = text.slice(1);
        }
        text = text.trim();
        const parsed = JSON.parse(text);
        handleProcessParsedData(parsed, file.name, sizeStr);
      } catch (err: any) {
        setError(`Invalid JSON file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleApplyPaste = () => {
    setError(null);
    if (!pastedText.trim()) {
      setError('Please paste JSON data first.');
      return;
    }
    try {
      let text = pastedText.trim();
      if (text.charCodeAt(0) === 0xfeff) {
        text = text.slice(1);
      }
      const parsed = JSON.parse(text);
      handleProcessParsedData(parsed, 'Pasted Backup Code', `${(pastedText.length / 1024).toFixed(1)} KB`);
    } catch (e: any) {
      setError(`Invalid JSON: ${e.message}`);
    }
  };

  const handleToggleModule = (key: string) => {
    setSelectedModules((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSelectAll = (modules: ModuleInfo[]) => {
    const next: Record<string, boolean> = {};
    modules.forEach((m) => {
      if (m.isAvailable) next[m.key] = true;
    });
    setSelectedModules(next);
  };

  const handleDeselectAll = () => {
    setSelectedModules({});
  };

  const handleConfirmRestore = () => {
    if (!parsedData) return;
    const selectedKeys = Object.keys(selectedModules).filter((k) => selectedModules[k]);
    if (selectedKeys.length === 0) {
      setError('Please select at least one module to restore.');
      return;
    }
    onApplySelectiveImport(unwrapBackupData(parsedData), selectedModules);
    onClose();
  };

  const modules = parsedData ? inspectBackupModules(parsedData) : [];
  const availableCount = modules.filter((m) => m.isAvailable).length;
  const selectedCount = Object.keys(selectedModules).filter((k) => selectedModules[k]).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".json,.txt,application/json,text/plain,*"
        onChange={handleFileChange}
      />

      <div className="bg-slate-800/98 border border-slate-700/80 rounded-3xl max-w-2xl w-full p-5 md:p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-700 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center font-black">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base md:text-lg text-slate-100 flex items-center gap-2">
                Selective Playbook Restore
              </h3>
              <p className="text-xs text-slate-300 font-medium">
                {step === 'upload'
                  ? 'Choose a backup file or paste JSON to choose what to restore'
                  : 'Select specific modules you want to import into your workspace'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: Upload / Paste File */}
        {step === 'upload' && (
          <div className="space-y-4 text-xs text-slate-300 overflow-y-auto pr-1">
            {/* Drag & Drop File Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-6 md:p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-slate-700 hover:border-indigo-500/70 bg-slate-900/60 hover:bg-slate-900/90'
              }`}
            >
              <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center mb-3">
                <Upload className="w-6 h-6" />
              </div>
              <p className="font-bold text-sm text-slate-100">
                Click to browse or drag &amp; drop your backup .JSON file
              </p>
              <p className="text-xs text-slate-300 font-medium mt-1">
                You will be able to review and select individual modules before restoring.
              </p>
              <div className="mt-4">
                <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-md">
                  <FileJson className="w-4 h-4" />
                  <span>Choose .JSON Backup File</span>
                </span>
              </div>
            </div>

            {/* Paste Option */}
            <div className="border-t border-slate-700/80 pt-3">
              <label className="font-bold text-slate-200 block mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Or Paste Backup JSON Directly</span>
              </label>
              <textarea
                value={pastedText}
                onChange={(e) => {
                  setPastedText(e.target.value);
                  setError(null);
                }}
                placeholder='Paste raw backup JSON code here (e.g. {"cascadingDrills": [...], "practiceData": [...]})...'
                rows={4}
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-3 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-indigo-500 shadow-inner"
              />

              {error && (
                <div className="flex items-center gap-1.5 text-rose-400 font-bold mt-2 text-xs bg-rose-950/40 border border-rose-800/60 p-2.5 rounded-xl">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex justify-end mt-2.5">
                <button
                  type="button"
                  onClick={handleApplyPaste}
                  disabled={!pastedText.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Inspect &amp; Select Modules</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Selective Module Inspector */}
        {step === 'select' && (
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Backup Info & Quick Select Toolbar */}
            <div className="bg-slate-900/90 rounded-2xl p-3 border border-slate-700/80 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <FileJson className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-bold text-xs text-slate-200 truncate max-w-[200px] md:max-w-xs">
                  {fileName}
                </span>
                {fileSize && (
                  <span className="text-[11px] text-slate-300 px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700">
                    {fileSize}
                  </span>
                )}
                <span className="text-[11px] font-bold text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-500/30">
                  {availableCount} items found
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectAll(modules)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-600 flex items-center gap-1 transition-all"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Select All</span>
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-600 flex items-center gap-1 transition-all"
                >
                  <Square className="w-3.5 h-3.5 text-slate-400" />
                  <span>Deselect All</span>
                </button>
              </div>
            </div>

            {/* Modules Checkbox List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[420px]">
              {modules.map((m) => {
                const isChecked = Boolean(selectedModules[m.key]);
                return (
                  <div
                    key={m.key}
                    onClick={() => m.isAvailable && handleToggleModule(m.key)}
                    className={`p-3 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                      !m.isAvailable
                        ? 'opacity-40 border-slate-800 bg-slate-900/30 cursor-not-allowed'
                        : isChecked
                        ? 'bg-indigo-950/40 border-indigo-500/80 shadow-md cursor-pointer hover:bg-indigo-950/60'
                        : 'bg-slate-900/60 border-slate-700/80 hover:border-slate-600 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={!m.isAvailable}
                        onChange={() => {}} // Handled by container click
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 w-4 h-4 cursor-pointer"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs md:text-sm text-slate-100 truncate">
                            {m.name}
                          </span>
                          {m.isAvailable ? (
                            <span className="text-[10.5px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {m.countLabel}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 border border-slate-700">
                              Not in backup
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-300 font-medium mt-0.5 line-clamp-1">
                          {m.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Non-destructive notice */}
            <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl p-3 text-[11px] text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Safe Selective Restore:</strong> Only the checked modules above will be updated. All your other current playbook data will remain completely untouched.
              </span>
            </div>

            {error && (
              <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs bg-rose-950/40 border border-rose-800/60 p-2.5 rounded-xl">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-700/80">
              <button
                type="button"
                onClick={() => {
                  setStep('upload');
                  setParsedData(null);
                  setError(null);
                }}
                className="px-3 py-2 text-xs font-bold text-slate-300 hover:text-white flex items-center gap-1.5 rounded-xl hover:bg-slate-700/50 transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Upload Different File</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-750 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  disabled={selectedCount === 0}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black rounded-xl text-xs transition-all shadow-lg active:scale-95 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Restore Selected ({selectedCount} Module{selectedCount === 1 ? '' : 's'})</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

