import type { Express } from 'express';
import { requireOpsSession } from '../opsSession';
import {
  broadcastLocks,
  activeLocks,
  cleanExpiredLocks,
  type ServerSectionLock,
} from '../liveSync';
import { opsSessionOf } from '../staffAccess';

export function registerLockRoutes(app: Express) {
  // Multi-Coach Section Lock Endpoints
  app.get('/api/locks', requireOpsSession, (req, res) => {
    cleanExpiredLocks();
    res.json({
      success: true,
      locks: Array.from(activeLocks.values()),
    });
  });

  app.post('/api/locks/acquire', requireOpsSession, (req, res) => {
    try {
      cleanExpiredLocks();
      const session = opsSessionOf(req);
      const { teamId, week, unit, holderName, force: forceRaw } = req.body;
      const holderEmail = session.email;
      const force = Boolean(forceRaw) && session.role === 'admin';
      if (!teamId || !week || !unit || !holderEmail) {
        return res.status(400).json({ error: 'Missing required lock fields.' });
      }

      const lockId = `${teamId}_wk${week}_${unit}`;
      const existing = activeLocks.get(lockId);
      const now = Date.now();

      if (existing && existing.expiresAt > now && existing.holderEmail !== holderEmail && !force) {
        return res.json({
          success: false,
          lockedByOther: true,
          existingLock: existing,
          message: `Locked by ${existing.holderName || existing.holderEmail}`,
        });
      }

      const newLock: ServerSectionLock = {
        id: lockId,
        teamId: String(teamId),
        week: String(week),
        unit: String(unit),
        holderEmail: String(holderEmail),
        holderName: String(holderName || session.email),
        acquiredAt: now,
        expiresAt: now + 90000, // 90 seconds lease
      };

      activeLocks.set(lockId, newLock);
      broadcastLocks();

      return res.json({
        success: true,
        lock: newLock,
        locks: Array.from(activeLocks.values()),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Lock acquire error' });
    }
  });

  app.post('/api/locks/release', requireOpsSession, (req, res) => {
    try {
      cleanExpiredLocks();
      const session = opsSessionOf(req);
      const { teamId, week, unit, force: forceRaw } = req.body;
      const holderEmail = session.email;
      const force = Boolean(forceRaw) && session.role === 'admin';
      const lockId = `${teamId}_wk${week}_${unit}`;
      const existing = activeLocks.get(lockId);

      if (existing) {
        if (existing.holderEmail === holderEmail || force) {
          activeLocks.delete(lockId);
          broadcastLocks();
        }
      }

      return res.json({
        success: true,
        locks: Array.from(activeLocks.values()),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Lock release error' });
    }
  });

  app.post('/api/locks/heartbeat', requireOpsSession, (req, res) => {
    try {
      cleanExpiredLocks();
      const session = opsSessionOf(req);
      const { teamId, week, unit } = req.body;
      const holderEmail = session.email;
      const lockId = `${teamId}_wk${week}_${unit}`;
      const existing = activeLocks.get(lockId);
      const now = Date.now();

      if (existing && existing.holderEmail === holderEmail) {
        existing.expiresAt = now + 90000;
        return res.json({
          success: true,
          lock: existing,
        });
      }

      return res.json({
        success: false,
        message: 'Lock not found or expired',
      });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Lock heartbeat error' });
    }
  });
}
