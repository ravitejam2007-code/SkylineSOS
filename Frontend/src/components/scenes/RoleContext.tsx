import React, { createContext, useContext, useState, useEffect } from 'react';
import type { RoleType } from '@campusone/contracts';
import { getCurrentUserSession, onAuthStateChange, signInAsDemoRole, type UserSession } from '../../lib/auth';

export type DemoRole = RoleType | 'guest' | 'applicant';

interface RoleContextValue {
  role: DemoRole;
  setRole: (r: DemoRole) => Promise<void>;
  roleLabel: string;
  session: UserSession | null;
  authStatus: 'authenticated' | 'demo' | 'loading';
  isRealAuth: boolean;
}

const ROLE_LABELS: Record<DemoRole, string> = {
  admin: 'Executive / Admin',
  treasurer: 'Treasurer',
  door_staff: 'Door Staff',
  volunteer: 'Volunteer Lead',
  member: 'Active Member',
  applicant: 'Student Applicant',
  guest: 'Campus Guest',
};

const RoleContext = createContext<RoleContextValue>({
  role: 'admin',
  setRole: async () => {},
  roleLabel: 'Executive / Admin',
  session: null,
  authStatus: 'loading',
  isRealAuth: false,
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<DemoRole>('admin');
  const [session, setSession] = useState<UserSession | null>(null);
  const [authStatus, setAuthStatus] = useState<'authenticated' | 'demo' | 'loading'>('loading');

  useEffect(() => {
    // 1. Initial check for existing Supabase Auth session
    getCurrentUserSession().then((currSession) => {
      if (currSession) {
        setSession(currSession);
        setAuthStatus('authenticated');
        if (currSession.roles.length > 0) {
          setRoleState(currSession.roles[0] as DemoRole);
        }
      } else {
        const saved = localStorage.getItem('campusone_demo_role') as DemoRole;
        if (saved && ROLE_LABELS[saved]) {
          setRoleState(saved);
        }
        setAuthStatus('demo');
      }
    });

    // 2. Subscribe to auth changes
    const subscription = onAuthStateChange((newSession) => {
      if (newSession) {
        setSession(newSession);
        setAuthStatus('authenticated');
        if (newSession.roles.length > 0) {
          setRoleState(newSession.roles[0] as DemoRole);
        }
      } else {
        setSession(null);
        setAuthStatus('demo');
      }
    });

    const onRoleChangedEvent = (e: CustomEvent) => {
      if (e.detail && ROLE_LABELS[e.detail as DemoRole]) {
        setRoleState(e.detail as DemoRole);
      }
    };

    window.addEventListener('campusone:role_changed' as any, onRoleChangedEvent);

    return () => {
      subscription?.unsubscribe();
      window.removeEventListener('campusone:role_changed' as any, onRoleChangedEvent);
    };
  }, []);

  const setRole = async (newRole: DemoRole) => {
    setRoleState(newRole);
    localStorage.setItem('campusone_demo_role', newRole);
    window.dispatchEvent(new CustomEvent('campusone:role_changed', { detail: newRole }));

    // Seamlessly attempt real Supabase sign-in for the persona
    try {
      if (newRole !== 'guest') {
        const authUser = await signInAsDemoRole(newRole);
        setSession(authUser);
        setAuthStatus('authenticated');
      }
    } catch (e) {
      console.warn('Real Supabase sign-in for role fallback:', e);
      setAuthStatus('demo');
    }
  };

  return (
    <RoleContext.Provider
      value={{
        role,
        setRole,
        roleLabel: session?.fullName
          ? `${session.fullName} (${ROLE_LABELS[role] || 'Member'})`
          : (ROLE_LABELS[role] || 'Student Member'),
        session,
        authStatus,
        isRealAuth: authStatus === 'authenticated',
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useDemoRole() {
  return useContext(RoleContext);
}
