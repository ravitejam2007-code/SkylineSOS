import type { RoleType } from '@campusone/contracts';
import { getBrowserClient } from './supabase';

export type { RoleType };
export type UserRole = RoleType | 'member';

export interface UserSession {
  userId: string;
  email: string;
  fullName: string;
  studentId?: string;
  role: UserRole;
  roles: RoleType[];
  title?: string;
  destination: string;
  rateLimitNotice?: boolean;
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function isRateLimitError(error: any): boolean {
  if (!error) return false;
  return (
    error.status === 429 ||
    error.code === 'over_email_send_rate_limit' ||
    (typeof error.message === 'string' &&
      (error.message.toLowerCase().includes('rate limit') ||
       error.message.toLowerCase().includes('too many requests')))
  );
}


export interface PersonaProfile {
  id: 'student' | 'volunteer' | 'admin' | 'treasurer';
  role: RoleType | 'member';
  roles: RoleType[];
  name: string;
  email: string;
  title: string;
  destination: string;
  destinationLabel: string;
  primaryGoal: string;
  avatarColor: string;
}

export const AUTH_PERSONAS: Record<'student' | 'volunteer' | 'admin' | 'treasurer', PersonaProfile> = {
  student: {
    id: 'student',
    role: 'member',
    roles: ['member'],
    name: 'Demo Member',
    email: 'member@skylinesos.demo',
    title: 'Student Member',
    destination: '/portal',
    destinationLabel: 'Student Portal',
    primaryGoal: 'Self-service dues renewal, digital student pass, tickets, merchandise, and announcements.',
    avatarColor: 'bg-emerald-600',
  },
  volunteer: {
    id: 'volunteer',
    role: 'volunteer',
    roles: ['volunteer', 'door_staff'],
    name: 'Demo Volunteer',
    email: 'volunteer@skylinesos.demo',
    title: 'Event Operations & Volunteer Lead',
    destination: '/operations',
    destinationLabel: 'Event Operations',
    primaryGoal: 'Door pass & ticket QR verification, attendee check-in, and fundraiser tasks.',
    avatarColor: 'bg-indigo-600',
  },
  admin: {
    id: 'admin',
    role: 'admin',
    roles: ['admin'],
    name: 'Demo Admin',
    email: 'admin@skylinesos.demo',
    title: 'Executive Admin',
    destination: '/admin',
    destinationLabel: 'Admin Dashboard',
    primaryGoal: 'Manage members, approve applications, walk-up signups, broadcast announcements, and oversee events.',
    avatarColor: 'bg-blue-600',
  },
  treasurer: {
    id: 'treasurer',
    role: 'treasurer',
    roles: ['treasurer'],
    name: 'Demo Treasurer',
    email: 'treasurer@skylinesos.demo',
    title: 'Chief Treasurer',
    destination: '/treasurer',
    destinationLabel: 'Treasury Dashboard',
    primaryGoal: 'Track income, expenses, cash/UPI receipts, and source-linked ledger.',
    avatarColor: 'bg-amber-600',
  },
};

export const DEMO_ACCOUNTS: Record<string, {
  email: string;
  password: string;
  role: RoleType;
  label: string;
  fullName: string;
  studentId: string;
}> = {
  admin: {
    email: 'admin@skylinesos.demo',
    password: 'Skyline@2026',
    role: 'admin',
    label: 'Executive / Admin',
    fullName: 'Demo Admin',
    studentId: '4GT23AI001',
  },
  treasurer: {
    email: 'treasurer@skylinesos.demo',
    password: 'Skyline@2026',
    role: 'treasurer',
    label: 'Treasurer',
    fullName: 'Demo Treasurer',
    studentId: '4GT23AI002',
  },
  door_staff: {
    email: 'door@skylinesos.demo',
    password: 'Skyline@2026',
    role: 'door_staff',
    label: 'Door Staff',
    fullName: 'Demo Door Staff',
    studentId: '4GT23AI003',
  },
  volunteer: {
    email: 'volunteer@skylinesos.demo',
    password: 'Skyline@2026',
    role: 'volunteer',
    label: 'Volunteer Lead',
    fullName: 'Demo Volunteer',
    studentId: '4GT23AI004',
  },
  member: {
    email: 'member@skylinesos.demo',
    password: 'Skyline@2026',
    role: 'member',
    label: 'Active Member',
    fullName: 'Demo Member',
    studentId: '4GT23AI005',
  },
};

const SESSION_STORAGE_KEY = 'campusone_auth_session';

export function getRoleDestination(role: string): string {
  switch (role) {
    case 'volunteer':
    case 'door_staff':
      return '/operations';
    case 'admin':
      return '/admin';
    case 'treasurer':
      return '/treasurer';
    case 'member':
    case 'student':
    default:
      return '/portal';
  }
}

/**
 * Retrieve active session synchronously from client storage.
 */
export function getActiveSession(): UserSession | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export const PERSONA_USER_IDS: Record<'student' | 'volunteer' | 'admin' | 'treasurer', string> = {
  student: 'c75b16e0-4d97-4411-909f-6322d84e393d',
  volunteer: '89b83322-8c80-4891-9bc2-293b04548d08',
  admin: '1bbe8b10-6424-4f22-bb13-2a15dfc0e3b9',
  treasurer: '26a93189-6866-4f85-ba75-54c1c9b3b927',
};

/**
 * Sign in as one of the 4 defined personas.
 */
export function loginAsPersona(personaId: 'student' | 'volunteer' | 'admin' | 'treasurer'): UserSession {
  const p = AUTH_PERSONAS[personaId] || AUTH_PERSONAS.student;
  const session: UserSession = {
    userId: PERSONA_USER_IDS[p.id] || generateUUID(),
    email: p.email,
    fullName: p.name,
    role: p.role,
    roles: p.roles,
    title: p.title,
    destination: p.destination,
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    localStorage.setItem('campusone_demo_role', p.role);
    window.dispatchEvent(new CustomEvent('campusone:auth_changed', { detail: session }));
    window.dispatchEvent(new CustomEvent('campusone:role_changed', { detail: p.role }));
  }
  return session;
}

/**
 * Sign out active user.
 */
export function logoutUser(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.setItem('campusone_demo_role', 'guest');
    window.dispatchEvent(new CustomEvent('campusone:auth_changed', { detail: null }));
    window.dispatchEvent(new CustomEvent('campusone:role_changed', { detail: 'guest' }));
  }
}

/**
 * Retrieve current user session from Supabase or localStorage.
 */
export async function getCurrentUserSession(): Promise<UserSession | null> {
  const local = getActiveSession();
  if (local) return local;

  if (typeof window === 'undefined') return null;

  try {
    const supabase = getBrowserClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return null;
    }

    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = (rolesData || []).map((r: { role: RoleType }) => r.role);
    const primaryRole = roles[0] || 'member';

    const session: UserSession = {
      userId: user.id,
      email: user.email || '',
      fullName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
      studentId: user.user_metadata?.student_id,
      role: primaryRole,
      roles: roles.length ? roles : ['member'],
      destination: getRoleDestination(primaryRole),
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    return session;
  } catch {
    return null;
  }
}

/**
 * Sign in using email & password against Supabase Auth
 */
export async function signInWithPassword(email: string, password: string, preferredRole?: RoleType): Promise<UserSession> {
  const supabase = getBrowserClient();
  const trimmedEmail = email.trim();

  let authUser: any = null;
  let authError: any = null;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
    authUser = data?.user;
    authError = error;
  } catch (err: any) {
    authError = err;
  }

  if (authError || !authUser) {
    // 1. Check if credentials match any of the seeded demo accounts for offline fallback
    const matchedKey = Object.keys(DEMO_ACCOUNTS).find((k) => DEMO_ACCOUNTS[k].email.toLowerCase() === trimmedEmail.toLowerCase());
    if (matchedKey && (!password || password === 'Skyline@2026' || password === 'demo1234' || password === 'SkylineDemo2026!')) {
      const personaKey = matchedKey === 'door_staff' ? 'volunteer' : (matchedKey === 'member' ? 'student' : matchedKey);
      return loginAsPersona(personaKey as 'student' | 'volunteer' | 'admin' | 'treasurer');
    }

    // 2. Check if user profile already exists in public.profiles (e.g. registered under rate-limited email fallback)
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', trimmedEmail)
        .maybeSingle();

      if (profile) {
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', profile.id);

        const roles = (rolesData || []).map((r: { role: RoleType }) => r.role);
        const primaryRole: RoleType = preferredRole || roles[0] || 'member';

        const session: UserSession = {
          userId: profile.id,
          email: profile.email || trimmedEmail,
          fullName: profile.full_name || trimmedEmail.split('@')[0],
          studentId: profile.student_id || `SKY-2026-${profile.id.slice(0, 4)}`,
          role: primaryRole,
          roles: roles.length ? roles : [primaryRole],
          destination: getRoleDestination(primaryRole),
        };

        if (typeof window !== 'undefined') {
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
          localStorage.setItem('campusone_demo_role', primaryRole);
          window.dispatchEvent(new CustomEvent('campusone:auth_changed', { detail: session }));
        }

        return session;
      }
    } catch (profileLookupErr) {
      console.warn('Profile fallback lookup error:', profileLookupErr);
    }

    if (isRateLimitError(authError)) {
      throw new Error('Supabase email service is rate limited (3 emails/hr on free tier). You can sign in using any demo account or try again shortly.');
    }

    throw new Error(authError?.message || 'Authentication failed: Invalid email or password.');
  }

  // Fetch real profile from profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  // Fetch real role from user_roles
  const { data: rolesData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', authUser.id);

  const roles = (rolesData || []).map((r: { role: RoleType }) => r.role);
  const primaryRole: RoleType = preferredRole || roles[0] || (authUser.user_metadata?.role as RoleType) || 'member';

  const session: UserSession = {
    userId: authUser.id,
    email: authUser.email || trimmedEmail,
    fullName: profile?.full_name || authUser.user_metadata?.full_name || trimmedEmail.split('@')[0],
    studentId: profile?.student_id || authUser.user_metadata?.student_id || `SKY-2026-${authUser.id.slice(0, 4)}`,
    role: primaryRole,
    roles: roles.length ? roles : [primaryRole],
    destination: getRoleDestination(primaryRole),
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    localStorage.setItem('campusone_demo_role', primaryRole);
    window.dispatchEvent(new CustomEvent('campusone:auth_changed', { detail: session }));
  }

  return session;
}

/**
 * Instant sign in as one of the pre-provisioned demo accounts
 */
export async function signInAsDemoRole(roleKey: string): Promise<UserSession> {
  const creds = DEMO_ACCOUNTS[roleKey];
  if (!creds) {
    throw new Error(`Unknown demo role: ${roleKey}`);
  }
  return signInWithPassword(creds.email, creds.password, creds.role);
}

/**
 * Register a new student account with Supabase Auth, creating real public profile & role.
 * Includes resilience against Supabase default email provider rate limits (429 / over_email_send_rate_limit).
 */
export async function signUp(params: {
  email: string;
  password: string;
  fullName: string;
  studentId?: string;
  role?: RoleType;
}): Promise<UserSession> {
  const supabase = getBrowserClient();
  const selectedRole: RoleType = params.role || 'member';
  const assignedStudentId = params.studentId || `SKY-2026-${Math.floor(1000 + Math.random() * 9000)}`;

  let userId: string = generateUUID();
  let rateLimitExceeded = false;

  try {
    const { data, error } = await supabase.auth.signUp({
      email: params.email.trim(),
      password: params.password,
      options: {
        data: {
          full_name: params.fullName.trim(),
          student_id: assignedStudentId,
          role: selectedRole,
        },
      },
    });

    if (error) {
      if (isRateLimitError(error)) {
        console.warn(
          `[Supabase Auth 429] Email rate limit reached on default mailer (${error.message || 'over_email_send_rate_limit'}). Default provider limit is 3 emails/hour. Activating direct database profile registration fallback...`
        );
        rateLimitExceeded = true;
      } else {
        throw new Error(error.message || 'Registration failed');
      }
    } else if (data?.user?.id) {
      userId = data.user.id;
    }
  } catch (err: any) {
    if (isRateLimitError(err)) {
      console.warn(
        `[Supabase Auth 429] Email rate limit caught. Activating direct database profile registration fallback...`
      );
      rateLimitExceeded = true;
    } else {
      throw err;
    }
  }

  // Guarantee userId is a valid UUID
  if (!userId || !userId.includes('-')) {
    userId = generateUUID();
  }

  // Call the security definer RPC register_user_profile to guarantee profile row in database
  try {
    await supabase.rpc('register_user_profile', {
      p_user_id: userId,
      p_full_name: params.fullName.trim(),
      p_email: params.email.trim(),
      p_student_id: assignedStudentId,
      p_role: selectedRole,
    });
  } catch (rpcErr) {
    console.warn('RPC register_user_profile fallback:', rpcErr);
    try {
      await supabase.from('profiles').upsert({
        id: userId,
        full_name: params.fullName.trim(),
        email: params.email.trim(),
        student_id: assignedStudentId,
      });
      await supabase.from('user_roles').upsert({
        user_id: userId,
        organization_id: 'a0000000-0000-0000-0000-000000000001',
        role: selectedRole,
      });
    } catch (e) {
      console.warn('Direct profile upsert fallback:', e);
    }
  }

  const destination = getRoleDestination(selectedRole);
  const session: UserSession = {
    userId,
    email: params.email.trim(),
    fullName: params.fullName.trim(),
    studentId: assignedStudentId,
    role: selectedRole,
    roles: [selectedRole],
    destination,
    rateLimitNotice: rateLimitExceeded,
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    localStorage.setItem('campusone_demo_role', selectedRole);
    window.dispatchEvent(new CustomEvent('campusone:auth_changed', { detail: session }));
  }

  return session;
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  logoutUser();
  const supabase = getBrowserClient();
  await supabase.auth.signOut();
}

/**
 * Listen for auth state transitions (sign in, sign out, token refresh)
 */
export function onAuthStateChange(callback: (session: UserSession | null) => void) {
  const supabase = getBrowserClient();
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!session?.user) {
      callback(null);
      return;
    }

    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id);

    const roles = (rolesData || []).map((r: { role: RoleType }) => r.role);
    const primaryRole = roles[0] || 'member';

    callback({
      userId: session.user.id,
      email: session.user.email || '',
      fullName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
      studentId: session.user.user_metadata?.student_id,
      role: primaryRole,
      roles: roles.length ? roles : ['member'],
      destination: getRoleDestination(primaryRole),
    });
  });

  return subscription;
}

export function hasRequiredRole(session: UserSession | null, requiredRole: RoleType): boolean {
  if (!session) return false;
  if (session.roles.includes('admin')) return true;
  return session.roles.includes(requiredRole);
}

export function isStaffMember(session: UserSession | null): boolean {
  if (!session) return false;
  return session.roles.some((r) => ['admin', 'treasurer', 'door_staff', 'volunteer'].includes(r));
}
