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

export default function MembershipScene() {
  const [session, setSession] = useState<UserSession | null>(() => {
    if (typeof window !== 'undefined') return getActiveSession();
    return null;
  });
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [applications, setApplications] = useState<MembershipApplication[]>([]);
  const [loading, setLoading] = useState(true);

  // Async submission loading states
  const [isApplying, setIsApplying] = useState(false);
  const [isReapplying, setIsReapplying] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [isWalkUpSubmitting, setIsWalkUpSubmitting] = useState(false);
  const [renewingId, setRenewingId] = useState<string | null>(null);

  // Application Modal/Form state
  const [applyTier, setApplyTier] = useState<MembershipTier | null>(null);
  const [applicantName, setApplicantName] = useState(() => {
    const s = typeof window !== 'undefined' ? getActiveSession() : null;
    return s?.fullName || 'Priya Nair';
  });
  const [applicantEmail, setApplicantEmail] = useState(() => {
    const s = typeof window !== 'undefined' ? getActiveSession() : null;
    return s?.email || 'p.nair@skyline.edu';
  });
  const [applicantIdNum, setApplicantIdNum] = useState(() => {
    const s = typeof window !== 'undefined' ? getActiveSession() : null;
    return s?.studentId || 'SKY-2026-4091';
  });
  const [statement, setStatement] = useState('I want to volunteer on the design committee and join the student gala team.');
  const [applySuccess, setApplySuccess] = useState<string | null>(null);

  // Reapply state
  const [reapplyApp, setReapplyApp] = useState<MembershipApplication | null>(null);
  const [updatedStatement, setUpdatedStatement] = useState('');

  // Rejection modal state
  const [rejectModalApp, setRejectModalApp] = useState<MembershipApplication | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('Incomplete statement or missing student documentation');

  // Walk-up state
  const [walkUpName, setWalkUpName] = useState('');
  const [walkUpEmail, setWalkUpEmail] = useState('');
  const [walkUpId, setWalkUpId] = useState('');
  const [walkUpTierId, setWalkUpTierId] = useState('');
  const [walkUpMethod, setWalkUpMethod] = useState<'cash' | 'manual_upi'>('cash');
  const [walkUpSuccess, setWalkUpSuccess] = useState<string | null>(null);

  // Member Lookup state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MemberLookupResult[]>([]);
  const [lookupFeedback, setLookupFeedback] = useState<string | null>(null);

  // Renewal state
  const [renewSuccess, setRenewSuccess] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [tList, aList] = await Promise.all([
        api.getMembershipTiers(),
        api.getMembershipApplications(),
      ]);
      setTiers(tList);
      setApplications(aList);
      if (tList.length > 0 && !walkUpTierId) {
        setWalkUpTierId(tList[0].id);
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
      await api.submitMembershipApplication({
        applicant_name: applicantName,
        email: applicantEmail,
        student_id: applicantIdNum,
        requested_tier_id: applyTier.id,
        statement,
      });
      setApplySuccess(`Application for ${applyTier.name} submitted successfully! In review by executive team.`);
      setApplyTier(null);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsApplying(false);
    }
  };

  // Handle Admin Review
  const handleReview = async (appId: string, decision: 'approved' | 'rejected', reason?: string) => {
    setReviewingId(appId);
    try {
      await api.reviewMembershipApplication({
        application_id: appId,
        decision,
        rejection_reason: reason,
        notes: decision === 'approved' ? 'Candidate meets all community requirements' : reason,
      });
      await loadData();
    } catch (err: any) {
      alert(err.message);
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

  // Handle Walk-up Registration
  const handleWalkUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkUpName || !walkUpEmail || !walkUpId) {
      alert('Please fill out all required fields');
      return;
    }
    setIsWalkUpSubmitting(true);
    try {
      const res = await api.recordWalkUpMembership({
        full_name: walkUpName,
        email: walkUpEmail,
        student_id: walkUpId,
        tier_id: walkUpTierId,
        payment_method: walkUpMethod,
      });
      setWalkUpSuccess(`Walk-up member ${walkUpName} activated! Dues posted to ledger (${res.ledgerEntry.id}).`);
      setWalkUpName('');
      setWalkUpEmail('');
      setWalkUpId('');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsWalkUpSubmitting(false);
    }
  };

  // Handle Door Member Search
  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults([]);
      setLookupFeedback(null);
      return;
    }
    try {
      const results = await api.lookupMember(val);
      setSearchResults(results);
      if (results.length === 0) {
        setLookupFeedback('No active student membership found with that query.');
      } else {
        setLookupFeedback(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Renewal
  const handleRenew = async (memberId: string) => {
    setRenewingId(memberId);
    try {
      const res = await api.renewMembership(memberId, 'online');
      setRenewSuccess(`Membership renewed until ${new Date(res.expires_at).toLocaleDateString()}! Dues recorded.`);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRenewingId(null);
    }
  };

  if (loading) {
    return <LoadingCard label="Loading membership tiers & application records..." />;
  }

  return (
    <div className="space-y-16 t-enter">
      {/* Toast Feedbacks */}
      {applySuccess && (
        <div className="p-4 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-success)] text-[var(--color-success)] flex justify-between items-center text-[14px] t-toast is-open">
          <span>✓ {applySuccess}</span>
          <button onClick={() => setApplySuccess(null)} className="font-bold underline ml-4 text-[12px] cursor-pointer">Dismiss</button>
        </div>
      )}
      {walkUpSuccess && (
        <div className="p-4 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-success)] text-[var(--color-success)] flex justify-between items-center text-[14px] t-toast is-open">
          <span>✓ {walkUpSuccess}</span>
          <button onClick={() => setWalkUpSuccess(null)} className="font-bold underline ml-4 text-[12px] cursor-pointer">Dismiss</button>
        </div>
      )}
      {renewSuccess && (
        <div className="p-4 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-success)] text-[var(--color-success)] flex justify-between items-center text-[14px] t-toast is-open">
          <span>✓ {renewSuccess}</span>
          <button onClick={() => setRenewSuccess(null)} className="font-bold underline ml-4 text-[12px] cursor-pointer">Dismiss</button>
        </div>
      )}

      {/* Active User Account Banner */}
      {session && (
        <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[13px] text-blue-950">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
            <span>
              Applying as authenticated student: <strong>{session.fullName}</strong> ({session.email})
            </span>
          </div>
          <span className="font-mono text-[11px] font-bold text-blue-800 bg-blue-100 px-3 py-1 rounded-full">
            {session.studentId || 'STUDENT ID ASSIGNED'}
          </span>
        </div>
      )}

      {/* ─── 1. TIER SELECTION & APPLICATION CARDS ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {tiers.map((t, idx) => {
          const isRecommended = idx === 1;
          return (
            <div
              key={t.id}
              className={`p-8 rounded-3xl bg-[var(--color-canvas)] border flex flex-col justify-between relative transition-all t-card-interactive ${
                isRecommended ? 'border-2 border-[var(--color-ink-deep)] shadow-sm' : 'border-[var(--color-hairline-soft)]'
              }`}
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className={`text-[13px] font-bold uppercase tracking-wider ${isRecommended ? 'text-[var(--color-primary)]' : 'text-[var(--color-steel)]'}`}>
                    {isRecommended ? 'Premium Access' : 'Annual Tier'}
                  </span>
                  <span className="px-3 py-1 rounded-full text-[12px] font-bold bg-[var(--color-surface-soft)] text-[var(--color-ink)] border border-[var(--color-hairline-soft)]">
                    {isRecommended ? 'Recommended' : 'Standard'}
                  </span>
                </div>

                <div>
                  <h3 className="text-3xl font-bold text-[var(--color-ink-deep)] mb-1">{t.name}</h3>
                  <p className="text-[14px] text-[var(--color-steel)]">{t.description}</p>
                </div>

                <div className="text-4xl font-extrabold text-[var(--color-ink-deep)]">
                  {formatPaise(t.fee_paise)}
                  <span className="text-[16px] text-[var(--color-steel)] font-normal"> / {t.duration_days} days</span>
                </div>

                <ul className="space-y-3 text-[14px] text-[var(--color-ink)] border-t border-[var(--color-hairline-soft)] pt-6">
                  <li className="flex items-center gap-2">
                    <span className="text-[var(--color-success)] font-bold">✓</span>
                    <span><strong>{t.ticket_discount_percent}% discount</strong> on Spring Gala tickets</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[var(--color-success)] font-bold">✓</span>
                    <span><strong>{t.merch_discount_percent}% discount</strong> on club hoodies & merch</span>
                  </li>
                  {Array.isArray(t.benefits) &&
                    t.benefits.map((b, bIdx) => (
                      <li key={bIdx} className="flex items-center gap-2">
                        <span className="text-[var(--color-success)] font-bold">✓</span>
                        <span>{b}</span>
                      </li>
                    ))}
                </ul>
              </div>

              <div className="pt-8 mt-6 border-t border-[var(--color-hairline-soft)]">
                {/* Cobalt Rule strictly for Dues Checkout */}
                <button
                  type="button"
                  onClick={() => setApplyTier(t)}
                  className="w-full py-3.5 px-6 rounded-full font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-deep)] transition-all text-[15px] shadow-sm cursor-pointer t-button-action"
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

      {/* ─── 2. SUBMITTED APPLICATIONS & REVIEW BOARD ─── */}
      <div className="p-8 rounded-3xl bg-[var(--color-canvas)] border border-[var(--color-hairline-soft)] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--color-hairline-soft)]">
          <div>
            <h3 className="text-2xl font-bold text-[var(--color-ink-deep)]">Membership Applications & Review Board</h3>
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
              <div key={app.id} className="py-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-[16px] text-[var(--color-ink-deep)]">
                      Application {app.id} · Revision #{app.revision}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                        app.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : app.status === 'rejected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {app.status}
                    </span>
                  </div>
                  <span className="text-[12px] text-[var(--color-steel)] font-mono">
                    {app.submitted_at ? formatDateTime(app.submitted_at) : 'Draft'}
                  </span>
                </div>

                <p className="text-[14px] text-[var(--color-ink)]">
                  <strong>Requested Tier:</strong> {requestedTier?.name || 'General Student Member'}
                </p>
                <p className="text-[14px] text-[var(--color-steel)] italic bg-[var(--color-surface-soft)] p-3 rounded-xl border border-[var(--color-hairline-soft)]">
                  "{app.statement}"
                </p>

                {app.rejection_reason && (
                  <div className="text-[13px] text-red-700 bg-red-50 p-3 rounded-xl border border-red-200">
                    <strong>Rejection Reason:</strong> {app.rejection_reason}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                  {app.status === 'submitted' && (
                    <>
                      <button
                        type="button"
                        disabled={reviewingId === app.id}
                        onClick={() => handleReview(app.id, 'approved')}
                        className="px-4 py-1.5 rounded-full bg-[var(--color-ink-deep)] text-white text-[12px] font-bold hover:bg-black cursor-pointer t-button-action inline-flex items-center gap-1.5"
                      >
                        {reviewingId === app.id ? <ButtonSpinner size={12} /> : 'Approve Membership'}
                      </button>
                      <button
                        type="button"
                        disabled={reviewingId === app.id}
                        onClick={() => {
                          setRejectModalApp(app);
                          setRejectReasonInput('Incomplete applicant statement or missing documentation');
                        }}
                        className="px-4 py-1.5 rounded-full border border-red-300 text-red-600 text-[12px] font-bold hover:bg-red-50 cursor-pointer t-button-action inline-flex items-center gap-1.5"
                      >
                        {reviewingId === app.id ? <ButtonSpinner size={12} color="#dc2626" /> : 'Reject with Reason'}
                      </button>
                    </>
                  )}

                  {app.status === 'rejected' && (
                    <button
                      type="button"
                      onClick={() => {
                        setReapplyApp(app);
                        setUpdatedStatement(app.statement || '');
                      }}
                      className="px-4 py-1.5 rounded-full bg-[var(--color-ink-deep)] text-white text-[12px] font-bold hover:bg-black cursor-pointer t-button-action"
                    >
                      Correct & Reapply
                    </button>
                  )}

                  {app.status === 'approved' && (
                    <span className="text-[13px] text-green-700 font-bold flex items-center gap-1">
                      ✓ Membership Active · Dues Verified
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── 3. WALK-UP SIGNUP & DOOR LOOKUP ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Walk-up Campus Registration Form */}
        <div className="p-8 rounded-3xl bg-[var(--color-canvas)] border border-[var(--color-hairline-soft)] space-y-6 t-card-interactive">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--color-hairline-soft)]">
            <div>
              <h3 className="text-xl font-bold text-[var(--color-ink-deep)]">Walk-up Campus Registration</h3>
              <p className="text-[13px] text-[var(--color-steel)]">Staff registers student walk-up at orientation desk</p>
            </div>
            <span className="px-3 py-1 rounded-full text-[12px] font-bold bg-[var(--color-surface-soft)] text-[var(--color-ink)] border border-[var(--color-hairline-soft)]">
              Desk staff
            </span>
          </div>

          <form onSubmit={handleWalkUp} className="space-y-4">
            <div>
              <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">Student Full Name</label>
              <input
                type="text"
                required
                value={walkUpName}
                onChange={(e) => setWalkUpName(e.target.value)}
                placeholder="e.g. Karan Malhotra"
                className="w-full px-4 py-3 rounded-full border border-[var(--color-hairline)] text-[14px] focus:outline-none focus:border-[var(--color-fb-blue)]"
              />
            </div>

            <div>
              <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">Student Email</label>
              <input
                type="email"
                required
                value={walkUpEmail}
                onChange={(e) => setWalkUpEmail(e.target.value)}
                placeholder="k.malhotra@skyline.edu"
                className="w-full px-4 py-3 rounded-full border border-[var(--color-hairline)] text-[14px] focus:outline-none focus:border-[var(--color-fb-blue)]"
              />
            </div>

            <div>
              <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">Student ID Number</label>
              <input
                type="text"
                required
                value={walkUpId}
                onChange={(e) => setWalkUpId(e.target.value)}
                placeholder="SKY-2026-9012"
                className="w-full px-4 py-3 rounded-full border border-[var(--color-hairline)] text-[14px] focus:outline-none focus:border-[var(--color-fb-blue)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">Membership Tier</label>
                <select
                  value={walkUpTierId}
                  onChange={(e) => setWalkUpTierId(e.target.value)}
                  className="w-full px-4 py-3 rounded-full border border-[var(--color-hairline)] text-[13px] focus:outline-none focus:border-[var(--color-fb-blue)] bg-white cursor-pointer"
                >
                  {tiers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({formatPaise(t.fee_paise)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">Payment Method</label>
                <select
                  value={walkUpMethod}
                  onChange={(e) => setWalkUpMethod(e.target.value as any)}
                  className="w-full px-4 py-3 rounded-full border border-[var(--color-hairline)] text-[13px] focus:outline-none focus:border-[var(--color-fb-blue)] bg-white cursor-pointer"
                >
                  <option value="cash">Staff Recorded Cash</option>
                  <option value="manual_upi">Manual UPI Desk QR</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isWalkUpSubmitting}
                className="w-full py-3.5 rounded-full bg-[var(--color-ink-deep)] text-white text-[14px] font-bold hover:bg-black transition-all cursor-pointer t-button-action flex items-center justify-center gap-2"
              >
                {isWalkUpSubmitting ? <ButtonSpinner size={16} /> : 'Record Walk-up Dues & Activate'}
              </button>
            </div>
          </form>
        </div>

        {/* Door-side Member Verification Card */}
        <div className="p-8 rounded-3xl bg-[var(--color-canvas)] border border-[var(--color-hairline-soft)] space-y-6 t-card-interactive">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--color-hairline-soft)]">
            <div>
              <h3 className="text-xl font-bold text-[var(--color-ink-deep)]">Door-Side Member Lookup</h3>
              <p className="text-[13px] text-[var(--color-steel)]">Verify membership in seconds if QR or Wi-Fi is shaky</p>
            </div>
            <span className="px-3 py-1 rounded-full text-[12px] font-bold bg-green-100 text-green-800">
              Door staff
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">Search by Name, Email, or ID</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Type member name, email, or student ID..."
                className="w-full px-4 py-3 rounded-full border border-[var(--color-hairline)] text-[14px] focus:outline-none focus:border-[var(--color-fb-blue)]"
              />
            </div>

            {lookupFeedback && (
              <p className="text-[13px] text-[var(--color-steel)] italic">{lookupFeedback}</p>
            )}

            {/* Results */}
            <div className="space-y-3">
              {searchResults.map((m) => (
                <div
                  key={m.id}
                  className="p-4 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)] space-y-2 t-card-interactive"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[15px] text-[var(--color-ink-deep)]">{m.full_name}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                        m.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {m.status === 'active' ? 'Active Member' : 'Expired'}
                    </span>
                  </div>
                  <p className="text-[13px] text-[var(--color-steel)]">
                    {m.student_id} · {m.tier_name}
                  </p>
                  <div className="text-[12px] text-[var(--color-slate)] pt-1 flex flex-wrap justify-between gap-2 border-t border-[var(--color-hairline-soft)] mt-2">
                    <span>Expires: {new Date(m.expires_at).toLocaleDateString()}</span>
                    <span className="text-green-700 font-bold">
                      Eligible for {m.ticket_discount_percent}% Gala Discount
                    </span>
                  </div>

                  {/* Immediate Renewal Action */}
                  <div className="pt-2">
                    <button
                      type="button"
                      disabled={renewingId === m.id}
                      onClick={() => handleRenew(m.id)}
                      className="px-3 py-1 rounded-full text-[12px] font-bold bg-[var(--color-ink-deep)] text-white hover:bg-black cursor-pointer t-button-action inline-flex items-center gap-1.5"
                    >
                      {renewingId === m.id ? <ButtonSpinner size={12} /> : 'Renew Membership (+365 Days)'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
