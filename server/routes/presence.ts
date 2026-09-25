import type { Express } from 'express';
import { requireOpsSession } from '../opsSession';
import {
  broadcastPresence,
  broadcastLocks,
  activeSessions,
  activeLocks,
  cleanExpiredSessions,
} from '../liveSync';
import { opsSessionOf } from '../staffAccess';

export function registerPresenceRoutes(app: Express) {
  // Active User Presence Endpoints
  app.get('/api/presence', requireOpsSession, (req, res) => {
    cleanExpiredSessions();
    res.json({
      success: true,
      users: Array.from(activeSessions.values()),
    });
  });

  app.post('/api/presence', requireOpsSession, (req, res) => {
    try {
      cleanExpiredSessions();
      const session = opsSessionOf(req);
      const { clientId, displayName, role, activeTeamId, activeUnit, currentWeek, isIdle } = req.body || {};
      const email = session.email;
      if (!clientId && !email) {
        return res.status(400).json({ error: 'clientId or email is required.' });
      }
      const id = clientId || email;
      const now = Date.now();
      const existing = activeSessions.get(id);

      activeSessions.set(id, {
        clientId: id,
        email,
        displayName: String(displayName || email.split('@')[0] || 'Coach'),
        role: String(role || (session.role === 'admin' ? 'Head Coach / Admin' : 'Coach')),
        activeTeamId: String(activeTeamId || 'team_10u'),
        activeUnit: String(activeUnit || 'depth_chart'),
        currentWeek: String(currentWeek || '0'),
        connectedAt: existing ? existing.connectedAt : now,
        lastSeen: now,
        isIdle: Boolean(isIdle),
      });

      broadcastPresence();

      return res.json({
        success: true,
        users: Array.from(activeSessions.values()),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Presence update error' });
    }
  });

  app.post('/api/presence/leave', requireOpsSession, (req, res) => {
    try {
      const session = opsSessionOf(req);
      const { clientId } = req.body || {};
      const email = session.email;
      if (clientId) activeSessions.delete(clientId);
      if (email) {
        const cleanEmail = email.toLowerCase().trim();
        for (const [key, session] of activeSessions.entries()) {
          if (session.email.toLowerCase().trim() === cleanEmail) {
            activeSessions.delete(key);
          }
        }
        // Also release any locks held by this user
        for (const [lockId, lock] of activeLocks.entries()) {
          if (lock.holderEmail.toLowerCase().trim() === cleanEmail) {
            activeLocks.delete(lockId);
          }
        }
        broadcastLocks();
      }
      broadcastPresence();
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Presence leave error' });
    }
  });
}
