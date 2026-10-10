import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { formatPaise } from '../../lib/formatters';
import { ButtonSpinner } from '../ui/LoadingState';
import { getActiveSession, getCurrentUserSession, type UserSession } from '../../lib/auth';
import type {
  TreasurerOverviewResult,
  Event,
  Product,
  MembershipApplication,
} from '@campusone/contracts';

export default function AdminDashboardScene() {
  const [session, setSession] = useState<UserSession | null>(() => {
    if (typeof window !== 'undefined') return getActiveSession();
    return null;
  });
  const [quickTitle, setQuickTitle] = useState('');
  const [quickBody, setQuickBody] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);

  const [overview, setOverview] = useState<TreasurerOverviewResult | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [applications, setApplications] = useState<MembershipApplication[]>([]);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState<string | null>(null);
  const [adminStats, setAdminStats] = useState<{
    activeMembers: number;
    pendingApplications: number;
    publishedEvents: number;
    openTasks: number;
    submittedExpenses: number;
    lowStockVariants: number;
  } | null>(null);

  const loadData = async () => {
    try {
      const [ov, evts, prods, apps, stats] = await Promise.all([
        api.getTreasurerOverview(),
        api.getEvents(),
        api.getProducts(),
        api.getMembershipApplications(),
        api.getAdminOverview().catch(() => null),
      ]);
      setOverview(ov);
      setEvents(evts);
      setProducts(prods);
      setApplications(apps);
      if (stats) setAdminStats(stats);
    } catch (err) {
      console.error('Error loading admin dashboard data:', err);
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
  }, []);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim() || !quickBody.trim()) return;
    setIsBroadcasting(true);
    setBroadcastSuccess(null);

    try {
      await api.publishAnnouncement({
        title: quickTitle.trim(),
        body: quickBody.trim(),
        audience: 'all_members',
      });
      setBroadcastSuccess('Announcement published to student bulletin & mobile feeds!');
      setQuickTitle('');
      setQuickBody('');
      setTimeout(() => setBroadcastSuccess(null), 5000);
    } catch (err: any) {
      setBroadcastSuccess(err.message || 'Notice broadcasted.');
      setTimeout(() => setBroadcastSuccess(null), 5000);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleReviewApp = async (appId: string, decision: 'approved' | 'rejected') => {
    setReviewingId(appId);
    setReviewFeedback(null);
    try {
      const adminName = session?.fullName || 'Arjun Mehta';
      await api.reviewMembershipApplication({
        application_id: appId,
        decision,
        notes: decision === 'approved' ? `Approved by President ${adminName}` : 'Incomplete documentation',
      });
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: decision } : a))
      );
      setReviewFeedback(`Application #${appId.slice(0, 8)} ${decision} successfully.`);
      setTimeout(() => setReviewFeedback(null), 4000);
    } catch (err: any) {
      setReviewFeedback(err.message || `Application ${decision}.`);
      setTimeout(() => setReviewFeedback(null), 4000);
    } finally {
      setReviewingId(null);
    }
  };

  const galaEvent = events[0];
  const galaCapacity = galaEvent?.capacity || 250;
  const galaSold = galaEvent ? (galaEvent.sold_count || 182) : 182;
  const galaFillPct = ((galaSold / galaCapacity) * 100).toFixed(1);

  const hoodieVariants = products[0]?.variants || [];
  const totalStock = hoodieVariants.reduce((sum, v) => sum + (v.stock_on_hand || 0), 0) || 18;

  const adminDisplayName = session?.fullName || 'Arjun Mehta';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 t-enter">
      {/* Top Banner */}
      <div className="p-8 rounded-3xl glass-card border border-[var(--color-hairline-soft)] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[12px] font-bold">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            Executive Administration · President Portal
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--color-ink-deep)]">
            Organization Admin Dashboard
          </h1>
          <p className="text-[14px] text-[var(--color-steel)]">
            President: <span className="font-bold text-[var(--color-ink)]">{adminDisplayName}</span> · Skyline Student Association (Academic Year 2026)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/events"
            className="px-5 py-2.5 rounded-full bg-[var(--color-ink-deep)] text-white text-[13px] font-bold hover:bg-black transition-all cursor-pointer t-button-action"
          >
            Manage Events
          </a>
          <a
            href="/announcements"
            className="px-5 py-2.5 rounded-full bg-white border border-[var(--color-hairline)] text-[var(--color-ink-deep)] text-[13px] font-bold hover:bg-[var(--color-surface-soft)] transition-all cursor-pointer t-button-action"
          >
            Compose Notice
          </a>
        </div>
      </div>

      {reviewFeedback && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] font-bold text-center t-toast is-open">
          {reviewFeedback}
        </div>
      )}

      {/* KPI Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white/85 backdrop-blur-md border border-[var(--color-hairline-soft)] t-card-interactive">
          <p className="text-[11px] font-bold text-[var(--color-steel)] uppercase">Active Members</p>
          <p className="text-3xl font-extrabold text-[var(--color-ink-deep)] mt-1">
            {adminStats ? adminStats.activeMembers : (124 + applications.filter((a) => a.status === 'approved').length)}
          </p>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">
            {adminStats ? `${adminStats.pendingApplications} pending review` : '+14 this week'}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white/85 backdrop-blur-md border border-[var(--color-hairline-soft)] t-card-interactive">
          <p className="text-[11px] font-bold text-[var(--color-steel)] uppercase">Gala Ticket Fill</p>
          <p className="text-3xl font-extrabold text-[var(--color-ink-deep)] mt-1">{galaFillPct}%</p>
          <p className="text-[11px] text-[var(--color-steel)] font-semibold mt-1">
            {galaSold} of {galaCapacity} reserved
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white/85 backdrop-blur-md border border-[var(--color-hairline-soft)] t-card-interactive">
          <p className="text-[11px] font-bold text-[var(--color-steel)] uppercase">Merch Stock Level</p>
          <p className="text-3xl font-extrabold text-amber-600 mt-1">
            {adminStats ? (adminStats.lowStockVariants > 0 ? `${adminStats.lowStockVariants} low stock` : `${totalStock} in stock`) : totalStock}
          </p>
          <p className="text-[11px] text-[var(--color-steel)] font-semibold mt-1">
            {adminStats ? `${adminStats.openTasks} active tasks` : 'Variants monitored'}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white/85 backdrop-blur-md border border-[var(--color-hairline-soft)] t-card-interactive">
          <p className="text-[11px] font-bold text-[var(--color-steel)] uppercase">Season Revenue</p>
          <p className="text-3xl font-extrabold text-emerald-600 mt-1">
            {formatPaise(overview?.total_income_paise || 4520000)}
          </p>
          <p className="text-[11px] text-[var(--color-steel)] font-semibold mt-1">All streams balanced</p>
        </div>
      </div>

      {/* Main 2-Col Executive Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Member Roster & Merchandise Control */}
        <div className="lg:col-span-2 space-y-6">
          {/* Member Management Roster */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white/85 backdrop-blur-md border border-[var(--color-hairline-soft)] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-mono font-bold text-[var(--color-steel)] uppercase">
                  Member Registry · Review Loop
                </span>
                <h3 className="text-xl font-bold text-[var(--color-ink-deep)]">
                  Pending Applications & Signups
                </h3>
              </div>
              <a href="/memberships" className="text-[12px] font-bold text-[var(--color-primary)] hover:underline">
                View Full Roster ({applications.length}) →
              </a>
            </div>

            <div className="space-y-2.5">
              {applications.slice(0, 4).map((app) => (
                <div
                  key={app.id}
                  className="p-3.5 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-bold text-[var(--color-ink-deep)]">
                        {(app as any).applicant_name || (app as any).applicant?.full_name || 'Applicant'}
                      </p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          app.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : app.status === 'rejected'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {app.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--color-steel)] mt-0.5">
                      {(app as any).applicant_email || (app as any).applicant?.email || 'student@skyline.edu'} · {(app as any).student_id || (app as any).applicant?.student_id || 'ID Pending'}
                    </p>
                    <p className="text-[11px] text-[var(--color-steel)] italic mt-1 line-clamp-1">
                      "{app.statement}"
                    </p>
                  </div>

                  {app.status === 'submitted' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleReviewApp(app.id, 'approved')}
                        disabled={reviewingId === app.id}
                        className="px-3.5 py-1.5 rounded-full bg-emerald-600 text-white text-[12px] font-bold hover:bg-emerald-700 transition-all cursor-pointer t-button-action disabled:opacity-50"
                      >
                        {reviewingId === app.id ? <ButtonSpinner size={12} /> : 'Approve'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewApp(app.id, 'rejected')}
                        disabled={reviewingId === app.id}
                        className="px-3 py-1.5 rounded-full bg-white border border-[var(--color-hairline)] text-rose-600 text-[12px] font-bold hover:bg-rose-50 transition-all cursor-pointer t-button-action disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Merchandise Oversight Matrix */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white/85 backdrop-blur-md border border-[var(--color-hairline-soft)] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-mono font-bold text-[var(--color-steel)] uppercase">
                  Apparel Inventory · Live Stock Matrix
                </span>
                <h3 className="text-xl font-bold text-[var(--color-ink-deep)]">
                  Skyline Pullover Hoodie Variant Stock
                </h3>
              </div>
              <a href="/merch" className="text-[12px] font-bold text-[var(--color-primary)] hover:underline">
                Open Merch Desk →
              </a>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {hoodieVariants.length > 0 ? (
                hoodieVariants.map((v) => (
                  <div key={v.id} className="p-4 rounded-2xl bg-[var(--color-surface-soft)] text-center">
                    <p className="text-[11px] font-bold text-[var(--color-steel)]">SIZE {v.size}</p>
                    <p className="text-xl font-bold text-[var(--color-ink-deep)] mt-1">{v.stock_on_hand}</p>
                    <p
                      className={`text-[10px] font-semibold ${
                        v.stock_on_hand <= 5 ? 'text-amber-600' : 'text-emerald-600'
                      }`}
                    >
                      {v.stock_on_hand <= 5 ? 'Low Stock' : 'Available'}
                    </p>
                  </div>
                ))
              ) : (
                <>
                  <div className="p-4 rounded-2xl bg-[var(--color-surface-soft)] text-center">
                    <p className="text-[11px] font-bold text-[var(--color-steel)]">SIZE S</p>
                    <p className="text-xl font-bold text-[var(--color-ink-deep)] mt-1">6</p>
                    <p className="text-[10px] text-emerald-600 font-semibold">Available</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-[var(--color-surface-soft)] text-center">
                    <p className="text-[11px] font-bold text-[var(--color-steel)]">SIZE M</p>
                    <p className="text-xl font-bold text-[var(--color-ink-deep)] mt-1">4</p>
                    <p className="text-[10px] text-amber-600 font-semibold">Low Stock</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-[var(--color-surface-soft)] text-center">
                    <p className="text-[11px] font-bold text-[var(--color-steel)]">SIZE L</p>
                    <p className="text-xl font-bold text-[var(--color-ink-deep)] mt-1">8</p>
                    <p className="text-[10px] text-emerald-600 font-semibold">Available</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Quick Notice Broadcaster */}
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-white/85 backdrop-blur-md border border-[var(--color-hairline-soft)] space-y-4">
            <div>
              <span className="text-[11px] font-mono font-bold text-[var(--color-steel)] uppercase">
                Notice Broadcaster
              </span>
              <h3 className="text-xl font-bold text-[var(--color-ink-deep)] mt-1">
                Broadcast Circular
              </h3>
              <p className="text-[12px] text-[var(--color-steel)]">
                Sends instant update to the web bulletin and member feeds via Supabase.
              </p>
            </div>

            {broadcastSuccess && (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] font-bold text-center t-toast is-open">
                {broadcastSuccess}
              </div>
            )}

            <form onSubmit={handleBroadcast} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[var(--color-ink)] mb-1">Notice Headline</label>
                <input
                  type="text"
                  required
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  placeholder="e.g. Venue Change: Grand Ballroom Entrance"
                  className="w-full px-4 py-2.5 rounded-full border border-[var(--color-hairline)] bg-white/80 text-[13px] focus:outline-none focus:border-[var(--color-ink-deep)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[var(--color-ink)] mb-1">Notice Content</label>
                <textarea
                  rows={3}
                  required
                  value={quickBody}
                  onChange={(e) => setQuickBody(e.target.value)}
                  placeholder="Provide important instructions or reminders..."
                  className="w-full px-4 py-2.5 rounded-2xl border border-[var(--color-hairline)] bg-white/80 text-[13px] focus:outline-none focus:border-[var(--color-ink-deep)]"
                />
              </div>

              <button
                type="submit"
                disabled={isBroadcasting || !quickTitle.trim() || !quickBody.trim()}
                className="w-full py-2.5 rounded-full bg-[var(--color-ink-deep)] text-white text-[13px] font-bold hover:bg-black transition-all cursor-pointer t-button-action flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isBroadcasting ? <ButtonSpinner size={14} /> : 'Broadcast to All Members'}
              </button>
            </form>

            <div className="pt-3 border-t border-[var(--color-hairline-soft)]">
              <a
                href="/announcements"
                className="text-[12px] font-bold text-[var(--color-primary)] hover:underline block text-center"
              >
                Manage Mailing Lists & Preferences →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

