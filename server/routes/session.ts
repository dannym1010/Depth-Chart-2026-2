import type { Express } from 'express';
import {
  allowLoginAttempt,
  clearOpsSessionCookie,
  createOpsSession,
  destroyOpsSession,
  getOpsSession,
  isLoopbackRequest,
  readOpsSessionToken,
  setOpsSessionCookie,
  verifyFirebaseIdToken,
  type OpsSession,
} from '../opsSession';
import { hashPasscode, hasPasscodeConfigured, verifyPasscode } from '../../src/utils/passcodeHash';
import { store, saveStateToDisk } from '../stateStore';
import { sseClients } from '../liveSync';
import { staffRoleForEmail, isStaffAllowedOnApi } from '../staffAccess';

export function registerSessionRoutes(app: Express) {
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      stateVersion: store.version,
      stateUpdatedAt: store.updatedAt,
      hasCachedState: !!store.state,
      connectedClients: sseClients.size,
      adminPasscodeSet: hasPasscodeConfigured(store.state),
    });
  });

  app.post('/api/session/login', async (req, res) => {
    try {
      if (!allowLoginAttempt(req)) {
        return res.status(429).json({ error: 'Too many sign-in attempts. Try again shortly.' });
      }

      const method = String(req.body?.method || '');
      const loopback = isLoopbackRequest(req);
      let email = '';
      let role: OpsSession['role'] = 'coach';

      if (method === 'local_developer') {
        if (!loopback) {
          return res.status(403).json({ error: 'Local developer sign-in is only allowed on this computer.' });
        }
        email = 'developer@localhost';
        role = 'admin';
      } else if (method === 'passcode') {
        const passcode = String(req.body?.passcode || '').trim();
        const storedHash = String(store.state?.adminPasscodeHash || '').trim();
        if (storedHash) {
          if (!passcode || !verifyPasscode(passcode, storedHash)) {
            return res.status(401).json({ error: 'Incorrect admin passcode.' });
          }
        } else {
          if (!loopback) {
            return res.status(401).json({ error: 'Admin passcode is not set.' });
          }
          if (passcode.length < 4) {
            return res.status(400).json({ error: 'Admin passcode must be at least 4 characters.' });
          }
          if (!store.state) store.state = {};
          store.state.adminPasscodeHash = hashPasscode(passcode);
          delete store.state.adminPasscode;
          saveStateToDisk({}, 'admin_passcode_bootstrap', {});
        }
        email = 'admin@coachportal.local';
        role = 'admin';
      } else if (method === 'firebase') {
        const verifiedEmail = await verifyFirebaseIdToken(String(req.body?.idToken || ''));
        if (!verifiedEmail) {
          return res.status(401).json({ error: 'Invalid or expired Google/Firebase sign-in.' });
        }
        if (!isStaffAllowedOnApi(verifiedEmail, loopback)) {
          return res.status(403).json({ error: 'This account is not approved for team data access.' });
        }
        email = verifiedEmail;
        role = staffRoleForEmail(verifiedEmail);
      } else if (method === 'loopback') {
        if (!loopback) {
          return res.status(403).json({ error: 'This sign-in method is only allowed on this computer.' });
        }
        email = String(req.body?.email || '').toLowerCase().trim();
        if (!email.includes('@')) {
          return res.status(400).json({ error: 'A valid email is required.' });
        }
        role = staffRoleForEmail(email);
      } else {
        return res.status(400).json({ error: 'Unknown sign-in method.' });
      }

      const token = createOpsSession(email, role);
      setOpsSessionCookie(res, token);
      return res.json({ success: true, email, role });
    } catch (err: any) {
      console.error('[Server] /api/session/login error:', err);
      return res.status(500).json({ error: 'Failed to create session.' });
    }
  });

  app.post('/api/session/logout', (req, res) => {
    destroyOpsSession(readOpsSessionToken(req));
    clearOpsSessionCookie(res);
    return res.json({ success: true });
  });

  app.get('/api/session/me', (req, res) => {
    const session = getOpsSession(req);
    if (!session) {
      return res.status(401).json({ error: 'Sign in required.' });
    }
    return res.json({ success: true, email: session.email, role: session.role });
  });
}
