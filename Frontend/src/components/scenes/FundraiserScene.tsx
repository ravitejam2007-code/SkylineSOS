import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { LoadingCard, ButtonSpinner } from '../ui/LoadingState';
import { getActiveSession, getCurrentUserSession, getRegisteredAccounts, type UserSession } from '../../lib/auth';
import type { Fundraiser, FundraiserTask, TaskStatus, TaskPriority } from '@campusone/contracts';

export type BakeSaleStation = 'baking' | 'supplies' | 'table';

export interface OperationsTaskMessage {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

export interface RichFundraiserTask extends FundraiserTask {
  progressPercent?: number;
  station?: BakeSaleStation;
  messages?: OperationsTaskMessage[];
}

export interface PersonnelOption {
  id: string;
  name: string;
  role: string;
  email: string;
  studentId?: string;
  isRealtime?: boolean;
}

export function getDynamicPersonnel(): PersonnelOption[] {
  const map = new Map<string, PersonnelOption>();

  // 1. Base chapter staff & leads
  const defaults: PersonnelOption[] = [
    { id: 'p1', name: 'Sarah Student', role: 'Active Member · Quad Table Lead', email: 'student@studentorg.edu', studentId: 'SKY-2026-1190' },
    { id: 'p2', name: 'Rahul Sharma', role: 'Core Member · Logistics & Baking Lead', email: 'rahul.s@skyline.edu', studentId: 'SKY-2026-4401' },
    { id: 'p3', name: 'Maya Deshmukh', role: 'Plus Member · Supplies & Packaging Lead', email: 'maya.d@skyline.edu', studentId: 'SKY-2026-8812' },
    { id: 'p4', name: 'Arjun Mehta', role: 'Lead Administrator', email: 'arjun.admin@skyline.edu', studentId: 'SKY-2026-0001' },
    { id: 'p5', name: 'Priya Patel', role: 'Treasurer · Quad Cashier Desk', email: 'priya.treasurer@skyline.edu', studentId: 'SKY-2026-0002' },
    { id: 'p6', name: 'Vikram Singh', role: 'Quad Setup & Logistics Lead', email: 'vikram.door@skyline.edu', studentId: 'SKY-2026-0003' },
    { id: 'p7', name: 'Ananya Rao', role: 'Volunteer Coordinator & Signage', email: 'ananya.volunteer@skyline.edu', studentId: 'SKY-2026-0004' },
  ];
  defaults.forEach((p) => map.set(p.name.toLowerCase(), p));

  if (typeof window !== 'undefined') {
    // 2. Real-time registered student accounts
    try {
      const regList = getRegisteredAccounts();
      if (Array.isArray(regList)) {
        regList.forEach((acc) => {
          if (acc.fullName || acc.email) {
            const name = (acc.fullName || acc.email.split('@')[0]).trim();
            const key = name.toLowerCase();
            map.set(key, {
              id: acc.userId || `reg-${acc.email}`,
              name,
              role: acc.role === 'admin' ? 'Executive Admin' : 'Registered Student Member',
              email: acc.email,
              studentId: acc.studentId || 'SKY-2026-REG',
              isRealtime: true,
            });
          }
        });
      }
    } catch {}

    // 3. Real-time student membership applications
    try {
      const rawApps = localStorage.getItem('skylinesos:membership_applications');
      if (rawApps) {
        const apps = JSON.parse(rawApps);
        if (Array.isArray(apps)) {
          apps.forEach((app: any) => {
            if (app.applicant_name) {
              const name = String(app.applicant_name).trim();
              const key = name.toLowerCase();
              if (!map.has(key) || !map.get(key)?.isRealtime) {
                map.set(key, {
                  id: app.applicant_id || app.id || `app-${name}`,
                  name,
                  role: app.status === 'approved' ? 'Verified Chapter Member' : 'Registered Student Applicant',
                  email: app.applicant_email || `${name.toLowerCase().replace(/\s+/g, '.')}@skyline.edu`,
                  studentId: app.student_id || 'SKY-2026-APP',
                  isRealtime: true,
                });
              }
            }
          });
        }
      }
    } catch {}

    // 4. Current active user session
    try {
      const activeSession = getActiveSession();
      if (activeSession && activeSession.fullName) {
        const name = activeSession.fullName.trim();
        const key = name.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            id: activeSession.userId || `sess-${activeSession.email}`,
            name,
            role: activeSession.role === 'admin' ? 'Executive Admin' : 'Registered Student',
            email: activeSession.email || '',
            studentId: activeSession.studentId || 'SKY-2026-SESS',
            isRealtime: true,
          });
        }
      }
    } catch {}
  }

  return Array.from(map.values());
}

// Canonical real bake sale tasks split into: Who is baking, Who is buying supplies, Who is managing table
export const REAL_BAKE_SALE_TASKS: RichFundraiserTask[] = [
  // 1. Who is baking
  {
    id: 'task-bake-1',
    organization_id: 'a0000000-0000-0000-0000-000000000001',
    fundraiser_id: 'fr-1',
    title: 'Bake 100 chocolate chip cookies and package with allergen labels',
    station: 'baking',
    priority: 'high',
    status: 'done',
    progressPercent: 100,
    assignee_name: 'Rahul Sharma',
    due_at: '2026-10-17T12:00:00Z',
    created_at: '2026-10-10T09:00:00Z',
    messages: [
      {
        id: 'msg-b1',
        author: 'Rahul Sharma',
        text: 'All 100 cookies baked, cooled, and packaged with gluten/nut allergen tags.',
        timestamp: '2026-10-10T12:00:00Z',
      },
    ],
  },
  {
    id: 'task-bake-2',
    organization_id: 'a0000000-0000-0000-0000-000000000001',
    fundraiser_id: 'fr-1',
    title: 'Bake 50 vegan blueberry muffins and gluten-free fudge brownies',
    station: 'baking',
    priority: 'high',
    status: 'in_progress',
    progressPercent: 60,
    assignee_name: 'Sarah Student',
    due_at: '2026-10-17T15:00:00Z',
    created_at: '2026-10-10T10:00:00Z',
    messages: [
      {
        id: 'msg-b2',
        author: 'Sarah Student',
        text: 'Muffins completed; brownies currently in campus kitchen oven.',
        timestamp: '2026-10-10T14:15:00Z',
      },
    ],
  },

  // 2. Who is buying supplies
  {
    id: 'task-supplies-1',
    organization_id: 'a0000000-0000-0000-0000-000000000001',
    fundraiser_id: 'fr-1',
    title: 'Purchase organic flour, cane sugar, butter, and compostable packaging boxes',
    station: 'supplies',
    priority: 'high',
    status: 'done',
    progressPercent: 100,
    assignee_name: 'Maya Deshmukh',
    due_at: '2026-10-16T18:00:00Z',
    created_at: '2026-10-10T08:30:00Z',
    messages: [
      {
        id: 'msg-s1',
        author: 'Maya Deshmukh',
        text: 'Eco-packaging and bulk ingredients acquired from campus market with club discount.',
        timestamp: '2026-10-10T11:00:00Z',
      },
    ],
  },
  {
    id: 'task-supplies-2',
    organization_id: 'a0000000-0000-0000-0000-000000000001',
    fundraiser_id: 'fr-1',
    title: 'Print QR code donation placards, allergen warning sheets, and price tent-cards',
    station: 'supplies',
    priority: 'medium',
    status: 'in_progress',
    progressPercent: 40,
    assignee_name: 'Ananya Rao',
    due_at: '2026-10-17T10:00:00Z',
    created_at: '2026-10-10T11:00:00Z',
    messages: [
      {
        id: 'msg-s2',
        author: 'Ananya Rao',
        text: 'Laminated QR stands and price tent cards sent to print queue.',
        timestamp: '2026-10-10T13:45:00Z',
      },
    ],
  },

  // 3. Who is managing the table on the day
  {
    id: 'task-table-1',
    organization_id: 'a0000000-0000-0000-0000-000000000001',
    fundraiser_id: 'fr-1',
    title: 'Set up Quad table with folding tablecloths, cash lockbox, and cake display risers',
    station: 'table',
    priority: 'urgent',
    status: 'todo',
    progressPercent: 0,
    assignee_name: 'Vikram Singh',
    due_at: '2026-10-17T11:00:00Z',
    created_at: '2026-10-10T09:30:00Z',
    messages: [
      {
        id: 'msg-t1',
        author: 'Vikram Singh',
        text: 'Checked out 4 tables and tablecloths from Student Union Room 204.',
        timestamp: '2026-10-10T10:15:00Z',
      },
    ],
  },
  {
    id: 'task-table-2',
    organization_id: 'a0000000-0000-0000-0000-000000000001',
    fundraiser_id: 'fr-1',
    title: 'Manage Quad table cashier desk, mobile UPI stand, and hourly cash reconciliation',
    station: 'table',
    priority: 'urgent',
    status: 'in_progress',
    progressPercent: 50,
    assignee_name: 'Priya Patel',
    due_at: '2026-10-17T17:00:00Z',
    created_at: '2026-10-10T10:00:00Z',
    messages: [
      {
        id: 'msg-t2',
        author: 'Priya Patel',
        text: 'Float initialized with ₹500 small change. Hourly reconciliation ledger active.',
        timestamp: '2026-10-10T14:00:00Z',
      },
    ],
  },
  {
    id: 'task-table-3',
    organization_id: 'a0000000-0000-0000-0000-000000000001',
    fundraiser_id: 'fr-1',
    title: 'Staff afternoon Quad table shift and coordinate student volunteer swaps',
    station: 'table',
    priority: 'medium',
    status: 'todo',
    progressPercent: 0,
    assignee_name: 'Sarah Student',
    due_at: '2026-10-17T16:00:00Z',
    created_at: '2026-10-10T12:00:00Z',
    messages: [],
  },
];

export function sanitizeOperationsTasks(loadedTasks: any[]): RichFundraiserTask[] {
  if (!Array.isArray(loadedTasks) || loadedTasks.length === 0) {
    return REAL_BAKE_SALE_TASKS;
  }

  // Filter out temporary mock tasks like "oddooo event"
  const valid = loadedTasks.filter((t) => {
    if (!t || !t.title || typeof t.title !== 'string') return false;
    const lower = t.title.toLowerCase();
    if (lower.includes('oddooo') || lower.includes('temporary') || lower.includes('test task')) return false;
    return true;
  });

  // Ensure canonical real bake sale tasks exist
  const existingTitles = new Set(valid.map((t) => t.title.toLowerCase().trim()));
  const merged = [...valid];
  for (const defaultTask of REAL_BAKE_SALE_TASKS) {
    if (!existingTitles.has(defaultTask.title.toLowerCase().trim())) {
      merged.push(defaultTask);
    }
  }

  return merged.map((t) => {
    let station: BakeSaleStation = t.station || 'table';
    if (!t.station) {
      const l = t.title.toLowerCase();
      if (l.includes('bake') || l.includes('cookie') || l.includes('muffin') || l.includes('brownie')) {
        station = 'baking';
      } else if (l.includes('supplies') || l.includes('flour') || l.includes('print') || l.includes('qr') || l.includes('box')) {
        station = 'supplies';
      } else {
        station = 'table';
      }
    }
    return {
      ...t,
      station,
      progressPercent: typeof t.progressPercent === 'number'
        ? t.progressPercent
        : t.status === 'done' ? 100 : t.status === 'in_progress' ? 50 : 0,
    };
  });
}

export default function FundraiserScene() {
  const [session, setSession] = useState<UserSession | null>(() => {
    if (typeof window !== 'undefined') return getActiveSession();
    return null;
  });

  const isAdmin = session?.role === 'admin';

  const [fundraiser, setFundraiser] = useState<Fundraiser | null>(null);
  const [tasks, setTasks] = useState<RichFundraiserTask[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('skylinesos:operations_tasks');
        if (stored) return sanitizeOperationsTasks(JSON.parse(stored));
      } catch {}
    }
    return REAL_BAKE_SALE_TASKS;
  });

  const [taskFeedbackInputs, setTaskFeedbackInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // Admin New task duty form state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskStation, setNewTaskStation] = useState<BakeSaleStation>('baking');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('high');
  const [newTaskAssignee, setNewTaskAssignee] = useState<string>('Sarah Student');

  // Volunteering station view filter
  const [stationFilter, setStationFilter] = useState<'all' | 'baking' | 'supplies' | 'table' | 'mine'>('all');

  // Personnel state & Real-time member picker
  const [personnelList, setPersonnelList] = useState<PersonnelOption[]>(() => getDynamicPersonnel());
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState('');
  const [assigneeCategory, setAssigneeCategory] = useState<'all' | 'realtime' | 'staff'>('all');
  const [customVolunteerName, setCustomVolunteerName] = useState('');

  const loadData = async () => {
    try {
      let storedTasks: RichFundraiserTask[] = [];
      if (typeof window !== 'undefined') {
        const local = localStorage.getItem('skylinesos:operations_tasks');
        if (local) {
          try {
            storedTasks = sanitizeOperationsTasks(JSON.parse(local));
          } catch {}
        }
      }

      const fList = await api.getActiveFundraisers();
      if (fList.length > 0) {
        setFundraiser(fList[0]);
        if (storedTasks.length > 0) {
          setTasks(storedTasks);
        } else {
          setTasks(REAL_BAKE_SALE_TASKS);
          localStorage.setItem('skylinesos:operations_tasks', JSON.stringify(REAL_BAKE_SALE_TASKS));
        }
      } else {
        setTasks(storedTasks.length > 0 ? storedTasks : REAL_BAKE_SALE_TASKS);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    getCurrentUserSession().then((s) => {
      if (s) setSession(s);
    });

    const refreshPersonnel = () => {
      setPersonnelList(getDynamicPersonnel());
    };

    const handleAuthChange = (e: CustomEvent) => {
      setSession(e.detail);
      refreshPersonnel();
    };

    const handleTasksUpdated = () => {
      try {
        const local = localStorage.getItem('skylinesos:operations_tasks');
        if (local) setTasks(sanitizeOperationsTasks(JSON.parse(local)));
      } catch {}
    };

    window.addEventListener('campusone:auth_changed' as any, handleAuthChange);
    window.addEventListener('storage', refreshPersonnel);
    window.addEventListener('storage', handleTasksUpdated);
    window.addEventListener('skylinesos:registered_accounts_updated' as any, refreshPersonnel);
    window.addEventListener('skylinesos:tasks_updated' as any, handleTasksUpdated);

    const pollTimer = setInterval(refreshPersonnel, 2500);

    return () => {
      window.removeEventListener('campusone:auth_changed' as any, handleAuthChange);
      window.removeEventListener('storage', refreshPersonnel);
      window.removeEventListener('storage', handleTasksUpdated);
      window.removeEventListener('skylinesos:registered_accounts_updated' as any, refreshPersonnel);
      window.removeEventListener('skylinesos:tasks_updated' as any, handleTasksUpdated);
      clearInterval(pollTimer);
    };
  }, []);

  // Handle Student Updating Task Status / Progress
  // User Request: "admin is correct cannot change only students role update"
  const handleSetTaskStatus = async (taskId: string, newStatus: TaskStatus, percent?: number) => {
    if (isAdmin) {
      alert('Admin view is read-only for progress. Only assigned student volunteers can update task status.');
      return;
    }

    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        const computedPercent =
          typeof percent === 'number'
            ? percent
            : newStatus === 'done'
            ? 100
            : newStatus === 'in_progress'
            ? 50
            : 0;

        const statusNote: OperationsTaskMessage = {
          id: `msg-status-${Date.now()}`,
          author: session?.fullName || 'Assigned Student',
          text: `Duty updated to ${newStatus.replace('_', ' ').toUpperCase()} (${computedPercent}% complete)`,
          timestamp: new Date().toISOString(),
        };

        return {
          ...t,
          status: newStatus,
          progressPercent: computedPercent,
          messages: [...(t.messages || []), statusNote],
        };
      }
      return t;
    });

    setTasks(updated);
    try {
      localStorage.setItem('skylinesos:operations_tasks', JSON.stringify(updated));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('skylinesos:tasks_updated', { detail: updated }));
      }
      await api.updateTaskStatus(taskId, newStatus).catch(() => {});
    } catch {}

    setBannerNotice(`Duty status updated to ${newStatus.replace('_', ' ').toUpperCase()}! Notice passed to Admin.`);
    setTimeout(() => setBannerNotice(null), 4000);
  };

  // Handle Student Passing Feedback / Progress Notes to Admin
  // User Request: "add feed back pass admin what are task complete todo status show"
  const handlePassFeedbackToAdmin = (taskId: string) => {
    const text = (taskFeedbackInputs[taskId] || '').trim();
    if (!text) return;

    const newMessage: OperationsTaskMessage = {
      id: `msg-${Date.now()}`,
      author: session?.fullName || 'Assigned Student',
      text,
      timestamp: new Date().toISOString(),
    };

    const updated = tasks.map((t) => {
      if (t.id === taskId) {
        return {
          ...t,
          messages: [...(t.messages || []), newMessage],
        };
      }
      return t;
    });

    setTasks(updated);
    setTaskFeedbackInputs((prev) => ({ ...prev, [taskId]: '' }));
    try {
      localStorage.setItem('skylinesos:operations_tasks', JSON.stringify(updated));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('skylinesos:tasks_updated', { detail: updated }));
      }
    } catch {}

    setBannerNotice('Feedback passed to Chapter Admin successfully!');
    setTimeout(() => setBannerNotice(null), 4000);
  };

  // Handle Admin Creating and Assigning Duty (Admin Only)
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle) return;
    setIsCreatingTask(true);
    try {
      const assignedName = newTaskAssignee || personnelList[0]?.name || 'Sarah Student';
      const newTask: RichFundraiserTask = {
        id: `task-${Date.now()}`,
        organization_id: 'a0000000-0000-0000-0000-000000000001',
        fundraiser_id: fundraiser?.id || 'fr-1',
        title: newTaskTitle,
        station: newTaskStation,
        priority: newTaskPriority,
        assignee_name: assignedName,
        status: 'todo',
        progressPercent: 0,
        due_at: new Date(Date.now() + 5 * 86400000).toISOString(),
        created_at: new Date().toISOString(),
        messages: [
          {
            id: `msg-init-${Date.now()}`,
            author: session?.fullName ? `${session.fullName} (Admin)` : 'Executive Admin',
            text: `Duty scheduled and assigned to ${assignedName}.`,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const updated = [newTask, ...tasks];
      setTasks(updated);
      try {
        localStorage.setItem('skylinesos:operations_tasks', JSON.stringify(updated));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('skylinesos:tasks_updated', { detail: updated }));
        }
        if (fundraiser) {
          await api.createTask({
            fundraiser_id: fundraiser.id,
            title: newTaskTitle,
            priority: newTaskPriority,
            assignee_name: assignedName,
          }).catch(() => {});
        }
      } catch {}

      setNewTaskTitle('');
      setBannerNotice(`Duty "${newTaskTitle}" scheduled and assigned to ${assignedName}!`);
      setTimeout(() => setBannerNotice(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to create duty');
    } finally {
      setIsCreatingTask(false);
    }
  };

  if (loading) {
    return <LoadingCard label="Loading bake sale volunteering operations & duties..." />;
  }

  // Operational Metrics
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'done');
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress');
  const todoTasks = tasks.filter((t) => t.status === 'todo');
  const pendingCount = totalTasks - doneTasks.length;
  const taskPercent = totalTasks > 0 ? Math.round((doneTasks.length / totalTasks) * 100) : 0;

  // Split Duties by Station
  const bakingTasks = tasks.filter((t) => t.station === 'baking');
  const suppliesTasks = tasks.filter((t) => t.station === 'supplies');
  const tableTasks = tasks.filter((t) => t.station === 'table');

  const myTasks = tasks.filter(
    (t) =>
      session?.fullName &&
      t.assignee_name &&
      (t.assignee_name.toLowerCase().includes(session.fullName.toLowerCase()) ||
        session.fullName.toLowerCase().includes(t.assignee_name.toLowerCase()))
  );

  // Filtered Tasks for Station View
  const displayedTasks = (() => {
    switch (stationFilter) {
      case 'baking':
        return bakingTasks;
      case 'supplies':
        return suppliesTasks;
      case 'table':
        return tableTasks;
      case 'mine':
        return myTasks;
      default:
        return tasks;
    }
  })();

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'urgent':
        return 'bg-rose-100 text-rose-800 border border-rose-200';
      case 'high':
        return 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'medium':
        return 'bg-slate-100 text-slate-800 border border-slate-200';
      default:
        return 'bg-slate-50 text-slate-600 border border-slate-200';
    }
  };

  const getStatusBadge = (s: TaskStatus) => {
    switch (s) {
      case 'done':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case 'in_progress':
        return 'bg-amber-100 text-amber-800 border border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  const getStationLabel = (s?: BakeSaleStation) => {
    switch (s) {
      case 'baking':
        return 'Baking Station';
      case 'supplies':
        return 'Supplies & Logistics';
      case 'table':
        return 'Quad Table Ops';
      default:
        return 'Table Ops';
    }
  };

  const filteredPersonnel = personnelList.filter((p) => {
    const q = assigneeSearchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.role.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      (p.studentId && p.studentId.toLowerCase().includes(q));

    if (!matchesSearch) return false;
    if (assigneeCategory === 'realtime') return Boolean(p.isRealtime);
    if (assigneeCategory === 'staff') return !p.isRealtime;
    return true;
  });

  const selectedPerson =
    personnelList.find((p) => p.name.toLowerCase() === (newTaskAssignee || '').toLowerCase()) ||
    personnelList[0] || {
      id: 'p-sel',
      name: newTaskAssignee || 'Sarah Student',
      role: 'Active Member · Quad Table Lead',
      email: 'student@studentorg.edu',
    };

  const realtimePersonnel = personnelList.filter((p) => p.isRealtime);
  const realtimeCount = realtimePersonnel.length;

  return (
    <div className="space-y-10 t-enter">
      {/* Toast Notification Banner */}
      {bannerNotice && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex justify-between items-center text-sm shadow-xs">
          <span className="font-semibold">✓ {bannerNotice}</span>
          <button
            onClick={() => setBannerNotice(null)}
            className="font-bold underline ml-4 text-xs cursor-pointer text-emerald-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ─── HEADER & REAL-TIME SYNC BADGE ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-black text-white shadow-xs">
            Volunteering Operations
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {tasks.length} Active Duties
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Spring Semester Bake Sale · Real-Time Volunteer Coordination</span>
        </div>
      </div>

      {/* ─── AT-A-GLANCE BAKE SALE STATUS DASHBOARD ─── */}
      {/* User Request: "what are task complete todo status show" */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900 text-white space-y-6 shadow-md border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Operations At A Glance
            </span>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight mt-1 text-white">
              Bake Sale Duty Roster & Execution Board
            </h2>
          </div>
          <div className="text-xs text-slate-400">
            Next Milestone: <strong className="text-slate-200">Quad Table Setup · 11:00 AM</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pillar 1: What Still Needs To Be Done */}
          <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center justify-between">
              <span>What Needs Done</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-400/20 text-amber-300">
                {pendingCount} Pending
              </span>
            </div>
            <div className="text-3xl font-extrabold text-white">
              {pendingCount} <span className="text-sm font-normal text-slate-400">of {totalTasks} duties left</span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-300 pt-1">
              <div className="flex items-center justify-between">
                <span>Complete ({doneTasks.length}):</span>
                <strong className="text-emerald-400 font-mono">{doneTasks.length} Done</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>In Progress ({inProgressTasks.length}):</span>
                <strong className="text-amber-300 font-mono">{inProgressTasks.length} Active</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>To Do ({todoTasks.length}):</span>
                <strong className="text-slate-300 font-mono">{todoTasks.length} Queued</strong>
              </div>
            </div>
          </div>

          {/* Pillar 2: Who Is Doing It */}
          <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center justify-between">
              <span>Who Is Doing It</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-sky-400/20 text-sky-300">
                6 Station Leads
              </span>
            </div>
            <div className="text-3xl font-extrabold text-white">
              6 <span className="text-sm font-normal text-slate-400">active student volunteers</span>
            </div>
            <div className="space-y-1.5 text-xs text-slate-300 pt-1">
              <div className="flex items-center justify-between">
                <span>Baking:</span>
                <span className="text-slate-200 font-semibold truncate max-w-[170px]">Rahul S. & Sarah S.</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Supplies:</span>
                <span className="text-slate-200 font-semibold truncate max-w-[170px]">Maya D. & Ananya R.</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Quad Table:</span>
                <span className="text-slate-200 font-semibold truncate max-w-[170px]">Vikram S. & Priya P.</span>
              </div>
            </div>
          </div>

          {/* Pillar 3: Whether Volunteering Is On Track */}
          <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center justify-between">
              <span>Execution Health</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ✓ ON TRACK
              </span>
            </div>
            <div className="text-3xl font-extrabold text-white">
              {taskPercent}% <span className="text-sm font-normal text-slate-400">readiness</span>
            </div>
            <div className="w-full bg-slate-700 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${taskPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Bulk ingredients acquired; cookies completed. Table setup scheduled on time for 11:00 AM quad start.
            </p>
          </div>
        </div>
      </div>

      {/* ─── ADMIN DUTY ASSIGNMENT BLOCK (Visible ONLY to Admin Role) ─── */}
      {/* User Request: "task assign duty only admin not show students and other role show only admin role." */}
      {isAdmin && (
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-800 border border-slate-200">
                  Admin Duty Assignment
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Schedule Duty
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-[#0f172a]">
                Schedule & Assign Student to Bake Sale Station Duty
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Assign a duty to a student name. The task will appear directly inside that student's account for them to update.
              </p>
            </div>
            <span className="text-xs text-emerald-600 font-bold hidden sm:inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {realtimeCount} Realtime Students
            </span>
          </div>

          <form onSubmit={handleCreateTask} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Task Title */}
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
                  Duty Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g. Bake 40 gluten-free brownies with ingredient tags"
                  className="w-full px-4 py-2.5 rounded-full border border-slate-300 text-sm bg-white focus:outline-none focus:border-black"
                />
              </div>

              {/* Station Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
                  Duty Station *
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-full border border-slate-200">
                  {[
                    { id: 'baking', label: 'Baking' },
                    { id: 'supplies', label: 'Supplies' },
                    { id: 'table', label: 'Quad Table' },
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setNewTaskStation(st.id as BakeSaleStation)}
                      className={`py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        newTaskStation === st.id
                          ? 'bg-black text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
                  Priority Level
                </label>
                <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-full border border-slate-200">
                  {(['urgent', 'high', 'medium', 'low'] as TaskPriority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewTaskPriority(p)}
                      className={`py-1.5 rounded-full text-xs font-bold uppercase transition-all cursor-pointer ${
                        newTaskPriority === p
                          ? p === 'urgent'
                            ? 'bg-rose-600 text-white'
                            : p === 'high'
                            ? 'bg-amber-500 text-white'
                            : 'bg-black text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Choose Student Assignee */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-slate-700 uppercase">
                  Select Student / Volunteer Assignee *
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  {personnelList.length} Registered Volunteers Available
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search student by name, student ID, or email..."
                    value={assigneeSearchQuery}
                    onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                    className="flex-1 px-3.5 py-1.5 rounded-full border border-slate-200 text-xs bg-white focus:outline-none focus:border-black"
                  />
                  <div className="flex gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setAssigneeCategory('all')}
                      className={`px-2.5 py-1 rounded-full font-bold cursor-pointer ${
                        assigneeCategory === 'all' ? 'bg-black text-white' : 'bg-white text-slate-700'
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssigneeCategory('realtime')}
                      className={`px-2.5 py-1 rounded-full font-bold cursor-pointer ${
                        assigneeCategory === 'realtime' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700'
                      }`}
                    >
                      Realtime ({realtimeCount})
                    </button>
                  </div>
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                  {filteredPersonnel.map((person) => {
                    const isSelected = newTaskAssignee.toLowerCase() === person.name.toLowerCase();
                    return (
                      <div
                        key={person.id + person.name}
                        onClick={() => setNewTaskAssignee(person.name)}
                        className={`p-2 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-black text-white shadow-xs'
                            : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div
                            className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-white text-black'
                                : person.isRealtime
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-800 text-white'
                            }`}
                          >
                            {person.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs font-bold truncate">{person.name}</span>
                          <span className={`text-[10px] truncate ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                            · {person.role}
                          </span>
                          {person.studentId && (
                            <span className={`font-mono text-[9px] px-1 rounded ${
                              isSelected ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {person.studentId}
                            </span>
                          )}
                        </div>
                        {isSelected && (
                          <span className="text-[10px] font-bold bg-white text-black px-2 py-0.5 rounded-full shrink-0">
                            Selected
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Selected Student Confirmation */}
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-950">
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-bold text-[10px] uppercase text-emerald-800">Assigning To:</span>
                    <strong>{selectedPerson.name}</strong>
                    <span className="text-emerald-700 text-[11px] truncate">· {selectedPerson.role}</span>
                    {selectedPerson.studentId && (
                      <span className="font-mono text-[10px] bg-emerald-100 px-1 rounded text-emerald-900">
                        {selectedPerson.studentId}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full shrink-0">
                    Ready
                  </span>
                </div>

                {/* Custom Name */}
                <div className="flex gap-2 pt-1 border-t border-slate-200">
                  <input
                    type="text"
                    placeholder="Or enter custom student/volunteer name..."
                    value={customVolunteerName}
                    onChange={(e) => setCustomVolunteerName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (customVolunteerName.trim()) {
                          setNewTaskAssignee(customVolunteerName.trim());
                          setCustomVolunteerName('');
                        }
                      }
                    }}
                    className="flex-1 px-3 py-1.5 rounded-full border border-slate-200 text-xs bg-white focus:outline-none focus:border-black"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customVolunteerName.trim()) {
                        setNewTaskAssignee(customVolunteerName.trim());
                        setCustomVolunteerName('');
                      }
                    }}
                    className="px-3 py-1.5 rounded-full bg-slate-800 text-white text-xs font-bold hover:bg-black cursor-pointer"
                  >
                    Set Name
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isCreatingTask}
                className="px-7 py-2.5 rounded-full bg-black hover:bg-slate-800 text-white text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-2"
              >
                {isCreatingTask ? <ButtonSpinner size={12} /> : '+ Schedule & Assign Duty'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── STATION FILTER TABS ─── */}
      <div className="flex items-center gap-2 pb-1 border-b border-slate-200 flex-wrap">
        <button
          type="button"
          onClick={() => setStationFilter('all')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
            stationFilter === 'all'
              ? 'bg-black text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:border-black'
          }`}
        >
          All Duties ({tasks.length})
        </button>
        <button
          type="button"
          onClick={() => setStationFilter('baking')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
            stationFilter === 'baking'
              ? 'bg-black text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:border-black'
          }`}
        >
          Who is Baking ({bakingTasks.length})
        </button>
        <button
          type="button"
          onClick={() => setStationFilter('supplies')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
            stationFilter === 'supplies'
              ? 'bg-black text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:border-black'
          }`}
        >
          Who is Buying Supplies ({suppliesTasks.length})
        </button>
        <button
          type="button"
          onClick={() => setStationFilter('table')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
            stationFilter === 'table'
              ? 'bg-black text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:border-black'
          }`}
        >
          Who is Managing Table ({tableTasks.length})
        </button>
        {session && (
          <button
            type="button"
            onClick={() => setStationFilter('mine')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              stationFilter === 'mine'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-50'
            }`}
          >
            <span>Assigned to You ({myTasks.length})</span>
          </button>
        )}
      </div>

      {/* ─── DUTY CARDS LIST ─── */}
      {/* User Request: "students tasks only students acconut inside task to do or proccess or complete options add feed back pass admin what are task complete todo status show. admin is correct cannot change only students role update" */}
      {displayedTasks.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-2">
          <p className="text-sm font-bold text-slate-800">
            {stationFilter === 'mine'
              ? 'No volunteer duties currently assigned to your account.'
              : 'No duties found under this station filter.'}
          </p>
          <p className="text-xs text-slate-500">
            {stationFilter === 'mine'
              ? 'When the chapter administrator schedules a bake sale duty for your name, it will appear here.'
              : 'Select "All Duties" to view all stations.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {displayedTasks.map((task) => {
            const percent =
              task.progressPercent ??
              (task.status === 'done' ? 100 : task.status === 'in_progress' ? 50 : 0);

            const isAssignedToMe = Boolean(
              session?.fullName &&
              task.assignee_name &&
              (task.assignee_name.toLowerCase().includes(session.fullName.toLowerCase()) ||
                session.fullName.toLowerCase().includes(task.assignee_name.toLowerCase()))
            );

            const assigneePerson = personnelList.find(
              (p) => p.name.toLowerCase() === (task.assignee_name || '').toLowerCase()
            );

            return (
              <div
                key={task.id}
                className={`p-6 rounded-3xl border bg-white space-y-4 transition-all shadow-2xs ${
                  isAssignedToMe
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                        {getStationLabel(task.station)}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${getPriorityBadge(task.priority)}`}>
                        {task.priority} Priority
                      </span>
                      {isAssignedToMe && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white uppercase shadow-xs">
                          Assigned to Your Account
                        </span>
                      )}
                    </div>

                    <h4 className="text-base sm:text-lg font-bold text-[#0f172a]">
                      {task.title}
                    </h4>

                    {/* Assigned Student Details Under Task */}
                    <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-slate-600">
                      <span className="text-slate-400 font-bold uppercase text-[10px]">Assigned Student:</span>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200">
                        <div
                          className={`w-5 h-5 rounded-full text-[9px] font-bold text-white flex items-center justify-center shrink-0 ${
                            assigneePerson?.isRealtime ? 'bg-emerald-600' : 'bg-slate-800'
                          }`}
                        >
                          {(task.assignee_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <strong className="text-slate-900 font-bold">{task.assignee_name || 'Unassigned'}</strong>
                        {assigneePerson?.studentId && (
                          <span className="font-mono text-[10px] text-slate-500 bg-white px-1 rounded border border-slate-200">
                            {assigneePerson.studentId}
                          </span>
                        )}
                        {assigneePerson?.role && (
                          <span className="text-[11px] text-slate-500">· {assigneePerson.role}</span>
                        )}
                      </div>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-500 font-mono text-[11px]">
                        Due: {task.due_at ? new Date(task.due_at).toLocaleDateString() : 'Bake Sale Day'}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider self-start sm:self-auto ${getStatusBadge(
                      task.status
                    )}`}
                  >
                    {task.status.replace('_', ' ')} ({percent}%)
                  </span>
                </div>

                {/* Progress Bar & Status Controls */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700">Work Completion</span>
                    <span className="text-black font-mono">{percent}% Done</span>
                  </div>

                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        percent === 100
                          ? 'bg-emerald-500'
                          : percent > 0
                          ? 'bg-black'
                          : 'bg-slate-300'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  {/* Admin view: CANNOT CHANGE STATUS ("admin is correct cannot change only students role update") */}
                  {/* Students view: if assigned to current student, give them TO DO / IN PROGRESS / COMPLETE options */}
                  {isAssignedToMe && !isAdmin ? (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 uppercase">
                          Update Your Duty Status:
                        </span>
                        <span className="text-[10px] text-emerald-700 font-bold">
                          ✓ Student Role Authorized
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSetTaskStatus(task.id, 'todo', 0)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            task.status === 'todo'
                              ? 'bg-black text-white shadow-xs'
                              : 'bg-white text-slate-700 border border-slate-200 hover:border-black'
                          }`}
                        >
                          To Do (0%)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetTaskStatus(task.id, 'in_progress', 50)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            task.status === 'in_progress'
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-white text-amber-800 border border-amber-200 hover:bg-amber-50'
                          }`}
                        >
                          In Progress (50%)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetTaskStatus(task.id, 'done', 100)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            task.status === 'done'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50'
                          }`}
                        >
                          Complete (100%)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>Status: <strong className="text-slate-800 capitalize">{task.status.replace('_', ' ')}</strong></span>
                      <span>Progress: <strong className="text-slate-800">{percent}% Completed</strong></span>
                      {isAdmin && (
                        <span className="text-slate-400 font-mono text-[10px]">
                          (Admin read-only · Updated by {task.assignee_name})
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Duty Notes & Feedback Passed to Admin Log */}
                {/* User Request: "add feed back pass admin what are task complete todo status show" */}
                <div className="space-y-2 pt-1">
                  {task.messages && task.messages.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-600 uppercase flex items-center justify-between">
                        <span>Feedback & Status Passed to Admin:</span>
                        <span className="text-[10px] text-slate-400 font-mono">{task.messages.length} Updates</span>
                      </span>
                      {task.messages.map((m) => (
                        <div
                          key={m.id}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 flex justify-between items-start gap-2"
                        >
                          <p className="leading-relaxed">
                            <strong className="text-slate-900">{m.author}:</strong> "{m.text}"
                          </p>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap font-mono">
                            {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Feedback Input (Available for students to pass feedback to admin) */}
                  {(!isAdmin || isAssignedToMe) && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={taskFeedbackInputs[task.id] || ''}
                        onChange={(e) =>
                          setTaskFeedbackInputs({ ...taskFeedbackInputs, [task.id]: e.target.value })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handlePassFeedbackToAdmin(task.id);
                          }
                        }}
                        placeholder="Pass feedback / status update to Chapter Admin..."
                        className="flex-1 px-4 py-2 rounded-full border border-slate-300 bg-white text-xs focus:outline-none focus:border-black"
                      />
                      <button
                        type="button"
                        onClick={() => handlePassFeedbackToAdmin(task.id)}
                        className="px-4 py-2 rounded-full bg-black hover:bg-slate-800 text-white text-xs font-bold cursor-pointer transition-colors shadow-2xs whitespace-nowrap"
                      >
                        Pass Feedback to Admin
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── LEADERSHIP & REGISTERED VOLUNTEER ROSTER ─── */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
              Chapter Volunteers & Leadership
            </span>
            <h3 className="text-lg sm:text-xl font-bold text-[#0f172a] mt-1">
              Bake Sale Volunteer Roster
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Core chapter leads and registered student volunteers managing this campaign.
            </p>
          </div>
          <span className="text-xs text-slate-600 font-bold bg-slate-100 px-3 py-1 rounded-full border border-slate-200 self-start sm:self-auto">
            {personnelList.length} Active Volunteers
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {personnelList.map((person) => {
            const assignedDuties = tasks.filter(
              (t) => t.assignee_name && t.assignee_name.toLowerCase() === person.name.toLowerCase()
            );

            return (
              <div
                key={person.id + person.name}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all space-y-3"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div
                    className={`w-8 h-8 rounded-full text-xs font-bold text-white flex items-center justify-center shrink-0 ${
                      person.isRealtime ? 'bg-emerald-600' : 'bg-slate-800'
                    }`}
                  >
                    {person.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="truncate">
                    <h4 className="font-bold text-sm text-[#0f172a] truncate">{person.name}</h4>
                    <span className="text-[11px] text-slate-500 truncate block">{person.role}</span>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-slate-600 pt-1 border-t border-slate-100">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Student ID:</span>
                    <span className="font-mono text-[10px] text-slate-700">{person.studentId || 'SKY-2026-VOL'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Assigned Duties:</span>
                    <span className={`font-bold ${assignedDuties.length > 0 ? 'text-black' : 'text-slate-400'}`}>
                      {assignedDuties.length > 0 ? `${assignedDuties.length} Active Duty` : 'Available'}
                    </span>
                  </div>
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewTaskAssignee(person.name);
                      if (typeof window !== 'undefined') {
                        window.scrollTo({ top: 380, behavior: 'smooth' });
                      }
                    }}
                    className="w-full py-1.5 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 cursor-pointer transition-colors"
                  >
                    + Assign Duty to {person.name.split(' ')[0]}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
