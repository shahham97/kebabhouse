import type { Permission } from './permissions';

export interface ModuleDef {
  key: string;
  label: string;
  href: string;
  icon: string;
  permission: Permission;
  group: 'Operations' | 'Catalogue & Stock' | 'Growth & Finance' | 'System';
}

export const ADMIN_MODULES = [
  { key: 'dashboard', label: 'Dashboard', href: '/admin', icon: 'LayoutDashboard', permission: 'dashboard.view', group: 'Operations' },
  { key: 'orders', label: 'Live Orders', href: '/admin/orders', icon: 'Receipt', permission: 'orders.view', group: 'Operations' },
  { key: 'till', label: 'Open Till / POS', href: '/till', icon: 'MonitorSmartphone', permission: 'till.use', group: 'Operations' },
  { key: 'stations', label: 'Kitchen Stations', href: '/admin/stations', icon: 'Flame', permission: 'kitchen.configure', group: 'Operations' },
  { key: 'catalog', label: 'Catalogue & Menu', href: '/admin/catalog', icon: 'UtensilsCrossed', permission: 'catalog.manage', group: 'Catalogue & Stock' },
  { key: 'inventory', label: 'Inventory & Recipes', href: '/admin/inventory', icon: 'Boxes', permission: 'inventory.view', group: 'Catalogue & Stock' },
  { key: 'purchasing', label: 'Vendors & POs', href: '/admin/purchasing', icon: 'Truck', permission: 'vendors.manage', group: 'Catalogue & Stock' },
  { key: 'deals', label: 'Deals & Coupons', href: '/admin/deals', icon: 'Tag', permission: 'deals.manage', group: 'Growth & Finance' },
  { key: 'customers', label: 'Customers & Loyalty', href: '/admin/customers', icon: 'Users', permission: 'customers.view', group: 'Growth & Finance' },
  { key: 'finance', label: 'Finance & Cash', href: '/admin/finance', icon: 'Landmark', permission: 'finance.view', group: 'Growth & Finance' },
  { key: 'cms', label: 'Website & CMS', href: '/admin/cms', icon: 'Globe', permission: 'cms.manage', group: 'System' },
  { key: 'staff', label: 'Staff & PINs', href: '/admin/staff', icon: 'UserCog', permission: 'staff.manage', group: 'System' },
  { key: 'roles', label: 'Roles & Permissions', href: '/admin/roles', icon: 'ShieldCheck', permission: 'roles.manage', group: 'System' },
  { key: 'audit', label: 'Audit Log', href: '/admin/audit', icon: 'FileSearch', permission: 'audit.view', group: 'System' },
  { key: 'settings', label: 'Store & Branding', href: '/admin/settings', icon: 'Settings', permission: 'settings.manage', group: 'System' },
] as const satisfies readonly ModuleDef[];
