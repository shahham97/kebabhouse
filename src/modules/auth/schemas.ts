import { z } from 'zod';
import type { Permission } from '@/config/permissions';

export type StaffPortalKind = 'admin' | 'staff';

export type PortalAccessDecision =
  | { allowed: true; redirectTo: string }
  | { allowed: false; reason: string; suggestedRoute: string };

/**
 * Enforces role separation between the Admin Portal (/admin/login)
 * and the Operational Staff Portal (/staff/login for Till & Kitchen).
 */
export function resolveStaffPortalAccess(args: {
  portal: StaffPortalKind;
  isSuperAdmin: boolean;
  permissions: Set<Permission | string>;
}): PortalAccessDecision {
  const isAdminCapable = args.isSuperAdmin || args.permissions.has('dashboard.view');

  if (args.portal === 'admin') {
    if (!isAdminCapable) {
      return {
        allowed: false,
        reason:
          'This login is for Administrators & Managers only. Please use the Staff Login portal for Till & Kitchen access.',
        suggestedRoute: '/staff/login',
      };
    }
    return { allowed: true, redirectTo: '/admin' };
  }

  // Operational staff portal (/staff/login)
  if (args.permissions.has('till.use') || args.isSuperAdmin) {
    return { allowed: true, redirectTo: '/till' };
  }
  if (args.permissions.has('kitchen.view') || args.permissions.has('kitchen.prepare')) {
    return { allowed: true, redirectTo: '/station/all' };
  }
  return { allowed: true, redirectTo: '/admin' };
}

/** Shared Zod schema for Admin & Staff login forms (client + server). */
export const staffLoginSchema = z.object({
  email: z.string().trim().email('Please enter a valid work email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  portal: z.enum(['admin', 'staff']).optional().default('staff'),
});

/** Shared Zod schema for 4–6 digit Till PIN quick-switch. */
export const staffPinSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4 to 6 digits'),
});

/** Australian mobile/landline phone validator (e.g. 0412 345 678 or (02) 9876 5432). */
export const auPhoneSchema = z
  .string()
  .trim()
  .refine(
    (v) => {
      const digits = v.replace(/\D/g, '');
      return digits.length >= 8 && digits.length <= 12;
    },
    { message: 'Enter a valid Australian phone number (e.g. 0412 345 678)' }
  );

/** Shared Zod schema for Customer Registration. */
export const customerRegisterSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your full name (at least 2 characters)').max(100),
  email: z.string().trim().email('Please enter a valid email address'),
  phone: auPhoneSchema,
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/** Shared Zod schema for Customer Login. */
export const customerLoginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(1, 'Please enter your password'),
});

/** Shared Zod schema for Storefront Checkout form validation. */
export const checkoutValidationSchema = z
  .object({
    fulfilment: z.enum(['PICKUP', 'DELIVERY']),
    customerName: z.string().trim().min(2, 'Full name is required (at least 2 characters)'),
    customerPhone: auPhoneSchema,
    customerEmail: z.string().trim().email('A valid email is required for your tax invoice'),
    deliveryAddress: z.string().trim().optional(),
    deliverySuburb: z.string().trim().optional(),
    deliveryPostcode: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.fulfilment === 'DELIVERY') {
      if (!data.deliveryAddress || data.deliveryAddress.length < 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['deliveryAddress'],
          message: 'Please enter your street address for delivery',
        });
      }
      if (!data.deliveryPostcode || !/^\d{4}$/.test(data.deliveryPostcode)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['deliveryPostcode'],
          message: 'Enter a valid 4-digit Australian postcode (e.g. 2042)',
        });
      }
    }
  });
