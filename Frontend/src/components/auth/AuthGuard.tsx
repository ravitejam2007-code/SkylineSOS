import React, { useState, useEffect } from 'react';
import { getActiveSession, getCurrentUserSession, formatRoleLabel, type UserSession, type UserRole } from '../../lib/auth';
import { LoadingCard } from '../ui/LoadingState';

export interface AuthGuardProps {
  /**
   * Allowed roles for this view.
   * Use 'authenticated' to allow any signed-in user (regardless of role).
   * Or pass specific roles like 'admin', ['admin', 'treasurer'], etc.
   */
  requiredRole?: 'authenticated' | UserRole | UserRole[];
  /** Human-readable title of the protected page or portal (e.g. 'Admin Dashboard') */
  pageTitle: string;
  /** Human-readable role required for display (e.g. 'Executive Administrator') */
  requiredRoleLabel?: string;
  /** Child view to render once authorized */
  children: React.ReactNode;
}

export default function AuthGuard({
  requiredRole = 'authenticated',
  pageTitle,
  requiredRoleLabel,
  children,
}: AuthGuardProps) {
  const [session, setSession] = useState<UserSession | null>(() => {
    if (typeof window !== 'undefined') {
      return getActiveSession();
    }
    return null;
  });
  const [loading, setLoading] = useState(true);
  const [currentPath, setCurrentPath] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentPath(window.location.pathname + window.location.search);
    }

    getCurrentUserSession()
      .then((curr) => {
        setSession(curr);
      })
      .finally(() => {
        setLoading(false);
      });

    const handleAuthChange = (e: CustomEvent) => {
      setSession(e.detail);
    };

    window.addEventListener('campusone:auth_changed' as any, handleAuthChange);
    return () => {
      window.removeEventListener('campusone:auth_changed' as any, handleAuthChange);
    };
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20">
        <LoadingCard label={`Verifying security credentials & role authority for ${pageTitle}...`} />
      </div>
    );
  }

  // ─── 1. UNAUTHENTICATED BARRIER (NOT SIGNED IN) ───
  if (!session) {
    const loginUrl = `/login?redirect=${encodeURIComponent(currentPath || '/portal')}`;
    const signupUrl = `/signup?redirect=${encodeURIComponent(currentPath || '/portal')}`;

    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-6 t-enter">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-xs">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>

        <div className="space-y-2">
          <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-200">
            Authentication Required · Access Locked
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-ink-deep)]">
            Sign In to Access {pageTitle}
          </h2>
          <p className="text-sm text-[var(--color-steel)] max-w-md mx-auto leading-relaxed">
            Without logging in or signing up, you cannot access this portal or platform. Please sign in with your credentials or register a student account to proceed.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <a
            href={loginUrl}
            className="w-full sm:w-auto px-6 py-3 rounded-full bg-[var(--color-ink-deep)] hover:bg-black text-white font-bold text-sm shadow-sm transition-all t-button-action"
          >
            Sign In to Account →
          </a>
          <a
            href={signupUrl}
            className="w-full sm:w-auto px-6 py-3 rounded-full bg-white hover:bg-slate-50 text-[var(--color-ink-deep)] font-bold text-sm border border-[var(--color-hairline)] transition-all t-button-action"
          >
            Register Student Account
          </a>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <a
            href="/"
            className="text-xs font-semibold text-[var(--color-steel)] hover:text-black transition-colors"
          >
            ← Back to Public Home
          </a>
        </div>
      </div>
    );
  }

  // ─── 2. AUTHORITY / ROLE CHECK ───
  let isAllowed = false;
  if (requiredRole === 'authenticated') {
    isAllowed = true;
  } else {
    const allowedList: UserRole[] = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    // Admin always has supervisory access across all platforms
    if (session.role === 'admin' || session.roles?.includes('admin')) {
      isAllowed = true;
    } else {
      isAllowed = allowedList.includes(session.role) || session.roles?.some((r) => allowedList.includes(r as UserRole));
    }
  }

  // ─── 3. AUTHORITY MISMATCH BARRIER (403 FORBIDDEN) ───
  if (!isAllowed) {
    const expectedLabel = requiredRoleLabel || (Array.isArray(requiredRole) ? requiredRole.join(' or ') : requiredRole);
    const userRoleLabel = formatRoleLabel(session.role);

    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-6 t-enter">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-xs">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
        </div>

        <div className="space-y-2">
          <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
            403 Forbidden · Authority Mismatch
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-ink-deep)]">
            Access Denied: {expectedLabel} Required
          </h2>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-1.5 max-w-md mx-auto">
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold">Current Account:</span>
              <span className="font-bold text-[#0f172a]">{session.fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold">Your Assigned Role:</span>
              <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                {userRoleLabel}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-semibold">Required Authority:</span>
              <span className="font-bold text-slate-800">{expectedLabel}</span>
            </div>
          </div>
          <p className="text-xs text-[var(--color-steel)] max-w-md mx-auto leading-relaxed pt-1">
            As defined in the PRD, permissions and authority are strictly segregated to uphold least privilege. Student Members cannot access {pageTitle}.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {session.role === 'member' && (
            <a
              href="/portal"
              className="w-full sm:w-auto px-6 py-3 rounded-full bg-[var(--color-ink-deep)] hover:bg-black text-white font-bold text-sm shadow-sm transition-all t-button-action"
            >
              Open Student Portal →
            </a>
          )}
          <a
            href={`/login?redirect=${encodeURIComponent(currentPath)}`}
            className="w-full sm:w-auto px-6 py-3 rounded-full bg-white hover:bg-slate-50 text-[var(--color-ink-deep)] font-bold text-sm border border-[var(--color-hairline)] transition-all t-button-action"
          >
            Sign In with {expectedLabel} Account
          </a>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <a
            href="/"
            className="text-xs font-semibold text-[var(--color-steel)] hover:text-black transition-colors"
          >
            ← Back to Public Home
          </a>
        </div>
      </div>
    );
  }

  // ─── 4. AUTHORIZED: RENDER PAGE ───
  return <>{children}</>;
}
