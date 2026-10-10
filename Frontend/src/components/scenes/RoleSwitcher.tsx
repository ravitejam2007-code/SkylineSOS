import { useState, useEffect } from 'react';
import { signInAsDemoRole } from '../../lib/auth';

const ROLES = [
  { id: 'admin', label: 'Admin' },
  { id: 'treasurer', label: 'Treasurer' },
  { id: 'door_staff', label: 'Door Staff' },
  { id: 'volunteer', label: 'Volunteer' },
  { id: 'member', label: 'Active Member' },
  { id: 'applicant', label: 'Applicant' },
] as const;

export default function RoleSwitcher() {
  const [currentRole, setCurrentRole] = useState<string>('admin');
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [authIndicator, setAuthIndicator] = useState<'real' | 'demo'>('real');

  useEffect(() => {
    const saved = localStorage.getItem('campusone_demo_role');
    if (saved) setCurrentRole(saved);

    const onRoleChange = (e: CustomEvent) => {
      setCurrentRole(e.detail);
    };

    window.addEventListener('campusone:role_changed' as any, onRoleChange);
    return () => window.removeEventListener('campusone:role_changed' as any, onRoleChange);
  }, []);

  const handleSelect = async (roleId: string) => {
    setCurrentRole(roleId);
    setLoadingRole(roleId);
    localStorage.setItem('campusone_demo_role', roleId);
    window.dispatchEvent(new CustomEvent('campusone:role_changed', { detail: roleId }));

    try {
      // Perform genuine Supabase Auth sign-in for the persona
      await signInAsDemoRole(roleId);
      setAuthIndicator('real');
    } catch (err) {
      console.warn('Real Supabase Auth fallback:', err);
      setAuthIndicator('demo');
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <div className="bg-[var(--color-ink-deep)] text-white py-2 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-[13px]">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${authIndicator === 'real' ? 'bg-[var(--color-success)]' : 'bg-amber-400'} animate-pulse`} />
          <span className="font-bold tracking-tight text-white/90">CampusOne Role View:</span>
          <span className="text-[var(--color-hairline)] hidden sm:inline">
            {authIndicator === 'real' ? 'Supabase Auth Verified' : 'Local Persona Sandbox'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {ROLES.map((r) => {
            const active = currentRole === r.id;
            const isLoading = loadingRole === r.id;
            return (
              <button
                key={r.id}
                onClick={() => handleSelect(r.id)}
                disabled={isLoading}
                className={`px-3 py-1 rounded-full text-[12px] font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  active
                    ? 'bg-white text-[var(--color-ink-deep)] shadow-sm'
                    : 'bg-white/10 text-white/80 hover:bg-white/20'
                }`}
              >
                {isLoading && (
                  <span className="inline-block w-2.5 h-2.5 border-2 border-[var(--color-ink-deep)] border-t-transparent rounded-full animate-spin" />
                )}
                {r.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
