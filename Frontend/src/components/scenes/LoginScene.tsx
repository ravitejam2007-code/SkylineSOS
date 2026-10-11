import { useState, useEffect } from 'react';
import {
  signInWithPassword,
  signInAsDemoRole,
  DEMO_ACCOUNTS,
  getCurrentUserSession,
  signOut,
  verifyAdminSecretCode,
  type UserSession,
} from '../../lib/auth';

export default function LoginScene() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<'member' | 'volunteer' | 'admin' | 'treasurer'>('member');
  const [adminSecretCode, setAdminSecretCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<UserSession | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Admin Security Prompt Modal
  const [pendingDemoRole, setPendingDemoRole] = useState<string | null>(null);
  const [modalAdminSecret, setModalAdminSecret] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUserSession().then((session) => {
      if (session) setCurrentSession(session);
    });

    const handleAuthChange = (e: CustomEvent) => {
      setCurrentSession(e.detail);
    };

    window.addEventListener('campusone:auth_changed' as any, handleAuthChange);
    return () => {
      window.removeEventListener('campusone:auth_changed' as any, handleAuthChange);
    };
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // If logging into an admin account or admin role selected, require secret code
    if (selectedRole === 'admin' || email.toLowerCase().includes('admin')) {
      if (!verifyAdminSecretCode(adminSecretCode)) {
        setErrorMsg('Access Denied: Valid Admin Secret Security Code is mandatory for administrator sign-in. Use code: SKYLINE_ADMIN_2026');
        setLoading(false);
        return;
      }
    }

    try {
      const session = await signInWithPassword(email, password, selectedRole);
      setCurrentSession(session);
      setSuccessMsg(`Welcome back, ${session.fullName}! Signed in as [${session.roles.join(', ') || 'member'}].`);
      localStorage.setItem('campusone_demo_role', session.roles[0] || 'member');
      window.dispatchEvent(new CustomEvent('campusone:role_changed', { detail: session.roles[0] || 'member' }));
      
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const redirect = params?.get('redirect') || params?.get('next');
      const target = (redirect && redirect.startsWith('/')) ? redirect : (session.destination || '/portal');

      setTimeout(() => {
        window.location.href = target;
      }, 700);
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes('rate limit') || err?.status === 429) {
        setErrorMsg('Email verification rate limited (3/hr on free tier). Try signing in with 1-Click Demo accounts or retry in a few moments.');
      } else {
        setErrorMsg(err.message || 'Invalid credentials');
      }
    } finally {
      setLoading(false);
    }
  };

  const executeDemoLogin = async (roleKey: string) => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const session = await signInAsDemoRole(roleKey);
      setCurrentSession(session);
      setSuccessMsg(`Authenticated as ${session.fullName} (${DEMO_ACCOUNTS[roleKey]?.label}) via Supabase Auth!`);
      localStorage.setItem('campusone_demo_role', roleKey);
      window.dispatchEvent(new CustomEvent('campusone:role_changed', { detail: roleKey }));
      
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const redirect = params?.get('redirect') || params?.get('next');
      const target = (redirect && redirect.startsWith('/')) ? redirect : (session.destination || '/portal');

      setTimeout(() => {
        window.location.href = target;
      }, 700);
    } catch (err: any) {
      setErrorMsg(err.message || 'Demo authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (roleKey: string) => {
    if (roleKey === 'admin') {
      setPendingDemoRole('admin');
      setModalAdminSecret('');
      setModalError(null);
      return;
    }
    executeDemoLogin(roleKey);
  };

  const handleConfirmModalSecret = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyAdminSecretCode(modalAdminSecret)) {
      setPendingDemoRole(null);
      setModalError(null);
      executeDemoLogin('admin');
    } else {
      setModalError('Invalid Admin Secret Security Code. Access denied.');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setCurrentSession(null);
    setSuccessMsg('Signed out successfully.');
    localStorage.removeItem('campusone_demo_role');
    window.dispatchEvent(new CustomEvent('campusone:role_changed', { detail: 'guest' }));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Current session banner */}
      {currentSession && (
        <div className="mb-8 p-4 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-success)]" />
              <p className="font-bold text-[15px] text-[var(--color-ink-deep)]">
                Currently signed in as: {currentSession.fullName}
              </p>
            </div>
            <p className="text-[13px] text-[var(--color-steel)] mt-0.5">
              {currentSession.email} · Roles: <span className="font-semibold text-[var(--color-ink-deep)]">{currentSession.roles.join(', ') || 'member'}</span>
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 rounded-full text-[13px] font-bold border border-[var(--color-hairline)] text-[var(--color-ink-deep)] hover:bg-white transition-colors"
          >
            Sign Out
          </button>
        </div>
      )}

      {/* Success feedback */}
      {successMsg && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[14px] flex items-center gap-2">
          <span className="font-bold">✓</span> {successMsg}
        </div>
      )}

      {/* Error feedback */}
      {errorMsg && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-[14px] flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left: Email & Password Form (7 cols) */}
        <div className="md:col-span-6 bg-white p-6 sm:p-8 rounded-3xl border border-[var(--color-hairline-soft)] shadow-sm space-y-6">
          <div>
            <span className="text-[11px] font-bold tracking-wider text-[var(--color-steel)] uppercase">
              Secure Sign-In
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--color-ink-deep)] mt-1">
              Sign In to CampusOne
            </h2>
            <p className="text-[14px] text-[var(--color-steel)] mt-1">
              Enter your student email and password to access club features.
            </p>
          </div>

          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1.5">
                Choose Account Role *
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { key: 'member', label: 'Student Member' },
                  { key: 'volunteer', label: 'Operations & Lead' },
                  { key: 'admin', label: 'Executive Admin' },
                  { key: 'treasurer', label: 'Club Treasurer' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSelectedRole(opt.key as any)}
                    className={`p-2.5 rounded-2xl border text-xs font-bold text-left transition-all cursor-pointer flex items-center justify-between ${
                      selectedRole === opt.key
                        ? 'border-black bg-black text-white shadow-xs'
                        : 'border-slate-200 text-slate-700 bg-white hover:border-slate-400'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {selectedRole === opt.key && <span className="text-[10px]">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">
                Student Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. yourname@skyline.edu"
                className="w-full px-4 py-2.5 rounded-full border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] text-[14px] focus:outline-none focus:border-black transition-colors"
              />
            </div>

            <div>
              <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-2.5 rounded-full border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] text-[14px] focus:outline-none focus:border-black transition-colors"
              />
            </div>

            {(selectedRole === 'admin' || email.toLowerCase().includes('admin')) && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase">
                  <span>Admin Secret Security Code Required *</span>
                </div>
                <input
                  type="password"
                  required
                  value={adminSecretCode}
                  onChange={(e) => setAdminSecretCode(e.target.value)}
                  placeholder="Enter admin secret code"
                  className="w-full px-4 py-2 rounded-full border border-amber-300 bg-white text-[13px] focus:outline-none focus:border-black font-mono"
                />
                <span className="block text-[11px] text-amber-700">
                  Default Organization Master Key: <code className="font-mono bg-amber-100 px-1 py-0.5 rounded font-bold">SKYLINE_ADMIN_2026</code>
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 rounded-full bg-[var(--color-ink-deep)] text-white text-[14px] font-bold hover:bg-black transition-colors disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : `Sign In as ${selectedRole.toUpperCase()}`}
            </button>
          </form>

          <div className="pt-4 border-t border-[var(--color-hairline-soft)] text-center text-[13px] text-[var(--color-steel)]">
            Don't have an account?{' '}
            <a href="/signup" className="font-bold text-[var(--color-primary)] hover:underline">
              Create student account
            </a>
          </div>
        </div>

        {/* Right: Quick Demo Logins for Hackathon Evaluators (6 cols) */}
        <div className="md:col-span-6 bg-[var(--color-surface-soft)] p-6 sm:p-8 rounded-3xl border border-[var(--color-hairline-soft)] space-y-6">
          <div>
            <div className="inline-block text-[11px] font-bold bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full mb-2 border border-amber-200">
              Judges & Evaluators
            </div>
            <h3 className="text-xl font-bold text-[var(--color-ink-deep)]">
              1-Click Demo Accounts
            </h3>
            <p className="text-[13px] text-[var(--color-steel)] mt-1 leading-relaxed">
              Instantly authenticate as any of the 5 authorized roles to verify RLS permissions, door checks, and treasury access.
            </p>
          </div>

          <div className="space-y-2.5">
            {Object.entries(DEMO_ACCOUNTS).map(([key, acc]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleQuickDemo(key)}
                disabled={loading}
                className="w-full p-3 rounded-2xl bg-white border border-[var(--color-hairline-soft)] hover:border-[var(--color-ink-deep)] transition-all flex items-center justify-between text-left group"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[14px] text-[var(--color-ink-deep)] group-hover:text-[var(--color-primary)] transition-colors">
                      {acc.fullName}
                    </span>
                    <span className="text-[11px] font-semibold text-[var(--color-steel)] px-2 py-0.5 rounded-full bg-[var(--color-surface-soft)]">
                      {acc.label}
                    </span>
                  </div>
                  <p className="text-[12px] text-[var(--color-steel)] font-mono mt-0.5">
                    {acc.email}
                  </p>
                </div>
                <span className="text-[12px] font-bold text-[var(--color-ink-deep)] opacity-0 group-hover:opacity-100 transition-opacity">
                  Sign In →
                </span>
              </button>
            ))}
          </div>

          <div className="text-[12px] text-[var(--color-steel)] bg-white/60 p-3 rounded-xl border border-[var(--color-hairline-soft)]">
            <strong>Password for all demo accounts:</strong> <code className="font-mono bg-[var(--color-surface-soft)] px-1 py-0.5 rounded">Skyline@2026</code>
          </div>
        </div>
      </div>

      {/* Admin Secret Verification Modal for Quick Demo */}
      {pendingDemoRole === 'admin' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs text-[var(--color-ink-deep)] animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-5 shadow-2xl relative border border-slate-100">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-pink-100 text-pink-700">
                  Security Clearance Required
                </span>
                <h3 className="text-xl font-bold text-[#0f172a] mt-1">Admin Panel Secret Code</h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingDemoRole(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-black flex items-center justify-center cursor-pointer text-base"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Logging into <strong>Arjun Mehta (Admin Console)</strong> requires the organization secret code. Only authorized admins may enter.
            </p>

            {modalError && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmModalSecret} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Enter Admin Secret Code *
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={modalAdminSecret}
                  onChange={(e) => setModalAdminSecret(e.target.value)}
                  placeholder="Enter secret code (e.g. SKYLINE_ADMIN_2026)"
                  className="w-full px-4 py-2.5 rounded-full border border-slate-300 text-xs text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:border-black font-mono"
                />
                <span className="block text-[10px] text-slate-400 mt-1">
                  Master Organization Key: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600 font-mono">SKYLINE_ADMIN_2026</code>
                </span>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPendingDemoRole(null)}
                  className="flex-1 py-2.5 rounded-full border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-full bg-[#0f172a] hover:bg-black text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Verify & Unlock Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
