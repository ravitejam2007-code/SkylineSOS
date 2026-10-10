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

  const [showAdminSecretModal, setShowAdminSecretModal] = useState(false);
  const [adminSecretInput, setAdminSecretInput] = useState('');
  const [adminSecretError, setAdminSecretError] = useState<string | null>(null);

  const performRoleSwitch = async (roleId: string) => {
    setCurrentRole(roleId);
    setLoadingRole(roleId);
    localStorage.setItem('campusone_demo_role', roleId);
    window.dispatchEvent(new CustomEvent('campusone:role_changed', { detail: roleId }));

    try {
      await signInAsDemoRole(roleId);
      setAuthIndicator('real');
    } catch (err) {
      console.warn('Real Supabase Auth fallback:', err);
      setAuthIndicator('demo');
    } finally {
      setLoadingRole(null);
    }
  };

  const handleSelect = (roleId: string) => {
    if (roleId === 'admin' && currentRole !== 'admin') {
      setAdminSecretInput('');
      setAdminSecretError(null);
      setShowAdminSecretModal(true);
      return;
    }
    performRoleSwitch(roleId);
  };

  const handleConfirmAdminSecret = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = adminSecretInput.trim();
    if (clean === 'SKYLINE_ADMIN_2026' || clean === 'ADMIN2026' || clean === 'ADMIN99') {
      setShowAdminSecretModal(false);
      setAdminSecretError(null);
      performRoleSwitch('admin');
    } else {
      setAdminSecretError('Invalid Admin Secret Security Code. Access denied.');
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

      {/* Admin Secret Verification Modal */}
      {showAdminSecretModal && (
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
                onClick={() => setShowAdminSecretModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-black flex items-center justify-center cursor-pointer text-base"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Switching to <strong>Executive Admin</strong> requires the organization master secret code. Only verified administrators may enter.
            </p>

            {adminSecretError && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                <span>⚠️</span> {adminSecretError}
              </div>
            )}

            <form onSubmit={handleConfirmAdminSecret} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Enter Admin Secret Code *
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={adminSecretInput}
                  onChange={(e) => setAdminSecretInput(e.target.value)}
                  placeholder="Enter secret code (e.g. SKYLINE_ADMIN_2026)"
                  className="w-full px-4 py-2.5 rounded-full border border-slate-300 text-xs text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#0064e0] font-mono"
                />
                <span className="block text-[10px] text-slate-400 mt-1">
                  Default Demo Key: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600 font-mono">SKYLINE_ADMIN_2026</code>
                </span>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdminSecretModal(false)}
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
