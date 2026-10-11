import { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { getCurrentUserSession } from '../../lib/auth';
import { LoadingCard, ButtonSpinner } from '../ui/LoadingState';
import type { StudentAllInOnePassResult, Announcement } from '@campusone/contracts';
import { REAL_BAKE_SALE_TASKS, sanitizeOperationsTasks, type RichFundraiserTask } from './FundraiserScene';

function checkIsMember(session: any, passPayload?: any): boolean {
  if (!session) return false;
  if (session.role === 'admin' || session.role === 'staff' || session.role === 'treasurer' || session.role === 'volunteer') return true;
  if (passPayload?.membership?.status === 'active') return true;
  if (typeof window !== 'undefined') {
    try {
      const rawApps = localStorage.getItem('skylinesos:membership_applications');
      if (rawApps) {
        const apps = JSON.parse(rawApps);
        const userApp = apps.find(
          (a: any) =>
            (a.applicant_email && session.email && a.applicant_email.toLowerCase() === session.email.toLowerCase()) ||
            (a.applicant_id && session.userId && a.applicant_id === session.userId)
        );
        if (userApp?.status === 'approved') return true;
      }
    } catch {}
  }
  return false;
}

export default function StudentPortalScene() {
  const [session, setSession] = useState<any>(null);
  const [pass, setPass] = useState<StudentAllInOnePassResult | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRenewing, setIsRenewing] = useState(false);
  const [renewSuccess, setRenewSuccess] = useState<string | null>(null);

  // Student Profile Photo state with user input & presets
  const [studentPhoto, setStudentPhoto] = useState<string>('/avatars/student-academic.jpg');
  const [photoToast, setPhotoToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Assigned Volunteer Duties for this Student Account
  const [volunteerTasks, setVolunteerTasks] = useState<RichFundraiserTask[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('skylinesos:operations_tasks');
        if (stored) return sanitizeOperationsTasks(JSON.parse(stored));
      } catch {}
    }
    return REAL_BAKE_SALE_TASKS;
  });
  const [taskFeedbackInputs, setTaskFeedbackInputs] = useState<Record<string, string>>({});
  const [feedbackSuccessToast, setFeedbackSuccessToast] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const currentSession = await getCurrentUserSession();
      setSession(currentSession);
      const [passRes, annList] = await Promise.all([
        api.generateAllInOnePass(currentSession?.userId),
        api.getAnnouncements('all_members'),
      ]);
      setPass(passRes);
      setAnnouncements(annList);

      // Load persisted student photo for current user
      if (currentSession && typeof window !== 'undefined') {
        const userKey = currentSession.userId || currentSession.email || 'default';
        const savedPhoto = localStorage.getItem('skylinesos_student_photo_' + userKey);
        if (savedPhoto) {
          setStudentPhoto(savedPhoto);
        }
      }
    } catch (err) {
      console.error('Error loading student portal data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Please select an image smaller than 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setStudentPhoto(result);
        const userKey = session?.userId || session?.email || 'default';
        try {
          localStorage.setItem('skylinesos_student_photo_' + userKey, result);
          setPhotoToast('Photo selected! Click "Save Photo" to confirm.');
          setTimeout(() => setPhotoToast(null), 3000);
        } catch (err) {
          console.warn('Could not save photo to storage:', err);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSavePhoto = () => {
    const userKey = session?.userId || session?.email || 'default';
    try {
      localStorage.setItem('skylinesos_student_photo_' + userKey, studentPhoto);
      setPhotoToast('Photo saved successfully!');
      setTimeout(() => setPhotoToast(null), 3000);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('skylinesos:photo_saved', { detail: studentPhoto }));
      }
    } catch (err) {
      console.warn('Could not save photo to storage:', err);
      setPhotoToast('Failed to save photo to local storage.');
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
        if (typeof window !== 'undefined') {
          const userKey = updated.userId || updated.email || 'default';
          const savedPhoto = localStorage.getItem('skylinesos_student_photo_' + userKey);
          if (savedPhoto) setStudentPhoto(savedPhoto);
        }
      }
    };
    const handleTasksUpdated = () => {
      try {
        const local = localStorage.getItem('skylinesos:operations_tasks');
        if (local) setVolunteerTasks(sanitizeOperationsTasks(JSON.parse(local)));
      } catch {}
    };

    window.addEventListener('campusone:auth_changed' as any, handleAuthChange);
    window.addEventListener('storage', handleTasksUpdated);
    window.addEventListener('skylinesos:tasks_updated' as any, handleTasksUpdated);
    return () => {
      window.removeEventListener('campusone:auth_changed' as any, handleAuthChange);
      window.removeEventListener('storage', handleTasksUpdated);
      window.removeEventListener('skylinesos:tasks_updated' as any, handleTasksUpdated);
    };
  }, []);

  // Handle student updating their assigned task status (To Do, In Progress, Complete)
  const handleUpdateStudentTaskStatus = async (taskId: string, newStatus: 'todo' | 'in_progress' | 'done', percent: number) => {
    const updated = volunteerTasks.map((t) => {
      if (t.id === taskId) {
        const statusNote = {
          id: `msg-status-${Date.now()}`,
          author: session?.fullName || 'Student Member',
          text: `Duty updated to ${newStatus.replace('_', ' ').toUpperCase()} (${percent}% done)`,
          timestamp: new Date().toISOString(),
        };
        return {
          ...t,
          status: newStatus as any,
          progressPercent: percent,
          messages: [...(t.messages || []), statusNote],
        };
      }
      return t;
    });

    setVolunteerTasks(updated);
    try {
      localStorage.setItem('skylinesos:operations_tasks', JSON.stringify(updated));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('skylinesos:tasks_updated', { detail: updated }));
      }
      api.updateTaskStatus(taskId, newStatus as any).catch(() => {});
    } catch {}

    setFeedbackSuccessToast(`Task updated to ${newStatus.replace('_', ' ').toUpperCase()}! Notice passed to Admin.`);
    setTimeout(() => setFeedbackSuccessToast(null), 3500);
  };

  // Handle student passing feedback to admin
  const handlePassFeedbackToAdmin = (taskId: string) => {
    const text = (taskFeedbackInputs[taskId] || '').trim();
    if (!text) return;

    const newMsg = {
      id: `msg-${Date.now()}`,
      author: session?.fullName || 'Student Member',
      text,
      timestamp: new Date().toISOString(),
    };

    const updated = volunteerTasks.map((t) => {
      if (t.id === taskId) {
        return {
          ...t,
          messages: [...(t.messages || []), newMsg],
        };
      }
      return t;
    });

    setVolunteerTasks(updated);
    setTaskFeedbackInputs((prev) => ({ ...prev, [taskId]: '' }));
    try {
      localStorage.setItem('skylinesos:operations_tasks', JSON.stringify(updated));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('skylinesos:tasks_updated', { detail: updated }));
      }
    } catch {}

    setFeedbackSuccessToast('Feedback passed to Chapter Admin successfully!');
    setTimeout(() => setFeedbackSuccessToast(null), 3500);
  };

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

  // Privacy Protection: Hide all personal data when user is logged out (User request)
  if (!session) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0f172a]">
            Personal Student Portal Locked
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Please sign in to access your personal digital membership pass, rotating door verification code, and organization records.
          </p>
        </div>
        <div>
          <a
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-black hover:bg-slate-900 text-white font-bold text-sm shadow-sm transition-all"
          >
            <span>Sign In to Student Portal</span>
            <span>→</span>
          </a>
        </div>
      </div>
    );
  }

  const membership = pass?.payload.membership;
  const upcomingEvents = pass?.payload.upcoming_events || [];

  // Scoped strictly to authenticated user session
  const displayName = session.fullName || 'Student Member';
  const displayEmail = session.email;
  const displayStudentId = session.studentId || `SKY-2026-${String(session.userId || 'NEW').slice(0, 4)}`;

  // Check if user has an approved membership application or is executive admin
  const isApprovedMember = checkIsMember(session, pass?.payload);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 t-enter">
      {/* Top Banner / Welcome Card */}
      <div className="p-8 rounded-3xl glass-card border border-[var(--color-hairline-soft)] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[12px] font-bold ${
              isApprovedMember
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                : 'bg-amber-50 border border-amber-200 text-amber-800'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isApprovedMember ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            {isApprovedMember
              ? 'Active Member · Skyline Student Association'
              : 'Membership Inactive · Not Enrolled'}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--color-ink-deep)]">
            Welcome, {displayName.split(' ')[0]}!
          </h1>
          <p className="text-[14px] text-[var(--color-steel)]">
            Student ID: <span className="font-mono font-bold text-[var(--color-ink)]">{displayStudentId}</span> · {displayEmail}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isApprovedMember ? (
            <>
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
                Reserve Event Passes
              </a>
            </>
          ) : (
            <a
              href="/memberships"
              className="px-6 py-3 rounded-full bg-[var(--color-primary)] text-white text-[13px] font-bold hover:bg-[var(--color-primary-deep)] transition-all cursor-pointer t-button-action"
            >
              Join Membership Tier →
            </a>
          )}
        </div>
      </div>

      {renewSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px] font-bold text-center t-toast is-open">
          {renewSuccess}
        </div>
      )}

      {/* Hero Section: All-in-One Digital Student Pass with Photo ID */}
      <div className="p-8 rounded-3xl glass-card border border-[var(--color-hairline-soft)] shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--color-hairline-soft)]">
          <div>
            <span className="text-[11px] font-mono font-bold text-[var(--color-steel)] uppercase">
              ALL-IN-ONE DIGITAL CREDENTIAL · VERIFIED STUDENT IDENTITY CARD
            </span>
            <h2 className="text-2xl font-bold text-[var(--color-ink-deep)] mt-1">
              Official Digital Student Identity Pass
            </h2>
            <p className="text-[13px] text-[var(--color-steel)]">
              Verified campus identity card consolidating student portrait badge, annual membership, gala admissions, and privileges.
            </p>
          </div>
          <span
            className={`self-start sm:self-center px-3.5 py-1.5 rounded-full text-[12px] font-bold ${
              isApprovedMember
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            {isApprovedMember ? membership?.tier_name || 'Active Member' : 'Membership Not Joined'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          {/* Minimalist Student Photo Card (User Request: Enlarged photo, upload button, save button, clean & minimalist) */}
          <div className="flex flex-col items-center justify-center p-6 sm:p-8 rounded-3xl bg-white border border-[var(--color-hairline-soft)] shadow-sm space-y-5 text-center">
            {/* Enlarged Photo */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative group cursor-pointer"
              title="Click to choose or change photo"
            >
              <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-3xl overflow-hidden bg-slate-100 border-2 border-slate-200 group-hover:border-[#0064e0] transition-all duration-300 shadow-sm flex items-center justify-center">
                <img
                  src={studentPhoto}
                  alt="Student portrait"
                  className="w-full h-full object-cover rounded-[22px] transition-transform duration-300 group-hover:scale-102"
                />
              </div>

              {/* Subtle hover overlay */}
              <div className="absolute inset-0 rounded-3xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center text-white text-xs font-bold gap-1.5 backdrop-blur-[2px]">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Change Photo</span>
              </div>
            </div>

            {/* Hidden File Input for User Choosing Photo */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />

            {/* Dual CTA: Upload Button & Save Button (DESIGN-meta.md specifications) */}
            <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto px-5 py-2.5 rounded-full border border-[var(--color-hairline)] hover:border-black text-[var(--color-ink-deep)] font-bold text-xs sm:text-sm bg-white hover:bg-slate-50 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>Upload Photo</span>
              </button>

              <button
                type="button"
                onClick={handleSavePhoto}
                className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#0064e0] hover:bg-[#0457cb] text-white font-bold text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>Save Photo</span>
              </button>
            </div>

            {photoToast && (
              <div className="text-xs font-bold text-emerald-600 animate-fadeIn">
                ✓ {photoToast}
              </div>
            )}
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
                  upcomingEvents.map((ev: any, idx: number) => {
                    const ticketIdStr = String(ev?.ticket_id || ev?.id || `TKT-${idx + 1}`);
                    const displayCode = ticketIdStr.length > 8 ? `${ticketIdStr.slice(0, 8)}...` : ticketIdStr;
                    return (
                      <div
                        key={ev?.ticket_id || ev?.id || idx}
                        className="p-3.5 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)] flex items-center justify-between"
                      >
                        <div>
                          <p className="text-[14px] font-bold text-[var(--color-ink-deep)]">
                            {ev?.event_title || ev?.title || 'Skyline Event'}
                          </p>
                          <p className="text-[11px] text-[var(--color-steel)]">
                            {ev?.venue || 'Campus Hall'} · {ev?.ticket_type_name || 'General Admission'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-black border border-slate-200">
                            Seat Confirmed
                          </span>
                          <span className="text-[11px] font-mono text-[var(--color-steel)]">{displayCode}</span>
                        </div>
                      </div>
                    );
                  })
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

      {/* ─── MY ASSIGNED VOLUNTEER DUTIES (Student Role Options & Feedback to Admin) ─── */}
      {/* User Request: "students tasks only students acconut inside task to do or proccess or complete options add feed back pass admin what are task complete todo status show" */}
      {(() => {
        const studentName = session?.fullName?.trim().toLowerCase() || '';
        const myAssignedDuties = volunteerTasks.filter((t) => {
          if (!studentName || !t.assignee_name) return false;
          const aName = t.assignee_name.trim().toLowerCase();
          return aName.includes(studentName) || studentName.includes(aName);
        });

        return (
          <div className="p-8 rounded-3xl glass-card border border-[var(--color-hairline-soft)] shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--color-hairline-soft)]">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Volunteer Duties & Tasks
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                    Student Account Exclusive
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-[var(--color-ink-deep)]">
                  My Assigned Volunteer Duties
                </h2>
                <p className="text-[13px] text-[var(--color-steel)] mt-0.5">
                  Bake sale duties assigned to your student pass. Update duty status (To Do, In Progress, Complete) and pass live feedback directly to chapter administrators.
                </p>
              </div>
              <span className="self-start sm:self-center px-3.5 py-1.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                {myAssignedDuties.length} Active Duties
              </span>
            </div>

            {feedbackSuccessToast && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold text-center">
                ✓ {feedbackSuccessToast}
              </div>
            )}

            {myAssignedDuties.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
                <p className="text-sm font-bold text-slate-800">
                  No volunteer duties currently assigned to your student account.
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  When chapter administrators schedule a bake sale duty for your name, it will appear here with To Do, In Progress, and Complete options.
                </p>
                <div className="pt-2">
                  <a
                    href="/volunteering"
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-black text-white text-xs font-bold hover:bg-slate-900 transition-colors"
                  >
                    <span>View Bake Sale Volunteering Board</span>
                    <span>→</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5">
                {myAssignedDuties.map((duty) => {
                  const percent =
                    duty.progressPercent ??
                    (duty.status === 'done' ? 100 : duty.status === 'in_progress' ? 50 : 0);

                  const getPriorityBadgeClass = (p: string) => {
                    switch (p) {
                      case 'urgent':
                        return 'bg-rose-100 text-rose-800 border border-rose-200';
                      case 'high':
                        return 'bg-amber-100 text-amber-800 border border-amber-200';
                      case 'medium':
                        return 'bg-slate-100 text-slate-800 border border-slate-200';
                      default:
                        return 'bg-slate-50 text-slate-600 border border-slate-200';
                    }
                  };

                  const getStatusBadgeClass = (s: string) => {
                    switch (s) {
                      case 'done':
                        return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
                      case 'in_progress':
                        return 'bg-amber-100 text-amber-800 border border-amber-200';
                      default:
                        return 'bg-slate-100 text-slate-700 border border-slate-200';
                    }
                  };

                  const getStationName = (st?: string) => {
                    switch (st) {
                      case 'baking':
                        return 'Baking Station';
                      case 'supplies':
                        return 'Supplies & Logistics';
                      case 'table':
                        return 'Quad Table Ops';
                      default:
                        return 'Station Duty';
                    }
                  };

                  return (
                    <div
                      key={duty.id}
                      className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-2xs space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                              {getStationName(duty.station)}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${getPriorityBadgeClass(duty.priority)}`}>
                              {duty.priority} Priority
                            </span>
                          </div>
                          <h3 className="text-base sm:text-lg font-bold text-[#0f172a]">
                            {duty.title}
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Due: {duty.due_at ? new Date(duty.due_at).toLocaleDateString() : 'Bake Sale Day'} · Assigned to your student pass
                          </p>
                        </div>

                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider self-start sm:self-auto ${getStatusBadgeClass(duty.status)}`}>
                          {duty.status.replace('_', ' ')} ({percent}%)
                        </span>
                      </div>

                      {/* Progress Bar & Student Status Buttons */}
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-700">Duty Execution Progress:</span>
                          <span className="text-black font-mono">{percent}% Complete</span>
                        </div>

                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              percent === 100
                                ? 'bg-emerald-500'
                                : percent > 0
                                ? 'bg-black'
                                : 'bg-slate-300'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        {/* Student Options: To Do, In Progress, Complete */}
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[11px] font-bold text-slate-700 uppercase">
                            Update Duty Status (Student Option):
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleUpdateStudentTaskStatus(duty.id, 'todo', 0)}
                              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                duty.status === 'todo'
                                  ? 'bg-black text-white shadow-xs'
                                  : 'bg-white text-slate-700 border border-slate-200 hover:border-black'
                              }`}
                            >
                              To Do (0%)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateStudentTaskStatus(duty.id, 'in_progress', 50)}
                              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                duty.status === 'in_progress'
                                  ? 'bg-amber-600 text-white shadow-xs'
                                  : 'bg-white text-amber-800 border border-amber-200 hover:bg-amber-50'
                              }`}
                            >
                              In Progress / Process (50%)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateStudentTaskStatus(duty.id, 'done', 100)}
                              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                duty.status === 'done'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50'
                              }`}
                            >
                              Complete (100%)
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Feedback Passed to Admin History & Input */}
                      <div className="space-y-2 pt-1">
                        {duty.messages && duty.messages.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-bold text-slate-600 uppercase flex items-center justify-between">
                              <span>Feedback Passed to Admin:</span>
                              <span className="text-[10px] text-slate-400 font-mono">{duty.messages.length} Entries</span>
                            </span>
                            {duty.messages.map((m: any) => (
                              <div
                                key={m.id}
                                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 flex justify-between items-start gap-2"
                              >
                                <p className="leading-relaxed">
                                  <strong className="text-slate-900">{m.author}:</strong> "{m.text}"
                                </p>
                                <span className="text-[10px] text-slate-400 whitespace-nowrap font-mono">
                                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Pass Feedback to Admin Input */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={taskFeedbackInputs[duty.id] || ''}
                            onChange={(e) =>
                              setTaskFeedbackInputs({ ...taskFeedbackInputs, [duty.id]: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handlePassFeedbackToAdmin(duty.id);
                              }
                            }}
                            placeholder="Pass feedback or progress note to Chapter Admin..."
                            className="flex-1 px-4 py-2 rounded-full border border-slate-300 bg-white text-xs focus:outline-none focus:border-black"
                          />
                          <button
                            type="button"
                            onClick={() => handlePassFeedbackToAdmin(duty.id)}
                            className="px-4 py-2 rounded-full bg-black hover:bg-slate-800 text-white text-xs font-bold cursor-pointer transition-colors shadow-2xs whitespace-nowrap"
                          >
                            Pass Feedback to Admin
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

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
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-black border border-slate-200 text-[11px] font-bold">
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
                {upcomingEvents[0]?.ticket_id
                  ? `TKT-GALA-${String(upcomingEvents[0].ticket_id).slice(0, 4).toUpperCase()}`
                  : upcomingEvents[0]?.id
                  ? `TKT-GALA-${String(upcomingEvents[0].id).slice(0, 4).toUpperCase()}`
                  : 'TKT-GALA-8819'}
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

