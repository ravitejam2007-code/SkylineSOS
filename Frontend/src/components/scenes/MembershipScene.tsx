import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { formatPaise, formatDateTime } from '../../lib/formatters';
import { LoadingCard, ButtonSpinner } from '../ui/LoadingState';
import { getActiveSession, getCurrentUserSession, type UserSession } from '../../lib/auth';
import { openRazorpayCheckout } from '../../lib/razorpay';
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
    status: 'submitted',
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
  const [signInFirstModal, setSignInFirstModal] = useState<{ isOpen: boolean; tier?: CuratedTier } | null>(null);
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
        setSignInFirstModal(null);
      }
    };
    if (applyTier || reapplyApp || rejectModalApp || signInFirstModal) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [applyTier, reapplyApp, rejectModalApp, signInFirstModal]);

  // Handle Application Submit with Razorpay Payment Gateway
  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyTier) return;
    setIsApplying(true);
    try {
      const duesPaise = applyTier.fee_paise || 30000;
      const isNominalTest = duesPaise === 0;
      const chargeAmountPaise = duesPaise > 0 ? duesPaise : 100; // Razorpay requires >= 100 paise (₹1.00)

      // Step 1: Open Razorpay Payment Gateway Modal (Test Mode)
      const paymentResult = await openRazorpayCheckout({
        amountPaise: chargeAmountPaise,
        name: 'Skyline Student Association',
        description: `${applyTier.name} Membership — Annual Dues${isNominalTest ? ' (Test Gateway Verification)' : ''}`,
        prefill: {
          name: applicantName || session?.fullName || 'Student Applicant',
          email: applicantEmail || session?.email || 'student@skyline.edu',
        },
        notes: {
          membership_tier_id: applyTier.id,
          tier_name: applyTier.name,
          student_id: applicantIdNum || '',
        },
      });

      // Step 2: Only upon successful payment settlement, submit application with payment record
      const newApp: RichMembershipApplication = {
        id: `app-req-${Date.now()}`,
        organization_id: 'a0000000-0000-0000-0000-000000000001',
        applicant_id: session?.userId || 'current-user',
        applicant_name: applicantName || 'Student Applicant',
        applicant_email: applicantEmail || 'student@skyline.edu',
        student_id: applicantIdNum || 'SKY-2026-9901',
        requested_tier_id: applyTier.id,
        statement: `${statement} [Payment Settled via Razorpay: ${paymentResult.paymentId}]`,
        status: 'submitted',
        revision: 1,
        rejection_reason: null,
        submitted_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      (newApp as any).payment_id = paymentResult.paymentId;
      (newApp as any).amount_paid_paise = paymentResult.amountPaise;

      const updated = [newApp, ...applications.filter((a) => a.id !== newApp.id)];
      setApplications(updated);
      try {
        localStorage.setItem('skylinesos:membership_applications', JSON.stringify(updated));
        await api.submitMembershipApplication({
          applicant_name: applicantName,
          email: applicantEmail,
          student_id: applicantIdNum,
          requested_tier_id: applyTier.id,
          statement: newApp.statement || statement,
        }).catch(() => {});
      } catch {}

      setApplySuccess(
        `Payment of ${formatPaise(paymentResult.amountPaise)} successful via Razorpay (ID: ${paymentResult.paymentId})! Application for ${applyTier.name} submitted for executive review.`
      );
      setApplyTier(null);
    } catch (err: any) {
      alert(err.message || 'Payment was not completed. Membership application not submitted.');
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
      {(() => {
        const userApp = session
          ? applications.find(
              (a) =>
                (a.applicant_email && session.email && a.applicant_email.toLowerCase() === session.email.toLowerCase()) ||
                (a.applicant_id && session.userId && a.applicant_id === session.userId)
            )
          : null;

        const isAdmin = Boolean(session && session.role === 'admin');
        const isStaff = Boolean(
          session &&
            (session.role === 'admin' ||
              session.role === 'volunteer' ||
              session.role === 'treasurer' ||
              session.role === 'door_staff' ||
              (session.roles && session.roles.some((r: any) => r !== 'member')))
        );
        const isApprovedMember = Boolean(userApp?.status === 'approved' || isAdmin);
        const isPendingMember = Boolean(userApp?.status === 'submitted');
        const isRejectedMember = Boolean(userApp?.status === 'rejected');

        return (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-xs sm:text-sm font-bold text-[#0f172a] tracking-wider uppercase">
                MY MEMBERSHIP STATUS
              </h3>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  !session
                    ? 'bg-slate-100 text-slate-600 border border-slate-200/60'
                    : isApprovedMember
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : isPendingMember
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : isRejectedMember
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                {!session
                  ? 'Unauthenticated'
                  : isApprovedMember
                  ? isStaff
                    ? session.role === 'admin'
                      ? 'Executive Admin'
                      : 'Staff Officer'
                    : 'Active Member'
                  : isPendingMember
                  ? 'Pending Review ⏳'
                  : isRejectedMember
                  ? 'Application Rejected ✕'
                  : 'Not a Member · Not Active'}
              </span>
            </div>

            {!session ? (
              <div className="pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                    GUEST VISITOR · NOT SIGNED IN
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#64748b]">
                  Please sign in to check your active membership status or select any plan below. If you click a plan without logging in or registering, the <strong>Sign In First</strong> command prompt will be displayed.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <a
                    href="/login"
                    className="inline-block px-5 py-2.5 rounded-full bg-black hover:bg-slate-900 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    Sign In to Account →
                  </a>
                  <a
                    href="/signup"
                    className="inline-block px-4 py-2 rounded-full border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs sm:text-sm font-bold transition-colors cursor-pointer"
                  >
                    Register Account
                  </a>
                </div>
              </div>
            ) : isApprovedMember ? (
              <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-[#0f172a]">
                      {session.fullName} ({session.email})
                    </p>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                      DONE (APPROVED) ✓
                    </span>
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
            ) : isPendingMember ? (
              <div className="pt-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-[#0f172a]">
                    {session.fullName} ({session.email})
                  </p>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200">
                    APPLICATION IN REVIEW ⏳
                  </span>
                </div>
                <p className="text-xs text-[#64748b]">
                  Your application for membership tier is currently in review by the executive administration.
                </p>
                <p className="text-xs text-amber-700 font-semibold">
                  Once an administrator approves your application in the Review Board, your membership perks and digital pass will be unlocked.
                </p>
              </div>
            ) : isRejectedMember ? (
              <div className="pt-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-[#0f172a]">
                    {session.fullName} ({session.email})
                  </p>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-rose-100 text-rose-800 border border-rose-200">
                    REJECTED ✕
                  </span>
                </div>
                <p className="text-xs text-rose-700 font-medium">
                  Reason: {userApp?.rejection_reason || 'Incomplete student verification.'}
                </p>
                <div>
                  <a
                    href="#plans-section"
                    className="inline-block px-4 py-1.5 rounded-full bg-slate-800 text-white text-xs font-bold hover:bg-black transition-colors"
                  >
                    Select Plan to Re-Apply ↓
                  </a>
                </div>
              </div>
            ) : (
              /* Fresh Registered Account - Not a member yet */
              <div className="pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-[#0f172a]">
                      {session.fullName} ({session.email})
                    </p>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                      NEW ACCOUNT · NOT JOINED
                    </span>
                  </div>
                  <p className="text-xs text-[#64748b]">
                    Student ID:{' '}
                    <span className="font-mono font-semibold text-[#0f172a]">
                      {session.studentId || 'SKY-2026-NEW'}
                    </span>
                  </p>
                  <p className="text-xs text-slate-600">
                    You do not have an active membership yet. Select one of the 3 plans below to apply and join the Skyline Student Association.
                  </p>
                </div>
                <a
                  href="#plans-section"
                  className="inline-block px-5 py-2.5 rounded-full bg-black hover:bg-slate-900 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
                >
                  Choose a Plan Below ↓
                </a>
              </div>
            )}

            {session && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-slate-500">
                  Active Account: <strong>{session.fullName}</strong> ({session.email}) · <span className="font-semibold text-black">{session.role === 'admin' ? 'Executive Admin' : 'Student Member'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    logoutUser();
                    setSession(null);
                  }}
                  className="px-3 py-1 rounded-full border border-slate-300 hover:border-black text-slate-700 hover:text-black hover:bg-slate-50 text-[11px] font-bold cursor-pointer transition-colors"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* ─── PROMINENT SIGN IN FIRST NOTIFICATION BANNER (WHEN BROWSING WITHOUT LOGIN) ─── */}
      {!session && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950 shadow-2xs">
          <div className="flex items-start sm:items-center gap-3">
            <span className="p-2 rounded-xl bg-amber-200/70 border border-amber-300 text-amber-900 font-bold text-sm leading-none shrink-0">
              🔒
            </span>
            <div>
              <p className="text-xs sm:text-sm font-extrabold tracking-tight text-amber-950">
                Sign In First Command: Authentication Required
              </p>
              <p className="text-xs text-amber-800">
                You are browsing membership plans without login or register. Click any plan below to see the Sign In First command prompt, or sign in now.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/login"
              className="px-4 py-2 rounded-full bg-black hover:bg-slate-900 text-white text-xs font-bold transition-all shadow-xs"
            >
              Sign In
            </a>
            <a
              href="/signup"
              className="px-3.5 py-2 rounded-full bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border border-amber-300 transition-all"
            >
              Register
            </a>
          </div>
        </div>
      )}

      {/* ─── 1. TIER SELECTION & 3 ROW-WISE PLANS (MATCHING SCREENSHOT 004724) ─── */}
      <div id="plans-section" className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {tiers.map((t, idx) => {
          const isRecommended = Boolean(t.isRecommended || idx === 1);
          return (
            <div
              key={t.id}
              className={`p-7 sm:p-8 rounded-3xl bg-white border flex flex-col justify-between relative transition-all shadow-2xs hover:shadow-md ${
                isRecommended
                  ? 'border-2 border-black ring-1 ring-black/20'
                  : 'border-slate-200'
              }`}
            >
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[12px] font-bold uppercase tracking-wider ${
                      isRecommended ? 'text-black' : 'text-slate-500'
                    }`}
                  >
                    {t.categoryLabel || (isRecommended ? 'PREMIUM ACCESS' : 'ANNUAL TIER')}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                      isRecommended
                        ? 'bg-black text-white border border-black'
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
                  onClick={() => {
                    if (!session) {
                      setSignInFirstModal({
                        isOpen: true,
                        tier: t,
                      });
                    } else {
                      setApplyTier(t);
                    }
                  }}
                  className="w-full py-3.5 px-6 rounded-full font-bold text-white bg-black hover:bg-slate-900 active:scale-[0.99] transition-all text-xs sm:text-sm shadow-sm cursor-pointer"
                >
                  {!session
                    ? `Sign In First to Apply (${formatPaise(t.fee_paise)})`
                    : `Apply & Pay Dues (${formatPaise(t.fee_paise)})`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── MODAL: SIGN IN FIRST COMMAND (WHEN WITHOUT LOGIN OR REGISTER) ─── */}
      {signInFirstModal?.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl relative my-auto border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSignInFirstModal(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-black flex items-center justify-center text-xl font-bold cursor-pointer leading-none transition-colors"
              aria-label="Close"
            >
              ×
            </button>

            {/* Icon & Title */}
            <div className="text-center space-y-3 pt-2">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shadow-xs">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>

              <div>
                <span className="px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 inline-block mb-1.5">
                  Sign In First Command
                </span>
                <h3 className="text-2xl font-black text-[#0f172a] tracking-tight">
                  Sign In First
                </h3>
              </div>

              <p className="text-xs sm:text-sm text-[#475569] leading-relaxed max-w-xs mx-auto">
                You are currently browsing without login or registration. Please{' '}
                <strong className="text-black">sign in to your account</strong> or{' '}
                <strong className="text-black">register a new student account</strong> before selecting the{' '}
                <span className="font-bold text-black">{signInFirstModal.tier?.name || 'Membership'}</span> plan.
              </p>
            </div>

            {/* Plan Info Pill */}
            {signInFirstModal.tier && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-900">{signInFirstModal.tier.name} Plan</p>
                  <p className="text-slate-500">{signInFirstModal.tier.duration_days} Days Access</p>
                </div>
                <div className="text-right">
                  <p className="font-extrabold text-slate-900">{formatPaise(signInFirstModal.tier.fee_paise)}</p>
                  <p className="text-[11px] text-amber-700 font-semibold">Sign in to activate</p>
                </div>
              </div>
            )}

            {/* Command Action Buttons */}
            <div className="space-y-2.5 pt-1">
              <a
                href="/login"
                className="w-full py-3.5 px-6 rounded-full font-bold text-white bg-black hover:bg-slate-900 active:scale-[0.99] text-center block text-sm shadow-sm transition-all t-button-action"
              >
                Sign In to Account →
              </a>
              <a
                href="/signup"
                className="w-full py-3 px-6 rounded-full font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 active:scale-[0.99] text-center block text-sm border border-slate-200 transition-all t-button-action"
              >
                Register New Student Account
              </a>
              <button
                type="button"
                onClick={() => setSignInFirstModal(null)}
                className="w-full py-2.5 text-xs font-semibold text-slate-500 hover:text-black cursor-pointer transition-colors"
              >
                Dismiss / Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: APPLICATION SUBMIT FORM ─── */}
      {applyTier && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-5 shadow-2xl relative my-auto border border-slate-200 t-modal is-open">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4 sticky top-0 bg-white z-10 -mt-1 pt-1">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-black bg-slate-100 px-2.5 py-0.5 rounded-full inline-block mb-1">
                  Membership Application
                </span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] tracking-tight">
                  Join as {applyTier.name}
                </h3>
                <p className="text-xs sm:text-sm text-[#64748b] mt-0.5 font-medium">
                  Annual dues: <strong className="text-black">{formatPaise(applyTier.fee_paise)}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setApplyTier(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-black flex items-center justify-center text-xl cursor-pointer leading-none transition-colors shrink-0 ml-3"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {!session ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center font-bold">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
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
                    className="flex-1 py-3 px-6 rounded-full bg-black text-white text-[14px] font-bold hover:bg-slate-900 t-button-action text-center inline-block"
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
                    className="w-full px-4 py-3 rounded-full border border-slate-300 text-[14px] focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">Student University Email</label>
                  <input
                    type="email"
                    required
                    value={applicantEmail}
                    onChange={(e) => setApplicantEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-full border border-slate-300 text-[14px] focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">Student ID Number</label>
                  <input
                    type="text"
                    required
                    value={applicantIdNum}
                    onChange={(e) => setApplicantIdNum(e.target.value)}
                    className="w-full px-4 py-3 rounded-full border border-slate-300 text-[14px] focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">Applicant Statement</label>
                  <textarea
                    rows={3}
                    required
                    value={statement}
                    onChange={(e) => setStatement(e.target.value)}
                    className="w-full p-4 rounded-2xl border border-slate-300 text-[14px] focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                    placeholder="Share your background and club interest..."
                  />
                </div>

                <div className="text-[11px] text-[#64748b] bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1">
                  <div>
                    <strong>Razorpay Test Gateway:</strong> API Key <code className="px-1.5 py-0.5 rounded bg-slate-200 text-black font-mono text-[10px]">rzp_test_T8GBnZ6P23gRoO</code>
                  </div>
                  <div>
                    Membership dues ({formatPaise(applyTier.fee_paise)}) settle securely via Razorpay in test mode before application submission.
                  </div>
                </div>

                <div className="pt-2 flex flex-col-reverse sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => setApplyTier(null)}
                    className="w-full sm:w-auto sm:px-6 py-3.5 rounded-full border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-100 t-button-action cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isApplying}
                    className="flex-1 py-3.5 px-6 rounded-full bg-black text-white text-sm font-bold hover:bg-slate-900 cursor-pointer t-button-action flex items-center justify-center gap-2 shadow-sm transition-all"
                  >
                    {isApplying ? (
                      <>
                        <ButtonSpinner size={16} />
                        <span>Opening Razorpay Gateway...</span>
                      </>
                    ) : (
                      `Pay ${formatPaise(applyTier.fee_paise)} via Razorpay & Apply`
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL: REAPPLY FORM ─── */}
      {reapplyApp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl relative my-auto border border-slate-200 t-modal is-open">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4 sticky top-0 bg-white z-10 -mt-1 pt-1">
              <div>
                <span className="text-[12px] font-bold text-red-600 uppercase tracking-wider">Revision #{reapplyApp.revision + 1}</span>
                <h3 className="text-2xl font-bold text-[var(--color-ink-deep)]">Update & Reapply</h3>
                {reapplyApp.rejection_reason && (
                  <div className="mt-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[13px]">
                    <strong>Prior Review Note:</strong> {reapplyApp.rejection_reason}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setReapplyApp(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-black flex items-center justify-center text-xl cursor-pointer leading-none transition-colors shrink-0 ml-3"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleReapply} className="space-y-4">
              <div>
                <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">Updated Applicant Statement</label>
                <textarea
                  rows={4}
                  required
                  value={updatedStatement}
                  onChange={(e) => setUpdatedStatement(e.target.value)}
                  className="w-full p-4 rounded-2xl border border-slate-300 text-[14px] focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                  placeholder="Address reviewer feedback and include missing details..."
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReapplyApp(null)}
                  className="w-full sm:w-auto sm:px-6 py-3.5 rounded-full border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-100 t-button-action cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReapplying}
                  className="flex-1 py-3.5 px-6 rounded-full bg-black text-white text-sm font-bold hover:bg-slate-900 cursor-pointer t-button-action flex items-center justify-center gap-2 shadow-sm transition-all"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl relative my-auto border border-slate-200 t-modal is-open">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4 sticky top-0 bg-white z-10 -mt-1 pt-1">
              <div>
                <span className="text-[12px] font-bold text-red-600 uppercase tracking-wider">Review Decision</span>
                <h3 className="text-2xl font-bold text-[var(--color-ink-deep)]">Reject Application {rejectModalApp.id}</h3>
                <p className="text-[13px] text-slate-500">State a reason so the applicant can revise and reapply.</p>
              </div>
              <button
                type="button"
                onClick={() => setRejectModalApp(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-black flex items-center justify-center text-xl cursor-pointer leading-none transition-colors shrink-0 ml-3"
                aria-label="Close"
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
                  className="w-full p-4 rounded-2xl border border-slate-300 text-[14px] focus:outline-none focus:border-red-500"
                  placeholder="Explain what needs revision (e.g. Incomplete statement, missing ID)..."
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalApp(null)}
                  className="w-full sm:w-auto sm:px-6 py-3.5 rounded-full border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-100 t-button-action cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewingId === rejectModalApp.id}
                  className="flex-1 py-3.5 px-6 rounded-full bg-red-600 text-white text-sm font-bold hover:bg-red-700 cursor-pointer t-button-action flex items-center justify-center gap-2 shadow-sm transition-all"
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
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-black font-bold text-xs border border-slate-200">
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
