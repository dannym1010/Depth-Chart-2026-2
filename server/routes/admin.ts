import type { Express } from 'express';
import crypto from 'crypto';
import { isLoopbackRequest, requireOpsSession } from '../opsSession';
import { hashPasscode, verifyPasscode } from '../../src/utils/passcodeHash';
import { store, saveStateToDisk } from '../stateStore';
import { broadcastStateUpdate } from '../liveSync';
import { opsSessionOf } from '../staffAccess';

// Pending Admin Passcode Resets Storage
interface PendingAdminReset {
  email: string;
  expiresAt: number;
  attempts: number;
}
const pendingAdminResets = new Map<string, PendingAdminReset>();

export function registerAdminRoutes(app: Express) {
  app.post('/api/admin/passcode', requireOpsSession, (req, res) => {
    try {
      const session = opsSessionOf(req);
      const loopback = isLoopbackRequest(req);
      if (session.role !== 'admin' && !loopback) {
        return res.status(403).json({ error: 'Only an administrator can change the admin passcode.' });
      }
      const newPasscode = String(req.body?.newPasscode || '').trim();
      const currentPasscode = String(req.body?.currentPasscode || '').trim();
      if (newPasscode.length < 4) {
        return res.status(400).json({ error: 'New admin passcode must be at least 4 characters long.' });
      }
      const storedHash = String(store.state?.adminPasscodeHash || '').trim();
      if (storedHash && !loopback) {
        if (!currentPasscode || !verifyPasscode(currentPasscode, storedHash)) {
          return res.status(401).json({ error: 'Current admin passcode is incorrect.' });
        }
      }
      if (!store.state) store.state = {};
      store.state.adminPasscodeHash = hashPasscode(newPasscode);
      delete store.state.adminPasscode;
      saveStateToDisk({}, `admin_passcode:${session.email}`, {});
      broadcastStateUpdate({
        version: store.version,
        updatedAt: store.updatedAt,
        lastAuthor: session.email,
        state: store.state,
      });
      return res.json({ success: true, adminPasscodeSet: true });
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Failed to update admin passcode.' });
    }
  });

  // Secure Admin Passcode Reset Endpoints
  app.post('/api/admin/request-passcode-reset', (req, res) => {
    try {
      const email = (req.body.email || '').toString().toLowerCase().trim();
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Please provide a valid email address.' });
      }

      // Check against staff coaches in store.state
      const staffList = (store.state && Array.isArray(store.state.staffList)) ? store.state.staffList : [];
      const adminCoaches = staffList.filter((c: any) => {
        const role = (c.role || '').toLowerCase();
        return role.includes('head') || role.includes('admin');
      });

      // If registered head/admin coaches exist, ensure email is authorized
      if (adminCoaches.length > 0) {
        const isAuthorized = adminCoaches.some((c: any) => (c.email || '').toLowerCase().trim() === email);
        if (!isAuthorized) {
          return res.status(403).json({
            error: `The email "${email}" is not registered as an authorized Head Coach or Administrator. Please contact your Head Coach.`,
          });
        }
      }

      // Generate a 6-digit numeric verification code and a cryptographically secure token
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');
      const expiresAt = Date.now() + 15 * 60 * 1000;

      const resetData: PendingAdminReset = {
        email,
        expiresAt,
        attempts: 0,
      };

      for (const [key, item] of pendingAdminResets.entries()) {
        if (item.expiresAt < Date.now()) pendingAdminResets.delete(key);
      }

      pendingAdminResets.set(codeHash, resetData);

      const [userPart, domainPart] = email.split('@');
      const maskedUser = userPart.length <= 2 ? userPart : `${userPart[0]}***${userPart[userPart.length - 1]}`;
      const maskedEmail = `${maskedUser}@${domainPart}`;

      console.log(`[Server] Admin passcode reset requested for ${maskedEmail}.`);

      return res.json({
        success: true,
        message: `If that address is authorized, a verification code was issued. It is not returned by this API.`,
        maskedEmail,
      });
    } catch (err: any) {
      console.error('[Server] /api/admin/request-passcode-reset error:', err);
      return res.status(500).json({ error: 'Failed to process admin reset request.' });
    }
  });

  app.post('/api/admin/verify-passcode-reset', (req, res) => {
    try {
      const code = String(req.body?.code || '').trim();
      const trimmedPasscode = String(req.body?.newPasscode || '').trim();

      if (!code) {
        return res.status(400).json({ error: 'Missing verification code.' });
      }

      if (!trimmedPasscode || trimmedPasscode.length < 4) {
        return res.status(400).json({ error: 'New admin passcode must be at least 4 characters long.' });
      }

      const codeHash = crypto.createHash('sha256').update(code).digest('hex');
      const pending = pendingAdminResets.get(codeHash);
      if (!pending) {
        return res.status(400).json({ error: 'Invalid or expired verification code. Please request a new code.' });
      }

      if (pending.expiresAt < Date.now()) {
        pendingAdminResets.delete(codeHash);
        return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
      }

      pending.attempts = (pending.attempts || 0) + 1;
      if (pending.attempts > 6) {
        pendingAdminResets.delete(codeHash);
        return res.status(429).json({ error: 'Too many attempts. Please request a new reset code.' });
      }

      if (!store.state) {
        store.state = {};
      }
      store.state.adminPasscodeHash = hashPasscode(trimmedPasscode);
      delete store.state.adminPasscode;

      saveStateToDisk({}, `admin_reset:${pending.email}`, { resetEmail: pending.email });
      pendingAdminResets.delete(codeHash);

      broadcastStateUpdate({
        version: store.version,
        updatedAt: store.updatedAt,
        lastAuthor: `admin_reset:${pending.email}`,
        state: store.state,
      });

      console.log('[Server] Admin passcode reset verified.');

      return res.json({
        success: true,
        message: 'Admin passcode has been successfully updated and verified.',
        adminPasscodeSet: true,
      });
    } catch (err: any) {
      console.error('[Server] /api/admin/verify-passcode-reset error:', err);
      return res.status(500).json({ error: 'Failed to verify admin reset.' });
    }
  });
}
