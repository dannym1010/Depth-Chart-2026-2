import {
  setAdminPasscodeOnServer,
  fetchServerState,
  checkServerHealth,
  establishOpsSession,
} from '../services/storageService';
import {
  canUseLocalDeveloperLogin,
  markLocalDeveloperSession,
  buildLocalDeveloperUser,
  LOCAL_DEV_EMAIL,
} from '../utils/localDeveloperAuth';
import type { Dispatch, SetStateAction } from 'react';
import type { UserRole } from '../types';

export interface AdminSignInDeps {
  setAdminPasscodeSet: Dispatch<SetStateAction<boolean>>;
  applyRemoteState: (data: any, source?: string, version?: number, updatedAt?: number) => void;
  setCurrentUser: Dispatch<any>;
  setIsPendingApproval: Dispatch<SetStateAction<boolean>>;
  setIsAuthModalOpen: Dispatch<SetStateAction<boolean>>;
  setUserRole: Dispatch<SetStateAction<UserRole>>;
  applyUserPreferencesOnLogin: (email: string) => void;
}

// Admin passcode setup and sign-in, plus the local developer sign-in, each followed by a server state pull.
export function useAdminSignIn({
  setAdminPasscodeSet,
  applyRemoteState,
  setCurrentUser,
  setIsPendingApproval,
  setIsAuthModalOpen,
  setUserRole,
  applyUserPreferencesOnLogin,
}: AdminSignInDeps) {
  const handleSetAdminPasscode = async (newPasscode: string) => {
    const trimmed = newPasscode.trim();
    const result = await setAdminPasscodeOnServer(trimmed);
    if (!result.success) {
      throw new Error(result.error || 'Failed to save admin passcode');
    }
    setAdminPasscodeSet(true);
    localStorage.setItem('footballAdminPasscodeSet', 'true');
    localStorage.removeItem('footballAdminCustomPasscode');
  };

  const pullServerStateAfterSession = async () => {
    try {
      const serverRes = await fetchServerState();
      if (serverRes && serverRes.hasData && serverRes.state) {
        applyRemoteState(serverRes.state, 'session_login_pull', serverRes.version, serverRes.updatedAt);
      }
      const health = await checkServerHealth();
      if (typeof health?.adminPasscodeSet === 'boolean') {
        setAdminPasscodeSet(health.adminPasscodeSet);
        localStorage.setItem('footballAdminPasscodeSet', health.adminPasscodeSet ? 'true' : 'false');
      }
    } catch (err) {
      console.warn('Server state pull after session failed:', err);
    }
  };

  const handleAdminPasscodeSignIn = async (enteredPasscode: string): Promise<boolean> => {
    const trimmed = enteredPasscode.trim();
    if (!trimmed) return false;
    const ok = await establishOpsSession({ method: 'passcode', passcode: trimmed });
    if (!ok) return false;
    sessionStorage.setItem('football_admin_passcode_active', 'true');
    const adminUser = {
      email: 'admin@coachportal.local',
      displayName: 'Head Coach (Admin)',
      isAdminPasscodeAuth: true,
    };
    setCurrentUser(adminUser);
    setIsPendingApproval(false);
    setIsAuthModalOpen(false);
    setUserRole('admin');
    applyUserPreferencesOnLogin('admin@coachportal.local');
    setAdminPasscodeSet(true);
    localStorage.setItem('footballAdminPasscodeSet', 'true');
    await pullServerStateAfterSession();
    return true;
  };

  const handleLocalDeveloperSignIn = async (): Promise<boolean> => {
    if (!canUseLocalDeveloperLogin() || !markLocalDeveloperSession()) {
      return false;
    }
    setCurrentUser(buildLocalDeveloperUser());
    setIsPendingApproval(false);
    setIsAuthModalOpen(false);
    setUserRole('admin');
    applyUserPreferencesOnLogin(LOCAL_DEV_EMAIL);
    const ok = await establishOpsSession({ method: 'local_developer' });
    if (ok) await pullServerStateAfterSession();
    return true;
  };

  const handleSetAndSignInWithAdminPasscode = async (newPasscode: string) => {
    const trimmed = newPasscode.trim();
    const sessionOk = await establishOpsSession({ method: 'passcode', passcode: trimmed });
    if (!sessionOk) {
      throw new Error('Could not set the admin passcode on this computer.');
    }
    await handleSetAdminPasscode(trimmed);
    sessionStorage.setItem('football_admin_passcode_active', 'true');
    const adminUser = {
      email: 'admin@coachportal.local',
      displayName: 'Head Coach (Admin)',
      isAdminPasscodeAuth: true,
    };
    setCurrentUser(adminUser);
    setIsPendingApproval(false);
    setIsAuthModalOpen(false);
    setUserRole('admin');
    applyUserPreferencesOnLogin('admin@coachportal.local');
    await pullServerStateAfterSession();
  };

  return {
    handleAdminPasscodeSignIn,
    handleSetAndSignInWithAdminPasscode,
    handleLocalDeveloperSignIn,
    handleSetAdminPasscode,
  };
}
