export interface PermissionDef {
  key: string;
  module: string;
  label: string;
  description: string;
}

export const PERMISSIONS = [
  { key: 'dashboard.view', module: 'dashboard', label: 'View Dashboard', description: 'Access KPI dashboard and analytics' },
  { key: 'orders.view', module: 'orders', label: 'View All Orders', description: 'View live orders board across all staff' },
  { key: 'orders.view_own', module: 'orders', label: 'View Own Orders', description: 'View orders created by self' },
  { key: 'orders.create', module: 'orders', label: 'Create Orders', description: 'Create walk-in, phone, dine-in orders' },
  { key: 'orders.cancel', module: 'orders', label: 'Cancel Orders', description: 'Cancel orders before completion' },
  { key: 'orders.refund', module: 'orders', label: 'Refund Orders', description: 'Issue full or partial refunds' },
  { key: 'orders.serve', module: 'orders', label: 'Serve Dine-in', description: 'Mark dine-in orders as served' },
  { key: 'orders.dispatch', module: 'orders', label: 'Collect / Dispatch', description: 'Mark pickup collected or delivery dispatched' },
  { key: 'orders.history.view', module: 'orders', label: 'View Order History', description: 'Access completed/cancelled order history' },
  { key: 'till.use', module: 'till', label: 'Use Till / POS', description: 'Operate the Till POS and order board' },
  { key: 'till.mark_all_ready', module: 'till', label: 'Mark All Ready', description: 'Override station tickets from the Till checklist' },
  { key: 'payments.take', module: 'payments', label: 'Take Payments', description: 'Record cash/EFTPOS/split payments at the Till' },
  { key: 'payments.configure', module: 'payments', label: 'Configure Stripe', description: 'Manage Stripe keys and surcharge rules' },
  { key: 'kitchen.view', module: 'kitchen', label: 'View Kitchen Screens', description: 'View station KDS tickets' },
  { key: 'kitchen.prepare', module: 'kitchen', label: 'Prepare / Ready Tickets', description: 'Tap Preparing and Ready on kitchen tickets' },
  { key: 'kitchen.recall', module: 'kitchen', label: 'Recall Ready Tickets', description: 'Undo a Ready ticket back to Preparing' },
  { key: 'kitchen.configure', module: 'kitchen', label: 'Configure Stations', description: 'Add, rename, reorder kitchen stations' },
  { key: 'catalog.manage', module: 'catalog', label: 'Manage Catalogue', description: 'Manage categories, products, variants, modifiers, 86' },
  { key: 'inventory.view', module: 'inventory', label: 'View Inventory', description: 'View ingredients, recipes, and stock ledger' },
  { key: 'inventory.adjust', module: 'inventory', label: 'Adjust Inventory', description: 'Post stocktake counts, waste, and adjustments' },
  { key: 'vendors.manage', module: 'purchasing', label: 'Manage Vendors', description: 'Create and edit suppliers' },
  { key: 'purchasing.receive', module: 'purchasing', label: 'Purchase & Receive', description: 'Create POs and receive supplier deliveries' },
  { key: 'deals.manage', module: 'deals', label: 'Manage Deals & Coupons', description: 'Create combos, coupons, and loyalty rules' },
  { key: 'customers.view', module: 'customers', label: 'View Customers', description: 'View customer profiles and loyalty points' },
  { key: 'billing.manage', module: 'billing', label: 'Manage Receipts', description: 'Edit AU GST tax invoice templates' },
  { key: 'finance.view', module: 'finance', label: 'View Finance', description: 'View inflows, outflows, expenses, Z-report' },
  { key: 'finance.export', module: 'finance', label: 'Export Finance', description: 'Export financial data to CSV' },
  { key: 'discounts.apply', module: 'till', label: 'Apply Discounts', description: 'Apply manual discounts up to role max %' },
  { key: 'cms.manage', module: 'cms', label: 'Manage Website CMS', description: 'Edit header, footer, announcements, home blocks' },
  { key: 'staff.manage', module: 'staff', label: 'Manage Staff', description: 'Create/disable staff and reset PINs' },
  { key: 'roles.manage', module: 'roles', label: 'Manage Roles', description: 'Create dynamic roles and edit permissions' },
  { key: 'devices.manage', module: 'devices', label: 'Manage Devices', description: 'Pair Till and Station KDS devices' },
  { key: 'settings.manage', module: 'settings', label: 'Manage Settings', description: 'Edit store info, hours, zones, branding, solo mode' },
  { key: 'audit.view', module: 'audit', label: 'View Audit Log', description: 'Inspect immutable staff audit trail' },
] as const satisfies readonly PermissionDef[];

export type Permission = (typeof PERMISSIONS)[number]['key'];
export const ALL_PERMISSION_KEYS: Permission[] = PERMISSIONS.map((p) => p.key);
