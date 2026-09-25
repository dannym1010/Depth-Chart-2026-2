import express from 'express';
import { type OpsSession } from './opsSession';
import { store } from './stateStore';

export const staffRoleForEmail = (email: string): OpsSession['role'] => {
  const staffList = Array.isArray(store.state?.staffList) ? store.state.staffList : [];
  const coach = staffList.find(
    (c: any) => String(c?.email || '').toLowerCase().trim() === email
  );
  const role = String(coach?.role || '').toLowerCase();
  if (role.includes('head') || role.includes('admin')) return 'admin';
  return 'coach';
};

export const isStaffAllowedOnApi = (email: string, loopback: boolean): boolean => {
  const staffList = Array.isArray(store.state?.staffList) ? store.state.staffList : [];
  if (staffList.length === 0) return true;
  const coach = staffList.find(
    (c: any) => String(c?.email || '').toLowerCase().trim() === email
  );
  if (!coach) return loopback;
  if (String(coach.status || '') === 'Active') return true;
  return loopback;
};

export const opsSessionOf = (req: express.Request): OpsSession =>
  (req as express.Request & { opsSession: OpsSession }).opsSession;
