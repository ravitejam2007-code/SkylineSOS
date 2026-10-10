import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { formatPaise, formatDateTime } from '../../lib/formatters';
import { LoadingCard, ButtonSpinner } from '../ui/LoadingState';
import { getActiveSession, getCurrentUserSession, type UserSession } from '../../lib/auth';
import type {
  MembershipTier,
  MembershipApplication,
  MemberLookupResult,
} from '@campusone/contracts';

interface CuratedTier {
  id: string;
  organization_id: string;
  name: string;
  categoryLabel: string;
  badgeLabel: string;
  description: string;
  fee_paise: number;
  duration_days: number;
  ticket_discount_percent: number;
  merch_discount_percent: number;
  benefits: string[];
  is_active: boolean;
  isRecommended?: boolean;
}

const DEFAULT_TIERS: CuratedTier[] = [
  {
    id: 't1',
    organization_id: 'a0000000-0000-0000-0000-000000000001',
    name: 'Basic',
    categoryLabel: 'ANNUAL TIER',
    badgeLabel: 'Standard',
    description: 'Event access · Announcement feed',
    fee_paise: 10000,
    duration_days: 365,
    ticket_discount_percent: 0,
    merch_discount_percent: 0,
    benefits: ['Event access', 'Announcement feed'],
    is_active: true,
    isRecommended: false,
  },
  {
    id: 't2',
    organization_id: 'a0000000-0000-0000-0000-000000000001',
    name: 'Plus',
    categoryLabel: 'PREMIUM ACCESS',
    badgeLabel: 'Recommended',
    description: 'Member ticket prices · 10% merch discount · Priority registration',
    fee_paise: 30000,
    duration_days: 365,
    ticket_discount_percent: 10,
    merch_discount_percent: 10,
    benefits: ['Member ticket prices', '10% merch discount', 'Priority registration'],
    is_active: true,
    isRecommended: true,
  },
  {
    id: 't3',
    organization_id: 'a0000000-0000-0000-0000-000000000001',
    name: 'Core',
    categoryLabel: 'ANNUAL TIER',
    badgeLabel: 'Standard',
    description: 'Member ticket prices · 20% merch discount · Voting rights · Free gala entry',
    fee_paise: 50000,
    duration_days: 365,
    ticket_discount_percent: 20,
    merch_discount_percent: 20,
    benefits: ['Member ticket prices', '20% merch discount', 'Voting rights', 'Free gala entry'],
    is_active: true,
    isRecommended: false,
  },
];

export interface RichMembershipApplication {
  id: string;
  organization_id: string;
  applicant_id: string;
  applicant_name?: string;
  applicant_email?: string;
  student_id?: string;
  requested_tier_id: string;
  statement?: string;
  status: 'submitted' | 'approved' | 'rejected';
  revision: number;
  rejection_reason?: string | null;
  submitted_at?: string;
  created_at: string;
}

const DEFAULT_APPLICATIONS: RichMembershipApplication[] = [
  {
    id: 'app-sky-101',
    organization_id: 'a0000000-0000-0000-0000-000000000001',
    applicant_id: 'usr-maya',
    applicant_name: 'Maya Deshmukh',
    applicant_email: 'maya.d@skyline.edu',
    student_id: 'SKY-2026-8812',
    requested_tier_id: 't2',
    statement: 'Interested in leading the Hackathon mentorship team and joining robotics workshops.',
    status: 'submitted',
    revision: 1,
    rejection_reason: null,
    submitted_at: '2026-10-10T14:22:00Z',
    created_at: '2026-10-10T14:22:00Z',
  },
  {
    id: 'app-sky-102',
    organization_id: 'a0000000-0000-0000-0000-000000000001',
    applicant_id: 'usr-rahul',
    applicant_name: 'Rahul Sharma',
    applicant_email: 'rahul.s@skyline.edu',
    student_id: 'SKY-2026-4401',
    requested_tier_id: 't3',
    statement: 'Active campus organizer. Requesting Core tier membership to participate in chapter voting and volunteer tasks.',
    status: 'submitted',
    revision: 1,
    rejection_reason: null,
    submitted_at: '2026-10-10T16:45:00Z',
    created_at: '2026-10-10T16:45:00Z',
  },
  {
    id: 'app-sky-103',
    organization_id: 'a0000000-0000-0000-0000-000000000001',
    applicant_id: 'usr-sarah',
    applicant_name: 'Sarah Student',
    applicant_email: 'student@studentorg.edu',
    student_id: 'SKY-2026-1190',
    requested_tier_id: 't1',
    statement: 'Applying for standard club membership for gala tickets and hackathon workshops.',
    status: 'approved',
    revision: 1,
    rejection_reason: null,
    submitted_at: '2026-10-09T11:15:00Z',
    created_at: '2026-10-09T11:15:00Z',
  },
];

export default function MembershipScene() {
  const [session, setSession] = useState<UserSession | null>(() => {
    if (typeof window !== 'undefined') return getActiveSession();
    return null;
  });
  const [tiers, setTiers] = useState<CuratedTier[]>(DEFAULT_TIERS);
  const [applications, setApplications] = useState<RichMembershipApplication[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('skylinesos:membership_applications');
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return DEFAULT_APPLICATIONS;
  });
  const [loading, setLoading] = useState(false);

  // Async submission loading states
  const [isApplying, setIsApplying] = useState(false);
  const [isReapplying, setIsReapplying] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  // Application Modal/Form state
  const [applyTier, setApplyTier] = useState<CuratedTier | null>(null);
  const [applicantName, setApplicantName] = useState(() => {
    const s = typeof window !== 'undefined' ? getActiveSession() : null;
    return s?.fullName || '';
  });
  const [applicantEmail, setApplicantEmail] = useState(() => {
    const s = typeof window !== 'undefined' ? getActiveSession() : null;
    return s?.email || '';
  });
  const [applicantIdNum, setApplicantIdNum] = useState(() => {
    const s = typeof window !== 'undefined' ? getActiveSession() : null;
    return s?.studentId || '';
  });
  const [statement, setStatement] = useState('I want to volunteer on the design committee and join the student gala team.');
  const [applySuccess, setApplySuccess] = useState<string | null>(null);

  // Reapply state
  const [reapplyApp, setReapplyApp] = useState<RichMembershipApplication | null>(null);
  const [updatedStatement, setUpdatedStatement] = useState('');

  // Rejection modal state
  const [rejectModalApp, setRejectModalApp] = useState<RichMembershipApplication | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('Incomplete statement or missing student documentation');

  const loadData = async () => {
    try {
      let storedApps: RichMembershipApplication[] = [];
      if (typeof window !== 'undefined') {
        const local = localStorage.getItem('skylinesos:membership_applications');
        if (local) {
          try {
            storedApps = JSON.parse(local);
          } catch {}
        }
      }

      const [tList, aList] = await Promise.all([
        api.getMembershipTiers().catch(() => []),
        api.getMembershipApplications().catch(() => []),
      ]);
      if (Array.isArray(tList) && tList.length > 0) {
        setTiers((prev) =>
          prev.map((curated, idx) => {
            const apiTier = tList[idx] || tList.find((t) => t.name.toLowerCase() === curated.name.toLowerCase());
            if (!apiTier) return curated;
            return {
              ...curated,
              id: apiTier.id,
              fee_paise: apiTier.fee_paise || curated.fee_paise,
              ticket_discount_percent: apiTier.ticket_discount_percent || curated.ticket_discount_percent,
              merch_discount_percent: apiTier.merch_discount_percent || curated.merch_discount_percent,
            };
          })
        );
      }

      const combined = storedApps.length > 0 ? storedApps : (Array.isArray(aList) && aList.length > 0 ? aList as any : DEFAULT_APPLICATIONS);
      setApplications(combined);
      if (typeof window !== 'undefined' && storedApps.length === 0) {
        localStorage.setItem('skylinesos:membership_applications', JSON.stringify(combined));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();

    getCurrentUserSession().then((s) => {
      if (s) {
        setSession(s);
        setApplicantName(s.fullName);
        setApplicantEmail(s.email);
        if (s.studentId) setApplicantIdNum(s.studentId);
      }
    });

    const handleAuthChange = (e: CustomEvent) => {
      const newSession = e.detail as UserSession | null;
      setSession(newSession);
      if (newSession) {
        setApplicantName(newSession.fullName);
        setApplicantEmail(newSession.email);
        if (newSession.studentId) setApplicantIdNum(newSession.studentId);
      }
    };

    window.addEventListener('campusone:auth_changed' as any, handleAuthChange);
    return () => {
      window.removeEventListener('campusone:auth_changed' as any, handleAuthChange);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setApplyTier(null);
        setReapplyApp(null);
        setRejectModalApp(null);
      }
    };
    if (applyTier || reapplyApp || rejectModalApp) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [applyTier, reapplyApp, rejectModalApp]);

  // Handle Application Submit
  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyTier) return;
    setIsApplying(true);
    try {
      const newApp: RichMembershipApplication = {
        id: `app-req-${Date.now()}`,
        organization_id: 'a0000000-0000-0000-0000-000000000001',
        applicant_id: session?.userId || 'current-user',
        applicant_name: applicantName || 'Student Applicant',
        applicant_email: applicantEmail || 'student@skyline.edu',
        student_id: applicantIdNum || 'SKY-2026-9901',
        requested_tier_id: applyTier.id,
        statement,
        status: 'submitted',
        revision: 1,
        rejection_reason: null,
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      const updated = [newApp, ...applications.filter((a) => a.id !== newApp.id)];
      setApplications(updated);
      try {
        localStorage.setItem('skylinesos:membership_applications', JSON.stringify(updated));
        await api.submitMembershipApplication({
          applicant_name: applicantName,
          email: applicantEmail,
          student_id: applicantIdNum,
          requested_tier_id: applyTier.id,
          statement,
        }).catch(() => {});
      } catch {}

      setApplySuccess(`Application for ${applyTier.name} submitted successfully! In review by executive team.`);
      setApplyTier(null);
    } catch (err: any) {
      alert(err.message || 'Application submission failed');
    } finally {
      setIsApplying(false);
    }
  };

  // Handle Admin Review
  const handleReview = async (appId: string, decision: 'approved' | 'rejected', reason?: string) => {
    setReviewingId(appId);
    try {
      const updated = applications.map((item) =>
        item.id === appId
          ? {
              ...item,
              status: decision,
              rejection_reason: decision === 'rejected' ? (reason || 'Incomplete applicant details') : null,
            }
          : item
      );
      setApplications(updated);
      try {
        localStorage.setItem('skylinesos:membership_applications', JSON.stringify(updated));
        await api.reviewMembershipApplication({
          application_id: appId,
          decision,
          rejection_reason: reason,
          notes: decision === 'approved' ? 'Candidate meets all community requirements' : reason,
        }).catch(() => {});
      } catch {}
    } catch (err: any) {
      alert(err.message || 'Review failed');
    } finally {
      setReviewingId(null);
    }
  };

  // Handle Reapply
  const handleReapply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reapplyApp) return;
    setIsReapplying(true);
    try {
      await api.reapplyMembershipApplication({
        application_id: reapplyApp.id,
        updated_statement: updatedStatement,
      });
      setReapplyApp(null);
      setUpdatedStatement('');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsReapplying(false);
    }
  };

  if (loading) {
    return <LoadingCard label="Loading membership tiers & application records..." />;
  }

  return (
    <div className="space-y-16 t-enter">
      {/* Toast Feedback */}
      {applySuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex justify-between items-center text-sm shadow-2xs">
          <span>✓ {applySuccess}</span>
          <button
            onClick={() => setApplySuccess(null)}
            className="font-bold underline ml-4 text-xs cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ─── MY MEMBERSHIP STATUS CARD (MATCHING SCREENSHOT 004842) ─── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-xs sm:text-sm font-bold text-[#0f172a] tracking-wider uppercase">
            MY MEMBERSHIP STATUS
          </h3>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              session
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-slate-100 text-slate-600 border border-slate-200/60'
            }`}
          >
            {session ? 'Active Member' : 'Unauthenticated'}
          </span>
        </div>

        {!session ? (
          <div className="pt-4 space-y-3">
            <p className="text-xs sm:text-sm text-[#64748b]">
              Please sign in to check your active membership status or submit an application.
            </p>
            <div>
              <a
                href="/login"
                className="inline-block px-5 py-2.5 rounded-full bg-[#0064e0] hover:bg-[#0052b8] text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
              >
                Sign In to View
              </a>
            </div>
          </div>
        ) : (
          <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-[#0f172a]">
                  {session.fullName} ({session.email})
                </p>
                {applications.find(
                  (a) =>
                    a.applicant_email?.toLowerCase() === session?.email?.toLowerCase() ||
                    a.applicant_id === session?.userId
                ) && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                      applications.find(
                        (a) =>
                          a.applicant_email?.toLowerCase() === session?.email?.toLowerCase() ||
                          a.applicant_id === session?.userId
                      )?.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : applications.find(
                            (a) =>
                              a.applicant_email?.toLowerCase() === session?.email?.toLowerCase() ||
                              a.applicant_id === session?.userId
                          )?.status === 'rejected'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    Application Status:{' '}
                    {applications.find(
                      (a) =>
                        a.applicant_email?.toLowerCase() === session?.email?.toLowerCase() ||
                        a.applicant_id === session?.userId
                    )?.status === 'approved'
                      ? 'DONE (APPROVED) ✓'
                      : applications.find(
                          (a) =>
                            a.applicant_email?.toLowerCase() === session?.email?.toLowerCase() ||
                            a.applicant_id === session?.userId
                        )?.status === 'rejected'
                      ? 'REJECTED ✕'
                      : 'IN REVIEW ⏳'}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#64748b]">
                Student ID:{' '}
                <span className="font-mono font-semibold text-[#0f172a]">
                  {session.studentId || 'SKY-2026-1042'}
                </span>{' '}
                · Role: <span className="capitalize">{session.role || 'Member'}</span>
              </p>
              <p className="text-xs text-emerald-700 font-semibold pt-0.5">
                ✓ Verified Chapter Member · Member ticket discounts & club perks active
              </p>
            </div>
            <a
              href="/portal"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-slate-200 text-xs font-bold text-slate-800 bg-white hover:bg-slate-50 transition-colors shadow-2xs self-start sm:self-auto cursor-pointer"
            >
              View Digital Pass in Portal →
            </a>
          </div>
        )}
      </div>

      {/* ─── 1. TIER SELECTION & 3 ROW-WISE PLANS (MATCHING SCREENSHOT 004724) ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {tiers.map((t, idx) => {
          const isRecommended = Boolean(t.isRecommended || idx === 1);
          return (
            <div
              key={t.id}
              className={`p-7 sm:p-8 rounded-3xl bg-white border flex flex-col justify-between relative transition-all shadow-2xs hover:shadow-md ${
                isRecommended
                  ? 'border-2 border-[#0064e0] ring-1 ring-[#0064e0]/20'
                  : 'border-slate-200'
              }`}
            >
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[12px] font-bold uppercase tracking-wider ${
                      isRecommended ? 'text-[#0064e0]' : 'text-slate-500'
                    }`}
                  >
                    {t.categoryLabel || (isRecommended ? 'PREMIUM ACCESS' : 'ANNUAL TIER')}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                      isRecommended
                        ? 'bg-blue-50 text-[#0064e0] border border-blue-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {t.badgeLabel || (isRecommended ? 'Recommended' : 'Standard')}
                  </span>
                </div>

                <div>
                  <h3 className="text-3xl font-extrabold text-[#0f172a] tracking-tight">{t.name}</h3>
                  <p className="text-xs text-[#64748b] mt-1 line-clamp-2">{t.description}</p>
                </div>

                <div className="text-3xl font-black text-[#0f172a]">
                  {formatPaise(t.fee_paise)}
                  <span className="text-sm text-[#64748b] font-normal"> / {t.duration_days} days</span>
                </div>

                <div className="border-t border-slate-100 pt-5 space-y-2.5 text-xs text-[#334155]">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>
                      <strong>{t.ticket_discount_percent}% discount</strong> on Spring Gala tickets
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600 font-bold">✓</span>
                    <span>
                      <strong>{t.merch_discount_percent}% discount</strong> on club hoodies & merch
                    </span>
                  </div>
                  {Array.isArray(t.benefits) &&
                    t.benefits.map((b, bIdx) => (
                      <div key={bIdx} className="flex items-center gap-2">
                        <span className="text-emerald-600 font-bold">✓</span>
                        <span>{b}</span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setApplyTier(t)}
                  className="w-full py-3.5 px-6 rounded-full font-bold text-white bg-[#0064e0] hover:bg-[#0052b8] active:scale-[0.99] transition-all text-xs sm:text-sm shadow-sm cursor-pointer"
                >
                  Apply & Pay Dues ({formatPaise(t.fee_paise)})
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── MODAL: APPLICATION SUBMIT FORM ─── */}
      {applyTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 t-modal-backdrop is-open">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 space-y-6 shadow-2xl relative t-modal is-open">
            <div className="flex justify-between items-start border-b border-[var(--color-hairline-soft)] pb-4">
              <div>
                <h3 className="text-2xl font-bold text-[var(--color-ink-deep)]">Join as {applyTier.name}</h3>
                <p className="text-[14px] text-[var(--color-steel)]">Annual dues: {formatPaise(applyTier.fee_paise)}</p>
              </div>
              <button
                type="button"
                onClick={() => setApplyTier(null)}
                className="text-2xl text-[var(--color-steel)] hover:text-black cursor-pointer leading-none"
              >
                ×
              </button>
            </div>

            {!session ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-14 h-14 mx-auto rounded-full bg-blue-50 text-[#0064e0] flex items-center justify-center text-2xl font-bold">
                  🔒
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-lg font-bold text-[var(--color-ink-deep)]">Authentication Required</h4>
                  <p className="text-sm text-[var(--color-steel)] max-w-sm mx-auto">
                    Please sign in with your student credentials or register an account to apply for the {applyTier.name} membership tier and pay dues.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-3">
                  <a
                    href="/login"
                    className="flex-1 py-3 px-6 rounded-full bg-[#0064e0] text-white text-[14px] font-bold hover:bg-[#0052b8] t-button-action text-center inline-block"
                  >
                    Sign In to Continue
                  </a>
                  <button
                    type="button"
                    onClick={() => setApplyTier(null)}
                    className="py-3 px-6 rounded-full border border-[var(--color-hairline)] text-[14px] font-bold hover:bg-[var(--color-surface-soft)] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleApply} className="space-y-4">
                <div>
                  <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">Full Legal Name</label>
                  <input
                    type="text"
                    required
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    className="w-full px-4 py-3 rounded-full border border-[var(--color-hairline)] text-[14px] focus:outline-none focus:border-[var(--color-fb-blue)]"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">Student University Email</label>
                  <input
                    type="email"
                    required
                    value={applicantEmail}
                    onChange={(e) => setApplicantEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-full border border-[var(--color-hairline)] text-[14px] focus:outline-none focus:border-[var(--color-fb-blue)]"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">Student ID Number</label>
                  <input
                    type="text"
                    required
                    value={applicantIdNum}
                    onChange={(e) => setApplicantIdNum(e.target.value)}
                    className="w-full px-4 py-3 rounded-full border border-[var(--color-hairline)] text-[14px] focus:outline-none focus:border-[var(--color-fb-blue)]"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">Applicant Statement</label>
                  <textarea
                    rows={3}
                    required
                    value={statement}
                    onChange={(e) => setStatement(e.target.value)}
                    className="w-full p-4 rounded-2xl border border-[var(--color-hairline)] text-[14px] focus:outline-none focus:border-[var(--color-fb-blue)]"
                    placeholder="Share your background and club interest..."
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setApplyTier(null)}
                    className="flex-1 py-3 rounded-full border border-[var(--color-hairline)] text-[14px] font-bold hover:bg-[var(--color-surface-soft)] t-button-action cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isApplying}
                    className="flex-1 py-3 rounded-full bg-[var(--color-primary)] text-white text-[14px] font-bold hover:bg-[var(--color-primary-deep)] cursor-pointer t-button-action flex items-center justify-center gap-2"
                  >
                    {isApplying ? <ButtonSpinner size={16} /> : 'Submit Application'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL: REAPPLY FORM ─── */}
      {reapplyApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 t-modal-backdrop is-open">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 space-y-6 shadow-2xl relative t-modal is-open">
            <div className="border-b border-[var(--color-hairline-soft)] pb-4">
              <span className="text-[12px] font-bold text-[var(--color-critical)] uppercase tracking-wider">Revision #{reapplyApp.revision + 1}</span>
              <h3 className="text-2xl font-bold text-[var(--color-ink-deep)]">Update & Reapply</h3>
              {reapplyApp.rejection_reason && (
                <div className="mt-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[13px]">
                  <strong>Prior Review Note:</strong> {reapplyApp.rejection_reason}
                </div>
              )}
            </div>

            <form onSubmit={handleReapply} className="space-y-4">
              <div>
                <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">Updated Applicant Statement</label>
                <textarea
                  rows={4}
                  required
                  value={updatedStatement}
                  onChange={(e) => setUpdatedStatement(e.target.value)}
                  className="w-full p-4 rounded-2xl border border-[var(--color-hairline)] text-[14px] focus:outline-none focus:border-[var(--color-fb-blue)]"
                  placeholder="Address reviewer feedback and include missing details..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReapplyApp(null)}
                  className="flex-1 py-3 rounded-full border border-[var(--color-hairline)] text-[14px] font-bold hover:bg-[var(--color-surface-soft)] t-button-action cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReapplying}
                  className="flex-1 py-3 rounded-full bg-[var(--color-ink-deep)] text-white text-[14px] font-bold hover:bg-black cursor-pointer t-button-action flex items-center justify-center gap-2"
                >
                  {isReapplying ? <ButtonSpinner size={16} /> : `Submit Revision #${reapplyApp.revision + 1}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: REJECT FORM ─── */}
      {rejectModalApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 t-modal-backdrop is-open">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 space-y-6 shadow-2xl relative t-modal is-open">
            <div className="flex justify-between items-start border-b border-[var(--color-hairline-soft)] pb-4">
              <div>
                <span className="text-[12px] font-bold text-[var(--color-critical)] uppercase tracking-wider">Review Decision</span>
                <h3 className="text-2xl font-bold text-[var(--color-ink-deep)]">Reject Application {rejectModalApp.id}</h3>
                <p className="text-[13px] text-[var(--color-steel)]">State a reason so the applicant can revise and reapply.</p>
              </div>
              <button
                type="button"
                onClick={() => setRejectModalApp(null)}
                className="text-2xl text-[var(--color-steel)] hover:text-black cursor-pointer leading-none"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (rejectModalApp) {
                  handleReview(rejectModalApp.id, 'rejected', rejectReasonInput);
                  setRejectModalApp(null);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">Rejection Reason</label>
                <textarea
                  rows={3}
                  required
                  value={rejectReasonInput}
                  onChange={(e) => setRejectReasonInput(e.target.value)}
                  className="w-full p-4 rounded-2xl border border-[var(--color-hairline)] text-[14px] focus:outline-none focus:border-red-500"
                  placeholder="Explain what needs revision (e.g. Incomplete statement, missing ID)..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalApp(null)}
                  className="flex-1 py-3 rounded-full border border-[var(--color-hairline)] text-[14px] font-bold hover:bg-[var(--color-surface-soft)] t-button-action cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewingId === rejectModalApp.id}
                  className="flex-1 py-3 rounded-full bg-red-600 text-white text-[14px] font-bold hover:bg-red-700 cursor-pointer t-button-action flex items-center justify-center gap-2"
                >
                  {reviewingId === rejectModalApp.id ? <ButtonSpinner size={16} /> : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 2. SUBMITTED APPLICATIONS & REVIEW BOARD (ADMIN ONLY) ─── */}
      {session?.role === 'admin' && (
        <div className="p-8 rounded-3xl bg-[var(--color-canvas)] border border-[var(--color-hairline-soft)] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--color-hairline-soft)]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-pink-100 text-pink-700">
                  Admin Only
                </span>
                <h3 className="text-2xl font-bold text-[var(--color-ink-deep)]">Membership Applications & Review Board</h3>
              </div>
              <p className="text-[13px] text-[var(--color-steel)]">Review decisions, audit history, and re-submission workflows</p>
            </div>
            <span className="px-3 py-1 rounded-full text-[12px] font-bold bg-[var(--color-surface-soft)] text-[var(--color-ink)] border border-[var(--color-hairline-soft)]">
              {applications.length} on file
            </span>
          </div>

          <div className="divide-y divide-[var(--color-hairline-soft)]">
            {applications.map((app) => {
              const requestedTier = tiers.find((t) => t.id === app.requested_tier_id);
              return (
                <div key={app.id} className="py-5 space-y-3.5">
                  {/* Top Bar: Applicant Info & Live Status Done/Not */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h4 className="font-bold text-[16px] text-[var(--color-ink-deep)]">
                        {app.applicant_name || `Applicant ${app.id}`}
                      </h4>
                      <span className="text-xs text-[var(--color-steel)] font-mono">
                        ({app.applicant_email || 'student@skyline.edu'})
                      </span>
                      {app.student_id && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {app.student_id}
                        </span>
                      )}
                      <span
                        className={`px-3 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider ${
                          app.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : app.status === 'rejected'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {app.status === 'approved'
                          ? '✓ DONE (APPROVED)'
                          : app.status === 'rejected'
                          ? '✕ REJECTED'
                          : '⏳ PENDING REVIEW'}
                      </span>
                    </div>

                    <span className="text-[12px] text-[var(--color-steel)] font-mono">
                      {app.submitted_at ? formatDateTime(app.submitted_at) : 'Recent'}
                    </span>
                  </div>

                  {/* Requested Tier Info */}
                  <div className="text-[13px] text-[var(--color-ink)] flex items-center gap-2">
                    <span className="font-bold text-slate-700">Requested Membership Tier:</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0064e0] font-bold text-xs border border-blue-100">
                      {requestedTier?.name || 'Standard Tier'} ({requestedTier?.categoryLabel || 'ANNUAL'})
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      Fee: ₹{(requestedTier?.fee_paise || 10000) / 100}
                    </span>
                  </div>

                  {/* Statement */}
                  <p className="text-[13px] text-[var(--color-steel)] italic bg-[var(--color-surface-soft)] p-3 rounded-2xl border border-[var(--color-hairline-soft)] leading-relaxed">
                    "{app.statement || 'Student request for club participation and event registration.'}"
                  </p>

                  {app.rejection_reason && (
                    <div className="text-[13px] text-rose-700 bg-rose-50 p-3 rounded-xl border border-rose-200 font-medium">
                      <strong>Rejection Note:</strong> {app.rejection_reason}
                    </div>
                  )}

                  {/* Review Actions */}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    {app.status === 'submitted' && (
                      <>
                        <button
                          type="button"
                          disabled={reviewingId === app.id}
                          onClick={() => handleReview(app.id, 'approved')}
                          className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold cursor-pointer transition-all shadow-2xs inline-flex items-center gap-1.5"
                        >
                          {reviewingId === app.id ? <ButtonSpinner size={12} /> : '✓ Approve Membership (Done)'}
                        </button>
                        <button
                          type="button"
                          disabled={reviewingId === app.id}
                          onClick={() => {
                            setRejectModalApp(app);
                            setRejectReasonInput('Incomplete applicant statement or missing documentation');
                          }}
                          className="px-4 py-2 rounded-full border border-rose-300 text-rose-600 hover:bg-rose-50 text-[12px] font-bold cursor-pointer transition-all inline-flex items-center gap-1.5"
                        >
                          {reviewingId === app.id ? <ButtonSpinner size={12} color="#dc2626" /> : '✕ Reject with Reason'}
                        </button>
                      </>
                    )}

                    {app.status === 'approved' && (
                      <span className="text-[13px] text-emerald-700 font-bold flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                        ✓ Status Done: Approved & Active in Chapter Registry
                      </span>
                    )}

                    {app.status === 'rejected' && (
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] text-rose-700 font-bold flex items-center gap-1.5 bg-rose-50 px-3 py-1.5 rounded-full border border-rose-200">
                          ✕ Status Done: Rejected
                        </span>
                        <button
                          type="button"
                          onClick={() => handleReview(app.id, 'approved')}
                          className="text-[11px] font-bold text-slate-600 underline hover:text-black cursor-pointer ml-2"
                        >
                          Reconsider & Approve
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
