'use client';

import { useState, useTransition } from 'react';
import { UserPlus, Power, KeyRound } from 'lucide-react';
import { createStaffUserAction, toggleStaffActiveAction } from '@/modules/admin/actions';
import { formatStoreDateTime } from '@/lib/time';

interface StaffRow {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  isSystemRole: boolean;
  active: boolean;
  hasPin: boolean;
  sessionVersion: number;
  lastLoginAt: string | null;
}

interface RoleOption {
  id: string;
  name: string;
  isSystem: boolean;
}

export function StaffManager({
  staffUsers,
  roles,
  currentStaffId,
}: {
  staffUsers: StaffRow[];
  roles: RoleOption[];
  currentStaffId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [roleId, setRoleId] = useState(roles.find((r) => !r.isSystem)?.id ?? roles[0]?.id ?? '');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await createStaffUserAction({ name, email, password, pin, roleId });
      if (res.ok) {
        setName('');
        setEmail('');
        setPassword('');
        setPin('');
        setFeedback({ type: 'ok', text: `Staff account ${res.data.email} created.` });
      } else {
        setFeedback({ type: 'err', text: res.error.message });
      }
    });
  };

  const handleToggle = (id: string) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await toggleStaffActiveAction({ id });
      if (res.ok) {
        setFeedback({
          type: 'ok',
          text: `Staff status updated (${res.data.active ? 'Active' : 'Disabled'}) and sessions invalidated.`,
        });
      } else {
        setFeedback({ type: 'err', text: res.error.message });
      }
    });
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            feedback.type === 'ok'
              ? 'border-herb/30 bg-herb/10 text-herb'
              : 'border-chilli/30 bg-chilli/10 text-chilli'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Create Staff Form */}
      <form
        onSubmit={handleCreate}
        className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs"
      >
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-ember" />
          <h2 className="font-display text-lg font-bold text-char">Add Staff Member</h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="block text-xs font-semibold text-smoke">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Samira Hassan"
              className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-smoke">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="samira@starkebab.com.au"
              className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-smoke">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 chars"
              className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-smoke">Till PIN (4-6 digits)</label>
            <input
              type="text"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="1234"
              className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm text-char"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-smoke">Role</label>
            <select
              required
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-ember px-4 py-2.5 text-sm font-semibold text-cream hover:bg-ember-dark disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" />
            Create Staff Account
          </button>
        </div>
      </form>

      {/* Staff List */}
      <div className="overflow-hidden rounded-2xl border border-border-warm bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border-warm bg-cream/70 text-xs uppercase tracking-wider text-smoke">
                <th className="px-4 py-3">Staff Member</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">PIN</th>
                <th className="px-4 py-3">Last Login</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-warm/60">
              {staffUsers.map((u) => {
                const isSelf = u.id === currentStaffId;
                return (
                  <tr key={u.id} className={!u.active ? 'opacity-60' : undefined}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-char">
                        {u.name} {isSelf && <span className="text-xs text-ember">(You)</span>}
                      </div>
                      <div className="text-xs text-smoke">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-cream px-2.5 py-1 font-mono text-xs font-semibold text-char">
                        {u.roleName}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.hasPin ? (
                        <span className="inline-flex items-center gap-1 font-mono text-xs text-herb">
                          <KeyRound className="h-3.5 w-3.5" />
                          Set
                        </span>
                      ) : (
                        <span className="text-xs text-smoke">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-smoke">
                      {u.lastLoginAt ? formatStoreDateTime(u.lastLoginAt) : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                          u.active ? 'bg-herb/15 text-herb' : 'bg-chilli/15 text-chilli'
                        }`}
                      >
                        {u.active ? 'ACTIVE' : 'DISABLED'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={isPending || isSelf}
                        onClick={() => handleToggle(u.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border-warm bg-cream px-3 py-1.5 text-xs font-semibold text-char transition hover:bg-cream-deep disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Power className="h-3.5 w-3.5" />
                        {u.active ? 'Disable' : 'Re-enable'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
