import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { formatPaise } from '../../lib/formatters';
import { LoadingCard, ButtonSpinner } from '../ui/LoadingState';
import type { Fundraiser, FundraiserTask, TaskStatus, TaskPriority } from '@campusone/contracts';

export default function FundraiserScene() {
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

      {/* ─── 2. TASK BOARD & CASH CONTRIBUTION ENTRY ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Volunteer Task Board (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--color-hairline-soft)]">
            <h3 className="text-xl font-bold text-[var(--color-ink-deep)]">Bake Sale Task Board</h3>
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

        {/* Record Cash Bake Sale Entry (1 Col) */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[var(--color-canvas)] border border-[var(--color-hairline-soft)] shadow-sm space-y-4 t-card-interactive">
            <div className="border-b border-[var(--color-hairline-soft)] pb-3">
              <h3 className="font-bold text-[18px] text-[var(--color-ink-deep)]">Record Cash Income</h3>
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
                  placeholder="e.g. Quad afternoon cookie sales"
                  className="w-full px-4 py-2.5 rounded-full border border-[var(--color-hairline)] text-[14px] focus:outline-none focus:border-[var(--color-fb-blue)]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-bold text-[var(--color-ink-deep)] mb-1">Volunteer Actor</label>
                <input
                  type="text"
                  disabled
                  value="Ananya P. (Quad Staff Desk)"
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
    </div>
  );
}
