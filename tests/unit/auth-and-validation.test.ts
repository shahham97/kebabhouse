import { describe, expect, it } from 'vitest';
import {
  resolveStaffPortalAccess,
  staffLoginSchema,
  customerRegisterSchema,
  checkoutValidationSchema,
} from '@/modules/auth/schemas';

describe('TDD Slice 1 & 2 — Role-Separated Auth & Form Validation Seams', () => {
  describe('Portal role access boundary (resolveStaffPortalAccess)', () => {
    it('allows Super Admin on /admin/login and routes to /admin', () => {
      const res = resolveStaffPortalAccess({
        portal: 'admin',
        isSuperAdmin: true,
        permissions: new Set(),
      });
      expect(res).toEqual({ allowed: true, redirectTo: '/admin' });
    });

    it('allows a Manager with dashboard.view on /admin/login', () => {
      const res = resolveStaffPortalAccess({
        portal: 'admin',
        isSuperAdmin: false,
        permissions: new Set(['dashboard.view']),
      });
      expect(res).toEqual({ allowed: true, redirectTo: '/admin' });
    });

    it('blocks Counter Staff (till-only) from /admin/login with clear redirect hint', () => {
      const res = resolveStaffPortalAccess({
        portal: 'admin',
        isSuperAdmin: false,
        permissions: new Set(['till.use', 'orders.create']),
      });
      expect(res.allowed).toBe(false);
      if (!res.allowed) {
        expect(res.reason).toMatch(/staff login/i);
        expect(res.suggestedRoute).toBe('/staff/login');
      }
    });

    it('blocks Kitchen Chef from /admin/login', () => {
      const res = resolveStaffPortalAccess({
        portal: 'admin',
        isSuperAdmin: false,
        permissions: new Set(['kitchen.view', 'kitchen.prepare']),
      });
      expect(res.allowed).toBe(false);
    });

    it('routes Counter Staff on /staff/login directly to /till', () => {
      const res = resolveStaffPortalAccess({
        portal: 'staff',
        isSuperAdmin: false,
        permissions: new Set(['till.use']),
      });
      expect(res).toEqual({ allowed: true, redirectTo: '/till' });
    });

    it('routes Kitchen Chef on /staff/login directly to /station/all', () => {
      const res = resolveStaffPortalAccess({
        portal: 'staff',
        isSuperAdmin: false,
        permissions: new Set(['kitchen.view', 'kitchen.prepare']),
      });
      expect(res).toEqual({ allowed: true, redirectTo: '/station/all' });
    });
  });

  describe('Shared form validation schemas', () => {
    it('rejects invalid staff email or short password', () => {
      const bad = staffLoginSchema.safeParse({ email: 'not-an-email', password: '123' });
      expect(bad.success).toBe(false);
      if (!bad.success) {
        const paths = bad.error.issues.map((i) => i.path[0]);
        expect(paths).toContain('email');
        expect(paths).toContain('password');
      }
    });

    it('validates Australian mobile phone and strong password on customer registration', () => {
      const bad = customerRegisterSchema.safeParse({
        name: 'O',
        email: 'bad-email',
        phone: '123',
        password: 'short',
      });
      expect(bad.success).toBe(false);

      const good = customerRegisterSchema.safeParse({
        name: 'Oliver Smith',
        email: 'oliver.smith@example.com.au',
        phone: '0412 345 678',
        password: 'Password123!',
      });
      expect(good.success).toBe(true);
    });

    it('requires 4-digit AU postcode and street address for delivery checkout', () => {
      const badDelivery = checkoutValidationSchema.safeParse({
        fulfilment: 'DELIVERY',
        customerName: 'Charlotte Taylor',
        customerPhone: '0412 345 678',
        customerEmail: 'charlotte@example.com.au',
        deliveryAddress: '',
        deliveryPostcode: '20',
      });
      expect(badDelivery.success).toBe(false);

      const goodPickup = checkoutValidationSchema.safeParse({
        fulfilment: 'PICKUP',
        customerName: 'Charlotte Taylor',
        customerPhone: '0412 345 678',
        customerEmail: 'charlotte@example.com.au',
      });
      expect(goodPickup.success).toBe(true);
    });
  });
});
