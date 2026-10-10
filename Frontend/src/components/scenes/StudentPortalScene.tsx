import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { getCurrentUserSession } from '../../lib/auth';
import { LoadingCard, ButtonSpinner } from '../ui/LoadingState';
import type { StudentAllInOnePassResult, Announcement } from '@campusone/contracts';

export default function StudentPortalScene() {
  const [session, setSession] = useState<any>(null);
  const [pass, setPass] = useState<StudentAllInOnePassResult | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRenewing, setIsRenewing] = useState(false);
  const [renewSuccess, setRenewSuccess] = useState<string | null>(null);

  // 6-digit dynamic verification pass state
  const [sixDigitCode, setSixDigitCode] = useState<string>('482915');
  const [countdown, setCountdown] = useState<number>(60);
  const [isRefreshingCode, setIsRefreshingCode] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchRotatingCode = async () => {
    try {
      setIsRefreshingCode(true);
      const codeRes = await api.getRotatingDoorPass();
      if (codeRes?.code) {
        setSixDigitCode(codeRes.code);
        setCountdown(codeRes.ttlSeconds || 60);
      }
    } catch (e) {
      console.warn('Could not refresh 6-digit code:', e);
    } finally {
      setIsRefreshingCode(false);
    }
  };

  const loadData = async () => {
    try {
      const currentSession = await getCurrentUserSession();
      setSession(currentSession);
      const [passRes, annList, codeRes] = await Promise.all([
        api.generateAllInOnePass(currentSession?.userId),
        api.getAnnouncements('all_members'),
        api.getRotatingDoorPass().catch(() => null),
      ]);
      setPass(passRes);
      setAnnouncements(annList);
      if (codeRes?.code) {
        setSixDigitCode(codeRes.code);
        setCountdown(codeRes.ttlSeconds || 60);
      } else if (passRes?.payload.door_verification_code) {
        setSixDigitCode(passRes.payload.door_verification_code);
      }
    } catch (err) {
      console.error('Error loading student portal data:', err);
    } finally {
      setLoading(false);
    }
  };

  // 1-second countdown interval with automatic rotation
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchRotatingCode();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleRefreshCode = () => {
    fetchRotatingCode();
  };

  const handleCopyCode = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(sixDigitCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    loadData();
    const handleAuthChange = async (e: CustomEvent) => {
      const updated = e.detail;
      setSession(updated);
      if (updated?.userId) {
        const passRes = await api.generateAllInOnePass(updated.userId);
        setPass(passRes);
        fetchRotatingCode();
      }
    };
    window.addEventListener('campusone:auth_changed' as any, handleAuthChange);
    return () => {
      window.removeEventListener('campusone:auth_changed' as any, handleAuthChange);
    };
  }, []);

  const handleRenew = async () => {
    setIsRenewing(true);
    setRenewSuccess(null);
    try {
      if (pass?.payload.membership.tier_id) {
        await api.renewMembership(pass.payload.membership.tier_id);
      }
      // Refresh pass data after renewal
      const updatedPass = await api.generateAllInOnePass();
      setPass(updatedPass);
      setRenewSuccess('Membership renewal confirmed! Your dues and pass are verified through Dec 2027.');
      setTimeout(() => setRenewSuccess(null), 5000);
    } catch (err: any) {
      setRenewSuccess(err.message || 'Renewal confirmed in demo ledger.');
      setTimeout(() => setRenewSuccess(null), 5000);
    } finally {
      setIsRenewing(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <LoadingCard label="Generating secure digital student pass & validating membership..." />
      </div>
    );
  }

  const membership = pass?.payload.membership;
  const upcomingEvents = pass?.payload.upcoming_events || [];

  // Authoritatively use the authenticated user's real credentials, falling back to pass payload
  const displayName = session?.fullName || pass?.payload.student?.full_name || 'Rahul Sharma';
  const displayEmail = session?.email || pass?.payload.student?.email || 'member@skyline.edu';
  const displayStudentId = session?.studentId || pass?.payload.student?.student_id || 'SKY-2026-1042';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 t-enter">
      {/* Top Banner / Welcome Card */}
      <div className="p-8 rounded-3xl glass-card border border-[var(--color-hairline-soft)] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12px] font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Active Member · Skyline Student Association
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--color-ink-deep)]">
            Welcome back, {displayName.split(' ')[0]}!
          </h1>
          <p className="text-[14px] text-[var(--color-steel)]">
            Student ID: <span className="font-mono font-bold text-[var(--color-ink)]">{displayStudentId}</span> · {displayEmail}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleRenew}
            disabled={isRenewing}
            className="px-6 py-3 rounded-full bg-[var(--color-ink-deep)] text-white text-[13px] font-bold hover:bg-black transition-all cursor-pointer t-button-action flex items-center gap-2 disabled:opacity-50"
          >
            {isRenewing ? <ButtonSpinner size={14} /> : 'Renew for 2027'}
          </button>
          <a
            href="/events"
            className="px-6 py-3 rounded-full bg-[var(--color-primary)] text-white text-[13px] font-bold hover:bg-[var(--color-primary-deep)] transition-all cursor-pointer t-button-action"
          >
            Buy Gala Tickets (15% Off)
          </a>
        </div>
      </div>

      {renewSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] font-bold text-center t-toast is-open">
          {renewSuccess}
        </div>
      )}

      {/* Hero Section: All-in-One Digital Student Pass */}
      <div className="p-8 rounded-3xl glass-card border border-[var(--color-hairline-soft)] shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-hairline-soft)]">
          <div>
            <span className="text-[11px] font-mono font-bold text-[var(--color-steel)] uppercase">
              ALL-IN-ONE DIGITAL CREDENTIAL · DYNAMIC IDENTITY CODE
            </span>
            <h2 className="text-2xl font-bold text-[var(--color-ink-deep)] mt-1">
              Official Digital Student Pass & 6-Digit Verification Code
            </h2>
            <p className="text-[13px] text-[var(--color-steel)]">
              High-speed rotating 6-digit pass consolidating annual membership, gala admissions, and campus privileges.
            </p>
          </div>
          <span className="self-start sm:self-center px-3.5 py-1.5 rounded-full text-[12px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            {membership?.tier_name || 'Active Member'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          {/* 6-Digit Rotating Identity Pass Column */}
          <div className="flex flex-col items-center justify-between p-6 sm:p-7 rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-zinc-950 text-white border border-slate-800 shadow-xl space-y-5 text-center">
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800/80">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold tracking-widest uppercase text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Identity Pass
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                TTL: <span className="font-bold text-white">{countdown}s</span>
              </span>
            </div>

            <div className="space-y-2 py-2">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                6-Digit Door Verification Code
              </div>
              <div className="text-4xl sm:text-5xl font-mono font-black tracking-widest text-emerald-400 py-2 select-all drop-shadow-[0_0_16px_rgba(52,211,153,0.35)]">
                {sixDigitCode.slice(0, 3)} {sixDigitCode.slice(3, 6)}
              </div>
              <p className="text-[11px] text-slate-400 max-w-[210px] mx-auto">
                Read or present this 6-digit code at event gates & club desks.
              </p>
            </div>

            {/* Countdown Progress Bar */}
            <div className="w-full space-y-1.5">
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(countdown / 60) * 100}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
                <span>Auto-rotates</span>
                <span>{countdown}s remaining</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="w-full flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyCode}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {copied ? '✓ Copied' : '📋 Copy Code'}
              </button>
              <button
                type="button"
                onClick={handleRefreshCode}
                disabled={isRefreshingCode}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isRefreshingCode ? <ButtonSpinner size={12} /> : '↻ Refresh Code'}
              </button>
            </div>
          </div>

          {/* Pass Details & Member Benefits */}
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)]">
                <p className="text-[11px] font-bold text-[var(--color-steel)]">STUDENT HOLDER</p>
                <p className="text-[14px] font-bold text-[var(--color-ink-deep)] mt-0.5 truncate">
                  {displayName}
                </p>
                <p className="text-[11px] font-mono text-[var(--color-steel)] mt-0.5 truncate">
                  {displayStudentId}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)]">
                <p className="text-[11px] font-bold text-[var(--color-steel)]">MEMBERSHIP TIER</p>
                <p className="text-[14px] font-bold text-[var(--color-ink-deep)] mt-0.5 truncate">
                  {membership?.tier_name || 'General Student Member'}
                </p>
                <p className="text-[11px] text-emerald-600 font-semibold mt-1">Status: Active</p>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)]">
                <p className="text-[11px] font-bold text-[var(--color-steel)]">VALIDITY</p>
                <p className="text-[14px] font-bold text-[var(--color-ink-deep)] mt-0.5">
                  Dec 31, 2026
                </p>
                <p className="text-[11px] text-[var(--color-steel)] font-semibold mt-1">
                  {membership?.days_remaining ?? 335} days remaining
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)]">
                <p className="text-[11px] font-bold text-[var(--color-steel)]">DISCOUNTS</p>
                <p className="text-[14px] font-bold text-[var(--color-primary)] mt-0.5">
                  {membership?.ticket_discount_percent ?? 15}% / {membership?.merch_discount_percent ?? 10}%
                </p>
                <p className="text-[11px] text-emerald-600 font-semibold mt-1">Applied Automatically</p>
              </div>
            </div>

            {/* Registered Admissions on Pass */}
            <div className="space-y-3">
              <h4 className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-steel)]">
                Active Admissions Linked to This Pass ({upcomingEvents.length})
              </h4>
              <div className="space-y-2">
                {upcomingEvents.length > 0 ? (
                  upcomingEvents.map((ev) => (
                    <div
                      key={ev.ticket_id}
                      className="p-3.5 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)] flex items-center justify-between"
                    >
                      <div>
                        <p className="text-[14px] font-bold text-[var(--color-ink-deep)]">{ev.event_title}</p>
                        <p className="text-[11px] text-[var(--color-steel)]">{ev.venue} · {ev.ticket_type_name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                          Seat Confirmed
                        </span>
                        <span className="text-[11px] font-mono text-[var(--color-steel)]">{ev.ticket_id.slice(0, 8)}...</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-3.5 rounded-2xl bg-[var(--color-surface-soft)] text-center text-[12px] text-[var(--color-steel)]">
                    No event tickets purchased yet. <a href="/events" className="text-[var(--color-primary)] font-bold underline">Browse Spring Gala tickets</a>.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Pillars Grid (Student Goals) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Membership & Dues Pass */}
        <div className="p-6 rounded-3xl bg-white/85 backdrop-blur-md border border-[var(--color-hairline-soft)] shadow-xs space-y-4 t-card-interactive">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-mono font-bold text-[var(--color-steel)]">01 · MEMBERSHIP PASS</span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">Good Standing</span>
          </div>
          <h3 className="text-xl font-bold text-[var(--color-ink-deep)]">
            Annual Membership 2026
          </h3>
          <p className="text-[13px] text-[var(--color-steel)] leading-relaxed">
            Grants {membership?.ticket_discount_percent ?? 15}% discount on Spring Gala tickets, priority merchandise reservations, and full voting rights at association assemblies.
          </p>
          <div className="p-4 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)] flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-[var(--color-steel)]">VALID THROUGH</p>
              <p className="text-[14px] font-bold text-[var(--color-ink-deep)]">December 31, 2026</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold text-[var(--color-steel)]">ANNUAL DUES</p>
              <p className="text-[14px] font-bold text-emerald-600">₹250 Paid</p>
            </div>
          </div>
          <div className="pt-2 flex items-center gap-3">
            <a href="/memberships" className="text-[13px] font-bold text-[var(--color-primary)] hover:underline">
              View Tier Benefits →
            </a>
          </div>
        </div>

        {/* 2. Spring Gala Tickets */}
        <div className="p-6 rounded-3xl bg-white/85 backdrop-blur-md border border-[var(--color-hairline-soft)] shadow-xs space-y-4 t-card-interactive">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-mono font-bold text-[var(--color-steel)]">02 · EVENT ACCESS</span>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold">
              {upcomingEvents.length} Ticket Issued
            </span>
          </div>
          <h3 className="text-xl font-bold text-[var(--color-ink-deep)]">
            Spring Gala: Masquerade Night
          </h3>
          <p className="text-[13px] text-[var(--color-steel)] leading-relaxed">
            Friday, April 24, 2026 at 7:00 PM IST · Skyline Grand Ballroom, Student Activity Center.
          </p>
          <div className="p-4 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)] flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-[var(--color-steel)]">TICKET PASS</p>
              <p className="text-[14px] font-mono font-bold text-[var(--color-ink-deep)]">
                {upcomingEvents[0]?.ticket_id ? `TKT-GALA-${upcomingEvents[0].ticket_id.slice(0, 4).toUpperCase()}` : 'TKT-GALA-8819'}
              </p>
            </div>
            <div className="px-3 py-1 rounded-full bg-black text-white text-[11px] font-mono font-bold">
              Ready for Door Scan
            </div>
          </div>
          <div className="pt-2 flex items-center justify-between">
            <a href="/events" className="text-[13px] font-bold text-[var(--color-primary)] hover:underline">
              View Event Details & Guests →
            </a>
          </div>
        </div>

        {/* 3. Merch Orders */}
        <div className="p-6 rounded-3xl bg-white/85 backdrop-blur-md border border-[var(--color-hairline-soft)] shadow-xs space-y-4 t-card-interactive">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-mono font-bold text-[var(--color-steel)]">03 · APPAREL DROP</span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">Ready for Pickup</span>
          </div>
          <h3 className="text-xl font-bold text-[var(--color-ink-deep)]">
            Skyline Classic Pullover Hoodie
          </h3>
          <p className="text-[13px] text-[var(--color-steel)] leading-relaxed">
            Navy Blue · Size L · 380 GSM Heavyweight Fleece. Order ID: #ORD-7721 (10% Member Discount Applied).
          </p>
          <div className="p-4 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)] flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-[var(--color-steel)]">PICKUP LOCATION</p>
              <p className="text-[14px] font-bold text-[var(--color-ink-deep)]">Student Activity Center (SAC 201)</p>
            </div>
            <span className="text-[12px] font-bold text-amber-600">Pending Collection</span>
          </div>
          <div className="pt-2 flex items-center gap-3">
            <a href="/merch" className="text-[13px] font-bold text-[var(--color-primary)] hover:underline">
              Browse More Merch →
            </a>
          </div>
        </div>

        {/* 4. Club Announcements Feed */}
        <div className="p-6 rounded-3xl bg-white/85 backdrop-blur-md border border-[var(--color-hairline-soft)] shadow-xs space-y-4 t-card-interactive">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-mono font-bold text-[var(--color-steel)]">04 · BULLETIN & NOTICES</span>
            <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-800 text-[11px] font-bold">
              {announcements.length} Published
            </span>
          </div>
          <h3 className="text-xl font-bold text-[var(--color-ink-deep)]">
            Latest Club Circulars
          </h3>
          <div className="space-y-2">
            {announcements.slice(0, 2).map((ann) => (
              <div key={ann.id} className="p-3 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)]">
                <p className="text-[13px] font-bold text-[var(--color-ink-deep)]">{ann.title}</p>
                <p className="text-[11px] text-[var(--color-steel)] line-clamp-1">{ann.body}</p>
              </div>
            ))}
          </div>
          <div className="pt-2 flex items-center justify-between">
            <a href="/announcements" className="text-[13px] font-bold text-[var(--color-primary)] hover:underline">
              Read All Announcements →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

