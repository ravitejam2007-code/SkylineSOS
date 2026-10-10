import { useState, useEffect, useRef } from 'react';
import { signInWithPassword, signUp, type RoleType } from '../../lib/auth';
import { ButtonSpinner } from '../ui/LoadingState';

type RoleKey = 'student' | 'volunteer' | 'admin' | 'treasurer';

interface RoleOption {
  key: RoleKey;
  title: string;
  destination: string;
  badge: string;
  badgeClass: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    key: 'student',
    title: 'Student / Member',
    destination: 'Student Portal',
    badge: 'Member',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    key: 'volunteer',
    title: 'Event Volunteer',
    destination: 'Event Operations',
    badge: 'Operations',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  {
    key: 'admin',
    title: 'President / Admin',
    destination: 'Admin Dashboard',
    badge: 'Executive',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    key: 'treasurer',
    title: 'Treasurer',
    destination: 'Finance Dashboard',
    badge: 'Treasury',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
];

export default function AuthCard() {
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [selectedRole, setSelectedRole] = useState<RoleKey>('student');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Custom Role Dropdown State (transitions-dev specification)
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = ROLE_OPTIONS.find((r) => r.key === selectedRole) || ROLE_OPTIONS[0];

  const handleOpenDropdown = () => {
    setIsClosing(false);
    setDropdownOpen(true);
  };

  const handleCloseDropdown = () => {
    if (!dropdownOpen) return;
    setIsClosing(true);
    setDropdownOpen(false);
    setTimeout(() => {
      setIsClosing(false);
    }, 150); // Matches --dropdown-close-dur
  };

  const handleToggleDropdown = () => {
    if (dropdownOpen) {
      handleCloseDropdown();
    } else {
      handleOpenDropdown();
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        handleCloseDropdown();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseDropdown();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const mappedRole: RoleType = selectedRole === 'student' ? 'member' : (selectedRole as RoleType);

      if (authMode === 'signup') {
        const session = await signUp({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          studentId: studentId.trim() || undefined,
          role: mappedRole,
        });

        setSuccessMessage(`Welcome, ${session.fullName}! Account created successfully. Redirecting to ${session.destination}...`);

        setTimeout(() => {
          window.location.href = session.destination || '/portal';
        }, 900);
      } else {
        const session = await signInWithPassword(email.trim(), password, mappedRole);
        setSuccessMessage(`Welcome back, ${session.fullName}! Access granted.`);
        setTimeout(() => {
          window.location.href = session.destination || '/portal';
        }, 500);
      }
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes('rate limit') || err?.status === 429) {
        setErrorMessage(
          'Supabase email confirmation rate limit reached (3/hr on free tier). You can sign in immediately using 1-Click Demo accounts or pre-seeded credentials.'
        );
      } else {
        setErrorMessage(err.message || 'Authentication error. Please check your credentials and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto rounded-3xl glass-card border border-[var(--color-hairline-soft)] shadow-xl p-6 sm:p-10 t-enter">
      {/* Brand Header */}
      <div className="text-center space-y-3 mb-8">
        <div className="flex justify-center">
          <img
            src="/skylinesos-logo.jpg"
            alt="SkylineSOS Logo"
            className="w-14 h-14 rounded-2xl shadow-sm object-cover border border-black/10"
          />
        </div>
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)] text-[12px] font-bold text-[var(--color-ink-deep)]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Skyline Student Association · SkylineSOS Access
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[var(--color-ink-deep)]">
          {authMode === 'signin' ? 'Sign In to SkylineSOS' : 'Create SkylineSOS Account'}
        </h1>
        <p className="text-[13px] text-[var(--color-steel)] max-w-sm mx-auto leading-relaxed">
          {authMode === 'signin'
            ? 'Access your student dashboard, event tickets, apparel orders, or club operations.'
            : 'Join the Skyline Student Association platform for exclusive access, discounts, and voting rights.'}
        </p>
      </div>

      {/* Symmetrical Auth Mode Tabs */}
      <div className="flex items-center justify-center p-1 rounded-full bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)] max-w-xs mx-auto mb-8">
        <button
          type="button"
          onClick={() => {
            setAuthMode('signin');
            setErrorMessage(null);
            setSuccessMessage(null);
          }}
          className={`flex-1 py-2 rounded-full text-[13px] font-bold transition-all cursor-pointer ${
            authMode === 'signin'
              ? 'bg-[var(--color-ink-deep)] text-white shadow-xs'
              : 'text-[var(--color-steel)] hover:text-black'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setAuthMode('signup');
            setErrorMessage(null);
            setSuccessMessage(null);
          }}
          className={`flex-1 py-2 rounded-full text-[13px] font-bold transition-all cursor-pointer ${
            authMode === 'signup'
              ? 'bg-[var(--color-ink-deep)] text-white shadow-xs'
              : 'text-[var(--color-steel)] hover:text-black'
          }`}
        >
          Sign Up
        </button>
      </div>

      {/* Auth Form (Unified Symmetrical Format) */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-[13px] font-semibold text-center">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px] font-semibold text-center">
            {successMessage}
          </div>
        )}

        {/* Full Name (Sign Up only) */}
        {authMode === 'signup' && (
          <div>
            <label className="block text-[12px] font-bold text-[var(--color-ink-deep)] mb-1.5">
              Full Legal Name
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              className="w-full px-4 py-3 rounded-full border border-[var(--color-hairline)] bg-white text-[14px] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
            />
          </div>
        )}

        {/* Student ID / Roll Number (Sign Up only) */}
        {authMode === 'signup' && (
          <div>
            <label className="block text-[12px] font-bold text-[var(--color-ink-deep)] mb-1.5">
              University Student ID / Roll No. (Optional)
            </label>
            <input
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="e.g. SKY-2026-1042 (auto-assigned if blank)"
              className="w-full px-4 py-3 rounded-full border border-[var(--color-hairline)] bg-white text-[14px] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
            />
          </div>
        )}

        {/* Email Address */}
        <div>
          <label className="block text-[12px] font-bold text-[var(--color-ink-deep)] mb-1.5">
            Student University Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="student@skyline.edu"
            className="w-full px-4 py-3 rounded-full border border-[var(--color-hairline)] bg-white text-[14px] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-[12px] font-bold text-[var(--color-ink-deep)] mb-1.5">
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-3 rounded-full border border-[var(--color-hairline)] bg-white text-[14px] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
          />
        </div>

        {/* Assigned Role Destination (Custom Dropdown with transitions-dev) */}
        <div className="relative" ref={dropdownRef}>
          <label className="block text-[12px] font-bold text-[var(--color-ink-deep)] mb-1.5">
            Assigned Role Destination
          </label>

          {/* Custom Trigger Button (No native OS select) */}
          <button
            type="button"
            onClick={handleToggleDropdown}
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
            className="w-full px-4 py-3 rounded-full border border-[var(--color-hairline)] hover:border-[var(--color-ink-deep)] bg-white text-[14px] flex items-center justify-between transition-all cursor-pointer focus:outline-none focus:border-[var(--color-primary)] t-button-action"
          >
            <div className="flex items-center gap-2.5 truncate">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${selectedOption.badgeClass}`}>
                {selectedOption.badge}
              </span>
              <span className="font-bold text-[var(--color-ink-deep)] truncate">
                {selectedOption.title}
              </span>
              <span className="text-[12px] text-[var(--color-steel)] hidden sm:inline">
                → {selectedOption.destination}
              </span>
            </div>

            <svg
              className={`w-4 h-4 text-[var(--color-steel)] shrink-0 transition-transform duration-200 ${
                dropdownOpen ? 'rotate-180 text-[var(--color-ink-deep)]' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Animated Dropdown Menu Panel via transitions-dev (.t-dropdown) */}
          <div
            data-origin="top-center"
            className={`t-dropdown absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl glass-dropdown border border-[var(--color-hairline-soft)] shadow-2xl p-2 space-y-1 ${
              dropdownOpen ? 'is-open' : ''
            } ${isClosing ? 'is-closing' : ''}`}
            role="listbox"
          >
            {ROLE_OPTIONS.map((opt) => {
              const isSelected = opt.key === selectedRole;
              return (
                <div
                  key={opt.key}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    setSelectedRole(opt.key);
                    handleCloseDropdown();
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-left flex items-center justify-between transition-colors cursor-pointer select-none ${
                    isSelected
                      ? 'bg-[var(--color-surface-soft)] text-[var(--color-ink-deep)] font-bold'
                      : 'hover:bg-black/5 text-[var(--color-ink)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${opt.badgeClass}`}>
                      {opt.badge}
                    </span>
                    <div>
                      <p className="text-[13px] font-bold text-[var(--color-ink-deep)] leading-tight">
                        {opt.title}
                      </p>
                      <p className="text-[11px] text-[var(--color-steel)] leading-tight mt-0.5">
                        Destination: {opt.destination}
                      </p>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="text-[12px] font-bold text-[var(--color-primary)]">
                      ✓
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="pt-3">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-full bg-[var(--color-ink-deep)] text-white text-[14px] font-bold hover:bg-black transition-all cursor-pointer t-button-action flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
          >
            {loading ? (
              <ButtonSpinner size={16} />
            ) : authMode === 'signin' ? (
              `Sign In as ${selectedOption.title}`
            ) : (
              `Create Account & Open ${selectedOption.destination}`
            )}
          </button>
        </div>

        {/* Switch Mode Footer Link */}
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => {
              setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
            className="text-[13px] font-bold text-[var(--color-steel)] hover:text-black cursor-pointer underline transition-colors"
          >
            {authMode === 'signin'
              ? "Don't have an account? Sign up here"
              : 'Already have an account? Sign in with password'}
          </button>
        </div>
      </form>
    </div>
  );
}
