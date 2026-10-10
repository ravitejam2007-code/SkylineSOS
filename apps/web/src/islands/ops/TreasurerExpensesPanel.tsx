import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { formatPaise } from "@/lib/money";

interface ExpenseItem {
  id: string;
  submitterId: string;
  submitterName: string;
  title: string;
  category: string;
  amountPaise: number;
  status: "pending" | "approved" | "rejected" | "paid";
  notes?: string;
  createdAt: string;
  rejectionReason?: string;
}

export function TreasurerExpensesPanel() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadExpenses = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<ExpenseItem[]>("/expenses");
      setExpenses(data || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load expense reimbursements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: "approved" | "rejected" | "paid") => {
    let reason: string | undefined = undefined;
    if (newStatus === "rejected") {
      const r = prompt("Provide reason for rejection:");
      if (!r) return;
      reason = r;
    }

    setActionLoading(id);
    try {
      await api(`/expenses/${id}/status`, {
        method: "POST",
        json: { status: newStatus, rejectionReason: reason }
      });
      await loadExpenses();
    } catch (err: any) {
      alert(err?.message || "Status update failed (self-approval prohibited)");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-surface-soft border border-hairline">
        <div>
          <h2 className="text-xl font-black text-ink-deep">Expense Reimbursement Queue</h2>
          <p className="text-xs text-steel mt-0.5">
            Review student out-of-pocket receipts and approve bank reimbursement payouts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/treasurer"
            className="px-4 py-2 rounded-full border border-hairline bg-white hover:bg-hairline text-xs font-bold text-ink-deep shadow-xs"
          >
            ← View Club Ledger
          </a>
          <button
            type="button"
            onClick={loadExpenses}
            className="p-2 rounded-full bg-white border border-hairline hover:bg-surface-soft text-charcoal text-xs font-bold shadow-xs transition-colors"
            title="Refresh"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="p-12 text-center rounded-3xl bg-white border border-hairline">
          <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-xs font-bold text-steel">Loading reimbursement claims...</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="p-6 text-center rounded-3xl bg-critical/5 border border-critical/20 text-xs text-critical font-bold">
          ⚠️ {error}
        </div>
      )}

      {/* Claims List */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {expenses.length === 0 ? (
            <div className="col-span-2 p-12 text-center rounded-3xl bg-white border border-hairline">
              <span className="text-3xl block mb-2">💰</span>
              <p className="text-sm font-bold text-ink-deep">No pending expense claims</p>
            </div>
          ) : (
            expenses.map((e) => (
              <div
                key={e.id}
                className="p-6 rounded-3xl bg-white border border-hairline shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-surface-soft border border-hairline text-steel">
                      {e.category}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        e.status === "paid"
                          ? "bg-success text-white"
                          : e.status === "approved"
                          ? "bg-success/10 text-success"
                          : e.status === "rejected"
                          ? "bg-critical/10 text-critical"
                          : "bg-warning/20 text-ink-deep"
                      }`}
                    >
                      {e.status}
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-ink-deep">{e.title}</h3>
                  <div className="my-2 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-critical">
                      -{formatPaise(e.amountPaise)}
                    </span>
                    <span className="text-xs text-steel">Claimant: {e.submitterName}</span>
                  </div>

                  {e.notes && (
                    <p className="text-xs text-steel mt-2 bg-surface-soft p-2.5 rounded-xl border border-hairline-soft">
                      {e.notes}
                    </p>
                  )}

                  {e.rejectionReason && (
                    <p className="text-xs text-critical mt-2 bg-critical/5 p-2.5 rounded-xl border border-critical/20">
                      Rejected: {e.rejectionReason}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-hairline flex items-center justify-end gap-2 text-xs">
                  {e.status === "pending" && (
                    <>
                      <button
                        type="button"
                        disabled={actionLoading === e.id}
                        onClick={() => handleUpdateStatus(e.id, "rejected")}
                        className="px-4 py-1.5 rounded-full border border-hairline hover:border-critical text-critical font-bold"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading === e.id}
                        onClick={() => handleUpdateStatus(e.id, "approved")}
                        className="px-5 py-1.5 rounded-full bg-primary hover:bg-primary-deep text-white font-bold shadow-xs"
                      >
                        Approve Claim
                      </button>
                    </>
                  )}
                  {e.status === "approved" && (
                    <button
                      type="button"
                      disabled={actionLoading === e.id}
                      onClick={() => handleUpdateStatus(e.id, "paid")}
                      className="px-5 py-1.5 rounded-full bg-success hover:bg-success/90 text-white font-bold shadow-xs"
                    >
                      Mark Reimbursement Paid ✓
                    </button>
                  )}
                  {e.status === "paid" && (
                    <span className="text-success text-xs font-bold">✓ Settled in Ledger</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
