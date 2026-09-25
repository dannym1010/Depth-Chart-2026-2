import { useEffect, useState } from 'react';
import { safeJSONParse, safeJSONSet } from '../services/storageService';
import { THEME_SCHEMES } from '../components/ThemeGalleryModal';
import { applyThemeScheme } from '../utils/themeScheme';

export type ThemeMode = 'dark' | 'light';

// Visual scheme + light/dark mode, remembered per signed-in coach on this device.
export function useThemePreferences(currentUser: any) {
  const [activeThemeId, setActiveThemeId] = useState<string>(() =>
    safeJSONParse('footballActiveThemeId', 'electric_volt')
  );
  // Site Display Theme Mode ('dark' | 'light') with account-based preference restoration
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const lastUserKey = (localStorage.getItem('footballLastUserKey') || '').toLowerCase().trim();
      const userThemes = safeJSONParse<Record<string, ThemeMode>>('footballUserThemePreferences', {});
      const savedForUser = lastUserKey && userThemes ? userThemes[lastUserKey] : undefined;
      if (savedForUser === 'light' || savedForUser === 'dark') {
        return savedForUser;
      }
      const saved = localStorage.getItem('footballThemeMode');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // ignore
    }
    return 'dark';
  });

  const handleToggleThemeMode = (specificMode?: ThemeMode) => {
    // Guard against callers wired straight to onClick, which would pass a
    // MouseEvent here and persist it as the theme mode.
    const requested = specificMode === 'dark' || specificMode === 'light' ? specificMode : undefined;
    setThemeMode((prev) => (requested ? requested : prev === 'dark' ? 'light' : 'dark'));
  };

  const selectTheme = (id: string) => {
    setActiveThemeId(id);
    safeJSONSet('footballActiveThemeId', id);
  };

  // Synchronize themeMode class on document & body + persist to user map & local storage
  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === 'light') {
      root.classList.add('theme-light');
      document.body.classList.add('theme-light');
      root.classList.remove('theme-dark', 'dark');
      document.body.classList.remove('theme-dark', 'dark');
    } else {
      root.classList.remove('theme-light');
      document.body.classList.remove('theme-light');
      root.classList.add('theme-dark', 'dark');
      document.body.classList.add('theme-dark', 'dark');
    }

    try {
      localStorage.setItem('footballThemeMode', themeMode);
    } catch {
      // ignore
    }

    const userKey = (currentUser?.email || currentUser?.displayName || 'guest').toLowerCase().trim();
    if (userKey) {
      try {
        localStorage.setItem('footballLastUserKey', userKey);
      } catch {
        // ignore
      }
      const userThemes = safeJSONParse<Record<string, ThemeMode>>('footballUserThemePreferences', {}) || {};
      userThemes[userKey] = themeMode;
      safeJSONSet('footballUserThemePreferences', userThemes);
    }
  }, [themeMode, currentUser?.email, currentUser?.displayName]);

  // Paint the selected visual scheme onto the document as CSS variables. Runs
  // after the light/dark effect above so it can override the mode's base ramp.
  useEffect(() => {
    applyThemeScheme(
      THEME_SCHEMES.find((scheme) => scheme.id === activeThemeId),
      themeMode
    );
  }, [activeThemeId, themeMode]);

  // When user logs in or switches account, automatically load their saved Light / Dark theme preference!
  useEffect(() => {
    const userKey = (currentUser?.email || currentUser?.displayName || 'guest').toLowerCase().trim();
    if (!userKey) return;
    try {
      localStorage.setItem('footballLastUserKey', userKey);
    } catch {
      // ignore
    }
    const userThemes = safeJSONParse<Record<string, ThemeMode>>('footballUserThemePreferences', {});
    if (userThemes && userThemes[userKey] && (userThemes[userKey] === 'light' || userThemes[userKey] === 'dark')) {
      setThemeMode(userThemes[userKey]);
    }
  }, [currentUser?.email, currentUser?.displayName]);

  return { activeThemeId, selectTheme, themeMode, handleToggleThemeMode };
}
