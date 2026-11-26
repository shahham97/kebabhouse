'use client';

import { useState, useTransition } from 'react';
import { Megaphone, Save, Plus } from 'lucide-react';
import { saveAnnouncementAction } from '@/modules/admin/actions';

interface AnnouncementItem {
  id: string;
  text: string;
  linkHref: string;
  active: boolean;
  createdAt: string;
}

export function CmsAnnouncementEditor({
  announcements,
}: {
  announcements: AnnouncementItem[];
}) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [editingId, setEditingId] = useState<string | undefined>(announcements[0]?.id);
  const [text, setText] = useState(announcements[0]?.text ?? '');
  const [linkHref, setLinkHref] = useState(announcements[0]?.linkHref ?? '');
  const [active, setActive] = useState(announcements[0]?.active ?? true);

  const selectAnnouncement = (a: AnnouncementItem) => {
    setEditingId(a.id);
    setText(a.text);
    setLinkHref(a.linkHref);
    setActive(a.active);
    setFeedback(null);
  };

  const startNew = () => {
    setEditingId(undefined);
    setText('');
    setLinkHref('/menu');
    setActive(true);
    setFeedback(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const res = await saveAnnouncementAction({
        id: editingId,
        text,
        linkHref,
        active,
      });
      if (res.ok) {
        setEditingId(res.data.id);
        setFeedback({ type: 'ok', text: 'Announcement bar saved and storefront cache updated.' });
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

      {/* Live Preview */}
      <div className="overflow-hidden rounded-2xl border border-border-warm bg-char text-center text-xs font-semibold text-cream">
        <div className="bg-ember px-4 py-2.5">
          {text || 'Preview: Free garlic sauce on all HSP orders over $30!'}
        </div>
      </div>

      {/* Editor Form */}
      <form
        onSubmit={handleSave}
        className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-ember" />
            <h2 className="font-display text-lg font-bold text-char">
              {editingId ? 'Edit Announcement Bar' : 'New Announcement Bar'}
            </h2>
          </div>
          <button
            type="button"
            onClick={startNew}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border-warm bg-cream px-3 py-1.5 text-xs font-semibold text-char hover:bg-cream-deep"
          >
            <Plus className="h-3.5 w-3.5" />
            New Banner
          </button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-smoke">Banner Text</label>
            <input
              type="text"
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="100% Halal Charcoal Grill · Open Late till 2AM Fri–Sat!"
              className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 text-sm text-char focus:border-ember focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-smoke">
              Optional Link URL
            </label>
            <input
              type="text"
              value={linkHref}
              onChange={(e) => setLinkHref(e.target.value)}
              placeholder="/deals"
              className="mt-1 w-full rounded-xl border border-border-warm bg-cream px-3 py-2 font-mono text-sm text-char focus:border-ember focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <label className="flex w-full items-center gap-2 rounded-xl border border-border-warm bg-cream px-3 py-2 text-xs font-semibold text-char">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 accent-ember"
              />
              Show on storefront header
            </label>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-ember px-4 py-2.5 text-sm font-semibold text-cream hover:bg-ember-dark disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {isPending ? 'Saving…' : 'Save Announcement'}
          </button>
        </div>
      </form>

      {/* Existing announcements */}
      {announcements.length > 0 && (
        <div className="rounded-2xl border border-border-warm bg-white p-5 shadow-xs">
          <h3 className="font-display text-base font-bold text-char">Saved Announcements</h3>
          <div className="mt-3 space-y-2">
            {announcements.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => selectAnnouncement(a)}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition ${
                  editingId === a.id
                    ? 'border-ember bg-cream'
                    : 'border-border-warm bg-white hover:bg-cream/50'
                }`}
              >
                <span className="truncate pr-3 font-medium text-char">{a.text}</span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                    a.active ? 'bg-herb/15 text-herb' : 'bg-char/10 text-smoke'
                  }`}
                >
                  {a.active ? 'ACTIVE' : 'HIDDEN'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
