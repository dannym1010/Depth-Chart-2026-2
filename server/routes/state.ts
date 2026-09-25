import type { Express } from 'express';
import { requireOpsSession } from '../opsSession';
import { sanitizeStateSecrets } from '../../src/utils/passcodeHash';
import { applyHudlScoutPatch, normalizeScoutWeekKey } from '../../src/utils/remoteStateMerge';
import { store, saveStateToDisk } from '../stateStore';
import {
  sseClients,
  broadcastStateUpdate,
  activeSessions,
  activeLocks,
  cleanExpiredSessions,
  cleanExpiredLocks,
} from '../liveSync';

export function registerStateRoutes(app: Express) {
  // State Persistence: Get current server-side state
  app.get('/api/hudl-scout', requireOpsSession, (req, res) => {
    const teamId = String(req.query.teamId || 'team_10u');
    const week = normalizeScoutWeekKey(String(req.query.week || '1'));
    const scoped = `${teamId}__week_${week}`;
    const weekState =
      store.state?.weeklyData?.[scoped] ||
      store.state?.weeklyData?.[week] ||
      {};
    res.json({
      success: true,
      opponentScout: weekState?.scouting?.hudlScout || null,
      ownTeamScout: store.state?.ownTeamHudlScout?.[teamId] || store.state?.ownTeamHudlScout?.team_10u || null,
    });
  });

  app.post('/api/hudl-scout', requireOpsSession, (req, res) => {
    try {
      const { teamId, week, opponentScout, ownTeamScout } = req.body || {};
      store.state = applyHudlScoutPatch(store.state || {}, {
        teamId: teamId || 'team_10u',
        week: week || '1',
        opponentScout,
        ownTeamScout,
      });
      const saveResult = saveStateToDisk(store.state, (req as any).opsSession?.email || 'coach', {
        scope: 'hudl_scout_update',
        activeUnit: 'hudl_scout',
        activeTeamId: teamId || 'team_10u',
        currentWeek: normalizeScoutWeekKey(String(week || '1')),
      });
      if (!saveResult.success) {
        return res.status(500).json({ error: 'Failed to save Hudl Scout.' });
      }
      broadcastStateUpdate({
        version: store.version,
        updatedAt: store.updatedAt,
        lastAuthor: (req as any).opsSession?.email || 'coach',
        state: store.state,
        metadata: { scope: 'hudl_scout_update' },
      });
      return res.json({ success: true, version: store.version, updatedAt: store.updatedAt });
    } catch (err: any) {
      console.error('[Server] /api/hudl-scout POST error:', err);
      return res.status(500).json({ error: err?.message || 'Hudl Scout save error' });
    }
  });

  app.get('/api/state', requireOpsSession, (req, res) => {
    res.json({
      success: true,
      hasData: !!store.state,
      version: store.version,
      updatedAt: store.updatedAt,
      state: sanitizeStateSecrets(store.state),
    });
  });

  // State Persistence: Save full or scoped state from any coach
  app.post('/api/state', requireOpsSession, (req, res) => {
    try {
      const { state, author, clientId, metadata } = req.body;
      if (!state || typeof state !== 'object') {
        return res.status(400).json({ error: 'Missing or invalid state payload.' });
      }

      const saveResult = saveStateToDisk(state, author || 'coach', metadata);
      if (!saveResult.success) {
        return res.status(500).json({ error: 'Failed to save state to server disk.' });
      }

      // Broadcast to other open browser tabs / coaches
      broadcastStateUpdate({
        version: store.version,
        updatedAt: store.updatedAt,
        lastAuthor: author,
        state: store.state,
        senderClientId: clientId,
        metadata,
      });

      return res.json({
        success: true,
        version: store.version,
        updatedAt: store.updatedAt,
      });
    } catch (err: any) {
      console.error('[Server] /api/state POST error:', err);
      return res.status(500).json({ error: err?.message || 'Server save error' });
    }
  });

  // Real-time SSE Endpoint for multi-coach live sync
  app.get('/api/state/events', requireOpsSession, (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    cleanExpiredLocks();
    cleanExpiredSessions();
    const initialPayload = {
      type: 'connected',
      version: store.version,
      updatedAt: store.updatedAt,
      locks: Array.from(activeLocks.values()),
      activeUsers: Array.from(activeSessions.values()),
    };
    res.write(`data: ${JSON.stringify(initialPayload)}\n\n`);
    if (typeof (res as any).flush === 'function') {
      (res as any).flush();
    }

    sseClients.add(res);

    // Heartbeat ping every 15 seconds to keep connection alive through proxies
    const heartbeat = setInterval(() => {
      try {
        res.write(`: ping\n\n`);
        if (typeof (res as any).flush === 'function') {
          (res as any).flush();
        }
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });
}
