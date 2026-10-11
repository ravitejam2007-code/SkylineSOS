import { useState, useEffect } from 'react';
import { getActiveSession, type UserSession } from '../../lib/auth';

export default function LandingAuthGate() {
  const [session, setSession] = useState<UserSession | null>(() => {
    if (typeof window !== 'undefined') {
      return getActiveSession();
    }
    return null;
  });

  const [showGateModal, setShowGateModal] = useState(false);
  const [intendedAction, setIntendedAction] = useState<string>('continue');
  const [showLoggedOutBanner, setShowLoggedOutBanner] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLoggedOutUrl = window.location.search.includes('logged_out=true');
      const isLoggedOutSession = sessionStorage.getItem('skylinesos_logged_out_notice') === 'true';

      if (isLoggedOutUrl || isLoggedOutSession) {
        setShowLoggedOutBanner(true);
      }

      // Sync active session
      const current = getActiveSession();
      setSession(current);

      const handleAuthChange = (e: CustomEvent) => {
        setSession(e.detail);
      };
      window.addEventListener('campusone:auth_changed' as any, handleAuthChange);

      // Global click interceptor for protected portals and admin platform when unauthenticated
      const handleGlobalClick = (e: MouseEvent) => {
        const active = getActiveSession();
        if (active) return; // User is authenticated, permit normal action

        const target = (e.target as HTMLElement).closest('a, button') as HTMLElement | null;
        if (!target) return;

        const href = target.getAttribute('href');
        const isAuthLink = href === '/login' || href === '/signup';
        const isModalButton = target.closest('[data-auth-gate-modal="true"]');

        if (isAuthLink || isModalButton) return;

        // Check if target points to a protected portal or platform dashboard
        if (
          href &&
          (href.startsWith('/portal') ||
            href.startsWith('/operations') ||
            href.startsWith('/admin') ||
            href.startsWith('/treasurer') ||
            href.startsWith('/door') ||
            href.startsWith('/finance'))
        ) {
          e.preventDefault();
          e.stopPropagation();
          const label = target.textContent?.trim() || 'this portal';
          setIntendedAction(`access ${label}`);
          setShowGateModal(true);
        }
      };

      document.addEventListener('click', handleGlobalClick, true);

      return () => {
        window.removeEventListener('campusone:auth_changed' as any, handleAuthChange);
        document.removeEventListener('click', handleGlobalClick, true);
      };
    }
  }, []);

  const handleDismissBanner = () => {
    setShowLoggedOutBanner(false);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('skylinesos_logged_out_notice');
    }
  };

  return (
    <>
      {/* ─── TOP LOGGED-OUT ALERT BANNER ─── */}
      {showLoggedOutBanner && !session && (
        <div className="w-full bg-amber-50 border-b border-amber-200 px-4 py-3 sm:px-6 shadow-2xs animate-in slide-in-from-top duration-200">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2.5 text-amber-950 font-semibold">
              <span className="p-1 rounded-full bg-amber-200 text-amber-900 text-xs">🔒</span>
              <span>
                You have been logged out. Please <strong>sign in</strong> or <strong>register</strong> your account to access your personal student portal and platform tools.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href="/login"
                className="px-3.5 py-1.5 rounded-full bg-black text-white font-bold hover:bg-slate-900 transition-colors shadow-2xs text-xs"
              >
                Sign In
              </a>
              <a
                href="/signup"
                className="px-3 py-1.5 rounded-full bg-white text-slate-800 font-bold border border-amber-300 hover:bg-amber-100 transition-colors text-xs"
              >
                Register
              </a>
              <button
                type="button"
                onClick={handleDismissBanner}
                className="text-slate-400 hover:text-black text-base px-1.5 cursor-pointer leading-none"
                aria-label="Dismiss banner"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: SIGN IN FIRST GATE (BLURRED BACKGROUND) ─── */}
      {showGateModal && !session && (
        <div
          data-auth-gate-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/75 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl relative my-auto border border-slate-200 animate-in zoom-in-95 duration-150">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setShowGateModal(false)}
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
                  Authentication Required
                </span>
                <h3 className="text-2xl font-black text-[#0f172a] tracking-tight">
                  Sign In or Register First
                </h3>
              </div>

              <p className="text-xs sm:text-sm text-[#475569] leading-relaxed max-w-xs mx-auto">
                Without logging in or signing up, access to the portal and platform is locked. Please <strong className="text-black">sign in</strong> or{' '}
                <strong className="text-black">register</strong> to {intendedAction}.
              </p>
            </div>

            {/* Action Buttons */}
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
                onClick={() => setShowGateModal(false)}
                className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-black cursor-pointer transition-colors"
              >
                Dismiss / Continue Browsing Public Events
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
