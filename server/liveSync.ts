import express from 'express';
import { sanitizeStateSecrets } from '../src/utils/passcodeHash';

// Multi-coach section lock storage
export interface ServerSectionLock {
  id: string; // e.g. "team_10u_week_1_offense"
  teamId: string;
  week: string;
  unit: string;
  holderEmail: string;
  holderName: string;
  acquiredAt: number;
  expiresAt: number;
}

// Active User / Coach Presence Tracking
export interface ActiveUserSession {
  clientId: string;
  email: string;
  displayName: string;
  role: string;
  activeTeamId: string;
  activeUnit: string;
  currentWeek: string;
  connectedAt: number;
  lastSeen: number;
  isIdle?: boolean;
}
export const activeSessions = new Map<string, ActiveUserSession>();

export function cleanExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of activeSessions.entries()) {
    // 2 minutes inactivity timeout for presence
    if (now - session.lastSeen > 120000) {
      activeSessions.delete(id);
    }
  }
}

export function broadcastPresence() {
  cleanExpiredSessions();
  const sessionsArray = Array.from(activeSessions.values());
  const payload = `data: ${JSON.stringify({ type: 'presence_update', users: sessionsArray })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

export const activeLocks = new Map<string, ServerSectionLock>();

export function cleanExpiredLocks() {
  const now = Date.now();
  for (const [id, lock] of activeLocks.entries()) {
    if (lock.expiresAt <= now) {
      activeLocks.delete(id);
    }
  }
}

export function broadcastLocks() {
  cleanExpiredLocks();
  const locksArray = Array.from(activeLocks.values());
  const payload = `data: ${JSON.stringify({ type: 'locks_update', locks: locksArray })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Active Server-Sent Events clients for live multi-coach sync
export const sseClients = new Set<express.Response>();

export function broadcastStateUpdate(data: any, senderClientId?: string) {
  const safe = { ...data, state: sanitizeStateSecrets(data?.state) };
  const message = `data: ${JSON.stringify({ type: 'sync', ...safe })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
      if (typeof (client as any).flush === 'function') {
        (client as any).flush();
      }
    } catch (err) {
      sseClients.delete(client);
    }
  }
}
