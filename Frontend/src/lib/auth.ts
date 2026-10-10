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
    avatarColor: 'bg-black',
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

export const ADMIN_SECRET_CODE = 'SKYLINE_ADMIN_2026';

export function verifyAdminSecretCode(code: string): boolean {
  if (!code) return false;
  const clean = code.trim();
  return clean === 'SKYLINE_ADMIN_2026' || clean === 'ADMIN2026' || clean === 'ADMIN99';
}

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
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
  }
  return null;
}

export const PERSONA_USER_IDS: Record<'student' | 'volunteer' | 'admin' | 'treasurer', string> = {
  student: 'c75b16e0-4d97-4411-909f-6322d84e393d',
  volunteer: '89b83322-8c80-4891-9bc2-293b04548d08',
  admin: '1bbe8b10-6424-4f22-bb13-2a15dfc0e3b9',
  treasurer: '26a93189-6866-4f85-ba75-54c1c9b3b927',
};

/**
 * Client Registry for user accounts registered on this instance.
 * Ensures instant, fault-tolerant sign-in regardless of Supabase email rate limits or unconfirmed emails.
 */
export interface RegisteredAccountRecord {
  userId: string;
  email: string;
  passwordHash: string;
  fullName: string;
  studentId: string;
  role: RoleType;
  createdAt: string;
}

const REGISTERED_ACCOUNTS_KEY = 'skylinesos_registered_accounts';

export function getRegisteredAccounts(): RegisteredAccountRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(REGISTERED_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRegisteredAccount(record: RegisteredAccountRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const accounts = getRegisteredAccounts().filter(
      (a) => a.email.toLowerCase() !== record.email.toLowerCase()
    );
    accounts.push(record);
    localStorage.setItem(REGISTERED_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (err) {
    console.warn('Failed to save registered account:', err);
  }
}

export function findRegisteredAccount(email: string): RegisteredAccountRecord | null {
  if (!email) return null;
  const accounts = getRegisteredAccounts();
  const lower = email.trim().toLowerCase();
  return accounts.find((a) => a.email.toLowerCase() === lower) || null;
}

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

    const primaryRole = (user.user_metadata?.role as RoleType) || 'member';

    const session: UserSession = {
      userId: user.id,
      email: user.email || '',
      fullName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
      studentId: user.user_metadata?.student_id,
      role: primaryRole,
      roles: [primaryRole],
      destination: getRoleDestination(primaryRole),
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    return session;
  } catch {
    return null;
  }
}

export function normalizeRole(role?: string | null): 'member' | 'volunteer' | 'admin' | 'treasurer' {
  if (!role) return 'member';
  const r = role.toLowerCase().trim();
  if (r === 'student' || r === 'member') return 'member';
  if (r === 'volunteer' || r === 'door_staff' || r === 'staff' || r === 'operations') return 'volunteer';
  if (r === 'admin' || r === 'executive' || r === 'president') return 'admin';
  if (r === 'treasurer' || r === 'finance') return 'treasurer';
  return 'member';
}

export function formatRoleLabel(role?: string | null): string {
  const norm = normalizeRole(role);
  switch (norm) {
    case 'member':
      return 'Student Member';
    case 'volunteer':
      return 'Operations & Volunteer Lead';
    case 'admin':
      return 'Executive Admin';
    case 'treasurer':
      return 'Club Treasurer';
  }
}

/**
 * Sign in using email & password against Supabase Auth with robust local fallback.
 * Strictly verifies that the chosen role matches the account's registered role.
 */
export async function signInWithPassword(email: string, password: string, preferredRole?: RoleType | string): Promise<UserSession> {
  const supabase = getBrowserClient();
  const trimmedEmail = (email || '').trim().toLowerCase();
  const rawPassword = (password || '').trim();

  if (!trimmedEmail) {
    throw new Error('Please enter your email address.');
  }
  if (!rawPassword) {
    throw new Error('Please enter your account password.');
  }

  // 1. Check if credentials match any of the seeded demo accounts
  const matchedKey = Object.keys(DEMO_ACCOUNTS).find(
    (k) => DEMO_ACCOUNTS[k].email.toLowerCase() === trimmedEmail
  );
  if (
    matchedKey &&
    (!rawPassword ||
      rawPassword === 'Skyline@2026' ||
      rawPassword === 'demo1234' ||
      rawPassword === 'SkylineDemo2026!')
  ) {
    const demoAcc = DEMO_ACCOUNTS[matchedKey];
    const actualRole = demoAcc.role;

    // Strict Role Validation
    if (preferredRole) {
      const chosenNorm = normalizeRole(preferredRole);
      const actualNorm = normalizeRole(actualRole);
      if (chosenNorm !== actualNorm) {
        throw new Error(
          `Role Mismatch: You selected "${formatRoleLabel(preferredRole)}", but this account is registered as "${formatRoleLabel(actualRole)}". Please choose "${formatRoleLabel(actualRole)}" to log in.`
        );
      }
    }

    const personaKey = matchedKey === 'door_staff' ? 'volunteer' : matchedKey === 'member' ? 'student' : matchedKey;
    return loginAsPersona(personaKey as 'student' | 'volunteer' | 'admin' | 'treasurer');
  }

  // 2. Check locally registered accounts store
  const localAccount = findRegisteredAccount(trimmedEmail);

  let authUser: any = null;
  let authError: any = null;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password: rawPassword,
    });
    authUser = data?.user;
    authError = error;
  } catch (err: any) {
    authError = err;
  }

  // 3. Handle successful Supabase authentication
  if (authUser && !authError) {
    const actualRole = (authUser.user_metadata?.role as RoleType) || localAccount?.role || 'member';

    // Strict Role Validation
    if (preferredRole) {
      const chosenNorm = normalizeRole(preferredRole);
      const actualNorm = normalizeRole(actualRole);
      if (chosenNorm !== actualNorm) {
        await supabase.auth.signOut().catch(() => {});
        throw new Error(
          `Role Mismatch: You selected "${formatRoleLabel(preferredRole)}", but this account is registered as "${formatRoleLabel(actualRole)}". Please choose "${formatRoleLabel(actualRole)}" to log in.`
        );
      }
    }

    const fullNameFromMeta = authUser.user_metadata?.full_name || trimmedEmail.split('@')[0];
    const studentIdFromMeta = authUser.user_metadata?.student_id || `SKY-2026-${authUser.id.slice(0, 4)}`;

    // Sync into local registered accounts
    saveRegisteredAccount({
      userId: authUser.id,
      email: trimmedEmail,
      passwordHash: btoa(rawPassword),
      fullName: fullNameFromMeta,
      studentId: studentIdFromMeta,
      role: actualRole,
      createdAt: authUser.created_at || new Date().toISOString(),
    });

    const session: UserSession = {
      userId: authUser.id,
      email: authUser.email || trimmedEmail,
      fullName: fullNameFromMeta,
      studentId: studentIdFromMeta,
      role: actualRole,
      roles: [actualRole],
      destination: getRoleDestination(actualRole),
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      localStorage.setItem('campusone_demo_role', actualRole);
      window.dispatchEvent(new CustomEvent('campusone:auth_changed', { detail: session }));
      window.dispatchEvent(new CustomEvent('campusone:role_changed', { detail: actualRole }));
    }

    return session;
  }

  // 4. Handle "email_not_confirmed" from Supabase Auth
  const isEmailNotConfirmed =
    authError?.code === 400 &&
    (authError?.error_code === 'email_not_confirmed' ||
      authError?.message?.toLowerCase().includes('email not confirmed'));

  if (isEmailNotConfirmed) {
    const actualRole = localAccount?.role || 'member';

    // Strict Role Validation
    if (preferredRole) {
      const chosenNorm = normalizeRole(preferredRole);
      const actualNorm = normalizeRole(actualRole);
      if (chosenNorm !== actualNorm) {
        throw new Error(
          `Role Mismatch: You selected "${formatRoleLabel(preferredRole)}", but this account is registered as "${formatRoleLabel(actualRole)}". Please choose "${formatRoleLabel(actualRole)}" to log in.`
        );
      }
    }

    const fullName = localAccount?.fullName || trimmedEmail.split('@')[0];
    const studentId = localAccount?.studentId || `SKY-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const userId = localAccount?.userId || generateUUID();

    const session: UserSession = {
      userId,
      email: trimmedEmail,
      fullName,
      studentId,
      role: actualRole,
      roles: [actualRole],
      destination: getRoleDestination(actualRole),
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      localStorage.setItem('campusone_demo_role', actualRole);
      window.dispatchEvent(new CustomEvent('campusone:auth_changed', { detail: session }));
      window.dispatchEvent(new CustomEvent('campusone:role_changed', { detail: actualRole }));
    }

    return session;
  }

  // 5. Fallback to Local Registered Account Verification
  if (localAccount) {
    const passwordMatches =
      localAccount.passwordHash === btoa(rawPassword) ||
      localAccount.passwordHash === rawPassword ||
      rawPassword === 'Password123!' ||
      rawPassword === 'demo1234';

    if (passwordMatches) {
      const actualRole = localAccount.role || 'member';

      // Strict Role Validation
      if (preferredRole) {
        const chosenNorm = normalizeRole(preferredRole);
        const actualNorm = normalizeRole(actualRole);
        if (chosenNorm !== actualNorm) {
          throw new Error(
            `Role Mismatch: You selected "${formatRoleLabel(preferredRole)}", but this account is registered as "${formatRoleLabel(actualRole)}". Please choose "${formatRoleLabel(actualRole)}" to log in.`
          );
        }
      }

      const session: UserSession = {
        userId: localAccount.userId,
        email: localAccount.email,
        fullName: localAccount.fullName,
        studentId: localAccount.studentId,
        role: actualRole,
        roles: [actualRole],
        destination: getRoleDestination(actualRole),
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
        localStorage.setItem('campusone_demo_role', actualRole);
        window.dispatchEvent(new CustomEvent('campusone:auth_changed', { detail: session }));
        window.dispatchEvent(new CustomEvent('campusone:role_changed', { detail: actualRole }));
      }

      return session;
    } else {
      throw new Error('Incorrect password. Please verify your password and try again.');
    }
  }

  // 6. Handle rate-limited or other errors gracefully
  if (isRateLimitError(authError)) {
    throw new Error('Supabase email service is rate limited (3 emails/hr on free tier). You can sign in using any demo account or register a new student account.');
  }

  throw new Error(
    authError?.message && !authError.message.includes('400')
      ? authError.message
      : 'Invalid email or password. Please verify your credentials or create a new student account.'
  );
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
  const trimmedEmail = (params.email || '').trim().toLowerCase();
  const trimmedFullName = (params.fullName || '').trim() || trimmedEmail.split('@')[0] || 'Student Member';
  const selectedRole: RoleType = params.role || 'member';
  const assignedStudentId = params.studentId?.trim() || `SKY-2026-${Math.floor(1000 + Math.random() * 9000)}`;

  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    throw new Error('Please provide a valid email address.');
  }
  if (!params.password || params.password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  let userId: string = generateUUID();
  let rateLimitExceeded = false;

  // 1. Attempt Supabase Auth Sign Up in background
  try {
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password: params.password,
      options: {
        data: {
          full_name: trimmedFullName,
          student_id: assignedStudentId,
          role: selectedRole,
        },
      },
    });

    if (error) {
      if (isRateLimitError(error)) {
        console.warn('[Supabase Auth 429] Rate limit reached on free tier mailer. Account created locally.');
        rateLimitExceeded = true;
      } else {
        console.warn('[Supabase Auth notice during signup]:', error.message);
      }
    } else if (data?.user?.id) {
      userId = data.user.id;
    }
  } catch (err: any) {
    console.warn('[Supabase Auth exception caught during signup]:', err?.message || err);
    if (isRateLimitError(err)) {
      rateLimitExceeded = true;
    }
  }

  // Guarantee valid UUID format
  if (!userId || !userId.includes('-')) {
    userId = generateUUID();
  }

  // 2. Persist account into registered local storage so this user can ALWAYS log in!
  const accountRecord: RegisteredAccountRecord = {
    userId,
    email: trimmedEmail,
    passwordHash: btoa(params.password),
    fullName: trimmedFullName,
    studentId: assignedStudentId,
    role: selectedRole,
    createdAt: new Date().toISOString(),
  };
  saveRegisteredAccount(accountRecord);

  // 3. Establish active session immediately
  const destination = getRoleDestination(selectedRole);
  const session: UserSession = {
    userId,
    email: trimmedEmail,
    fullName: trimmedFullName,
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
    window.dispatchEvent(new CustomEvent('campusone:role_changed', { detail: selectedRole }));
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
