import { useState, useEffect, useRef } from 'react';
import { getActiveSession, logoutUser, type UserSession } from '../../lib/auth';

export default function UserNavMenu() {
  const [session, setSession] = useState<UserSession | null>(() => {
    if (typeof window !== 'undefined') {
      return getActiveSession();
    }
    return null;
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Sync on mount
    const current = getActiveSession();
    if (current?.userId !== session?.userId || current?.fullName !== session?.fullName) {
      setSession(current);
    }

    const handleAuthChange = (e: CustomEvent) => {
      setSession(e.detail);
    };

    window.addEventListener('campusone:auth_changed' as any, handleAuthChange);

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('campusone:auth_changed' as any, handleAuthChange);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleLogout = () => {
    logoutUser();
    setSession(null);
    setDropdownOpen(false);
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    if (path.startsWith('/admin') || path.startsWith('/operations') || path.startsWith('/treasurer') || path.startsWith('/portal')) {
      window.location.href = '/memberships';
    }
  };

  if (!session) {
    return (
      <div className="flex items-center gap-3">
        <a
          href="/login"
          className="text-[13px] font-bold text-[var(--color-ink)] hover:text-black px-3.5 py-1.5 rounded-full hover:bg-[var(--color-surface-soft)] transition-all t-button-action"
        >
          Sign In
        </a>
        <a
          href="/memberships"
          className="text-[13px] font-bold bg-[var(--color-ink-deep)] text-white hover:bg-black px-4 py-2 rounded-full transition-all shadow-sm t-button-action"
        >
          Join Club
        </a>
      </div>
    );
  }

  const currentRole = session.role || 'member';
  const roleBadgeLabel = (
    {
      member: 'Member',
      volunteer: 'Volunteer',
      door_staff: 'Volunteer',
      admin: 'President / Admin',
      treasurer: 'Treasurer',
    } as Record<string, string>
  )[currentRole] || 'Member';

  const destinationLabel = (
    {
      member: 'Student Portal',
      volunteer: 'Event Operations',
      door_staff: 'Event Operations',
      admin: 'Admin Dashboard',
      treasurer: 'Finance Dashboard',
    } as Record<string, string>
  )[currentRole] || 'Dashboard';

  const avatarInitials = session.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative flex items-center gap-3" ref={dropdownRef}>
      {/* Primary Role Destination Link */}
      <a
        href={session.destination}
        className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--color-surface-soft)] hover:bg-[var(--color-hairline-soft)] border border-[var(--color-hairline-soft)] text-[13px] font-bold text-[var(--color-ink-deep)] transition-all t-button-action"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>{destinationLabel}</span>
      </a>

      {/* User Profile Capsule with Dropdown */}
      <button
        type="button"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        aria-expanded={dropdownOpen}
        aria-haspopup="true"
        className="flex items-center gap-2 p-1 pl-2 sm:pr-3 rounded-full border border-[var(--color-hairline-soft)] hover:border-[var(--color-hairline)] bg-white/80 hover:bg-white backdrop-blur-md transition-all cursor-pointer t-button-action"
        aria-label="User navigation menu"
      >
        <div className="w-7 h-7 rounded-full bg-[var(--color-ink-deep)] text-white text-[11px] font-extrabold flex items-center justify-center">
          {avatarInitials}
        </div>
        <div className="hidden md:flex flex-col text-left">
          <span className="text-[12px] font-bold text-[var(--color-ink-deep)] leading-tight max-w-[110px] truncate">
            {session.fullName}
          </span>
          <span className="text-[10px] font-semibold text-[var(--color-steel)] leading-none">
            {roleBadgeLabel}
          </span>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-[var(--color-steel)] transition-transform duration-200 ${
            dropdownOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Glassmorphic Dropdown Panel */}
      {dropdownOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl glass-dropdown border border-[var(--color-hairline-soft)] shadow-xl p-3 z-50 t-enter space-y-2">
          {/* Header Info */}
          <div className="px-3 py-2 border-b border-[var(--color-hairline-soft)]">
            <p className="text-[13px] font-bold text-[var(--color-ink-deep)]">{session.fullName}</p>
            <p className="text-[11px] text-[var(--color-steel)] truncate">{session.email}</p>
            <div className="mt-1.5 inline-block px-2 py-0.5 rounded-full bg-[var(--color-surface-soft)] text-[10px] font-bold text-[var(--color-primary)]">
              {session.title || roleBadgeLabel}
            </div>
          </div>

          {/* Quick Destination Link */}
          <a
            href={session.destination}
            onClick={() => setDropdownOpen(false)}
            className="flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-bold text-[var(--color-ink-deep)] hover:bg-[var(--color-surface-soft)] transition-colors"
          >
            <span>Go to {destinationLabel}</span>
            <span className="text-xs">→</span>
          </a>

          {/* Sign Out */}
          <div className="pt-2 border-t border-[var(--color-hairline-soft)]">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 rounded-xl text-[12px] font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
