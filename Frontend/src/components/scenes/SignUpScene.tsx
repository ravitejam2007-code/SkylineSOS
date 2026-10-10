import { useState } from 'react';
import { signUp } from '../../lib/auth';

export default function SignUpScene() {
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const session = await signUp({
        email,
        password,
        fullName,
        studentId: studentId.trim() || undefined,
      });

      if (session.rateLimitNotice) {
        setSuccessMsg(
          `Welcome, ${session.fullName}! Account created directly in database (email verification rate limit bypassed). Redirecting to memberships...`
        );
      } else {
        setSuccessMsg(`Welcome, ${session.fullName}! Your student account has been created. Redirecting to memberships...`);
      }

      setTimeout(() => {
        window.location.href = '/memberships';
      }, 1200);
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes('rate limit') || err?.status === 429) {
        setErrorMsg('Supabase email verification rate limit exceeded (3/hr on free tier). Sign in via Demo Persona or try again shortly.');
      } else {
        setErrorMsg(err.message || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-[var(--color-hairline-soft)] shadow-sm space-y-6">
        <div>
          <span className="text-[11px] font-bold tracking-wider text-[var(--color-steel)] uppercase">
            New Student Registration
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--color-ink-deep)] mt-1">
            Create Your CampusOne Account
          </h2>
          <p className="text-[14px] text-[var(--color-steel)] mt-1">
            Sign up to apply for club membership, purchase discounted Gala tickets, and order hoodies.
          </p>
        </div>

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[14px] flex items-center gap-2">
            <span className="font-bold">✓</span> {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-[14px] flex items-center gap-2">
            <span className="font-bold">⚠</span> {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Maya Deshmukh"
              className="w-full px-4 py-2.5 rounded-full border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] text-[14px] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
            />
          </div>

          <div>
            <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">
              Student ID Number
            </label>
            <input
              type="text"
              required
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="e.g. SKY-2026-8812"
              className="w-full px-4 py-2.5 rounded-full border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] text-[14px] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
            />
          </div>

          <div>
            <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. maya.d@skyline.edu"
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
              placeholder="At least 6 characters"
              className="w-full px-4 py-2.5 rounded-full border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] text-[14px] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
            />
          </div>

          <div>
            <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full px-4 py-2.5 rounded-full border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] text-[14px] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-6 rounded-full bg-[var(--color-ink-deep)] text-white text-[14px] font-bold hover:bg-black transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? 'Creating Account...' : 'Register Student Account'}
          </button>
        </form>

        <div className="pt-4 border-t border-[var(--color-hairline-soft)] text-center text-[13px] text-[var(--color-steel)]">
          Already registered?{' '}
          <a href="/login" className="font-bold text-[var(--color-primary)] hover:underline">
            Sign in here
          </a>
        </div>
      </div>
    </div>
  );
}
