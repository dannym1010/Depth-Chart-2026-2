import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {execSync} from 'child_process';

// The version shown at the top of the app: the commit it was built from (the host's, or git's) and when.
const commit = (() => {
  const fromHost = process.env.VERCEL_GIT_COMMIT_SHA || process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || process.env.GITHUB_SHA || '';
  if (fromHost) return fromHost.slice(0, 7);
  try {
    return execSync('git rev-parse --short=7 HEAD', {stdio: ['ignore', 'pipe', 'ignore']}).toString().trim();
  } catch {
    return 'dev';
  }
})();

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    define: {
      __APP_COMMIT__: JSON.stringify(commit),
      __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      proxy: {
        '/api/ollama': {
          target: 'http://127.0.0.1:11434',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/ollama/, '/api'),
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch:
        process.env.DISABLE_HMR === 'true'
          ? null
          : {
              // Saved team state is rewritten constantly by the Express process.
              // Watching it full-page-reloads the login screen and snaps the
              // Admin Passcode tab back to Sign In.
              ignored: ['**/data/**', '**/dist/**', '**/*.test.ts', '**/*.test.tsx'],
            },
    },
  };
});
