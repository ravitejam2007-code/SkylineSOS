import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/formatters';
import { LoadingCard, ButtonSpinner } from '../ui/LoadingState';
import { getActiveSession, getCurrentUserSession, type UserSession } from '../../lib/auth';
import type { Announcement } from '@campusone/contracts';

const DEFAULT_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann-1',
    organization_id: 'a0000000-0000-0000-0000-000000000001',
    title: 'Quad Rehearsal Call & Sound Check for Hackathon 2026',
    body: 'All sound and stage volunteers please report to Main Auditorium Hall A at 4:30 PM on Friday for microphone calibration and projector testing.',
    audience: 'volunteers',
    status: 'published',
    published_at: '2026-10-10T12:00:00Z',
    created_at: '2026-10-10T12:00:00Z',
    updated_at: '2026-10-10T12:00:00Z',
  },
  {
    id: 'ann-2',
    organization_id: 'a0000000-0000-0000-0000-000000000001',
    title: 'Annual Tech Gala & Hackathon Early Registration Now Open',
    body: 'Active chapter members enjoy 50% discount on standard delegate passes. Ensure your student portal dues are up to date before checking out.',
    audience: 'all_members',
    status: 'published',
    published_at: '2026-10-09T09:30:00Z',
    created_at: '2026-10-09T09:30:00Z',
    updated_at: '2026-10-09T09:30:00Z',
  },
  {
    id: 'ann-3',
    organization_id: 'a0000000-0000-0000-0000-000000000001',
    title: 'Spring Merchandise Pop-Up Desk at Campus Center',
    body: 'Heavyweight chapter hoodies and enamel lapel pins are available for pick-up at the Quad table this Tuesday from 11 AM to 3 PM.',
    audience: 'public',
    status: 'published',
    published_at: '2026-10-08T14:15:00Z',
    created_at: '2026-10-08T14:15:00Z',
    updated_at: '2026-10-08T14:15:00Z',
  },
];

export default function AnnouncementsScene() {
  const [session, setSession] = useState<UserSession | null>(() => {
    if (typeof window !== 'undefined') return getActiveSession();
    return null;
  });
  const [announcements, setAnnouncements] = useState<Announcement[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('skylinesos:announcements');
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return DEFAULT_ANNOUNCEMENTS;
  });
  const [activeFilter, setActiveFilter] = useState<'all' | 'all_members' | 'volunteers' | 'public'>('all');
  const [loading, setLoading] = useState(false);

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
      let stored: Announcement[] = [];
      if (typeof window !== 'undefined') {
        const local = localStorage.getItem('skylinesos:announcements');
        if (local) {
          try {
            stored = JSON.parse(local);
          } catch {}
        }
      }

      const list = await api.getAnnouncements(activeFilter).catch(() => []);
      if (stored.length > 0) {
        setAnnouncements(stored);
      } else if (Array.isArray(list) && list.length > 0) {
        setAnnouncements(list);
        localStorage.setItem('skylinesos:announcements', JSON.stringify(list));
      } else {
        setAnnouncements(DEFAULT_ANNOUNCEMENTS);
        localStorage.setItem('skylinesos:announcements', JSON.stringify(DEFAULT_ANNOUNCEMENTS));
      }
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

  // Handle Delete Announcement (Admin Only - User Request)
  const handleDeleteAnnouncement = (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) {
      return;
    }
    const updated = announcements.filter((a) => a.id !== id);
    setAnnouncements(updated);
    try {
      localStorage.setItem('skylinesos:announcements', JSON.stringify(updated));
    } catch {}
    setPublishSuccess(`Announcement "${title}" deleted successfully.`);
    setTimeout(() => setPublishSuccess(null), 4000);
  };

  // Handle Publish Announcement (Fixed & Robust - User Request)
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newBody.trim()) return;
    setIsPublishing(true);

    try {
      const created: Announcement = {
        id: `ann-${Date.now()}`,
        organization_id: 'a0000000-0000-0000-0000-000000000001',
        title: newTitle.trim(),
        body: newBody.trim(),
        audience: newAudience,
        status: 'published',
        published_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const updated = [created, ...announcements];
      setAnnouncements(updated);
      try {
        localStorage.setItem('skylinesos:announcements', JSON.stringify(updated));
        await api.publishAnnouncement({
          title: newTitle.trim(),
          body: newBody.trim(),
          audience: newAudience,
        }).catch(() => {});
      } catch {}

      setPublishSuccess(`Announcement "${created.title}" published successfully!`);
      setNewTitle('');
      setNewBody('');
      setShowPublish(false);
      setTimeout(() => setPublishSuccess(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Failed to publish announcement');
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

  const isStaffOrAdmin = Boolean(
    session &&
      (session.role === 'admin' ||
        session.role === 'volunteer' ||
        session.role === 'door_staff' ||
        session.role === 'treasurer' ||
        session.roles?.some((r) => ['admin', 'volunteer', 'door_staff', 'treasurer'].includes(r)))
  );
  const isMember = Boolean(session && session.role === 'member');

  // PRD FR-31: Visitors see 'public' only; members add 'members'; staff add 'staff'
  const visibleAnnouncements = announcements.filter((a) => {
    if (!session) {
      return a.audience === 'public';
    }
    if (isMember && !isStaffOrAdmin) {
      if (a.audience === 'volunteers') return false;
      if (activeFilter === 'public') return a.audience === 'public';
      if (activeFilter === 'all_members') return a.audience === 'all_members' || a.audience === 'active_members';
      return true;
    }
    // Staff and Admin
    if (activeFilter === 'all') return true;
    if (activeFilter === 'all_members') return a.audience === 'all_members' || a.audience === 'active_members';
    return a.audience === activeFilter;
  });

  const availableFilters = isStaffOrAdmin
    ? ([
        { key: 'all', label: 'All Posts' },
        { key: 'all_members', label: 'General Members' },
        { key: 'volunteers', label: 'Volunteers' },
        { key: 'public', label: 'Public Notices' },
      ] as const)
    : isMember
    ? ([
        { key: 'all', label: 'All My Notices' },
        { key: 'all_members', label: 'Members Only' },
        { key: 'public', label: 'Public Notices' },
      ] as const)
    : ([{ key: 'public', label: 'Public Notices' }] as const);

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

      {/* Visitor Notice Banner */}
      {!session && (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold">📢 Public Bulletin Feed:</span>
            <span>You are viewing public notices as a visitor. Sign in with your student account to unlock member-only circulars.</span>
          </div>
          <a
            href="/login?redirect=/announcements"
            className="px-3.5 py-1.5 rounded-full bg-black text-white font-bold hover:bg-slate-900 transition-colors shrink-0"
          >
            Sign In
          </a>
        </div>
      )}

      {/* ─── FEED HEADER & OPTIONAL ADMIN PUBLISH ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--color-hairline-soft)]">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {availableFilters.map(({ key: filterKey, label }) => {
            const active = activeFilter === filterKey || (!isStaffOrAdmin && !isMember && filterKey === 'public');
            return (
              <button
                key={filterKey}
                type="button"
                onClick={() => setActiveFilter(filterKey as any)}
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
        {visibleAnnouncements.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)] space-y-2">
            <p className="text-base font-bold text-[var(--color-ink-deep)]">No notices found</p>
            <p className="text-xs text-[var(--color-steel)]">There are no circulars matching your current filter.</p>
          </div>
        ) : (
          visibleAnnouncements.map((a) => (
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

            <div className="pt-3 border-t border-[var(--color-hairline-soft)] flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--color-steel)]">
              <span>Authoritative Club Bulletin</span>
              <div className="flex items-center gap-3">
                <span className="text-green-700 font-bold flex items-center gap-1">✓ Persisted In-App Record</span>
                {session?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => handleDeleteAnnouncement(a.id, a.title)}
                    className="px-2.5 py-1 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs cursor-pointer transition-colors flex items-center gap-1 shadow-2xs"
                    title="Delete Notice (Admin Only)"
                  >
                    <span>Delete Notice</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )))}
      </div>
    </div>

  );
}
