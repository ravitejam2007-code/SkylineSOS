import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { formatPaise } from "@/lib/money";

interface Fundraiser {
  id: string;
  title: string;
  description: string;
  targetPaise: number;
  startsAt: string;
  endsAt: string;
  raisedPaise?: number;
  contributionCount?: number;
}

interface TaskItem {
  id: string;
  fundraiserId: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  assigneeName?: string;
  priority: "low" | "medium" | "high";
}

export function AdminFundraisersPanel() {
  const [fundraisers, setFundraisers] = useState<Fundraiser[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Contribution Modal
  const [showContrib, setShowContrib] = useState(false);
  const [contribForm, setContribForm] = useState({
    fundraiserId: "",
    donorName: "",
    amountRupees: 500,
    method: "cash" as "cash" | "upi",
    notes: ""
  });
  const [contribLoading, setContribLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [fData, tData] = await Promise.all([
        api<Fundraiser[]>("/fundraisers").catch(() => []),
        api<TaskItem[]>("/tasks").catch(() => [])
      ]);
      setFundraisers(fData || []);
      setTasks(tData || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load fundraisers and task board");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRecordContrib = async (e: React.FormEvent) => {
    e.preventDefault();
    setContribLoading(true);
    try {
      await api(`/fundraisers/${contribForm.fundraiserId}/contributions`, {
        method: "POST",
        json: {
          donorName: contribForm.donorName,
          amountPaise: contribForm.amountRupees * 100,
          method: contribForm.method,
          notes: contribForm.notes
        }
      });
      setShowContrib(false);
      setContribForm({
        fundraiserId: "",
        donorName: "",
        amountRupees: 500,
        method: "cash",
        notes: ""
      });
      await loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to record contribution");
    } finally {
      setContribLoading(false);
    }
  };

  const handleTaskStatus = async (taskId: string, newStatus: "todo" | "in_progress" | "done") => {
    try {
      await api(`/tasks/${taskId}`, {
        method: "PATCH",
        json: { status: newStatus }
      });
      await loadData();
    } catch (err: any) {
      alert(err?.message || "Failed to update task status");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-surface-soft border border-hairline">
        <div>
          <h2 className="text-xl font-black text-ink-deep">Club Fundraisers & Volunteer Board</h2>
          <p className="text-xs text-steel mt-0.5">
            Track campaign fundraising progress, log on-campus donations, and organize volunteer task squads.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (fundraisers.length > 0) {
              setContribForm((prev) => ({ ...prev, fundraiserId: fundraisers[0].id }));
            }
            setShowContrib(true);
          }}
          className="px-5 py-2.5 rounded-full bg-ink-deep hover:bg-charcoal text-white font-bold text-xs shadow-xs transition-all hover:scale-[1.02]"
        >
          + Record Donation Receipt
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="p-12 text-center rounded-3xl bg-white border border-hairline">
          <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-xs font-bold text-steel">Loading campaign boards...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="p-6 text-center rounded-3xl bg-critical/5 border border-critical/20 text-xs text-critical font-bold">
          ⚠️ {error}
        </div>
      )}

      {/* Fundraisers List */}
      {!loading && !error && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {fundraisers.map((f) => {
              const raised = f.raisedPaise || 0;
              const target = f.targetPaise || 1;
              const percent = Math.min(100, Math.round((raised / target) * 100));

              return (
                <div
                  key={f.id}
                  className="p-6 rounded-3xl bg-white border border-hairline shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider">
                        Active Campaign
                      </span>
                      <span className="text-xs font-bold text-charcoal">
                        Goal: {formatPaise(f.targetPaise)}
                      </span>
                    </div>

                    <h3 className="text-xl font-black text-ink-deep">{f.title}</h3>
                    <p className="text-xs text-steel mt-1 leading-relaxed">{f.description}</p>

                    {/* Progress Bar */}
                    <div className="mt-5 space-y-1.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-success">{formatPaise(raised)} Raised</span>
                        <span className="text-steel font-mono">{percent}%</span>
                      </div>
                      <div className="w-full h-3 rounded-full bg-surface-soft overflow-hidden border border-hairline-soft">
                        <div
                          className="h-full bg-success transition-all duration-500 rounded-full"
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-hairline flex items-center justify-between text-xs">
                    <span className="text-steel font-medium">
                      {f.contributionCount || 0} Backers
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setContribForm((prev) => ({ ...prev, fundraiserId: f.id }));
                        setShowContrib(true);
                      }}
                      className="px-4 py-2 rounded-full bg-primary hover:bg-primary-deep text-white font-bold transition-all shadow-xs"
                    >
                      Log Contribution →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Volunteer Tasks Kanban Grid */}
          <div className="p-6 rounded-3xl bg-surface-soft border border-hairline">
            <h3 className="text-lg font-black text-ink-deep mb-4">Volunteer Task Kanban</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* To Do Column */}
              <div className="p-4 rounded-2xl bg-white border border-hairline shadow-2xs">
                <span className="text-xs font-bold uppercase tracking-wider text-steel block mb-3">
                  📋 To Do ({tasks.filter((t) => t.status === "todo").length})
                </span>
                <div className="space-y-2.5">
                  {tasks.filter((t) => t.status === "todo").map((t) => (
                    <div key={t.id} className="p-3 rounded-xl bg-surface-soft border border-hairline text-xs">
                      <p className="font-bold text-ink-deep">{t.title}</p>
                      <div className="mt-2 flex justify-between items-center">
                        <span className="text-[10px] text-steel">{t.assigneeName || "Unassigned"}</span>
                        <button
                          type="button"
                          onClick={() => handleTaskStatus(t.id, "in_progress")}
                          className="px-2 py-0.5 rounded-full bg-white border border-hairline text-[10px] font-bold text-charcoal hover:bg-hairline"
                        >
                          Start →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* In Progress Column */}
              <div className="p-4 rounded-2xl bg-white border border-hairline shadow-2xs">
                <span className="text-xs font-bold uppercase tracking-wider text-attention block mb-3">
                  ⚡ In Progress ({tasks.filter((t) => t.status === "in_progress").length})
                </span>
                <div className="space-y-2.5">
                  {tasks.filter((t) => t.status === "in_progress").map((t) => (
                    <div key={t.id} className="p-3 rounded-xl bg-attention/5 border border-attention/20 text-xs">
                      <p className="font-bold text-ink-deep">{t.title}</p>
                      <div className="mt-2 flex justify-between items-center">
                        <span className="text-[10px] text-steel">{t.assigneeName || "Squad"}</span>
                        <button
                          type="button"
                          onClick={() => handleTaskStatus(t.id, "done")}
                          className="px-2 py-0.5 rounded-full bg-success text-white text-[10px] font-bold shadow-xs hover:bg-success/90"
                        >
                          Complete ✓
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Done Column */}
              <div className="p-4 rounded-2xl bg-white border border-hairline shadow-2xs">
                <span className="text-xs font-bold uppercase tracking-wider text-success block mb-3">
                  ✓ Completed ({tasks.filter((t) => t.status === "done").length})
                </span>
                <div className="space-y-2.5">
                  {tasks.filter((t) => t.status === "done").map((t) => (
                    <div key={t.id} className="p-3 rounded-xl bg-success/5 border border-success/20 text-xs opacity-75">
                      <p className="font-bold text-ink-deep line-through">{t.title}</p>
                      <span className="text-[10px] text-success font-bold mt-1 block">Verified Done</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Contribution Modal */}
      {showContrib && (
        <div className="fixed inset-0 z-50 bg-ink-deep/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-white border border-hairline shadow-2xl text-left">
            <h3 className="text-xl font-black text-ink-deep mb-2">Record Contribution</h3>
            <p className="text-xs text-steel mb-4">
              Log on-campus cash or UPI donations directly to the campaign fund.
            </p>

            <form onSubmit={handleRecordContrib} className="space-y-3 text-xs">
              <div>
                <label className="font-bold uppercase tracking-wider text-charcoal block mb-1">
                  Campaign
                </label>
                <select
                  value={contribForm.fundraiserId}
                  onChange={(e) => setContribForm({ ...contribForm, fundraiserId: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-hairline font-bold text-ink-deep"
                >
                  {fundraisers.map((f) => (
                    <option key={f.id} value={f.id}>{f.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider text-charcoal block mb-1">
                  Donor Name
                </label>
                <input
                  type="text"
                  required
                  value={contribForm.donorName}
                  onChange={(e) => setContribForm({ ...contribForm, donorName: e.target.value })}
                  placeholder="e.g. Alum Ananya Ray"
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
                    min={10}
                    value={contribForm.amountRupees}
                    onChange={(e) => setContribForm({ ...contribForm, amountRupees: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-hairline text-ink-deep font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold uppercase tracking-wider text-charcoal block mb-1">
                    Method
                  </label>
                  <select
                    value={contribForm.method}
                    onChange={(e) => setContribForm({ ...contribForm, method: e.target.value as any })}
                    className="w-full p-2.5 rounded-xl border border-hairline text-ink-deep font-bold"
                  >
                    <option value="cash">Cash (Counter)</option>
                    <option value="upi">Direct UPI</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider text-charcoal block mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={contribForm.notes}
                  onChange={(e) => setContribForm({ ...contribForm, notes: e.target.value })}
                  placeholder="Receipt note or batch reference"
                  className="w-full p-2.5 rounded-xl border border-hairline text-ink-deep"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowContrib(false)}
                  className="px-4 py-2 rounded-full border border-hairline font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={contribLoading}
                  className="px-6 py-2 rounded-full bg-primary hover:bg-primary-deep text-white font-bold"
                >
                  {contribLoading ? "Recording..." : "Record Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
