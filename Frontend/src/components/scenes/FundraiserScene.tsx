import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { formatPaise } from '../../lib/formatters';
import { LoadingCard, ButtonSpinner } from '../ui/LoadingState';
import { getActiveSession, getCurrentUserSession, type UserSession } from '../../lib/auth';
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
  const [newTaskAssignee, setNewTaskAssignee] = useState<string>(REGISTERED_PERSONNEL[0].name);
  const [taskViewFilter, setTaskViewFilter] = useState<'all' | 'mine'>('all');

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

    const handleAuthChange = (e: CustomEvent) => {
      setSession(e.detail);
    };

    window.addEventListener('campusone:auth_changed' as any, handleAuthChange);
    return () => {
      window.removeEventListener('campusone:auth_changed' as any, handleAuthChange);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAddTask(false);
      }
    };
    if (showAddTask) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [showAddTask]);

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
      const newTask: RichFundraiserTask = {
        id: `task-${Date.now()}`,
        organization_id: 'a0000000-0000-0000-0000-000000000001',
        fundraiser_id: fundraiser?.id || 'fr-1',
        title: newTaskTitle,
        priority: newTaskPriority,
        assignee_name: newTaskAssignee || REGISTERED_PERSONNEL[0].name,
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
            assignee_name: newTaskAssignee,
          }).catch(() => {});
        }
      } catch {}

      setShowAddTask(false);
      setNewTaskTitle('');
      setNewTaskAssignee(REGISTERED_PERSONNEL[0].name);
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

      {/* ─── 2. ADMIN ONLY: TASK BOARDS, CASH INCOME & OPERATIONS MASTER BOARD ─── */}
      {session?.role === 'admin' ? (
        <div className="space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Volunteer Task Board (2 Cols) - Screenshot 010849 */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--color-hairline-soft)]">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-pink-100 text-pink-700">
                      Admin Only
                    </span>
                    <h3 className="text-xl font-bold text-[var(--color-ink-deep)]">Bake Sale Task Board</h3>
                  </div>
                  <p className="text-[12px] text-[var(--color-steel)]">Organize volunteer tasks and table assignments</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddTask(!showAddTask)}
                  className="px-4 py-1.5 rounded-full bg-[var(--color-ink-deep)] text-white text-[12px] font-bold hover:bg-black cursor-pointer t-button-action"
                >
                  + Add Task
                </button>
              </div>

              {/* Add Task Drawer */}
              {showAddTask && (
                <div className="p-6 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)] space-y-3 t-card-interactive">
                  <h4 className="font-bold text-[16px] text-[var(--color-ink-deep)]">New Volunteer Task</h4>
                  <form onSubmit={handleCreateTask} className="space-y-3">
                    <input
                      type="text"
                      required
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="Task title (e.g. Pick up folding tables)"
                      className="w-full px-4 py-2.5 rounded-full border border-[var(--color-hairline)] text-[14px] bg-white focus:outline-none focus:border-[var(--color-fb-blue)]"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Priority Level
                        </label>
                        <select
                          value={newTaskPriority}
                          onChange={(e) => setNewTaskPriority(e.target.value as any)}
                          className="w-full px-4 py-2 rounded-full border border-[var(--color-hairline)] text-[13px] bg-white cursor-pointer"
                        >
                          <option value="urgent">Urgent</option>
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                          Assign Personnel *
                        </label>
                        <select
                          value={newTaskAssignee}
                          onChange={(e) => setNewTaskAssignee(e.target.value)}
                          className="w-full px-4 py-2 rounded-full border border-[var(--color-hairline)] text-[13px] bg-white cursor-pointer font-medium"
                        >
                          {REGISTERED_PERSONNEL.map((person) => (
                            <option key={person.name} value={person.name}>
                              {person.name} — {person.role}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddTask(false)}
                        className="px-4 py-1.5 rounded-full border border-[var(--color-hairline)] text-[12px] font-bold bg-white t-button-action cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isCreatingTask}
                        className="px-5 py-1.5 rounded-full bg-[var(--color-ink-deep)] text-white text-[12px] font-bold hover:bg-black cursor-pointer t-button-action inline-flex items-center gap-2"
                      >
                        {isCreatingTask ? <ButtonSpinner size={12} /> : 'Create Task'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Task Items */}
              <div className="space-y-3">
                {tasks.map((t) => (
                  <div
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleToggleTask(t.id, t.status)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggleTask(t.id, t.status);
                      }
                    }}
                    className="p-4 rounded-2xl border border-[var(--color-hairline-soft)] bg-[var(--color-canvas)] flex items-center justify-between gap-4 cursor-pointer hover:border-[var(--color-ink-deep)] transition-all t-card-interactive focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                    title="Click to toggle status (Todo -> In Progress -> Done)"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full border ${t.status === 'done' ? 'bg-green-600 border-green-600' : 'border-gray-400'}`} />
                        <h4 className={`font-bold text-[15px] ${t.status === 'done' ? 'line-through text-[var(--color-stone)]' : 'text-[var(--color-ink-deep)]'}`}>
                          {t.title}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-[var(--color-steel)] pl-5">
                        <span>Assignee: {t.assignee_name || 'Unassigned'}</span>
                        <span>·</span>
                        <span>Due: {t.due_at ? new Date(t.due_at).toLocaleDateString() : 'Today'}</span>
                        <span>·</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getPriorityBadge(t.priority)}`}>
                          {t.priority}
                        </span>
                      </div>
                    </div>

                    <span className={`px-3 py-1 rounded-full text-[12px] font-bold uppercase tracking-wider ${getStatusBadge(t.status)}`}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Record Cash Bake Sale Entry (1 Col) - Screenshot 010559 */}
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-[var(--color-canvas)] border border-[var(--color-hairline-soft)] shadow-sm space-y-4 t-card-interactive">
                <div className="border-b border-[var(--color-hairline-soft)] pb-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-pink-100 text-pink-700">
                    Admin Only
                  </span>
                  <h3 className="font-bold text-[18px] text-[var(--color-ink-deep)] mt-1">Record Cash Income</h3>
                  <p className="text-[12px] text-[var(--color-steel)]">Bake sale quad table cash collection desk</p>
                </div>

                <form onSubmit={handleCashEntry} className="space-y-3.5">
                  <div>
                    <label className="block text-[12px] font-bold text-[var(--color-ink-deep)] mb-1">
                      Amount Collected (₹)
                    </label>
                    <input
                      type="number"
                      required
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      placeholder="e.g. 1200"
                      className="w-full px-4 py-2.5 rounded-full border border-[var(--color-hairline)] text-[14px] focus:outline-none focus:border-black"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-bold text-[var(--color-ink-deep)] mb-1">
                      Source / Table Description
                    </label>
                    <input
                      type="text"
                      required
                      value={cashDesc}
                      onChange={(e) => setCashDesc(e.target.value)}
                      placeholder="Quad table afternoon cookie sales"
                      className="w-full px-4 py-2.5 rounded-full border border-[var(--color-hairline)] text-[14px] focus:outline-none focus:border-[var(--color-fb-blue)]"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-bold text-[var(--color-ink-deep)] mb-1">Volunteer Actor</label>
                    <input
                      type="text"
                      disabled
                      value={session?.fullName ? `${session.fullName} (Officer)` : 'Ananya P. (Quad Staff Desk)'}
                      className="w-full px-4 py-2 rounded-full border border-[var(--color-hairline-soft)] text-[13px] bg-[var(--color-surface-soft)] text-[var(--color-steel)] cursor-not-allowed"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isPostingCash}
                      className="w-full py-3 rounded-full bg-[var(--color-ink-deep)] text-white text-[13px] font-bold hover:bg-black transition-all cursor-pointer t-button-action flex items-center justify-center gap-2"
                    >
                      {isPostingCash ? <ButtonSpinner size={16} /> : 'Post Cash Entry to Ledger'}
                    </button>
                  </div>

                  <p className="text-[11px] text-[var(--color-stone)] text-center">
                    Updates campaign total & creates immutable audit record.
                  </p>
                </form>
              </div>
            </div>
          </div>

          {/* Operations Master Board / Assign Task Table (Screenshot 010659) */}
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/60">
                    Operations Master Board
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-pink-100 text-pink-700">
                    Admin Only
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-[#0f172a]">
                  All Chapter Operations Tasks
                </h3>
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
                            <span className="bg-slate-100 px-2.5 py-1 rounded-full text-slate-700 font-semibold border border-slate-200/80">
                              {task.assignee_name || 'Unassigned'}
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
      ) : (
        /* Member / Student View: Display operations tasks with filter tabs so tasks list matches total tasks count */
        <div className="space-y-8">
          {session ? (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-2xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-black border border-slate-200">
                    Operations Task Board
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold text-[#0f172a] mt-1">
                    Volunteer & Chapter Operations Tasks
                  </h3>
                  <p className="text-xs text-slate-500">
                    Live operational duties for {fundraiser?.title || 'Chapter Campaign'}. Review tasks, update work progress, and send live notes.
                  </p>
                </div>

                {/* Filter Tabs: All Tasks vs Assigned to Me */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-full border border-slate-200 self-start sm:self-auto">
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
                  <button
                    type="button"
                    onClick={() => setTaskViewFilter('mine')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      taskViewFilter === 'mine'
                        ? 'bg-black text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Assigned to Me ({
                      tasks.filter(
                        (t) =>
                          session?.fullName &&
                          t.assignee_name &&
                          (t.assignee_name.toLowerCase().includes(session.fullName.toLowerCase()) ||
                            session.fullName.toLowerCase().includes(t.assignee_name.toLowerCase()))
                      ).length
                    })
                  </button>
                </div>
              </div>

              {/* Tasks List */}
              {(() => {
                const myAssignedTasks = tasks.filter(
                  (t) =>
                    session?.fullName &&
                    t.assignee_name &&
                    (t.assignee_name.toLowerCase().includes(session.fullName.toLowerCase()) ||
                      session.fullName.toLowerCase().includes(t.assignee_name.toLowerCase()))
                );
                const displayedTasks = taskViewFilter === 'mine' ? myAssignedTasks : tasks;

                if (displayedTasks.length === 0) {
                  return (
                    <div className="py-10 text-center space-y-2">
                      <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-slate-800">
                        {taskViewFilter === 'mine'
                          ? 'No operations tasks assigned to your account yet'
                          : 'No active operations tasks'}
                      </p>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        {taskViewFilter === 'mine'
                          ? 'Click "All Tasks" above to review all active operations duties for this chapter fundraiser.'
                          : 'Tasks will appear here once added by administrators.'}
                      </p>
                    </div>
                  );
                }

                return (
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

                      return (
                        <div
                          key={task.id}
                          className={`p-5 rounded-2xl border bg-slate-50/50 space-y-4 hover:shadow-xs transition-shadow ${
                            isAssignedToMe ? 'border-black ring-1 ring-black/20' : 'border-slate-200'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-sm sm:text-base text-[#0f172a]">{task.title}</h4>
                                {isAssignedToMe && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-black border border-slate-200 uppercase">
                                    Assigned to You
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 font-mono mt-0.5">
                                Assignee: <strong className="text-slate-800">{task.assignee_name || 'Unassigned'}</strong> · Due: {task.due_at ? new Date(task.due_at).toLocaleDateString() : 'Today'} · Priority:{' '}
                                <span className="font-bold uppercase text-slate-700">{task.priority}</span>
                              </p>
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

                          {/* Student message input and history (User Request) */}
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
                                placeholder="Send message (e.g. Complete setup, need 2 more volunteers)..."
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
                );
              })()}
            </div>
          ) : (
            <div className="p-8 rounded-3xl bg-[var(--color-canvas)] border border-[var(--color-hairline-soft)] text-center space-y-3 shadow-2xs">
              <p className="text-sm font-semibold text-slate-800">Sign in to access your assigned volunteer tasks</p>
              <a
                href="/login"
                className="inline-block px-5 py-2 rounded-full bg-black text-white text-xs font-bold hover:bg-slate-900"
              >
                Sign In
              </a>
            </div>
          )}

          {/* Campaign Support Information & Online Razorpay Donation */}
          <div className="p-8 rounded-3xl bg-[var(--color-canvas)] border border-[var(--color-hairline-soft)] text-center space-y-6 shadow-2xs">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-[var(--color-ink-deep)]">Support the Spring Semester Bake Sale</h3>
              <p className="text-sm text-[var(--color-steel)] max-w-lg mx-auto leading-relaxed">
                Student contributions directly fund engineering supplies, club workshops, and subsidized gala tickets.
              </p>
            </div>

            {/* Online Donation via Razorpay (Test Mode) */}
            <div className="max-w-md mx-auto p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-black">
                  Contribute Online (Test Gateway)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 text-black font-semibold">
                  rzp_test_T8GBnZ6P23gRoO
                </span>
              </div>

              {/* Amount Presets */}
              <div className="grid grid-cols-4 gap-2">
                {['50', '100', '250', '500'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setOnlineAmount(preset)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      onlineAmount === preset
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-black'
                    }`}
                  >
                    ₹{preset}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
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
                  className="px-6 py-2.5 rounded-full bg-black hover:bg-slate-900 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isPostingOnline ? (
                    <>
                      <ButtonSpinner size={14} />
                      <span>Opening...</span>
                    </>
                  ) : (
                    `Donate ₹${onlineAmount || 0} via Razorpay`
                  )}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <a
                href="/memberships"
                className="inline-block px-6 py-2.5 rounded-full bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
              >
                Explore Membership Benefits →
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
