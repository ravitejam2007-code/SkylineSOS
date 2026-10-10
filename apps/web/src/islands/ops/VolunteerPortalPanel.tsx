import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface TaskItem {
  id: string;
  fundraiserId: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  fundraiserTitle?: string;
}

export function VolunteerPortalPanel() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expense Submission State
  const [showExpense, setShowExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    title: "",
    amountRupees: 250,
    category: "materials",
    notes: ""
  });
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);
  const [expenseSuccess, setExpenseSuccess] = useState<string | null>(null);

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<TaskItem[]>("/tasks");
      setTasks(data || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load assigned tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleStatusChange = async (taskId: string, newStatus: "todo" | "in_progress" | "done") => {
    try {
      await api(`/tasks/${taskId}`, {
        method: "PATCH",
        json: { status: newStatus }
      });
      await loadTasks();
    } catch (err: any) {
      alert(err?.message || "Status update failed");
    }
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseSubmitting(true);
    setExpenseSuccess(null);
    try {
      await api("/expenses", {
        method: "POST",
        json: {
          title: expenseForm.title,
          amountPaise: expenseForm.amountRupees * 100,
          category: expenseForm.category,
          notes: expenseForm.notes
        }
      });
      setExpenseSuccess("Expense claim submitted to Treasurer for review!");
      setExpenseForm({ title: "", amountRupees: 250, category: "materials", notes: "" });
    } catch (err: any) {
      alert(err?.message || "Failed to submit expense claim");
    } finally {
      setExpenseSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-surface-soft border border-hairline">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider mb-1">
            Volunteer Duty
          </div>
          <h2 className="text-xl font-black text-ink-deep">Assigned Tasks & Out-of-Pocket Claims</h2>
          <p className="text-xs text-steel mt-0.5">
            Update your task progress and submit receipts for event materials or refreshment reimbursements.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowExpense(true);
            setExpenseSuccess(null);
          }}
          className="px-5 py-2.5 rounded-full bg-ink-deep hover:bg-charcoal text-white font-bold text-xs shadow-xs transition-all hover:scale-[1.02]"
        >
          + Submit Expense Claim
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="p-12 text-center rounded-3xl bg-white border border-hairline">
          <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-xs font-bold text-steel">Loading your task queue...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="p-6 text-center rounded-3xl bg-critical/5 border border-critical/20 text-xs text-critical font-bold">
          ⚠️ {error}
        </div>
      )}

      {/* Task Queue Cards */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tasks.length === 0 ? (
            <div className="col-span-2 p-12 text-center rounded-3xl bg-white border border-hairline">
              <span className="text-3xl block mb-2">🎉</span>
              <p className="text-sm font-bold text-ink-deep">No assigned tasks pending</p>
            </div>
          ) : (
            tasks.map((t) => (
              <div
                key={t.id}
                className="p-6 rounded-3xl bg-white border border-hairline shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        t.priority === "high"
                          ? "bg-critical/10 text-critical"
                          : t.priority === "medium"
                          ? "bg-warning/20 text-ink-deep"
                          : "bg-surface-soft text-steel"
                      }`}
                    >
                      {t.priority} Priority
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        t.status === "done"
                          ? "bg-success/10 text-success"
                          : t.status === "in_progress"
                          ? "bg-attention/10 text-ink-deep"
                          : "bg-surface-soft text-steel"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-ink-deep">{t.title}</h3>
                  {t.fundraiserTitle && (
                    <p className="text-xs text-steel mt-0.5">Campaign: {t.fundraiserTitle}</p>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-hairline flex items-center justify-end gap-2 text-xs">
                  {t.status === "todo" && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(t.id, "in_progress")}
                      className="px-4 py-1.5 rounded-full bg-ink-deep hover:bg-charcoal text-white font-bold"
                    >
                      Start Task →
                    </button>
                  )}
                  {t.status === "in_progress" && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(t.id, "done")}
                      className="px-4 py-1.5 rounded-full bg-success hover:bg-success/90 text-white font-bold shadow-xs"
                    >
                      Mark Complete ✓
                    </button>
                  )}
                  {t.status === "done" && (
                    <span className="text-success text-xs font-bold">✓ Task Completed</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Expense Reimbursement Modal */}
      {showExpense && (
        <div className="fixed inset-0 z-50 bg-ink-deep/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-white border border-hairline shadow-2xl text-left">
            <h3 className="text-xl font-black text-ink-deep mb-1">Submit Expense Claim</h3>
            <p className="text-xs text-steel mb-4">
              Treasurer will review your claim and issue reimbursement.
            </p>

            {expenseSuccess && (
              <div className="mb-4 p-3 rounded-2xl bg-success/10 border border-success/20 text-xs text-success font-bold">
                ✓ {expenseSuccess}
              </div>
            )}

            <form onSubmit={handleExpenseSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold uppercase tracking-wider text-charcoal block mb-1">
                  Expense Description
                </label>
                <input
                  type="text"
                  required
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  placeholder="e.g. Paint & poster boards for Auditorium Stage"
                  className="w-full p-2.5 rounded-xl border border-hairline text-ink-deep font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold uppercase tracking-wider text-charcoal block mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={expenseForm.amountRupees}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amountRupees: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-hairline text-ink-deep font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold uppercase tracking-wider text-charcoal block mb-1">
                    Category
                  </label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-hairline text-ink-deep font-bold"
                  >
                    <option value="materials">Materials / Supplies</option>
                    <option value="refreshments">Refreshments</option>
                    <option value="equipment">Equipment Rental</option>
                    <option value="travel">Travel / Transport</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider text-charcoal block mb-1">
                  Receipt / Notes
                </label>
                <textarea
                  rows={2}
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  placeholder="Bill number or store receipt details"
                  className="w-full p-2.5 rounded-xl border border-hairline text-ink-deep"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowExpense(false)}
                  className="px-4 py-2 rounded-full border border-hairline font-bold"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={expenseSubmitting}
                  className="px-6 py-2 rounded-full bg-primary hover:bg-primary-deep text-white font-bold"
                >
                  {expenseSubmitting ? "Submitting..." : "Submit Claim"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
