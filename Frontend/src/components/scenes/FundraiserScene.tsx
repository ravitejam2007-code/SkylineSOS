import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { formatPaise } from '../../lib/formatters';
import { LoadingCard, ButtonSpinner } from '../ui/LoadingState';
import { getActiveSession, getCurrentUserSession, getRegisteredAccounts, type UserSession } from '../../lib/auth';
import { openRazorpayCheckout } from '../../lib/razorpay';
import type { Fundraiser, FundraiserTask, TaskStatus, TaskPriority } from '@campusone/contracts';

export interface OperationsTaskMessage {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

export interface RichFundraiserTask extends FundraiserTask {
  progressPercent?: number;
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
    { id: 'p2', name: 'Rahul Sharma', role: 'Core Member · Logistics Lead', email: 'rahul.s@skyline.edu', studentId: 'SKY-2026-4401' },
    { id: 'p3', name: 'Maya Deshmukh', role: 'Plus Member · Design Lead', email: 'maya.d@skyline.edu', studentId: 'SKY-2026-8812' },
    { id: 'p4', name: 'Arjun Mehta', role: 'Lead Administrator', email: 'arjun.admin@skyline.edu', studentId: 'SKY-2026-0001' },
    { id: 'p5', name: 'Priya Patel', role: 'Treasurer · Finance Desk', email: 'priya.treasurer@skyline.edu', studentId: 'SKY-2026-0002' },
    { id: 'p6', name: 'Vikram Singh', role: 'Door Staff · Entrance Lead', email: 'vikram.door@skyline.edu', studentId: 'SKY-2026-0003' },
    { id: 'p7', name: 'Ananya Rao', role: 'Volunteer Coordinator', email: 'ananya.volunteer@skyline.edu', studentId: 'SKY-2026-0004' },
  ];
  defaults.forEach((p) => map.set(p.name.toLowerCase(), p));

  if (typeof window !== 'undefined') {
    // 2. Real-time registered student accounts from SignUpScene / auth storage
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

    // 4. Current active user session (student or staff)
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

export const REGISTERED_PERSONNEL = [
  { name: 'Sarah Student', role: 'Active Member · Quad Table Lead', email: 'student@studentorg.edu' },
  { name: 'Rahul Sharma', role: 'Core Member · Logistics Lead', email: 'rahul.s@skyline.edu' },
  { name: 'Maya Deshmukh', role: 'Plus Member · Design Lead', email: 'maya.d@skyline.edu' },
  { name: 'Arjun Mehta', role: 'Lead Administrator', email: 'arjun.admin@skyline.edu' },
  { name: 'Priya Patel', role: 'Treasurer · Finance Desk', email: 'priya.treasurer@skyline.edu' },
  { name: 'Vikram Singh', role: 'Door Staff · Entrance Lead', email: 'vikram.door@skyline.edu' },
  { name: 'Ananya Rao', role: 'Volunteer Coordinator', email: 'ananya.volunteer@skyline.edu' },
];

const DEFAULT_OPERATIONS_TASKS: RichFundraiserTask[] = [
  {
    id: 'task-1',
    organization_id: 'a0000000-0000-0000-0000-000000000001',
    fundraiser_id: 'fr-1',
    title: 'Pick up folding tables and display risers from Student Union',
    priority: 'high',
    status: 'in_progress',
    progressPercent: 50,
    assignee_name: 'Sarah Student',
    due_at: '2026-10-17T18:00:00Z',
    created_at: new Date().toISOString(),
    messages: [
      {
        id: 'msg-1',
        author: 'Sarah Student',
        text: 'Checked out 4 tables from Room 204. Setting them up at the Quad table.',
        timestamp: '2026-10-10T15:30:00Z',
      },
    ],
  },
  {
    id: 'task-2',
    organization_id: 'a0000000-0000-0000-0000-000000000001',
    fundraiser_id: 'fr-1',
    title: 'Bake 100 chocolate chip cookies and package in individual compostable sleeves',
    priority: 'urgent',
    status: 'done',
    progressPercent: 100,
    assignee_name: 'Rahul Sharma',
    due_at: '2026-10-17T12:00:00Z',
    created_at: new Date().toISOString(),
    messages: [
      {
        id: 'msg-2',
        author: 'Rahul Sharma',
        text: 'All 100 cookies baked and packaged with ingredient labels.',
        timestamp: '2026-10-10T12:00:00Z',
      },
    ],
  },
  {
    id: 'task-3',
    organization_id: 'a0000000-0000-0000-0000-000000000001',
    fundraiser_id: 'fr-1',
    title: 'Print QR code donation placards and price tags',
    priority: 'medium',
    status: 'todo',
    progressPercent: 0,
    assignee_name: 'Maya Deshmukh',
    due_at: '2026-10-18T10:00:00Z',
    created_at: new Date().toISOString(),
    messages: [],
  },
  {
    id: 'task-4',
    organization_id: 'a0000000-0000-0000-0000-000000000001',
    fundraiser_id: 'fr-1',
    title: 'Manage Quad Cash Box and tally hourly cash reconciliation',
    priority: 'high',
    status: 'in_progress',
    progressPercent: 60,
    assignee_name: 'Priya Patel',
    due_at: '2026-10-17T17:00:00Z',
    created_at: new Date().toISOString(),
    messages: [
      {
        id: 'msg-4',
        author: 'Priya Patel',
        text: 'Cash drawer initialized with ₹500 change. ₹1,200 collected by 2 PM.',
        timestamp: '2026-10-10T14:00:00Z',
      },
    ],
  },
];

export default function FundraiserScene() {
  const [session, setSession] = useState<UserSession | null>(() => {
    if (typeof window !== 'undefined') return getActiveSession();
    return null;
  });
  const [fundraiser, setFundraiser] = useState<Fundraiser | null>(null);
  const [tasks, setTasks] = useState<RichFundraiserTask[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('skylinesos:operations_tasks');
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return DEFAULT_OPERATIONS_TASKS;
  });
  const [taskMessageInputs, setTaskMessageInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Async button loading states
  const [isPostingCash, setIsPostingCash] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // Cash contribution entry state
  const [cashAmount, setCashAmount] = useState('');
  const [cashDesc, setCashDesc] = useState('Quad table afternoon cookie sales');
  const [cashSuccess, setCashSuccess] = useState<string | null>(null);

  // Online contribution state (Razorpay test mode)
  const [onlineAmount, setOnlineAmount] = useState('250');
  const [isPostingOnline, setIsPostingOnline] = useState(false);

  // New task modal state (Select registered personnel - User Request)
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('high');
  const [newTaskAssignee, setNewTaskAssignee] = useState<string>(() => {
    const list = getDynamicPersonnel();
    return list[0]?.name || 'Sarah Student';
  });
  const [taskViewFilter, setTaskViewFilter] = useState<'all' | 'mine' | 'registered' | 'todo' | 'in_progress' | 'done'>('all');

  // Real-time Personnel state & Custom Member Picker UI
  const [personnelList, setPersonnelList] = useState<PersonnelOption[]>(() => getDynamicPersonnel());
  const [isAssigneePickerOpen, setIsAssigneePickerOpen] = useState(false);
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
            storedTasks = JSON.parse(local);
          } catch {}
        }
      }

      const fList = await api.getActiveFundraisers();
      if (fList.length > 0) {
        setFundraiser(fList[0]);
        const tList = await api.getFundraiserTasks(fList[0].id).catch(() => []);
        if (storedTasks.length > 0) {
          setTasks(storedTasks);
        } else if (Array.isArray(tList) && tList.length > 0) {
          setTasks(tList as any);
          localStorage.setItem('skylinesos:operations_tasks', JSON.stringify(tList));
        } else {
          setTasks(DEFAULT_OPERATIONS_TASKS);
          localStorage.setItem('skylinesos:operations_tasks', JSON.stringify(DEFAULT_OPERATIONS_TASKS));
        }
      } else {
        setTasks(storedTasks.length > 0 ? storedTasks : DEFAULT_OPERATIONS_TASKS);
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

    window.addEventListener('campusone:auth_changed' as any, handleAuthChange);
    window.addEventListener('storage', refreshPersonnel);
    window.addEventListener('skylinesos:registered_accounts_updated' as any, refreshPersonnel);

    // Real-time poll (every 2.5s) to auto-detect any newly registered students/applicants without reload
    const pollTimer = setInterval(refreshPersonnel, 2500);

    return () => {
      window.removeEventListener('campusone:auth_changed' as any, handleAuthChange);
      window.removeEventListener('storage', refreshPersonnel);
      window.removeEventListener('skylinesos:registered_accounts_updated' as any, refreshPersonnel);
      clearInterval(pollTimer);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAddTask(false);
        setIsAssigneePickerOpen(false);
      }
    };
    if (showAddTask || isAssigneePickerOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [showAddTask, isAssigneePickerOpen]);

  // Handle Cash Contribution Submit
  const handleCashEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const paise = Math.round(parseFloat(cashAmount) * 100);
    if (!paise || paise <= 0 || !fundraiser) return;
    setIsPostingCash(true);
    try {
      const res = await api.recordCashContribution({
        p_fundraiser_id: fundraiser.id,
        p_amount_paise: paise,
        p_method: 'cash',
        p_notes: cashDesc,
      });
      setCashSuccess(`Audited cash entry of ₹${cashAmount} posted to ledger (${res.ledger_entry_id})!`);
      setCashAmount('');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsPostingCash(false);
    }
  };

  // Handle Online Contribution via Razorpay Gateway (Test Mode)
  const handleOnlineDonation = async (amountInRupees: number) => {
    if (!amountInRupees || amountInRupees <= 0 || !fundraiser) return;
    setIsPostingOnline(true);
    try {
      const paise = Math.round(amountInRupees * 100);
      const paymentResult = await openRazorpayCheckout({
        amountPaise: paise,
        name: 'Skyline Student Association',
        description: `Bake Sale Fundraiser Donation — ₹${amountInRupees}`,
        prefill: {
          name: session?.fullName || 'Student Contributor',
          email: session?.email || 'student@skyline.edu',
        },
        notes: {
          fundraiser_id: fundraiser.id,
          purpose: 'Bake Sale Fundraiser Donation',
        },
      });

      // Record contribution with Razorpay payment ID
      const res = await api.recordCashContribution({
        p_fundraiser_id: fundraiser.id,
        p_amount_paise: paise,
        p_method: 'online' as any,
        p_notes: `Online donation settled via Razorpay (${paymentResult.paymentId})`,
      });

      setCashSuccess(
        `Thank you! Contribution of ₹${amountInRupees} settled via Razorpay (ID: ${paymentResult.paymentId})! Ledger entry posted.`
      );
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Payment was not completed. Contribution was not recorded.');
    } finally {
      setIsPostingOnline(false);
    }
  };

  // Handle Progress / Status Update (User Request)
  const handleSetTaskStatus = async (taskId: string, newStatus: TaskStatus, percent?: number) => {
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
        return {
          ...t,
          status: newStatus,
          progressPercent: computedPercent,
        };
      }
      return t;
    });

    setTasks(updated);
    try {
      localStorage.setItem('skylinesos:operations_tasks', JSON.stringify(updated));
      await api.updateTaskStatus(taskId, newStatus).catch(() => {});
    } catch {}
  };

  // Handle Student Sending Progress Message (User Request)
  const handleSendTaskMessage = (taskId: string) => {
    const text = (taskMessageInputs[taskId] || '').trim();
    if (!text) return;

    const newMessage: OperationsTaskMessage = {
      id: `msg-${Date.now()}`,
      author: session?.fullName || 'Volunteer Staff',
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
    setTaskMessageInputs((prev) => ({ ...prev, [taskId]: '' }));
    try {
      localStorage.setItem('skylinesos:operations_tasks', JSON.stringify(updated));
    } catch {}
  };

  // Handle Create Task with Personnel Dropdown
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
        priority: newTaskPriority,
        assignee_name: assignedName,
        status: 'todo',
        progressPercent: 0,
        due_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        created_at: new Date().toISOString(),
        messages: [],
      };

      const updated = [newTask, ...tasks];
      setTasks(updated);
      try {
        localStorage.setItem('skylinesos:operations_tasks', JSON.stringify(updated));
        if (fundraiser) {
          await api.createTask({
            fundraiser_id: fundraiser.id,
            title: newTaskTitle,
            priority: newTaskPriority,
            assignee_name: assignedName,
          }).catch(() => {});
        }
      } catch {}

      setShowAddTask(false);
      setIsAssigneePickerOpen(false);
      setNewTaskTitle('');
      setNewTaskAssignee(personnelList[0]?.name || 'Sarah Student');
    } catch (err: any) {
      alert(err.message || 'Failed to create task');
    } finally {
      setIsCreatingTask(false);
    }
  };

  if (loading) {
    return <LoadingCard label="Loading bake sale fundraiser & task progress..." />;
  }

  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const totalTasks = tasks.length;
  const taskPercent = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;

  const raisedPaise = fundraiser?.raised_paise || 1420000;
  const goalPaise = fundraiser?.goal_paise || 2500000;
  const goalPercent = Math.min(100, Math.round((raisedPaise / goalPaise) * 100));

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-amber-100 text-amber-800';
      case 'medium':
        return 'bg-slate-100 text-slate-800 border border-slate-200';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusBadge = (s: TaskStatus) => {
    switch (s) {
      case 'done':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-amber-100 text-amber-800';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // Filter personnel for custom member selector
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

  const myTasks = tasks.filter(
    (t) =>
      session?.fullName &&
      t.assignee_name &&
      (t.assignee_name.toLowerCase().includes(session.fullName.toLowerCase()) ||
        session.fullName.toLowerCase().includes(t.assignee_name.toLowerCase()))
  );

  const registeredStudentTasks = tasks.filter((t) =>
    personnelList.some((p) => p.isRealtime && p.name.toLowerCase() === (t.assignee_name || '').toLowerCase())
  );

  const displayedTasks = (() => {
    switch (taskViewFilter) {
      case 'mine':
        return myTasks;
      case 'registered':
        return registeredStudentTasks;
      case 'todo':
        return tasks.filter((t) => t.status === 'todo');
      case 'in_progress':
        return tasks.filter((t) => t.status === 'in_progress');
      case 'done':
        return tasks.filter((t) => t.status === 'done');
      default:
        return tasks;
    }
  })();

  const handleAssignToPerson = (personName: string) => {
    setNewTaskAssignee(personName);
    setShowAddTask(true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 380, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-12 t-enter">
      {cashSuccess && (
        <div className="p-4 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-success)] text-[var(--color-success)] flex justify-between items-center text-[14px] t-toast is-open">
          <span>✓ {cashSuccess}</span>
          <button onClick={() => setCashSuccess(null)} className="font-bold underline ml-4 text-[12px] cursor-pointer">Dismiss</button>
        </div>
      )}

      {/* ─── 1. FUNDRAISER PROGRESS CARDS ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Financial Progress Card */}
        <div className="p-8 rounded-3xl bg-[var(--color-canvas)] border border-[var(--color-hairline-soft)] space-y-4 t-card-interactive">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-[var(--color-steel)] uppercase tracking-wider">
              Fundraising Goal
            </span>
            <span className="px-3 py-1 rounded-full text-[12px] font-bold bg-green-100 text-green-800">
              Active Campaign
            </span>
          </div>

          <h3 className="text-2xl font-bold text-[var(--color-ink-deep)]">
            {fundraiser?.title || 'Spring Semester Bake Sale'}
          </h3>

          <div className="text-3xl font-extrabold text-[var(--color-ink-deep)]">
            {formatPaise(raisedPaise)}{' '}
            <span className="text-[16px] text-[var(--color-steel)] font-normal">
              raised of {formatPaise(goalPaise)} goal
            </span>
          </div>

          <div className="w-full bg-[var(--color-hairline)] h-3 rounded-full overflow-hidden">
            <div
              className="bg-[var(--color-success)] h-full rounded-full transition-all duration-500"
              style={{ width: `${goalPercent}%` }}
            />
          </div>

          <p className="text-[12px] text-[var(--color-steel)]">
            {goalPercent}% of goal achieved · Backed by real audited bake-sale cash entries
          </p>
        </div>

        {/* Task Progress Card */}
        <div className="p-8 rounded-3xl bg-[var(--color-canvas)] border border-[var(--color-hairline-soft)] space-y-4 t-card-interactive">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-[var(--color-steel)] uppercase tracking-wider">
              Task Status
            </span>
            <span className="px-3 py-1 rounded-full text-[12px] font-bold bg-amber-100 text-amber-800">
              {totalTasks - doneCount} Pending
            </span>
          </div>

          <h3 className="text-2xl font-bold text-[var(--color-ink-deep)]">Volunteer Operations</h3>

          <div className="text-3xl font-extrabold text-[var(--color-ink-deep)]">
            {doneCount} Done{' '}
            <span className="text-[16px] text-[var(--color-steel)] font-normal">
              out of {totalTasks} total tasks
            </span>
          </div>

          <div className="w-full bg-[var(--color-hairline)] h-3 rounded-full overflow-hidden">
            <div
              className="bg-[var(--color-ink-deep)] h-full rounded-full transition-all duration-500"
              style={{ width: `${taskPercent}%` }}
            />
          </div>

          <p className="text-[12px] text-[var(--color-steel)]">
            Task completion and money raised are separate, verifiable operational metrics.
          </p>
        </div>
      </div>

      {/* ─── 2. OPERATIONS TASK BOARD & REAL-TIME VOLUNTEER ASSIGNMENTS ─── */}
      <div className="space-y-10">
        {/* Operations & Volunteer Task Board Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-800 border border-slate-200">
                  Operations Task Board
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Real-Time Sync Active
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200">
                  {personnelList.length} Personnel ({realtimeCount} Registered Students)
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-[#0f172a]">
                Bake Sale Operations & Volunteer Tasks
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Live duties for {fundraiser?.title || 'Chapter Campaign'}. Assign tasks to registered students and update progress in real time.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('assign-task-title-input');
                  if (el) el.focus();
                }}
                className="px-4 py-2 rounded-full bg-[#0064e0] hover:bg-[#0052b8] text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span>+ Assign Duty</span>
              </button>
              <button
                type="button"
                onClick={() => loadData()}
                className="px-3.5 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                title="Refresh tasks from server"
              >
                ↻ Refresh
              </button>
            </div>
          </div>

          {/* Assign Student to Operations Duty (Permanently Front-Side — CANNOT HIDE) */}
          <div className="p-6 rounded-2xl bg-slate-50/90 border border-slate-200/90 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
              <div>
                <h4 className="font-bold text-base text-[#0f172a] flex items-center gap-2">
                  <span>Assign Students to Operations Duty</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
                    Live Assignment
                  </span>
                </h4>
                <p className="text-xs text-slate-500">
                  Select any registered student below to immediately schedule and assign campaign duties.
                </p>
              </div>
              <span className="text-xs text-emerald-600 font-bold hidden sm:inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {realtimeCount} Students Registered in Real-time
              </span>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
                  Task Title *
                </label>
                <input
                  id="assign-task-title-input"
                  type="text"
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Task title (e.g. Pick up folding tables from Student Union Room 204)"
                  className="w-full px-4 py-2.5 rounded-full border border-slate-300 text-sm bg-white focus:outline-none focus:border-black transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Priority Selector Pills */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">
                    Priority Level
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 p-1 bg-white rounded-full border border-slate-200">
                    {(['urgent', 'high', 'medium', 'low'] as TaskPriority[]).map((p) => {
                      const isSelected = newTaskPriority === p;
                      const getActiveBadgeStyle = () => {
                        switch (p) {
                          case 'urgent': return 'bg-rose-600 text-white shadow-xs';
                          case 'high': return 'bg-amber-500 text-white shadow-xs';
                          case 'medium': return 'bg-slate-800 text-white shadow-xs';
                          case 'low': return 'bg-sky-600 text-white shadow-xs';
                        }
                      };
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setNewTaskPriority(p)}
                          className={`py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            isSelected ? getActiveBadgeStyle() : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Assign Students Details Under Labels Inside Show (Front-Side Visible) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase">
                      Assign Student / Personnel *
                    </label>
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      {personnelList.length} Personnel ({realtimeCount} Realtime)
                    </span>
                  </div>

                  {/* Student Details Search & Categories */}
                  <div className="space-y-2 p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                    {/* Search Bar */}
                    <div className="relative">
                      <svg className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search registered students, names, or IDs..."
                        value={assigneeSearchQuery}
                        onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 rounded-full border border-slate-200 text-xs focus:outline-none focus:border-black"
                      />
                    </div>

                    {/* Category Filter Tabs */}
                    <div className="flex items-center gap-1 pb-1 border-b border-slate-100 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setAssigneeCategory('all')}
                        className={`px-2.5 py-1 rounded-full font-bold transition-colors cursor-pointer ${assigneeCategory === 'all' ? 'bg-black text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        All ({personnelList.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssigneeCategory('realtime')}
                        className={`px-2.5 py-1 rounded-full font-bold transition-colors cursor-pointer flex items-center gap-1 ${assigneeCategory === 'realtime' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Registered Students ({realtimeCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssigneeCategory('staff')}
                        className={`px-2.5 py-1 rounded-full font-bold transition-colors cursor-pointer ${assigneeCategory === 'staff' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        Staff & Leads
                      </button>
                    </div>

                    {/* Students Details List (Front Side Visible Under Label Inside Container) */}
                    <div className="overflow-y-auto space-y-1.5 max-h-48 pr-1">
                      {filteredPersonnel.length === 0 ? (
                        <div className="py-4 text-center text-xs text-slate-400">
                          No registered students or personnel matching search.
                        </div>
                      ) : (
                        filteredPersonnel.map((person) => {
                          const isSelected = newTaskAssignee.toLowerCase() === person.name.toLowerCase();
                          return (
                            <div
                              key={person.id + person.name}
                              onClick={() => setNewTaskAssignee(person.name)}
                              className={`p-2 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-slate-900 text-white shadow-xs'
                                  : 'bg-slate-50 hover:bg-slate-100 text-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 truncate">
                                <div className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? 'bg-white text-slate-900'
                                    : person.isRealtime
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-800 text-white'
                                }`}>
                                  {person.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="truncate text-left">
                                  <div className="text-xs font-bold truncate flex items-center gap-1.5">
                                    <span>{person.name}</span>
                                    {person.isRealtime && (
                                      <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase border ${
                                        isSelected
                                          ? 'bg-emerald-500 text-white border-emerald-400'
                                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      }`}>
                                        REALTIME
                                      </span>
                                    )}
                                  </div>
                                  <div className={`text-[10px] truncate ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                                    {person.role} {person.studentId ? `· ${person.studentId}` : ''}
                                  </div>
                                </div>
                              </div>
                              {isSelected ? (
                                <span className="text-[10px] font-bold bg-white text-slate-900 px-2 py-0.5 rounded-full shrink-0">
                                  ✓ Assigned
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                                  Select
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Selected Student Details Confirmation Banner */}
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-emerald-800 font-bold uppercase text-[10px] shrink-0">Assigned To:</span>
                        <div className={`w-5 h-5 rounded-full text-[9px] font-bold text-white flex items-center justify-center shrink-0 ${selectedPerson.isRealtime ? 'bg-emerald-600' : 'bg-slate-800'}`}>
                          {selectedPerson.name.charAt(0).toUpperCase()}
                        </div>
                        <strong className="text-emerald-950 font-bold truncate">{selectedPerson.name}</strong>
                        <span className="text-emerald-700 text-[11px] truncate">· {selectedPerson.role}</span>
                        {selectedPerson.studentId && (
                          <span className="font-mono text-[10px] text-emerald-800 bg-emerald-100 px-1 rounded shrink-0">
                            {selectedPerson.studentId}
                          </span>
                        )}
                      </div>
                      {selectedPerson.isRealtime && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-emerald-200 text-emerald-900 uppercase shrink-0">
                          Realtime Student
                        </span>
                      )}
                    </div>

                    {/* Quick Add Custom Volunteer Name Input */}
                    <div className="pt-1.5 border-t border-slate-100 flex items-center gap-1.5">
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
                        className="flex-1 px-3 py-1.5 rounded-full border border-slate-200 text-xs focus:outline-none focus:border-black"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (customVolunteerName.trim()) {
                            setNewTaskAssignee(customVolunteerName.trim());
                            setCustomVolunteerName('');
                          }
                        }}
                        className="px-3.5 py-1.5 rounded-full bg-black text-white text-xs font-bold hover:bg-slate-800 cursor-pointer"
                      >
                        Select
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2 justify-end">
                <button
                  type="submit"
                  disabled={isCreatingTask}
                  className="px-7 py-2.5 rounded-full bg-[#0064e0] hover:bg-[#0052b8] text-white text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-2"
                >
                  {isCreatingTask ? <ButtonSpinner size={12} /> : 'Assign Student & Schedule Task'}
                </button>
              </div>
            </form>
          </div>

          {/* Filter Tabs Bar: All, Assigned to Me, Registered Students, Statuses */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-full border border-slate-200 flex-wrap">
            <button
              type="button"
              onClick={() => setTaskViewFilter('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                taskViewFilter === 'all'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Tasks ({tasks.length})
            </button>
            {session && (
              <button
                type="button"
                onClick={() => setTaskViewFilter('mine')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  taskViewFilter === 'mine'
                    ? 'bg-black text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Assigned to Me ({myTasks.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => setTaskViewFilter('registered')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                taskViewFilter === 'registered'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Registered Students ({registeredStudentTasks.length})
            </button>
            <button
              type="button"
              onClick={() => setTaskViewFilter('todo')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                taskViewFilter === 'todo'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              To Do ({tasks.filter((t) => t.status === 'todo').length})
            </button>
            <button
              type="button"
              onClick={() => setTaskViewFilter('in_progress')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                taskViewFilter === 'in_progress'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              In Progress ({tasks.filter((t) => t.status === 'in_progress').length})
            </button>
            <button
              type="button"
              onClick={() => setTaskViewFilter('done')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                taskViewFilter === 'done'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Complete ({tasks.filter((t) => t.status === 'done').length})
            </button>
          </div>

          {/* Tasks List Cards */}
          {displayedTasks.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-800">
                {taskViewFilter === 'mine'
                  ? 'No operations tasks assigned to your account yet'
                  : taskViewFilter === 'registered'
                  ? 'No tasks currently assigned to self-registered students'
                  : 'No active operations tasks matching filter'}
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {taskViewFilter === 'mine'
                  ? 'Click "All Tasks" above or click "+ Add Task" to volunteer for a bake sale station.'
                  : 'Click "+ Add Task" above to schedule a new duty and assign it to any student.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
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
                const isRealtimeAssignee = personnelList.some(
                  (p) => p.isRealtime && p.name.toLowerCase() === (task.assignee_name || '').toLowerCase()
                );

                return (
                  <div
                    key={task.id}
                    className={`p-5 sm:p-6 rounded-2xl border bg-slate-50/50 space-y-4 hover:shadow-xs transition-shadow ${
                      isAssignedToMe ? 'border-black ring-1 ring-black/20 bg-slate-50' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-sm sm:text-base text-[#0f172a]">{task.title}</h4>
                          {isAssignedToMe && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black text-white uppercase">
                              Assigned to You
                            </span>
                          )}
                          {isRealtimeAssignee && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
                              Registered Student
                            </span>
                          )}
                        </div>

                        {/* Assigned Student Details Directly Under Task Labels (Front Side — Cannot Hide) */}
                        {(() => {
                          const assigneePerson = personnelList.find(
                            (p) => p.name.toLowerCase() === (task.assignee_name || '').toLowerCase()
                          );
                          return (
                            <div className="mt-2 flex items-center gap-2.5 flex-wrap text-xs">
                              <span className="text-slate-400 font-bold uppercase text-[10px]">Assigned Student:</span>
                              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-2xs">
                                <div className={`w-5 h-5 rounded-full text-[9px] font-bold text-white flex items-center justify-center shrink-0 ${
                                  assigneePerson?.isRealtime ? 'bg-emerald-600' : 'bg-slate-800'
                                }`}>
                                  {(task.assignee_name || 'U').charAt(0).toUpperCase()}
                                </div>
                                <strong className="text-slate-900 font-bold">{task.assignee_name || 'Unassigned'}</strong>
                                {assigneePerson?.studentId && (
                                  <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                    {assigneePerson.studentId}
                                  </span>
                                )}
                                {assigneePerson?.role && (
                                  <span className="text-[11px] text-slate-500">· {assigneePerson.role}</span>
                                )}
                              </div>
                              <span className="text-slate-300">·</span>
                              <span className="text-slate-500">Due: {task.due_at ? new Date(task.due_at).toLocaleDateString() : 'Today'}</span>
                              <span className="text-slate-300">·</span>
                              <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${getPriorityBadge(task.priority)}`}>
                                {task.priority}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider self-start sm:self-auto ${getStatusBadge(
                          task.status
                        )}`}
                      >
                        {task.status.replace('_', ' ')} ({percent}%)
                      </span>
                    </div>

                    {/* Progress options */}
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-700">How much work is done:</span>
                        <span className="text-black font-mono">{percent}% Complete</span>
                      </div>

                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
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

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSetTaskStatus(task.id, 'todo', 0)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            task.status === 'todo'
                              ? 'bg-slate-800 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          To Do (0%)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetTaskStatus(task.id, 'in_progress', 50)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            task.status === 'in_progress'
                              ? 'bg-amber-600 text-white'
                              : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                          }`}
                        >
                          In Progress (50%)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetTaskStatus(task.id, 'done', 100)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            task.status === 'done'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                          }`}
                        >
                          Complete (100%)
                        </button>
                      </div>
                    </div>

                    {/* Student message input and history */}
                    <div className="space-y-2">
                      {task.messages && task.messages.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-bold text-slate-600 uppercase">Updates & Notes:</span>
                          {task.messages.map((m) => (
                            <div
                              key={m.id}
                              className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 flex justify-between items-start gap-2"
                            >
                              <p className="leading-relaxed">
                                <strong>{m.author}:</strong> "{m.text}"
                              </p>
                              <span className="text-[10px] text-slate-400 whitespace-nowrap font-mono">
                                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          value={taskMessageInputs[task.id] || ''}
                          onChange={(e) =>
                            setTaskMessageInputs({ ...taskMessageInputs, [task.id]: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSendTaskMessage(task.id);
                            }
                          }}
                          placeholder="Send message (e.g. Completed pickup, tables placed in quad)..."
                          className="flex-1 px-4 py-2 rounded-full border border-slate-300 bg-white text-xs focus:outline-none focus:border-black"
                        />
                        <button
                          type="button"
                          onClick={() => handleSendTaskMessage(task.id)}
                          className="px-4 py-2 rounded-full bg-black hover:bg-slate-900 text-white text-xs font-bold cursor-pointer transition-colors"
                        >
                          Send Update
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── 3. LIVE REGISTERED MEMBERS & VOLUNTEERS ROSTER (User Request: Real-time data show without admin) ─── */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Roster (Real-time Sync)
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                  Auto-Updates Without Admin Approval
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-[#0f172a]">
                Real-time Registered Students & Volunteers
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Students and members registered directly on CampusOne. Click "+ Assign Task" on any registered student to immediately schedule an operational duty.
              </p>
            </div>

            <div className="text-right self-start sm:self-auto">
              <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                {realtimeCount} Registered Students
              </span>
            </div>
          </div>

          {/* Registered Personnel Grid */}
          {realtimePersonnel.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-800">
                No self-registered students detected yet
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                When new students sign up on the portal (via /signup or membership registration), their real-time profile, student ID, and live task assignment status will immediately display here.
              </p>
              <div className="pt-2">
                <a
                  href="/signup"
                  className="inline-block px-5 py-2 rounded-full bg-black text-white text-xs font-bold hover:bg-slate-900 transition-colors"
                >
                  Register New Student Account
                </a>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {realtimePersonnel.map((person) => {
                const assignedCount = tasks.filter(
                  (t) => t.assignee_name && t.assignee_name.toLowerCase() === person.name.toLowerCase()
                ).length;

                return (
                  <div
                    key={person.id + person.name}
                    className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-400 hover:shadow-xs transition-all space-y-3.5 flex flex-col justify-between"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 truncate">
                          <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                            {person.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <h4 className="font-bold text-sm text-[#0f172a] truncate">
                              {person.name}
                            </h4>
                            <span className="text-[11px] text-slate-500 truncate block font-mono">
                              {person.studentId || 'SKY-2026-REG'}
                            </span>
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase whitespace-nowrap">
                          Realtime
                        </span>
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400">Role:</span>
                          <span className="font-semibold text-slate-800">{person.role}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400">Email:</span>
                          <span className="font-mono text-[11px] text-slate-700 truncate max-w-[170px]" title={person.email}>
                            {person.email}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400">Assigned Duties:</span>
                          <span className={`font-bold ${assignedCount > 0 ? 'text-black' : 'text-slate-400'}`}>
                            {assignedCount > 0 ? `${assignedCount} Active Task(s)` : 'Available'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAssignToPerson(person.name)}
                        className="w-full py-2 rounded-full bg-black hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>+ Assign Task</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── 4. AUDITED FINANCIAL OPERATIONS & CONTRIBUTIONS ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Online Donation via Razorpay (Test Mode rzp_test_T8GBnZ6P23gRoO) */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-2xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-800 border border-slate-200">
                  Online Payment Gateway
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-[#0f172a] mt-1">
                  Support the Spring Semester Bake Sale
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
                rzp_test_T8GBnZ6P23gRoO
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Student contributions directly fund engineering supplies, club workshops, and subsidized gala tickets. Settles via live test gateway.
            </p>

            <div className="space-y-3">
              <label className="block text-[11px] font-bold text-slate-700 uppercase">
                Choose Contribution Amount
              </label>

              {/* Amount Presets */}
              <div className="grid grid-cols-4 gap-2">
                {['50', '100', '250', '500'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setOnlineAmount(preset)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      onlineAmount === preset
                        ? 'bg-black text-white border-black shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-black'
                    }`}
                  >
                    ₹{preset}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    min="1"
                    value={onlineAmount}
                    onChange={(e) => setOnlineAmount(e.target.value)}
                    placeholder="Custom amount"
                    className="w-full pl-8 pr-4 py-2.5 rounded-full border border-slate-200 bg-white text-sm focus:outline-none focus:border-black"
                  />
                </div>
                <button
                  type="button"
                  disabled={isPostingOnline || !onlineAmount || Number(onlineAmount) <= 0}
                  onClick={() => handleOnlineDonation(Number(onlineAmount))}
                  className="px-6 py-2.5 rounded-full bg-[#0064e0] hover:bg-[#0052b8] text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                >
                  {isPostingOnline ? (
                    <>
                      <ButtonSpinner size={14} />
                      <span>Opening...</span>
                    </>
                  ) : (
                    `Donate ₹${onlineAmount || 0}`
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Record Cash Income Form (Audited Cash Ledger) */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-pink-100 text-pink-700">
                  Audited Cash Ledger
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-[#0f172a] mt-1">
                  Record Cash Intake
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Bake sale quad table cash collection desk. Posts immutable audit entries to chapter treasury.
            </p>

            <form onSubmit={handleCashEntry} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Amount Collected (₹) *
                </label>
                <input
                  type="number"
                  required
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  placeholder="e.g. 1200"
                  className="w-full px-4 py-2.5 rounded-full border border-slate-200 text-sm focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Source / Table Description *
                </label>
                <input
                  type="text"
                  required
                  value={cashDesc}
                  onChange={(e) => setCashDesc(e.target.value)}
                  placeholder="Quad table afternoon cookie sales"
                  className="w-full px-4 py-2.5 rounded-full border border-slate-200 text-sm focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Volunteer Actor
                </label>
                <input
                  type="text"
                  disabled
                  value={session?.fullName ? `${session.fullName} (Officer)` : 'Quad Staff Desk'}
                  className="w-full px-4 py-2 rounded-full border border-slate-200 text-xs bg-slate-50 text-slate-500 cursor-not-allowed"
                />
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isPostingCash}
                  className="w-full py-2.5 rounded-full bg-black text-white text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isPostingCash ? <ButtonSpinner size={14} /> : 'Post Cash Entry to Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ─── 5. OPERATIONS MASTER BOARD (All Chapter Operations Tasks & Real-time Audit Table) ─── */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-2xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/60">
                  Operations Master Board
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Live Transparency
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-[#0f172a]">
                All Chapter Operations Tasks & Audit Board
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time operational overview. Inspect active duties, registered student assignees, and live task completion.
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadData()}
              className="px-4 py-1.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 transition-colors shadow-2xs self-start sm:self-auto cursor-pointer"
            >
              Refresh Master Board
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[#64748b] uppercase font-bold tracking-wider">
                  <th className="py-3 px-4">TASK & CAMPAIGN</th>
                  <th className="py-3 px-4">ASSIGNEE</th>
                  <th className="py-3 px-4">PRIORITY</th>
                  <th className="py-3 px-4">WORK PROGRESS</th>
                  <th className="py-3 px-4">STATUS ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No operations tasks currently scheduled.
                    </td>
                  </tr>
                ) : (
                  tasks.map((task) => {
                    const percent =
                      task.progressPercent ??
                      (task.status === 'done' ? 100 : task.status === 'in_progress' ? 50 : 0);
                    const isRealtime = personnelList.some(
                      (p) => p.isRealtime && p.name.toLowerCase() === (task.assignee_name || '').toLowerCase()
                    );

                    return (
                      <tr key={task.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-[#0f172a] max-w-xs">
                          <div>{task.title}</div>
                          <div className="text-[11px] font-normal text-[#64748b]">
                            {fundraiser?.title || 'Spring Semester Bake Sale'}
                          </div>
                          {/* Message Log */}
                          {task.messages && task.messages.length > 0 && (
                            <div className="mt-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-900 font-normal">
                              <span className="font-semibold text-black">Latest Message:</span> "
                              {task.messages[task.messages.length - 1].text}" —{' '}
                              <em className="text-slate-500 font-sans">
                                {task.messages[task.messages.length - 1].author}
                              </em>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-[#334155] font-medium whitespace-nowrap">
                          <span className="bg-slate-100 px-2.5 py-1 rounded-full text-slate-700 font-semibold border border-slate-200/80 inline-flex items-center gap-1.5">
                            <span>{task.assignee_name || 'Unassigned'}</span>
                            {isRealtime && (
                              <span className="px-1.5 py-0.2 rounded text-[8px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                REALTIME
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${getPriorityBadge(
                              task.priority
                            )}`}
                          >
                            {task.priority}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 min-w-[150px]">
                          <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                            <span className="text-slate-600">Progress</span>
                            <span className="text-black font-mono">{percent}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
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
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSetTaskStatus(task.id, 'todo', 0)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase cursor-pointer ${
                                task.status === 'todo'
                                  ? 'bg-slate-700 text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              To Do
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetTaskStatus(task.id, 'in_progress', 50)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase cursor-pointer ${
                                task.status === 'in_progress'
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                              }`}
                            >
                              Progress
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetTaskStatus(task.id, 'done', 100)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase cursor-pointer ${
                                task.status === 'done'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              }`}
                            >
                              Complete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
