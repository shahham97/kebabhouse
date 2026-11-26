'use client';

import { useState, useTransition } from 'react';
import { ShieldCheck, Lock, Plus, Save } from 'lucide-react';
import { createRoleAction, updateRolePermissionsAction } from '@/modules/admin/actions';

interface RoleRow {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  maxDiscountPct: number;
  staffCount: number;
  permissionIds: string[];
  permissionKeys: string[];
}

interface PermissionItem {
  id: string;
  key: string;
  label: string;
  description: string;
}

export function RolesMatrix({
  roles,
  permissionsByModule,
  currentRoleId,
}: {
  roles: RoleRow[];
  permissionsByModule: Record<string, PermissionItem[]>;
  currentRoleId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Selected role to edit
  const defaultEditable = roles.find((r) => !r.isSystem && r.id !== currentRoleId) ?? roles[0];
  const [selectedRoleId, setSelectedRoleId] = useState(defaultEditable?.id ?? '');

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? roles[0];
  const [checkedIds, setCheckedIds] = useState<Set<string>>(
    () => new Set(selectedRole?.permissionIds ?? [])
  );
  const [maxDiscountPct, setMaxDiscountPct] = useState<number>(
    selectedRole?.maxDiscountPct ?? 0
  );

  // Create new role form
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newMaxDiscount, setNewMaxDiscount] = useState('10');

  const handleSelectRole = (role: RoleRow) => {
    setSelectedRoleId(role.id);
    setCheckedIds(new Set(role.permissionIds));
    setMaxDiscountPct(role.maxDiscountPct);
    setFeedback(null);
  };

  const togglePermission = (permId: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  };

  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await createRoleAction({
        name: newName,
        description: newDesc,
        maxDiscountPct: Number(newMaxDiscount) || 0,
      });
      if (res.ok) {
        setNewName('');
        setNewDesc('');
        setSelectedRoleId(res.data.id);
        setCheckedIds(new Set());
        setMaxDiscountPct(Number(newMaxDiscount) || 0);
        setFeedback({ type: 'ok', text: `Role "${res.data.name}" created. Select permissions below.` });
      } else {
        setFeedback({ type: 'err', text: res.error.message });
      }
    });
  };

  const handleSavePermissions = () => {
    if (!selectedRole) return;
    setFeedback(null);
    startTransition(async () => {
      const res = await updateRolePermissionsAction({
        roleId: selectedRole.id,
        permissionIds: Array.from(checkedIds),
        maxDiscountPct,
      });
      if (res.ok) {
        setFeedback({
          type: 'ok',
          text: `Saved ${res.data.permissionCount} permissions for "${selectedRole.name}". ${res.data.affectedStaff} staff session(s) invalidated immediately.`,
        });
      } else {
        setFeedback({ type: 'err', text: res.error.message });
      }
    });
  };

  const isLocked = selectedRole ? selectedRole.isSystem || selectedRole.id === currentRoleId : true;
  const moduleNames = Object.keys(permissionsByModule).sort();

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

      {/* Create Role Form */}
      <form
        onSubmit={handleCreateRole}
        className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs"
      >
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-ember" />
          <h2 className="font-display text-lg font-bold text-char">Create Dynamic Role</h2>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <div>
            <label className="block text-xs font-semibold text-smoke">Role Name</label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Shift Supervisor"
              className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-smoke">Description</label>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Till, refunds, and kitchen KDS access"
              className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-smoke">Max Discount (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={newMaxDiscount}
              onChange={(e) => setNewMaxDiscount(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm text-char"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-char px-4 py-2 text-sm font-semibold text-cream hover:bg-char-soft disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Create Role
          </button>
        </div>
      </form>

      {/* Role selector pills */}
      <div className="flex flex-wrap gap-2">
        {roles.map((r) => {
          const isSelected = selectedRole?.id === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => handleSelectRole(r)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                isSelected
                  ? 'border-ember bg-ember text-cream'
                  : 'border-border-warm bg-white text-char hover:bg-cream-deep'
              }`}
            >
              {(r.isSystem || r.id === currentRoleId) && <Lock className="h-3.5 w-3.5" />}
              <span>{r.name}</span>
              <span
                className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] ${
                  isSelected ? 'bg-char/25 text-cream' : 'bg-cream text-smoke'
                }`}
              >
                {r.staffCount} staff
              </span>
            </button>
          );
        })}
      </div>

      {/* Permission Matrix for selected role */}
      {selectedRole && (
        <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-warm pb-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-ember" />
                <h2 className="font-display text-xl font-bold text-char">
                  {selectedRole.name} Permissions
                </h2>
              </div>
              <p className="mt-0.5 text-xs text-smoke">
                {selectedRole.isSystem
                  ? 'System Super Admin role is locked with all permissions.'
                  : selectedRole.id === currentRoleId
                    ? 'Guard rail: You cannot edit permissions on your own assigned role.'
                    : 'Saving bumps sessionVersion for all staff on this role so changes take effect immediately.'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-smoke">Max Discount %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  disabled={isLocked}
                  value={maxDiscountPct}
                  onChange={(e) => setMaxDiscountPct(Number(e.target.value) || 0)}
                  className="w-20 rounded-xl border border-border-warm bg-cream px-2.5 py-1.5 font-mono text-sm text-char disabled:opacity-50"
                />
              </div>

              <button
                type="button"
                disabled={isPending || isLocked}
                onClick={handleSavePermissions}
                className="inline-flex items-center gap-2 rounded-xl bg-ember px-4 py-2.5 text-sm font-semibold text-cream hover:bg-ember-dark disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Save className="h-4 w-4" />
                Save Matrix
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {moduleNames.map((mod) => (
              <div key={mod} className="rounded-xl border border-border-warm bg-cream/40 p-4">
                <div className="mb-2.5 font-mono text-xs font-bold uppercase tracking-wider text-ember">
                  {mod}
                </div>
                <div className="space-y-2">
                  {(permissionsByModule[mod] ?? []).map((perm) => {
                    const checked = selectedRole.isSystem || checkedIds.has(perm.id);
                    return (
                      <label
                        key={perm.id}
                        className={`flex items-start gap-2.5 rounded-lg p-1.5 text-xs ${
                          isLocked ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:bg-cream'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={isLocked}
                          checked={checked}
                          onChange={() => togglePermission(perm.id)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-ember"
                        />
                        <div>
                          <div className="font-semibold text-char">{perm.label}</div>
                          <div className="font-mono text-[10px] text-smoke">{perm.key}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
