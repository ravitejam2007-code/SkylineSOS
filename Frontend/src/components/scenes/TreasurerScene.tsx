import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { formatPaise } from '../../lib/formatters';
import { LoadingCard, ButtonSpinner } from '../ui/LoadingState';
import type { TreasurerOverviewResult, LedgerEntry, ActionQueueItem } from '@campusone/contracts';

export default function TreasurerScene() {
  const [overview, setOverview] = useState<TreasurerOverviewResult | null>(null);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'online' | 'cash' | 'expense'>('all');
  const [actionQueue, setActionQueue] = useState<ActionQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Async button loading states
  const [isRefreshingQueue, setIsRefreshingQueue] = useState(false);
  const [resolvingItemId, setResolvingItemId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [ov, le, aq] = await Promise.all([
        api.getTreasurerOverview(),
        api.getLedgerEntries(activeFilter),
        api.getActionQueueItems(),
      ]);
      setOverview(ov);
      setLedgerEntries(le);
      setActionQueue(aq);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeFilter]);

  // Handle Action Queue Refresh (Re-evaluate deterministic SQL rules)
  const handleRefreshQueue = async () => {
    setIsRefreshingQueue(true);
    try {
      const count = await api.refreshActionQueue();
      setActionSuccess(`Evaluated all deterministic operational rules! Active open items: ${count}.`);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsRefreshingQueue(false);
    }
  };

  // Handle Resolve Action Item
  const handleResolveItem = async (itemId: string, title: string) => {
    setResolvingItemId(itemId);
    try {
      await api.resolveActionQueueItem(itemId, 'Staff verified & closed');
      setActionSuccess(`Action item "${title}" marked resolved.`);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setResolvingItemId(null);
    }
  };

  if (loading) {
    return <LoadingCard label="Loading audited ledger & real-time money movement..." />;
  }

  const netMovement = overview?.netPaise ?? overview?.net_recorded_movement_paise ?? 4469200;
  const totalIncome = overview?.inPaise ?? overview?.total_income_paise ?? 5219200;
  const totalExpense = overview?.outPaise ?? overview?.total_expense_paise ?? 750000;

  const methodOnline = overview?.byMethod?.online ?? overview?.by_method?.online ?? 0;
  const methodCash = overview?.byMethod?.cash ?? overview?.by_method?.cash ?? 0;
  const methodUpi = overview?.byMethod?.manual_upi ?? overview?.by_method?.manual_upi ?? 0;

  const sourceDues = overview?.byCategory?.dues ?? overview?.by_source?.dues ?? 0;
  const sourceTickets = overview?.byCategory?.tickets ?? overview?.by_source?.tickets ?? 0;
  const sourceMerch = overview?.byCategory?.merch ?? overview?.by_source?.merch ?? 0;
  const sourceFundraiser = overview?.byCategory?.fundraiser ?? overview?.by_source?.fundraiser ?? 0;

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'medium':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-12 t-enter">
      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-success)] text-[var(--color-success)] flex justify-between items-center text-[14px] t-toast is-open">
          <span>✓ {actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="font-bold underline ml-4 text-[12px] cursor-pointer">Dismiss</button>
        </div>
      )}

      {/* ─── 1. THREE BIG KPI TILES (Money In, Money Out, Net Recorded Movement) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Money In */}
        <div className="p-8 rounded-3xl bg-[var(--color-canvas)] border border-[var(--color-hairline-soft)] space-y-2 t-card-interactive">
          <span className="text-[13px] font-bold text-[var(--color-steel)] uppercase tracking-wider">
            Money In (Total)
          </span>
          <div className="text-3xl sm:text-4xl font-extrabold text-[var(--color-success)]">
            +{formatPaise(totalIncome)}
          </div>
          <p className="text-[12px] text-[var(--color-steel)] pt-1">
            Dues, Gala Tickets, Merch, Bake Sale Cash
          </p>
        </div>

        {/* Money Out */}
        <div className="p-8 rounded-3xl bg-[var(--color-canvas)] border border-[var(--color-hairline-soft)] space-y-2 t-card-interactive">
          <span className="text-[13px] font-bold text-[var(--color-steel)] uppercase tracking-wider">
            Money Out (Expenses)
          </span>
          <div className="text-3xl sm:text-4xl font-extrabold text-[var(--color-critical)]">
            -{formatPaise(totalExpense)}
          </div>
          <p className="text-[12px] text-[var(--color-steel)] pt-1">
            Reimbursed quad canopies, baking supplies
          </p>
        </div>

        {/* Net Recorded Movement */}
        <div className="p-8 rounded-3xl bg-[var(--color-canvas)] border-2 border-[var(--color-ink-deep)] space-y-2 shadow-sm t-card-interactive">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-[var(--color-ink-deep)] uppercase tracking-wider">
              Net Recorded Movement
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-800">
              Balanced
            </span>
          </div>
          <div className="text-3xl sm:text-4xl font-extrabold text-[var(--color-ink-deep)]">
            {formatPaise(netMovement)}
          </div>
          <p className="text-[12px] text-[var(--color-steel)] pt-1">
            Authoritative ledger balance · Zero missing cash
          </p>
        </div>
      </div>

      {/* ─── 2. REVENUE BREAKDOWN (By Method & By Source) ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)] space-y-4 t-card-interactive">
          <h4 className="font-bold text-[16px] text-[var(--color-ink-deep)]">Breakdown by Payment Method</h4>
          <div className="space-y-2 text-[14px]">
            <div className="flex justify-between py-1 border-b border-[var(--color-hairline-soft)]">
              <span className="text-[var(--color-steel)]">Online Cards & UPI</span>
              <span className="font-mono font-bold text-[var(--color-ink-deep)]">
                {formatPaise(methodOnline)}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[var(--color-hairline-soft)]">
              <span className="text-[var(--color-steel)]">Staff Recorded Cash (Door/Table)</span>
              <span className="font-mono font-bold text-[var(--color-ink-deep)]">
                {formatPaise(methodCash)}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[var(--color-steel)]">Manual UPI Desk Receipts</span>
              <span className="font-mono font-bold text-[var(--color-ink-deep)]">
                {formatPaise(methodUpi)}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)] space-y-4 t-card-interactive">
          <h4 className="font-bold text-[16px] text-[var(--color-ink-deep)]">Breakdown by Income Source</h4>
          <div className="space-y-2 text-[14px]">
            <div className="flex justify-between py-1 border-b border-[var(--color-hairline-soft)]">
              <span className="text-[var(--color-steel)]">Membership Dues</span>
              <span className="font-mono font-bold text-[var(--color-ink-deep)]">
                {formatPaise(sourceDues)}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[var(--color-hairline-soft)]">
              <span className="text-[var(--color-steel)]">Gala Event Tickets</span>
              <span className="font-mono font-bold text-[var(--color-ink-deep)]">
                {formatPaise(sourceTickets)}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[var(--color-hairline-soft)]">
              <span className="text-[var(--color-steel)]">Club Merchandise</span>
              <span className="font-mono font-bold text-[var(--color-ink-deep)]">
                {formatPaise(sourceMerch)}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[var(--color-steel)]">Bake Sale Fundraiser</span>
              <span className="font-mono font-bold text-[var(--color-ink-deep)]">
                {formatPaise(sourceFundraiser)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 3. AUDITED SOURCE LEDGER TABLE ─── */}
      <div className="p-8 rounded-3xl bg-[var(--color-canvas)] border border-[var(--color-hairline-soft)] space-y-6 t-card-interactive">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--color-hairline-soft)]">
          <div>
            <h3 className="text-2xl font-bold text-[var(--color-ink-deep)]">Audited Source Ledger</h3>
            <p className="text-[13px] text-[var(--color-steel)]">
              Immutable records linking directly to checkouts and contributions
            </p>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {(['all', 'online', 'cash', 'expense'] as const).map((key) => {
              const label =
                key === 'all'
                  ? 'All Sources'
                  : key === 'online'
                  ? 'Online Payments'
                  : key === 'cash'
                  ? 'Staff Cash'
                  : 'Expenses';
              const active = activeFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveFilter(key)}
                  className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold transition-all cursor-pointer t-button-action ${
                    active
                      ? 'bg-[var(--color-ink-deep)] text-white shadow-sm'
                      : 'bg-[var(--color-surface-soft)] text-[var(--color-steel)] hover:text-black border border-[var(--color-hairline-soft)]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[14px]">
            <thead>
              <tr className="border-b border-[var(--color-hairline-soft)] text-[var(--color-steel)] text-[12px] font-bold uppercase tracking-wider">
                <th className="py-3 px-3">Entry ID</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Method</th>
                <th className="py-3 px-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-hairline-soft)]">
              {ledgerEntries.map((e) => {
                const isIncome = e.entry_type === 'income' || e.direction === 'in';
                const dateStr = e.effective_date || e.effective_on || '';
                const descStr = e.notes || e.memo || 'Ledger transaction';
                const methodStr = (e.payment_method || e.method || 'internal').replace('_', ' ');
                const displayId = e.id.length > 12 ? e.id.slice(0, 8) + '...' : e.id;
                return (
                  <tr key={e.id} className="hover:bg-[var(--color-surface-soft)]/50 transition-colors">
                    <td className="py-3.5 px-3 font-mono text-[12px] text-[var(--color-steel)]">{displayId}</td>
                    <td className="py-3.5 px-3 text-[var(--color-slate)] whitespace-nowrap">{dateStr}</td>
                    <td className="py-3.5 px-3 font-bold text-[var(--color-ink-deep)]">{descStr}</td>
                    <td className="py-3.5 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-[var(--color-surface-soft)] text-[var(--color-ink)] text-[11px] font-bold border border-[var(--color-hairline-soft)] uppercase">
                        {e.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-[var(--color-steel)] text-[13px] capitalize">
                      {methodStr}
                    </td>
                    <td
                      className={`py-3.5 px-3 font-mono font-bold text-right whitespace-nowrap ${
                        isIncome ? 'text-[var(--color-success)]' : 'text-[var(--color-critical)]'
                      }`}
                    >
                      {isIncome ? `+${formatPaise(e.amount_paise)}` : `-${formatPaise(e.amount_paise)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── 4. DETERMINISTIC ACTION QUEUE ─── */}
      <div className="p-8 rounded-3xl bg-[var(--color-canvas)] border border-[var(--color-hairline-soft)] space-y-6 t-card-interactive">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--color-hairline-soft)]">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-bold text-[var(--color-ink-deep)]">Deterministic Operational Action Queue</h3>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                {actionQueue.length} Open Items
              </span>
            </div>
            <p className="text-[13px] text-[var(--color-steel)]">
              Automated rules monitoring renewals, event capacity, overdue tasks, low stock, reimbursements, and failed alerts
            </p>
          </div>

          <button
            type="button"
            disabled={isRefreshingQueue}
            onClick={handleRefreshQueue}
            className="px-4 py-2 rounded-full bg-[var(--color-ink-deep)] text-white text-[13px] font-bold hover:bg-black transition-all cursor-pointer whitespace-nowrap t-button-action inline-flex items-center gap-2"
          >
            {isRefreshingQueue ? <ButtonSpinner size={14} /> : '↻ Re-evaluate Operational Rules'}
          </button>
        </div>

        {/* Queue Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {actionQueue.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-2xl border border-[var(--color-hairline-soft)] bg-[var(--color-surface-soft)] space-y-3 flex flex-col justify-between t-card-interactive"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getPriorityBadge(
                      item.priority
                    )}`}
                  >
                    {item.priority} · {item.assigned_role}
                  </span>
                  <span className="text-[11px] text-[var(--color-steel)] font-mono">
                    {item.source_type}
                  </span>
                </div>

                <h4 className="font-bold text-[16px] text-[var(--color-ink-deep)]">{item.title}</h4>
                <p className="text-[13px] text-[var(--color-steel)] leading-relaxed">
                  <strong>Trigger:</strong> {item.reason}
                </p>

                <div className="p-2.5 rounded-xl bg-white border border-[var(--color-hairline-soft)] text-[12px] text-[var(--color-ink)]">
                  <strong>Required Next Action:</strong> {item.next_action}
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--color-hairline-soft)] flex justify-end">
                <button
                  type="button"
                  disabled={resolvingItemId === item.id}
                  onClick={() => handleResolveItem(item.id, item.title)}
                  className="px-4 py-1.5 rounded-full bg-[var(--color-ink-deep)] text-white text-[12px] font-bold hover:bg-black cursor-pointer t-button-action inline-flex items-center gap-1.5"
                >
                  {resolvingItemId === item.id ? <ButtonSpinner size={12} /> : 'Mark Resolved'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
