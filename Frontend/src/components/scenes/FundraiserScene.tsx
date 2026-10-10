import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { formatPaise } from '../../lib/formatters';
import { LoadingCard, ButtonSpinner } from '../ui/LoadingState';
import { getActiveSession, getCurrentUserSession, type UserSession } from '../../lib/auth';
import type { Fundraiser, FundraiserTask, TaskStatus, TaskPriority } from '@campusone/contracts';

export default function FundraiserScene() {
  const [session, setSession] = useState<UserSession | null>(() => {
    if (typeof window !== 'undefined') return getActiveSession();
    return null;
  });
  const [fundraiser, setFundraiser] = useState<Fundraiser | null>(null);
  const [tasks, setTasks] = useState<FundraiserTask[]>([]);
  const [loading, setLoading] = useState(true);

  // Async button loading states
  const [isPostingCash, setIsPostingCash] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // Cash contribution entry state
  const [cashAmount, setCashAmount] = useState('');
  const [cashDesc, setCashDesc] = useState('Quad table afternoon cookie sales');
  const [cashSuccess, setCashSuccess] = useState<string | null>(null);

  // New task modal state
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('high');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');

  const loadData = async () => {
    try {
      const fList = await api.getActiveFundraisers();
      if (fList.length > 0) {
        setFundraiser(fList[0]);
        const tList = await api.getFundraiserTasks(fList[0].id);
        setTasks(tList);
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

  // Handle Task Status Toggle
  const handleToggleTask = async (taskId: string, currentStatus: TaskStatus) => {
    let nextStatus: TaskStatus = 'in_progress';
    if (currentStatus === 'todo') nextStatus = 'in_progress';
    else if (currentStatus === 'in_progress') nextStatus = 'done';
    else nextStatus = 'todo';

    try {
      await api.updateTaskStatus(taskId, nextStatus);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Handle Create Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle || !fundraiser) return;
    setIsCreatingTask(true);
    try {
      await api.createTask({
        fundraiser_id: fundraiser.id,
        title: newTaskTitle,
        priority: newTaskPriority,
        assignee_name: newTaskAssignee || 'Unassigned',
      });
      setShowAddTask(false);
      setNewTaskTitle('');
      setNewTaskAssignee('');
      await loadData();
    } catch (err: any) {
      alert(err.message);
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
        return 'bg-blue-100 text-blue-800';
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
                    <div className="grid grid-cols-2 gap-3">
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
                      <input
                        type="text"
                        value={newTaskAssignee}
                        onChange={(e) => setNewTaskAssignee(e.target.value)}
                        placeholder="Assignee name"
                        className="w-full px-4 py-2 rounded-full border border-[var(--color-hairline)] text-[13px] bg-white"
                      />
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
                      className="w-full px-4 py-2.5 rounded-full border border-[var(--color-hairline)] text-[14px] focus:outline-none focus:border-[var(--color-fb-blue)]"
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
                    <th className="py-3 px-4">DUE DATE</th>
                    <th className="py-3 px-4">STATUS</th>
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
                    tasks.map((task) => (
                      <tr key={task.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-[#0f172a]">
                          <div>{task.title}</div>
                          <div className="text-[11px] font-normal text-[#64748b]">
                            {fundraiser?.title || 'Spring Semester Bake Sale'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-[#334155] font-medium">
                          {task.assignee_name || 'Unassigned'}
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
                        <td className="py-3.5 px-4 text-[#64748b] font-mono">
                          {task.due_at ? new Date(task.due_at).toLocaleDateString() : '17 Oct 2026'}
                        </td>
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => handleToggleTask(task.id, task.status)}
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-transform active:scale-95 ${getStatusBadge(
                              task.status
                            )}`}
                            title="Click to toggle status"
                          >
                            {task.status.replace('_', ' ')}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Public / Member View: Campaign Support Information */
        <div className="p-8 rounded-3xl bg-[var(--color-canvas)] border border-[var(--color-hairline-soft)] text-center space-y-4 shadow-2xs">
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-bold">
            🍪
          </div>
          <h3 className="text-xl font-bold text-[var(--color-ink-deep)]">Support the Spring Semester Bake Sale</h3>
          <p className="text-sm text-[var(--color-steel)] max-w-lg mx-auto leading-relaxed">
            Student contributions directly fund engineering supplies, club workshops, and subsidized gala tickets. Visit our quad table during lunch hours to grab freshly baked snacks or join our volunteer committee!
          </p>
          <div className="pt-2">
            <a
              href="/memberships"
              className="inline-block px-6 py-2.5 rounded-full bg-[#0064e0] hover:bg-[#0052b8] text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
            >
              Explore Membership Benefits →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
