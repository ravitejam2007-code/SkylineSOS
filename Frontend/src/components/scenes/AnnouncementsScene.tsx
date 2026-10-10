import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { formatDateTime } from '../../lib/formatters';
import { LoadingCard, ButtonSpinner } from '../ui/LoadingState';
import type { Announcement } from '@campusone/contracts';

export default function AnnouncementsScene() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'all_members' | 'volunteers' | 'public'>('all');
  const [loading, setLoading] = useState(true);

  // Async button loading states
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [isOptingOut, setIsOptingOut] = useState(false);

  // New announcement publisher state
  const [showPublish, setShowPublish] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newAudience, setNewAudience] = useState<'all_members' | 'active_members' | 'volunteers' | 'public'>('all_members');
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);

  // Mailing preferences state
  const [meetingAlerts, setMeetingAlerts] = useState(true);
  const [eventReminders, setEventReminders] = useState(true);
  const [merchDrops, setMerchDrops] = useState(false);
  const [prefsSuccess, setPrefsSuccess] = useState<string | null>(null);
  const [optOutMessage, setOptOutMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const list = await api.getAnnouncements(activeFilter);
      setAnnouncements(list);
      const prefs = await api.getMailingPreferences();
      for (const p of prefs) {
        if (p.topic === 'meeting_alerts') setMeetingAlerts(p.is_subscribed);
        if (p.topic === 'event_reminders') setEventReminders(p.is_subscribed);
        if (p.topic === 'merch_drops') setMerchDrops(p.is_subscribed);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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

  // Handle Save Preferences
  const handleSavePrefs = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPrefs(true);
    try {
      await api.updateMailingPreferences({
        meeting_alerts: meetingAlerts,
        event_reminders: eventReminders,
        merch_drops: merchDrops,
      });
      setPrefsSuccess('Mailing preferences updated successfully!');
      setTimeout(() => setPrefsSuccess(null), 4000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSavingPrefs(false);
    }
  };

  // Handle One-click Opt-out
  const handleOneClickOptOut = async () => {
    setIsOptingOut(true);
    try {
      await api.updateMailingPreferences({
        meeting_alerts: false,
        event_reminders: false,
        merch_drops: false,
      });
      setMeetingAlerts(false);
      setEventReminders(false);
      setMerchDrops(false);
      setOptOutMessage('You have been unsubscribed from all optional email circulars. Internal web bulletin notices remain available.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsOptingOut(false);
    }
  };

  if (loading) {
    return <LoadingCard label="Loading club announcements & mailing feeds..." />;
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
    <div className="space-y-12 t-enter">
      {/* Toast Feedbacks */}
      {publishSuccess && (
        <div className="p-4 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-success)] text-[var(--color-success)] flex justify-between items-center text-[14px] t-toast is-open">
          <span>✓ {publishSuccess}</span>
          <button onClick={() => setPublishSuccess(null)} className="font-bold underline ml-4 text-[12px] cursor-pointer">Dismiss</button>
        </div>
      )}
      {prefsSuccess && (
        <div className="p-4 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-success)] text-[var(--color-success)] flex justify-between items-center text-[14px] t-toast is-open">
          <span>✓ {prefsSuccess}</span>
          <button onClick={() => setPrefsSuccess(null)} className="font-bold underline ml-4 text-[12px] cursor-pointer">Dismiss</button>
        </div>
      )}
      {optOutMessage && (
        <div className="p-4 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-steel)] text-[var(--color-ink-deep)] flex justify-between items-center text-[14px] t-toast is-open">
          <span>ℹ {optOutMessage}</span>
          <button onClick={() => setOptOutMessage(null)} className="font-bold underline ml-4 text-[12px] cursor-pointer">Dismiss</button>
        </div>
      )}

      {/* ─── FEED & SUBSCRIPTION SIDEBAR LAYOUT ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Announcement Feed (2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
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

            <button
              type="button"
              onClick={() => setShowPublish(!showPublish)}
              className="px-4 py-1.5 rounded-full bg-[var(--color-ink-deep)] text-white text-[13px] font-bold hover:bg-black transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto t-button-action"
            >
              + Publish Notice
            </button>
          </div>

          {/* New Announcement Form Drawer */}
          {showPublish && (
            <div className="p-6 rounded-3xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)] space-y-4 t-card-interactive">
              <h4 className="font-bold text-[18px] text-[var(--color-ink-deep)]">Publish New Announcement</h4>
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

                <div className="grid grid-cols-2 gap-3">
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

                <div className="flex gap-3">
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
                className="p-8 rounded-3xl bg-[var(--color-canvas)] border border-[var(--color-hairline-soft)] space-y-4 t-card-interactive"
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

        {/* ─── MAILING PREFERENCES & OPT-OUT SIDEBAR ─── */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[var(--color-canvas)] border border-[var(--color-hairline-soft)] shadow-sm space-y-6">
            <div className="border-b border-[var(--color-hairline-soft)] pb-4">
              <h3 className="font-bold text-[18px] text-[var(--color-ink-deep)] mb-1">Mailing Preferences</h3>
              <p className="text-[13px] text-[var(--color-steel)]">
                Separate from login identity. Honor member opt-outs.
              </p>
            </div>

            <form onSubmit={handleSavePrefs} className="space-y-4 text-[14px]">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={meetingAlerts}
                  onChange={(e) => setMeetingAlerts(e.target.checked)}
                  className="mt-1 accent-[var(--color-fb-blue)] w-4 h-4 rounded cursor-pointer"
                />
                <div>
                  <span className="font-bold text-[var(--color-ink)]">Urgent Meeting & Venue Alerts</span>
                  <p className="text-[12px] text-[var(--color-steel)]">
                    Immediate notifications about schedule or venue shifts.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={eventReminders}
                  onChange={(e) => setEventReminders(e.target.checked)}
                  className="mt-1 accent-[var(--color-fb-blue)] w-4 h-4 rounded cursor-pointer"
                />
                <div>
                  <span className="font-bold text-[var(--color-ink)]">Event Reminders & Gala Updates</span>
                  <p className="text-[12px] text-[var(--color-steel)]">
                    Ticket release dates, seat alerts, and check-in details.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={merchDrops}
                  onChange={(e) => setMerchDrops(e.target.checked)}
                  className="mt-1 accent-[var(--color-fb-blue)] w-4 h-4 rounded cursor-pointer"
                />
                <div>
                  <span className="font-bold text-[var(--color-ink)]">Merch Drops & Fundraiser Calls</span>
                  <p className="text-[12px] text-[var(--color-steel)]">
                    New hoodies, bake-sale schedules, and volunteer requests.
                  </p>
                </div>
              </label>

              <div className="pt-4 border-t border-[var(--color-hairline-soft)] space-y-2">
                <button
                  type="submit"
                  disabled={isSavingPrefs}
                  className="w-full py-2.5 rounded-full bg-[var(--color-ink-deep)] text-white text-[13px] font-bold hover:bg-black transition-all cursor-pointer t-button-action flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSavingPrefs ? <ButtonSpinner size={14} /> : 'Save Mailing Preferences'}
                </button>
                <button
                  type="button"
                  onClick={handleOneClickOptOut}
                  disabled={isOptingOut}
                  className="w-full py-2 rounded-full border border-[var(--color-hairline)] text-[12px] font-bold text-[var(--color-steel)] hover:text-black cursor-pointer t-button-action flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isOptingOut ? <ButtonSpinner size={12} color="#475569" /> : 'One-Click Unsubscribe All'}
                </button>
                <p className="text-[11px] text-[var(--color-stone)] text-center mt-2">
                  Unsubscribe anytime with one-click token link
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
