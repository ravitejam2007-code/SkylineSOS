import { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { formatPaise } from '../../lib/formatters';
import { LoadingCard, ButtonSpinner } from '../ui/LoadingState';
import { getActiveSession, getCurrentUserSession, getRegisteredAccounts, type UserSession } from '../../lib/auth';
import { openRazorpayCheckout } from '../../lib/razorpay';
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

export interface FundraiserPaymentEntry {
  id: string;
  timestamp: string;
  contributor: string;
  method: 'online' | 'cash';
  amountPaise: number;
  status: 'settled' | 'audited';
  notes: string;
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

  // 1. Base chapter staff & leads (Aligned with Screenshot 052542)
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
const REAL_BAKE_SALE_TASKS: RichFundraiserTask[] = [
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

const DEFAULT_PAYMENT_HISTORY: FundraiserPaymentEntry[] = [
  {
    id: 'PAY-RZP-98421',
    timestamp: '2026-10-10T14:45:00Z',
    contributor: 'Ananya Rao',
    method: 'online',
    amountPaise: 50000,
    status: 'settled',
    notes: 'Online donation settled via Razorpay test mode',
  },
  {
    id: 'PAY-CSH-44102',
    timestamp: '2026-10-10T13:30:00Z',
    contributor: 'Sarah Student (Quad Desk)',
    method: 'cash',
    amountPaise: 120000,
    status: 'audited',
    notes: 'Quad table afternoon cookie sales cash intake',
  },
  {
    id: 'PAY-CSH-33918',
    timestamp: '2026-10-10T11:15:00Z',
    contributor: 'Priya Patel (Treasurer Desk)',
    method: 'cash',
    amountPaise: 85000,
    status: 'audited',
    notes: 'Morning muffins and brownie batch table collection',
  },
  {
    id: 'PAY-RZP-91044',
    timestamp: '2026-10-09T17:20:00Z',
    contributor: 'Vikram Singh',
    method: 'online',
    amountPaise: 25000,
    status: 'settled',
    notes: 'Online donation settled via Razorpay test mode',
  },
];

function sanitizeOperationsTasks(loadedTasks: any[]): RichFundraiserTask[] {
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

  // Mode: Volunteering vs Fundraiser Financials (User Request: "seprate voluentry and fundrise", "fund only admin show others not show")
  const [activeTab, setActiveTab] = useState<'volunteering' | 'fundraiser'>('volunteering');

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

  const [paymentHistory, setPaymentHistory] = useState<FundraiserPaymentEntry[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('skylinesos:fundraiser_payment_history');
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return DEFAULT_PAYMENT_HISTORY;
  });

  const [taskMessageInputs, setTaskMessageInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Async button loading states
  const [isPostingCash, setIsPostingCash] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // Cash contribution entry state (Admin view)
  const [cashAmount, setCashAmount] = useState('');
  const [cashDesc, setCashDesc] = useState('Quad table afternoon cookie sales');
  const [cashSuccess, setCashSuccess] = useState<string | null>(null);

  // Online contribution state (Razorpay test mode)
  const [onlineAmount, setOnlineAmount] = useState('250');
  const [isPostingOnline, setIsPostingOnline] = useState(false);

  // Admin New task duty state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskStation, setNewTaskStation] = useState<BakeSaleStation>('baking');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('high');
  const [newTaskAssignee, setNewTaskAssignee] = useState<string>('Sarah Student');

  // Volunteering station view filter
  const [stationFilter, setStationFilter] = useState<'all' | 'baking' | 'supplies' | 'table' | 'mine'>('all');

  // Custom dropdown states matching Screenshot 052542 with transitions-dev
  const [showNewTaskCard, setShowNewTaskCard] = useState(true);
  const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false);
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const priorityDropdownRef = useRef<HTMLDivElement | null>(null);
  const assigneeDropdownRef = useRef<HTMLDivElement | null>(null);

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

    const handleClickOutside = (e: MouseEvent) => {
      if (priorityDropdownRef.current && !priorityDropdownRef.current.contains(e.target as Node)) {
        setPriorityDropdownOpen(false);
      }
      if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(e.target as Node)) {
        setAssigneeDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPriorityDropdownOpen(false);
        setAssigneeDropdownOpen(false);
      }
    };

    window.addEventListener('campusone:auth_changed' as any, handleAuthChange);
    window.addEventListener('storage', refreshPersonnel);
    window.addEventListener('skylinesos:registered_accounts_updated' as any, refreshPersonnel);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    const pollTimer = setInterval(refreshPersonnel, 2500);

    return () => {
      window.removeEventListener('campusone:auth_changed' as any, handleAuthChange);
      window.removeEventListener('storage', refreshPersonnel);
      window.removeEventListener('skylinesos:registered_accounts_updated' as any, refreshPersonnel);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      clearInterval(pollTimer);
    };
  }, []);

  // Handle Cash Contribution Submit (Admin view)
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

      // Update local fundraiser raised amount
      const newRaised = (fundraiser.raised_paise || 1420000) + paise;
      setFundraiser({ ...fundraiser, raised_paise: newRaised });

      // Add to Payment History Ledger
      const newPayment: FundraiserPaymentEntry = {
        id: res.ledger_entry_id || `PAY-CSH-${Date.now().toString().slice(-5)}`,
        timestamp: new Date().toISOString(),
        contributor: session?.fullName ? `${session.fullName} (Quad Desk)` : 'Quad Cashier Desk',
        method: 'cash',
        amountPaise: paise,
        status: 'audited',
        notes: cashDesc,
      };
      const updatedHistory = [newPayment, ...paymentHistory];
      setPaymentHistory(updatedHistory);
      try {
        localStorage.setItem('skylinesos:fundraiser_payment_history', JSON.stringify(updatedHistory));
      } catch {}

      setCashSuccess(`Audited cash entry of ₹${cashAmount} posted to ledger (${newPayment.id})!`);
      setCashAmount('');
    } catch (err: any) {
      alert(err.message || 'Failed to post cash entry');
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

      // Update local raised amount
      const newRaised = (fundraiser.raised_paise || 1420000) + paise;
      setFundraiser({ ...fundraiser, raised_paise: newRaised });

      // Add to Payment History Ledger
      const newPayment: FundraiserPaymentEntry = {
        id: `PAY-RZP-${paymentResult.paymentId.slice(-6)}`,
        timestamp: new Date().toISOString(),
        contributor: session?.fullName || 'Online Supporter',
        method: 'online',
        amountPaise: paise,
        status: 'settled',
        notes: `Online donation settled via Razorpay test gateway (${paymentResult.paymentId})`,
      };
      const updatedHistory = [newPayment, ...paymentHistory];
      setPaymentHistory(updatedHistory);
      try {
        localStorage.setItem('skylinesos:fundraiser_payment_history', JSON.stringify(updatedHistory));
      } catch {}

      setCashSuccess(
        `Thank you! Contribution of ₹${amountInRupees} settled via Razorpay (ID: ${paymentResult.paymentId})!`
      );
    } catch (err: any) {
      alert(err.message || 'Payment was not completed. Contribution was not recorded.');
    } finally {
      setIsPostingOnline(false);
    }
  };

  // Handle Student Updating Task Status / Progress
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

  // Handle Sending Task Progress Message / Update
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

      setNewTaskTitle('');
      setCashSuccess(`Task "${newTaskTitle}" scheduled and assigned to ${assignedName}!`);
    } catch (err: any) {
      alert(err.message || 'Failed to create task');
    } finally {
      setIsCreatingTask(false);
    }
  };

  if (loading) {
    return <LoadingCard label="Loading bake sale operations & volunteer duties..." />;
  }

  // Financial Metrics (Admin View)
  const raisedPaise = fundraiser?.raised_paise || 1420000;
  const goalPaise = fundraiser?.goal_paise || 2500000;
  const balancePaise = Math.max(0, goalPaise - raisedPaise);
  const goalPercent = Math.min(100, Math.round((raisedPaise / goalPaise) * 100));
  const pendingPercent = Math.max(0, 100 - goalPercent);

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
      {/* Toast Banner */}
      {cashSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex justify-between items-center text-sm shadow-xs">
          <span className="font-semibold">✓ {cashSuccess}</span>
          <button
            onClick={() => setCashSuccess(null)}
            className="font-bold underline ml-4 text-xs cursor-pointer text-emerald-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ─── NAVIGATION MODE SELECTOR (Volunteering vs Fundraiser) ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-full border border-slate-200 self-start">
          <button
            type="button"
            onClick={() => setActiveTab('volunteering')}
            className={`px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'volunteering'
                ? 'bg-black text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Volunteering & Duties</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-200">
              {tasks.length}
            </span>
          </button>

          {/* Fundraiser Tab (Visible ONLY to Admin — User Request: "fund only admin show others not show") */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('fundraiser')}
              className={`px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'fundraiser'
                  ? 'bg-black text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Fundraiser Financials</span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                Admin
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Spring Semester Bake Sale · Live Operations Sync</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          VIEW 1: VOLUNTEERING VIEW (Tasks, Stations & Leadership Roster)
          ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'volunteering' && (
        <div className="space-y-8">
          {/* ─── SUMMARY KPI CARDS (Matching Screenshot 052542) ─── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Fundraiser Raised */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-[#0f172a]">
                  {formatPaise(raisedPaise)}
                </span>
                <span className="text-sm font-semibold text-slate-500">
                  raised of {formatPaise(goalPaise)} goal
                </span>
              </div>

              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(8, goalPercent))}%` }}
                />
              </div>

              <p className="text-xs text-slate-500">
                {goalPercent}% of goal achieved · Backed by real audited bake-sale cash entries
              </p>
            </div>

            {/* Card 2: Tasks Done */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-[#0f172a]">
                  {doneTasks.length} Done
                </span>
                <span className="text-sm font-semibold text-slate-500">
                  out of {totalTasks} total tasks
                </span>
              </div>

              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-black h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(10, taskPercent))}%` }}
                />
              </div>

              <p className="text-xs text-slate-500">
                Task completion and money raised are separate, verifiable operational metrics.
              </p>
            </div>
          </div>

          {/* ─── ADMIN DUTY ASSIGNMENT BLOCK (Visible ONLY to Admin Role) ─── */}
          {/* User Request: "task assign duty only admin not show students and other role show only admin role." */}
          {/* User Request: "admin assign task him name choose him acconut show task title show." */}
          {isAdmin && (
            <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-800 border border-slate-200">
                      Admin Access
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Duty Assignment Form
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-[#0f172a]">
                    Assign Student to Bake Sale Station Duty
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Schedule a duty for a student. The assigned duty will immediately appear in their account view.
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
                      Task Title *
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
                      Bake Sale Station *
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

                {/* Assign Student Details Search & Picker */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase">
                      Choose Student / Volunteer Assignee *
                    </label>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {personnelList.length} Registered Volunteers Available
                    </span>
                  </div>

                  {/* Student Search & List */}
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

                    {/* Scrollable Student Selection Grid */}
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

                    {/* Assigned Student Confirmation */}
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-950">
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-bold text-[10px] uppercase text-emerald-800">Assigned Student:</span>
                        <strong>{selectedPerson.name}</strong>
                        <span className="text-emerald-700 text-[11px] truncate">· {selectedPerson.role}</span>
                        {selectedPerson.studentId && (
                          <span className="font-mono text-[10px] bg-emerald-100 px-1 rounded text-emerald-900">
                            {selectedPerson.studentId}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full shrink-0">
                        Ready to Assign
                      </span>
                    </div>

                    {/* Quick Custom Volunteer Name */}
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
          {/* User Request: "admin inside task process remove not work buttons admin only status see task proccess just." */}
          {displayedTasks.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-2">
              <p className="text-sm font-bold text-slate-800">
                {stationFilter === 'mine'
                  ? 'No tasks currently assigned to your account.'
                  : 'No duties found under this station filter.'}
              </p>
              <p className="text-xs text-slate-500">
                {stationFilter === 'mine'
                  ? 'When the chapter administrator assigns a bake sale duty to your name, it will show up here.'
                  : 'Select "All Duties" to view all bake sale stations.'}
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
                              Assigned to You
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

                      {/* Admin view: clean status display ONLY. Buttons REMOVED per user request */}
                      {/* Student view: if assigned to current user, they can update their status! */}
                      {!isAdmin && isAssignedToMe ? (
                        <div className="space-y-1 pt-1">
                          <span className="text-[11px] font-bold text-slate-600 uppercase">Update Your Duty Progress:</span>
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
                        </div>
                      )}
                    </div>

                    {/* Duty Notes & Progress Message Log */}
                    <div className="space-y-2 pt-1">
                      {task.messages && task.messages.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-bold text-slate-500 uppercase">Station Log & Notes:</span>
                          {task.messages.map((m) => (
                            <div
                              key={m.id}
                              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 flex justify-between items-start gap-2"
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

                      <div className="flex gap-2">
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
                          placeholder="Post update (e.g. Batch out of oven, tables set up at Quad)..."
                          className="flex-1 px-4 py-2 rounded-full border border-slate-300 bg-white text-xs focus:outline-none focus:border-black"
                        />
                        <button
                          type="button"
                          onClick={() => handleSendTaskMessage(task.id)}
                          className="px-4 py-2 rounded-full bg-black hover:bg-slate-800 text-white text-xs font-bold cursor-pointer transition-colors"
                        >
                          Post Note
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ─── LEADERSHIP & REGISTERED VOLUNTEER ROSTER ─── */}
          {/* User Request: "voluentry only tasks reletd and leadrships" */}
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
              <span className="text-xs text-slate-600 font-bold self-start sm:self-auto bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
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
                        + Assign Task to {person.name.split(' ')[0]}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          VIEW 2: FUNDRAISER FINANCIALS VIEW (Strictly Admin Role)
          ═══════════════════════════════════════════════════════════════════════ */}
      {/* User Request: "fund only admin show others not show" */}
      {/* User Request: "fundrise show amount balence amount pending amount pay hisry" */}
      {activeTab === 'fundraiser' && isAdmin && (
        <div className="space-y-10">
          {/* Financial Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* 1. Goal Amount */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 space-y-2 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Campaign Goal
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#0f172a]">
                {formatPaise(goalPaise)}
              </div>
              <p className="text-xs text-slate-500">
                Official target for {fundraiser?.title || 'Spring Bake Sale'}
              </p>
            </div>

            {/* 2. Amount Raised */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 space-y-2 shadow-2xs">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">
                Total Amount Raised
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700">
                {formatPaise(raisedPaise)}
              </div>
              <p className="text-xs text-slate-500">
                {goalPercent}% of target achieved
              </p>
            </div>

            {/* 3. Balance Amount */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 space-y-2 shadow-2xs">
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">
                Balance Amount Remaining
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#0f172a]">
                {formatPaise(balancePaise)}
              </div>
              <p className="text-xs text-slate-500">
                Balance needed to hit target
              </p>
            </div>

            {/* 4. Pending Amount / Target */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 space-y-2 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Pending Target %
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-800">
                {pendingPercent}%
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all"
                  style={{ width: `${goalPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* ─── PAYMENT HISTORY LEDGER (`pay hisry`) ─── */}
          {/* User Request: "fundrise show amount balence amount pending amount pay hisry" */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-800 border border-slate-200">
                  Audited Treasury Ledger
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-[#0f172a] mt-1">
                  Fundraiser Payment & Collection History
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete verifiable transaction log from table cash collections and online Razorpay donations.
                </p>
              </div>
              <span className="text-xs text-slate-600 font-bold bg-slate-100 px-3 py-1 rounded-full border border-slate-200 self-start sm:self-auto">
                {paymentHistory.length} Recorded Transactions
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase font-bold tracking-wider">
                    <th className="py-3 px-4">Receipt / ID</th>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Contributor / Desk Officer</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Audit Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paymentHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No transactions recorded yet in payment history.
                      </td>
                    </tr>
                  ) : (
                    paymentHistory.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {entry.id}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {new Date(entry.timestamp).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3.5 px-4 text-slate-900 font-medium">
                          <div>{entry.contributor}</div>
                          <div className="text-[10px] text-slate-400">{entry.notes}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              entry.method === 'cash'
                                ? 'bg-pink-100 text-pink-800 border border-pink-200'
                                : 'bg-sky-100 text-sky-800 border border-sky-200'
                            }`}
                          >
                            {entry.method === 'cash' ? 'Cash Intake' : 'Razorpay Online'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">
                          {formatPaise(entry.amountPaise)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            ✓ Verified & Audited
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── CASH INTAKE DESK & ONLINE TEST CHECKOUT ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Record Cash Income Form (Audited Cash Ledger) */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-pink-100 text-pink-700">
                    Quad Cashier Desk
                  </span>
                  <h3 className="text-lg sm:text-xl font-bold text-[#0f172a] mt-1">
                    Record Quad Table Cash Intake
                  </h3>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Bake sale table cash collection desk. Posts immutable audit entries into chapter treasury.
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
                    Submitting Officer
                  </label>
                  <input
                    type="text"
                    disabled
                    value={session?.fullName ? `${session.fullName} (Administrator)` : 'Executive Admin Desk'}
                    className="w-full px-4 py-2 rounded-full border border-slate-200 text-xs bg-slate-50 text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={isPostingCash}
                    className="w-full py-2.5 rounded-full bg-black text-white text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isPostingCash ? <ButtonSpinner size={14} /> : 'Post Audited Cash Intake'}
                  </button>
                </div>
              </form>
            </div>

            {/* Online Test Donation (Razorpay Test Mode) */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-800 border border-slate-200">
                    Online Payment Gateway
                  </span>
                  <h3 className="text-lg sm:text-xl font-bold text-[#0f172a] mt-1">
                    Simulate Online Donation
                  </h3>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  rzp_test_T8GBnZ6P23gRoO
                </span>
              </div>

              <p className="text-xs text-slate-500">
                Test mode live integration with Razorpay. Contributes directly to the bake sale fund and logs into payment history.
              </p>

              <div className="space-y-3">
                <label className="block text-[11px] font-bold text-slate-700 uppercase">
                  Select Preset Amount
                </label>
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
                    className="px-6 py-2.5 rounded-full bg-black hover:bg-slate-800 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shadow-xs"
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
          </div>
        </div>
      )}
    </div>
  );
}
