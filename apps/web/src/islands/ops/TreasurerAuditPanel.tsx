import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface AuditEntry {
  id: string;
  actorId?: string;
  actorEmail?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

export function TreasurerAuditPanel() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterEntity, setFilterEntity] = useState<string>("all");

  const loadAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<AuditEntry[]>("/audit");
      setLogs(data || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudit();
  }, []);

  const filtered = filterEntity === "all"
    ? logs
    : logs.filter((l) => l.entity === filterEntity || l.action.includes(filterEntity));

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-surface-soft border border-hairline">
        <div>
          <h2 className="text-xl font-black text-ink-deep">System Security & Audit Trail</h2>
          <p className="text-xs text-steel mt-0.5">
            Cryptographic log of all sensitive actions: role changes, payment receipts, door check-ins, and refunds.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
            className="px-3 py-2 rounded-full border border-hairline bg-white text-xs font-bold text-ink-deep focus:outline-none focus:border-primary shadow-xs"
          >
            <option value="all">All Events ({logs.length})</option>
            <option value="checkout">Checkouts & Payments</option>
            <option value="check_in">Door Gate Check-ins</option>
            <option value="role">Role & Permission Grants</option>
            <option value="expense">Expenses & Payouts</option>
          </select>
          <button
            type="button"
            onClick={loadAudit}
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
          <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-xs font-bold text-steel">Loading audit trail...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="p-6 text-center rounded-3xl bg-critical/5 border border-critical/20 text-xs text-critical font-bold">
          ⚠️ {error}
        </div>
      )}

      {/* Audit Table */}
      {!loading && !error && (
        <div className="rounded-3xl bg-white border border-hairline shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-soft text-[10px] uppercase font-bold text-steel border-b border-hairline tracking-wider">
                <tr>
                  <th className="py-3.5 px-6">Timestamp</th>
                  <th className="py-3.5 px-4">Action Event</th>
                  <th className="py-3.5 px-4">Entity</th>
                  <th className="py-3.5 px-4">Actor</th>
                  <th className="py-3.5 px-6">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-steel">
                      No matching audit records found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((log) => (
                    <tr key={log.id} className="hover:bg-surface-soft/40 transition-colors">
                      <td className="py-3.5 px-6 font-mono text-[11px] text-steel">
                        {new Date(log.createdAt).toLocaleString("en-IN", {
                          dateStyle: "short",
                          timeStyle: "medium"
                        })}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-ink-deep text-white">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-ink-deep">
                        {log.entity}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-charcoal">
                        {log.actorEmail || log.actorId?.slice(0, 8) || "System"}
                      </td>
                      <td className="py-3.5 px-6">
                        <code className="text-[11px] font-mono text-steel block max-w-xs truncate">
                          {JSON.stringify(log.details || {})}
                        </code>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
