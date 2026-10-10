import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface ActionItem {
  id: string;
  type: "application" | "expense" | "task" | "stock";
  title: string;
  subtitle: string;
  urgency: "low" | "medium" | "high";
  link: string;
  createdAt: string;
}

export function AdminActionQueuePanel() {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadActions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<ActionItem[]>("/actions");
      setActions(data || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load action queue items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActions();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-surface-soft border border-hairline">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-attention/15 text-charcoal text-[10px] font-bold uppercase tracking-wider mb-1">
            Real-time Resolution
          </div>
          <h2 className="text-xl font-black text-ink-deep">Executive Action Queue</h2>
          <p className="text-xs text-steel mt-0.5">
            Dynamic triage list computed on read — zero stale database rows or missed student requests.
          </p>
        </div>
        <button
          type="button"
          onClick={loadActions}
          className="p-2.5 rounded-full bg-white border border-hairline hover:bg-surface-soft text-charcoal text-xs font-bold shadow-xs transition-colors"
          title="Refresh"
        >
          🔄 Refresh Queue
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="p-12 text-center rounded-3xl bg-white border border-hairline">
          <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-xs font-bold text-steel">Computing action queue items...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="p-6 text-center rounded-3xl bg-critical/5 border border-critical/20 text-xs text-critical font-bold">
          ⚠️ {error}
        </div>
      )}

      {/* Queue Items */}
      {!loading && !error && (
        <div className="space-y-3">
          {actions.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white border border-hairline">
              <span className="text-3xl block mb-2">🎯</span>
              <h3 className="text-base font-bold text-ink-deep">Inbox Zero</h3>
              <p className="text-xs text-steel mt-1 max-w-sm mx-auto">
                No pending applications, unapproved expenses, or urgent volunteer tasks need attention right now.
              </p>
            </div>
          ) : (
            actions.map((act) => (
              <div
                key={act.id}
                className="p-5 rounded-2xl bg-white border border-hairline shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-ink/20 transition-all"
              >
                <div className="flex items-start gap-3.5">
                  <span className="text-2xl p-2 bg-surface-soft rounded-xl border border-hairline shrink-0">
                    {act.type === "application" ? "🪪" : act.type === "expense" ? "💰" : "📋"}
                  </span>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          act.urgency === "high"
                            ? "bg-critical/10 text-critical"
                            : act.urgency === "medium"
                            ? "bg-warning/20 text-ink-deep"
                            : "bg-surface-soft text-steel"
                        }`}
                      >
                        {act.urgency} Urgency
                      </span>
                      <span className="text-[10px] uppercase font-bold text-steel">
                        {act.type}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-ink-deep">{act.title}</h4>
                    <p className="text-xs text-steel mt-0.5">{act.subtitle}</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 shrink-0">
                  <a
                    href={act.link || "/admin"}
                    className="px-5 py-2 rounded-full bg-ink-deep hover:bg-charcoal text-white font-bold text-xs transition-all shadow-xs"
                  >
                    Resolve →
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
