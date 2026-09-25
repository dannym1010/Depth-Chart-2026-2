import { safeJSONSet, getFirebaseServices } from '../services/storageService';
import type { Dispatch, SetStateAction, RefObject } from 'react';
import type { PlaybookGuideTree } from '../types';
import type { LatestAppState } from './appStateTypes';

export interface PlaybookGuideActionsDeps {
  setGuideTree: Dispatch<SetStateAction<PlaybookGuideTree>>;
  latestStateRef: RefObject<LatestAppState>;
  flushAndSaveStateToStorage: (scope?: string, extraMeta?: Record<string, any>) => Promise<void>;
}

// Upload, edit, and clear the documents attached to playbook guide pages.
export function usePlaybookGuideActions({
  setGuideTree,
  latestStateRef,
  flushAndSaveStateToStorage,
}: PlaybookGuideActionsDeps) {
  /* =========================================================================
     PLAYBOOKS & GUIDES ACTIONS
     ========================================================================= */
  const handleSaveGuideHtml = (main: string, sub: string, htmlContent: string) => {
    setGuideTree((prev) => {
      const next = {
        ...prev,
        [main]: {
          ...(prev[main] || {}),
          [sub]: htmlContent,
        },
      };
      latestStateRef.current.guideTree = next;
      safeJSONSet('footballPdfGuidesTree', next);
      return next;
    });
    flushAndSaveStateToStorage('guide_html_update');
  };

  const handleClearGuideDocument = (main: string, sub: string) => {
    setGuideTree((prev) => {
      const next = {
        ...prev,
        [main]: {
          ...(prev[main] || {}),
          [sub]: '',
        },
      };
      latestStateRef.current.guideTree = next;
      safeJSONSet('footballPdfGuidesTree', next);
      return next;
    });
    flushAndSaveStateToStorage('guide_clear');
  };

  const handleUploadGuideDocument = (
    main: string,
    sub: string,
    file: File
  ) => {
    const isHtmlFile =
      file.name.toLowerCase().endsWith('.html') ||
      file.name.toLowerCase().endsWith('.htm') ||
      file.type === 'text/html';

    if (isHtmlFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = (e.target?.result as string) || '';
        handleSaveGuideHtml(main, sub, content);
      };
      reader.readAsText(file);
      return;
    }

    const { storage } = getFirebaseServices();
    if (storage) {
      const storageRef = storage.ref(`playbook_guides/${Date.now()}_${file.name}`);
      storageRef
        .put(file)
        .then((snapshot: any) => snapshot.ref.getDownloadURL())
        .then((downloadUrl: string) => {
          setGuideTree((prev) => {
            const next = {
              ...prev,
              [main]: {
                ...(prev[main] || {}),
                [sub]: downloadUrl,
              },
            };
            latestStateRef.current.guideTree = next;
            safeJSONSet('footballPdfGuidesTree', next);
            return next;
          });
          flushAndSaveStateToStorage('guide_upload');
        })
        .catch((err: any) => {
          console.warn('Storage upload error, falling back to local data URL:', err);
          const localUrl = URL.createObjectURL(file);
          setGuideTree((prev) => {
            const next = {
              ...prev,
              [main]: {
                ...(prev[main] || {}),
                [sub]: localUrl,
              },
            };
            latestStateRef.current.guideTree = next;
            safeJSONSet('footballPdfGuidesTree', next);
            return next;
          });
          flushAndSaveStateToStorage('guide_upload_local');
        });
    } else {
      const localUrl = URL.createObjectURL(file);
      setGuideTree((prev) => {
        const next = {
          ...prev,
          [main]: {
            ...(prev[main] || {}),
            [sub]: localUrl,
          },
        };
        latestStateRef.current.guideTree = next;
        safeJSONSet('footballPdfGuidesTree', next);
        return next;
      });
      flushAndSaveStateToStorage('guide_upload_local');
    }
  };

  return {
    handleUploadGuideDocument,
    handleSaveGuideHtml,
    handleClearGuideDocument,
  };
}
