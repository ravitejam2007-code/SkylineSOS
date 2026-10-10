import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/formatters';
import { LoadingCard, ButtonSpinner } from '../ui/LoadingState';
import { getActiveSession, getCurrentUserSession, type UserSession } from '../../lib/auth';
import type { Announcement } from '@campusone/contracts';

export default function AnnouncementsScene() {
  const [session, setSession] = useState<UserSession | null>(() => {
    if (typeof window !== 'undefined') return getActiveSession();
    return null;
  });
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'all_members' | 'volunteers' | 'public'>('all');
  const [loading, setLoading] = useState(true);

  // Async button loading states
  const [isPublishing, setIsPublishing] = useState(false);

  // New announcement publisher state
  const [showPublish, setShowPublish] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newAudience, setNewAudience] = useState<'all_members' | 'active_members' | 'volunteers' | 'public'>('all_members');
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const list = await api.getAnnouncements(activeFilter);
      setAnnouncements(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    getCurrentUserSession().then((s) => {
      if (s) setSession(s);
    });

    const handleAuthChange = (e: CustomEvent) => {
      setSession(e.detail);
    };

    window.addEventListener('campusone:auth_changed' as any, handleAuthChange);
    return () => {
      window.removeEventListener('campusone:auth_changed' as any, handleAuthChange);
    };
  }, [activeFilter]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowPublish(false);
      }
    };
    if (showPublish) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [showPublish]);

  // Handle Publish Announcement
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newBody) return;
    setIsPublishing(true);
    try {
      const created = await api.publishAnnouncement({
        title: newTitle,
        body: newBody,
        audience: newAudience,
      });
      setPublishSuccess(`Announcement "${created.title}" published to ${created.audience} feed!`);
      setNewTitle('');
      setNewBody('');
      setShowPublish(false);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  if (loading) {
    return <LoadingCard label="Loading club announcements & bulletins..." />;
  }

  const getBadgeStyle = (aud: string) => {
    switch (aud) {
      case 'all_members':
        return 'bg-amber-100 text-amber-800';
      case 'volunteers':
        return 'bg-purple-100 text-purple-800';
      case 'public':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-[var(--color-surface-soft)] text-[var(--color-ink)]';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 t-enter">
      {/* Toast Feedback */}
      {publishSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex justify-between items-center text-[14px] shadow-2xs">
          <span>✓ {publishSuccess}</span>
          <button onClick={() => setPublishSuccess(null)} className="font-bold underline ml-4 text-[12px] cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* ─── FEED HEADER & OPTIONAL ADMIN PUBLISH ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--color-hairline-soft)]">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'all_members', 'volunteers', 'public'] as const).map((filterKey) => {
            const label =
              filterKey === 'all'
                ? 'All Posts'
                : filterKey === 'all_members'
                ? 'General Members'
                : filterKey === 'volunteers'
                ? 'Volunteers'
                : 'Public Notices';
            const active = activeFilter === filterKey;
            return (
              <button
                key={filterKey}
                type="button"
                onClick={() => setActiveFilter(filterKey)}
                className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition-all cursor-pointer t-button-action ${
                  active
                    ? 'bg-[var(--color-ink-deep)] text-white shadow-sm'
                    : 'bg-[var(--color-surface-soft)] text-[var(--color-steel)] hover:text-black border border-[var(--color-hairline-soft)]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Publish Notice: Admin Only */}
        {session?.role === 'admin' && (
          <button
            type="button"
            onClick={() => setShowPublish(!showPublish)}
            className="px-4 py-1.5 rounded-full bg-[var(--color-ink-deep)] text-white text-[13px] font-bold hover:bg-black transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto t-button-action flex items-center gap-1.5 shadow-xs"
          >
            <span>+ Publish Notice</span>
          </button>
        )}
      </div>

      {/* New Announcement Form Drawer (Admin Only) */}
      {session?.role === 'admin' && showPublish && (
        <div className="p-6 sm:p-8 rounded-3xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)] space-y-4 shadow-sm t-card-interactive">
          <div className="flex items-center justify-between border-b border-[var(--color-hairline-soft)] pb-3">
            <div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-pink-100 text-pink-700">
                Admin Only
              </span>
              <h4 className="font-bold text-[18px] text-[var(--color-ink-deep)] mt-1">Publish New Announcement</h4>
            </div>
            <button
              type="button"
              onClick={() => setShowPublish(false)}
              className="text-slate-400 hover:text-black text-lg cursor-pointer"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handlePublish} className="space-y-3.5">
            <div>
              <label className="block text-[12px] font-bold text-[var(--color-ink-deep)] mb-1">Headline Title</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Quad Rehearsal Call & Sound Check"
                className="w-full px-4 py-2.5 rounded-full border border-[var(--color-hairline)] text-[14px] bg-white focus:outline-none focus:border-[var(--color-fb-blue)]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-bold text-[var(--color-ink-deep)] mb-1">Target Audience</label>
                <select
                  value={newAudience}
                  onChange={(e) => setNewAudience(e.target.value as any)}
                  className="w-full px-4 py-2.5 rounded-full border border-[var(--color-hairline)] text-[13px] bg-white focus:outline-none focus:border-[var(--color-fb-blue)] cursor-pointer"
                >
                  <option value="all_members">All Members</option>
                  <option value="volunteers">Volunteers Only</option>
                  <option value="public">Open to All Campus</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-bold text-[var(--color-ink-deep)] mb-1">Notice Body Content</label>
              <textarea
                rows={3}
                required
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="Type details, timings, room numbers..."
                className="w-full p-4 rounded-2xl border border-[var(--color-hairline)] text-[14px] bg-white focus:outline-none focus:border-[var(--color-fb-blue)]"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPublish(false)}
                className="px-4 py-2 rounded-full border border-[var(--color-hairline)] text-[13px] font-bold bg-white t-button-action cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPublishing}
                className="px-6 py-2 rounded-full bg-[var(--color-ink-deep)] text-white text-[13px] font-bold hover:bg-black cursor-pointer t-button-action inline-flex items-center gap-2"
              >
                {isPublishing ? <ButtonSpinner size={14} /> : 'Publish to Feed'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Feed Posts */}
      <div className="space-y-6">
        {announcements.map((a) => (
          <div
            key={a.id}
            className="p-8 rounded-3xl bg-[var(--color-canvas)] border border-[var(--color-hairline-soft)] space-y-4 t-card-interactive shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${getBadgeStyle(
                  a.audience
                )}`}
              >
                {a.audience.replace('_', ' ')}
              </span>
              <span className="text-[12px] text-[var(--color-steel)] font-mono">
                {a.published_at ? formatDateTime(a.published_at) : 'Recent'}
              </span>
            </div>

            <h3 className="text-2xl font-bold text-[var(--color-ink-deep)]">{a.title}</h3>

            <p className="text-[15px] text-[var(--color-ink)] leading-relaxed tracking-[-0.16px]">{a.body}</p>

            <div className="pt-3 border-t border-[var(--color-hairline-soft)] flex items-center justify-between text-[12px] text-[var(--color-steel)]">
              <span>Authoritative Club Bulletin</span>
              <span className="text-green-700 font-bold flex items-center gap-1">✓ Persisted In-App Record</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
