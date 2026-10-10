import { useState, useEffect } from 'react';
import { signInWithPassword, signInAsDemoRole, DEMO_ACCOUNTS, getCurrentUserSession, signOut, type UserSession } from '../../lib/auth';

export default function LoginScene() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<UserSession | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

    try {
      const session = await signInWithPassword(email, password);
      setCurrentSession(session);
      setSuccessMsg(`Welcome back, ${session.fullName}! Signed in as [${session.roles.join(', ') || 'member'}].`);
      localStorage.setItem('campusone_demo_role', session.roles[0] || 'member');
      window.dispatchEvent(new CustomEvent('campusone:role_changed', { detail: session.roles[0] || 'member' }));
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
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

  const handleQuickDemo = async (roleKey: string) => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const session = await signInAsDemoRole(roleKey);
      setCurrentSession(session);
      setSuccessMsg(`Authenticated as ${session.fullName} (${DEMO_ACCOUNTS[roleKey]?.label}) via Supabase Auth!`);
      localStorage.setItem('campusone_demo_role', roleKey);
      window.dispatchEvent(new CustomEvent('campusone:role_changed', { detail: roleKey }));
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Demo authentication failed');
    } finally {
      setLoading(false);
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
          <span className="font-bold">⚠</span> {errorMsg}
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
              <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">
                Student Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. yourname@skyline.edu"
                className="w-full px-4 py-2.5 rounded-full border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] text-[14px] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
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
                className="w-full px-4 py-2.5 rounded-full border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] text-[14px] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-6 rounded-full bg-[var(--color-ink-deep)] text-white text-[14px] font-bold hover:bg-black transition-colors disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
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
    </div>
  );
}
