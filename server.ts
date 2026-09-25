import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { loadStateFromDisk } from './server/stateStore';
import { registerSessionRoutes } from './server/routes/session';
import { registerStateRoutes } from './server/routes/state';
import { registerLockRoutes } from './server/routes/locks';
import { registerPresenceRoutes } from './server/routes/presence';
import { registerAdminRoutes } from './server/routes/admin';
import { registerTeamSnapRoutes } from './server/routes/teamsnap';

dotenv.config();

async function startServer() {
  loadStateFromDisk();

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  registerSessionRoutes(app);
  registerStateRoutes(app);
  registerLockRoutes(app);
  registerPresenceRoutes(app);
  registerAdminRoutes(app);
  registerTeamSnapRoutes(app);

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: ['**/data/**', '**/dist/**'],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Football Operations Server running on port ${PORT}`);
  });
}

startServer();
