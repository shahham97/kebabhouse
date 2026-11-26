'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Receipt,
  MonitorSmartphone,
  Flame,
  UtensilsCrossed,
  Boxes,
  Truck,
  Tag,
  Users,
  Landmark,
  Globe,
  UserCog,
  ShieldCheck,
  FileSearch,
  Settings,
  Store,
  LogOut,
  Menu,
  X,
  ChefHat,
  type LucideIcon,
} from 'lucide-react';
import type { ModuleDef } from '@/config/modules';
import { adminLogoutAction } from '@/modules/admin/actions';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Receipt,
  MonitorSmartphone,
  Flame,
  UtensilsCrossed,
  Boxes,
  Truck,
  Tag,
  Users,
  Landmark,
  Globe,
  UserCog,
  ShieldCheck,
  FileSearch,
  Settings,
};

const GROUP_ORDER: ModuleDef['group'][] = [
  'Operations',
  'Catalogue & Stock',
  'Growth & Finance',
  'System',
];

interface AdminShellProps {
  modules: ModuleDef[];
  staffName: string;
  roleName: string;
  isSuperAdmin: boolean;
  children: React.ReactNode;
}

export function AdminShell({
  modules,
  staffName,
  roleName,
  isSuperAdmin,
  children,
}: AdminShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    items: modules.filter((m) => m.group === group),
  })).filter((g) => g.items.length > 0);

  const handleLogout = () => {
    startTransition(async () => {
      await adminLogoutAction();
    });
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-char text-cream">
      {/* Brand header */}
      <div className="flex items-center justify-between border-b border-char-soft px-5 py-4">
        <Link href="/admin" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ember font-display text-lg font-bold text-cream">
            SK
          </div>
          <div>
            <div className="font-display text-lg font-bold leading-tight tracking-tight text-cream">
              Star Kebab
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-saffron">
              Admin Portal
            </div>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-1.5 text-cream/70 hover:bg-char-soft hover:text-cream lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Staff badge */}
      <div className="border-b border-char-soft px-5 py-3">
        <div className="truncate text-sm font-semibold text-cream">{staffName}</div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-char-soft px-2 py-0.5 font-mono text-[11px] text-saffron">
            {roleName}
          </span>
          {isSuperAdmin && (
            <span className="rounded-md bg-ember/25 px-1.5 py-0.5 font-mono text-[10px] uppercase text-cream">
              All Access
            </span>
          )}
        </div>
      </div>

      {/* Permission-filtered navigation */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {grouped.map(({ group, items }) => (
          <div key={group}>
            <div className="px-3 pb-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-cream/50">
              {group}
            </div>
            <ul className="space-y-1">
              {items.map((mod) => {
                const Icon = ICON_MAP[mod.icon] ?? LayoutDashboard;
                const isActive =
                  mod.href === '/admin'
                    ? pathname === '/admin'
                    : pathname === mod.href || pathname.startsWith(`${mod.href}/`);
                return (
                  <li key={mod.key}>
                    <Link
                      href={mod.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition',
                        isActive
                          ? 'bg-ember text-cream shadow-sm'
                          : 'text-cream/80 hover:bg-char-soft hover:text-cream'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{mod.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Quick launch & Logout */}
      <div className="border-t border-char-soft p-3 space-y-2">
        <div className="grid grid-cols-3 gap-1.5">
          <Link
            href="/"
            className="flex flex-col items-center justify-center rounded-lg bg-char-soft px-2 py-2 text-[11px] font-medium text-cream/85 transition hover:bg-ember/25 hover:text-cream"
          >
            <Store className="mb-1 h-3.5 w-3.5 text-saffron" />
            Store
          </Link>
          <Link
            href="/till"
            className="flex flex-col items-center justify-center rounded-lg bg-char-soft px-2 py-2 text-[11px] font-medium text-cream/85 transition hover:bg-ember/25 hover:text-cream"
          >
            <MonitorSmartphone className="mb-1 h-3.5 w-3.5 text-saffron" />
            Till
          </Link>
          <Link
            href="/station/all"
            className="flex flex-col items-center justify-center rounded-lg bg-char-soft px-2 py-2 text-[11px] font-medium text-cream/85 transition hover:bg-ember/25 hover:text-cream"
          >
            <ChefHat className="mb-1 h-3.5 w-3.5 text-saffron" />
            Kitchen
          </Link>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-char-soft bg-char-soft/60 px-3 py-2 text-xs font-semibold text-cream/85 transition hover:bg-chilli hover:text-cream disabled:opacity-60"
        >
          <LogOut className="h-3.5 w-3.5" />
          {isPending ? 'Signing out…' : 'Sign Out'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream text-char lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 lg:sticky lg:top-0 lg:block lg:h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-char/60 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 h-full w-72 max-w-[85vw] shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile topbar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border-warm bg-cream/95 px-4 py-3 backdrop-blur-xs lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border-warm bg-white px-3 py-1.5 text-sm font-semibold text-char"
          >
            <Menu className="h-4 w-4" />
            Menu
          </button>
          <div className="font-display text-base font-bold text-char">Star Kebab Admin</div>
          <Link
            href="/till"
            className="rounded-lg bg-ember px-2.5 py-1.5 text-xs font-semibold text-cream"
          >
            Till
          </Link>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
