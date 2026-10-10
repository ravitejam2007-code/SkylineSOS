import React, { useState, useEffect } from "react";
import { api, ApiError } from "@/lib/api";

interface Application {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  studentId: string;
  major: string;
  gradYear: number;
  tierId: string;
  tierName: string;
  duesPaise: number;
  status: "pending" | "approved" | "rejected";
  appliedAt: string;
  rejectionReason?: string;
}

export function AdminApplicationsPanel() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [rejectionModalId, setRejectionModalId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const loadApplications = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<Application[]>("/admin/membership/applications");
      setApplications(data || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load membership applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const handleReview = async (id: string, decision: "approve" | "reject", reason?: string) => {
    setActionLoading(id);
    try {
      await api(`/admin/membership/applications/${id}/review`, {
        method: "POST",
        json: {
          decision,
          rejectionReason: decision === "reject" ? reason : undefined
        }
      });
      setRejectionModalId(null);
      setRejectionReason("");
      await loadApplications();
    } catch (err: any) {
      alert(err?.message || "Review action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = filter === "pending"
    ? applications.filter((a) => a.status === "pending")
    : applications;

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-surface-soft border border-hairline">
        <div>
          <h2 className="text-xl font-black text-ink-deep">Membership Review Queue</h2>
          <p className="text-xs text-steel mt-0.5">
            Review student applications for Skyline Student Association tiers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="p-1 bg-white rounded-full border border-hairline flex">
            <button
              type="button"
              onClick={() => setFilter("pending")}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                filter === "pending"
                  ? "bg-ink-deep text-white shadow-xs"
                  : "text-steel hover:text-ink"
              }`}
            >
              Pending ({applications.filter((a) => a.status === "pending").length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                filter === "all"
                  ? "bg-ink-deep text-white shadow-xs"
                  : "text-steel hover:text-ink"
              }`}
            >
              All Records ({applications.length})
            </button>
          </div>
          <button
            type="button"
            onClick={loadApplications}
            className="p-2 rounded-full bg-white border border-hairline hover:bg-surface-soft text-charcoal text-xs font-bold shadow-xs transition-colors"
            title="Refresh"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="p-12 text-center rounded-3xl bg-white border border-hairline">
          <div className="inline-block w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-xs font-bold text-steel">Loading applications queue...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="p-8 text-center rounded-3xl bg-critical/5 border border-critical/20">
          <p className="text-sm font-bold text-critical mb-3">⚠️ {error}</p>
          <button
            type="button"
            onClick={loadApplications}
            className="px-5 py-2 rounded-full bg-ink-deep text-white text-xs font-bold shadow-xs hover:bg-charcoal"
          >
            Retry Request
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filtered.length === 0 && (
        <div className="p-12 text-center rounded-3xl bg-white border border-hairline">
          <span className="text-4xl block mb-2">🎉</span>
          <h3 className="text-base font-bold text-ink-deep">Queue is All Caught Up</h3>
          <p className="text-xs text-steel mt-1 max-w-sm mx-auto">
            {filter === "pending"
              ? "There are no pending membership applications waiting for review."
              : "No membership application records found."}
          </p>
        </div>
      )}

      {/* Applications Cards */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((app) => (
            <div
              key={app.id}
              className="p-6 rounded-3xl bg-white border border-hairline shadow-xs flex flex-col justify-between hover:border-ink/20 transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-lg font-black text-ink-deep">{app.fullName}</h3>
                    <p className="text-xs text-steel">{app.email}</p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      app.status === "approved"
                        ? "bg-success/10 text-success border border-success/20"
                        : app.status === "rejected"
                        ? "bg-critical/10 text-critical border border-critical/20"
                        : "bg-warning/20 text-ink-deep border border-warning/30"
                    }`}
                  >
                    {app.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-surface-soft border border-hairline text-xs mb-4">
                  <div>
                    <span className="text-[10px] text-steel font-bold uppercase block">Student ID</span>
                    <span className="font-mono font-bold text-ink-deep">{app.studentId || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-steel font-bold uppercase block">Tier</span>
                    <span className="font-bold text-primary">{app.tierName || "Active"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-steel font-bold uppercase block">Major</span>
                    <span className="text-charcoal">{app.major || "Computer Science"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-steel font-bold uppercase block">Class</span>
                    <span className="text-charcoal">{app.gradYear || "2027"}</span>
                  </div>
                </div>

                {app.rejectionReason && (
                  <div className="p-3 rounded-xl bg-critical/5 border border-critical/20 text-xs text-critical mb-4">
                    <span className="font-bold block text-[10px] uppercase">Rejection Reason:</span>
                    {app.rejectionReason}
                  </div>
                )}
              </div>

              {app.status === "pending" && (
                <div className="pt-4 border-t border-hairline flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={actionLoading === app.id}
                    onClick={() => {
                      setRejectionModalId(app.id);
                      setRejectionReason("");
                    }}
                    className="px-4 py-2 rounded-full border border-hairline hover:border-critical text-critical text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading === app.id}
                    onClick={() => handleReview(app.id, "approve")}
                    className="px-6 py-2 rounded-full bg-primary hover:bg-primary-deep text-white text-xs font-bold transition-all shadow-xs hover:scale-[1.02] disabled:opacity-50"
                  >
                    {actionLoading === app.id ? "Processing..." : "Approve Member"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectionModalId && (
        <div className="fixed inset-0 z-50 bg-ink-deep/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-3xl bg-white border border-hairline shadow-2xl text-left">
            <h3 className="text-lg font-black text-ink-deep">Reject Application</h3>
            <p className="text-xs text-steel mt-1">
              Provide a clear reason so the student can edit and resubmit their application.
            </p>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Please provide a valid institutional ID card number or current semester verification."
              rows={3}
              className="w-full mt-4 p-3 rounded-xl border border-hairline text-xs text-ink-deep focus:outline-none focus:border-critical"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectionModalId(null)}
                className="px-4 py-2 rounded-full border border-hairline text-xs font-bold text-charcoal hover:bg-surface-soft"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectionReason.trim() || actionLoading === rejectionModalId}
                onClick={() => handleReview(rejectionModalId, "reject", rejectionReason)}
                className="px-5 py-2 rounded-full bg-critical hover:bg-critical-strong text-white text-xs font-bold shadow-xs disabled:opacity-50"
              >
                {actionLoading === rejectionModalId ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
