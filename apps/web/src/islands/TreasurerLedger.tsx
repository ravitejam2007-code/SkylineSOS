import React, { useState, useEffect } from "react";
import { api } from "../lib/api.ts";
import { formatPaise } from "../lib/money.ts";

export function TreasurerLedger() {
  const [overview, setOverview] = useState<any>(null);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<string>("all");

  const loadData = async () => {
    try {
      setLoading(true);
      const [ov, entries] = await Promise.all([
        api<any>("/treasurer/overview"),
        api<any[]>("/treasurer/ledger?limit=50")
      ]);
      setOverview(ov);
      setLedgerEntries(entries || []);
    } catch (err) {
      console.error("Failed to load treasurer data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = filterCat === "all"
    ? ledgerEntries
    : ledgerEntries.filter((e) => e.category === filterCat);

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-steel flex justify-center items-center gap-2">
        <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Loading immutable club ledger...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Overview Stat Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-3xl bg-white border border-hairline shadow-xs">
          <div className="text-xs uppercase font-bold tracking-wider text-steel mb-1">
            Recorded Net Movement
          </div>
          <div
            className={`text-3xl font-black ${
              (overview?.netPaise || 0) >= 0 ? "text-success" : "text-critical"
            }`}
          >
            {formatPaise(overview?.netPaise || 0)}
          </div>
          <div className="text-xs text-steel mt-1 font-medium">Traceable to source ledger rows</div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-hairline shadow-xs">
          <div className="text-xs uppercase font-bold tracking-wider text-steel mb-1">
            Total Inflow (Income)
          </div>
          <div className="text-3xl font-black text-ink-deep">
            {formatPaise(overview?.inPaise || 0)}
          </div>
          <div className="text-xs text-steel mt-1 font-medium">Dues, tickets, merch & fundraisers</div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-hairline shadow-xs">
          <div className="text-xs uppercase font-bold tracking-wider text-steel mb-1">
            Total Outflow (Paid Expenses)
          </div>
          <div className="text-3xl font-black text-ink-deep">
            {formatPaise(overview?.outPaise || 0)}
          </div>
          <div className="text-xs text-steel mt-1 font-medium">Approved and disbursed</div>
        </div>
      </div>

      {/* Ledger Table Section */}
      <div className="bg-white rounded-3xl border border-hairline shadow-xs overflow-hidden">
        <div className="p-6 border-b border-hairline flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-ink-deep">Source-Linked Ledger</h2>
            <p className="text-xs text-steel mt-0.5">
              Append-only financial records protected by database triggers.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-1.5 bg-surface-soft p-1 rounded-full border border-hairline-soft">
            {["all", "dues", "tickets", "merch", "fundraiser", "expense"].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={`px-3 py-1 text-xs font-bold rounded-full capitalize transition-all ${
                  filterCat === cat
                    ? "bg-white text-ink shadow-xs"
                    : "text-steel hover:text-ink"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-soft text-xs uppercase tracking-wider font-bold text-steel border-b border-hairline">
              <tr>
                <th className="px-6 py-3.5">Effective Date</th>
                <th className="px-6 py-3.5">Category</th>
                <th className="px-6 py-3.5">Memo / Description</th>
                <th className="px-6 py-3.5">Method</th>
                <th className="px-6 py-3.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-steel">
                    No ledger transactions match this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((entry) => (
                  <tr key={entry.id} className="hover:bg-surface-soft/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-charcoal">
                      {entry.effective_on}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-surface-soft border border-hairline text-charcoal">
                        {entry.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-ink">
                      {entry.memo || `Source: ${entry.source_type}`}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-steel uppercase">
                      {entry.method}
                    </td>
                    <td
                      className={`px-6 py-4 text-right font-bold ${
                        entry.direction === "in" ? "text-success" : "text-critical"
                      }`}
                    >
                      {entry.direction === "in" ? "+" : "-"}
                      {formatPaise(entry.amount_paise)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
