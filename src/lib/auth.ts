import 'server-only';
import { cookies, headers } from 'next/headers';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { cache } from 'react';
import { db } from './db';
import { ForbiddenError, UnauthorizedError } from './errors';
import { ALL_PERMISSION_KEYS, type Permission } from '@/config/permissions';

export const STAFF_COOKIE = 'sk_staff_session';
export const CUSTOMER_COOKIE = 'sk_cust_session';
export const DEVICE_COOKIE = 'sk_device_token';

const SESSION_CACHE_TTL_MS = 20_000;
const staffSessionCache = new Map<string, { actor: StaffActor; expiresAt: number }>();
const customerSessionCache = new Map<string, { actor: CustomerActor; expiresAt: number }>();

export function invalidateStaffSessionCache(tokenHash?: string) {
  if (tokenHash) {
    staffSessionCache.delete(tokenHash);
  } else {
    staffSessionCache.clear();
  }
}

export function invalidateCustomerSessionCache(tokenHash?: string) {
  if (tokenHash) {
    customerSessionCache.delete(tokenHash);
  } else {
    customerSessionCache.clear();
  }
}

export interface StaffActor {
  type: 'staff';
  id: string;
  storeId: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  isSuperAdmin: boolean;
  maxDiscountPct: number;
  permissions: Set<Permission>;
  key: string;
}

export interface CustomerActor {
  type: 'customer';
  id: string;
  name: string;
  email: string;
  key: string;
}

export interface AnonymousActor {
  type: 'anonymous';
  id: null;
  key: string;
}

export type Actor = StaffActor | CustomerActor | AnonymousActor;

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function hashSecret(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifySecret(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    return h.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
  } catch {
    return '127.0.0.1';
  }
}

export const getStaffActor = cache(async (): Promise<StaffActor | null> => {
  try {
    const store = await cookies();
    const raw = store.get(STAFF_COOKIE)?.value;
    if (!raw) return null;

    const hashed = hashToken(raw);
    const cached = staffSessionCache.get(hashed);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.actor;
    }

    const session = await db.staffSession.findUnique({
      where: { tokenHash: hashed },
      include: {
        staffUser: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
            grants: { include: { permission: true } },
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      staffSessionCache.delete(hashed);
      return null;
    }
    const u = session.staffUser;
    if (!u.active || u.sessionVersion !== session.sessionVersion) {
      staffSessionCache.delete(hashed);
      return null;
    }

    const perms = new Set<Permission>();
    if (u.role.isSystem) {
      for (const k of ALL_PERMISSION_KEYS) perms.add(k);
    } else {
      for (const rp of u.role.permissions) perms.add(rp.permission.key as Permission);
      for (const g of u.grants) perms.add(g.permission.key as Permission);
    }

    const actor: StaffActor = {
      type: 'staff',
      id: u.id,
      storeId: u.storeId,
      name: u.name,
      email: u.email,
      roleId: u.roleId,
      roleName: u.role.name,
      isSuperAdmin: u.role.isSystem,
      maxDiscountPct: u.role.maxDiscountPct,
      permissions: perms,
      key: `staff:${u.id}`,
    };
    staffSessionCache.set(hashed, { actor, expiresAt: Date.now() + SESSION_CACHE_TTL_MS });
    return actor;
  } catch {
    return null;
  }
});

export const getCustomerActor = cache(async (): Promise<CustomerActor | null> => {
  try {
    const store = await cookies();
    const raw = store.get(CUSTOMER_COOKIE)?.value;
    if (!raw) return null;

    const hashed = hashToken(raw);
    const cached = customerSessionCache.get(hashed);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.actor;
    }

    const session = await db.customerSession.findUnique({
      where: { tokenHash: hashed },
      include: { customer: true },
    });

    if (!session || session.expiresAt < new Date()) {
      customerSessionCache.delete(hashed);
      return null;
    }
    if (session.customer.sessionVersion !== session.sessionVersion) {
      customerSessionCache.delete(hashed);
      return null;
    }

    const actor: CustomerActor = {
      type: 'customer',
      id: session.customer.id,
      name: session.customer.name,
      email: session.customer.email,
      key: `cust:${session.customer.id}`,
    };
    customerSessionCache.set(hashed, { actor, expiresAt: Date.now() + SESSION_CACHE_TTL_MS });
    return actor;
  } catch {
    return null;
  }
});

export async function getActor(): Promise<Actor> {
  const staff = await getStaffActor();
  if (staff) return staff;
  const customer = await getCustomerActor();
  if (customer) return customer;
  const ip = await getClientIp();
  return { type: 'anonymous', id: null, key: `ip:${ip}` };
}

export function assertPermission(actor: Actor, required: Permission | 'public' | 'customer' | 'staff'): void {
  if (required === 'public') return;
  if (required === 'customer') {
    if (actor.type !== 'customer' && actor.type !== 'staff') {
      throw new UnauthorizedError('Please sign in to continue');
    }
    return;
  }
  if (actor.type !== 'staff') {
    throw new UnauthorizedError('Staff sign-in required');
  }
  if (required === 'staff') return;
  if (!actor.isSuperAdmin && !actor.permissions.has(required)) {
    throw new ForbiddenError(`Missing permission: ${required}`);
  }
}

export async function requireStaff(permission?: Permission): Promise<StaffActor> {
  const staff = await getStaffActor();
  if (!staff) throw new UnauthorizedError('Staff sign-in required');
  if (permission && !staff.isSuperAdmin && !staff.permissions.has(permission)) {
    throw new ForbiddenError(`Missing permission: ${permission}`);
  }
  return staff;
}

export async function createStaffSession(staffUserId: string, sessionVersion: number, deviceId?: string) {
  const raw = generateToken();
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12h
  const ip = await getClientIp();

  await db.staffSession.create({
    data: {
      tokenHash: hashToken(raw),
      staffUserId,
      sessionVersion,
      deviceId,
      expiresAt,
      ip,
    },
  });

  const isHttps = process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://') ?? false;
  const c = await cookies();
  c.set(STAFF_COOKIE, raw, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && isHttps,
    path: '/',
    expires: expiresAt,
  });
}

export async function destroyStaffSession() {
  const c = await cookies();
  const raw = c.get(STAFF_COOKIE)?.value;
  if (raw) {
    const hashed = hashToken(raw);
    invalidateStaffSessionCache(hashed);
    await db.staffSession.deleteMany({ where: { tokenHash: hashed } });
  }
  c.delete(STAFF_COOKIE);
}

export async function createCustomerSession(customerId: string, sessionVersion: number) {
  const raw = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30d

  await db.customerSession.create({
    data: {
      tokenHash: hashToken(raw),
      customerId,
      sessionVersion,
      expiresAt,
    },
  });

  const isHttps = process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://') ?? false;
  const c = await cookies();
  c.set(CUSTOMER_COOKIE, raw, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && isHttps,
    path: '/',
    expires: expiresAt,
  });
}

export async function destroyCustomerSession() {
  const c = await cookies();
  const raw = c.get(CUSTOMER_COOKIE)?.value;
  if (raw) {
    const hashed = hashToken(raw);
    invalidateCustomerSessionCache(hashed);
    await db.customerSession.deleteMany({ where: { tokenHash: hashed } });
  }
  c.delete(CUSTOMER_COOKIE);
}

export function signTrackingToken(publicId: string): string {
  const secret = process.env.APP_SECRET || 'star-kebab-dev-secret-change-in-prod';
  return crypto.createHmac('sha256', secret).update(publicId).digest('hex').slice(0, 24);
}
