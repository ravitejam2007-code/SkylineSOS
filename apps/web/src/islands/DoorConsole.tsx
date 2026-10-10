import React, { useState, useEffect } from "react";
import { api, ApiError } from "../lib/api.ts";
import { formatPaise } from "../lib/money.ts";

interface VerifyResult {
  type: "member" | "ticket";
  success: boolean;
  title: string;
  subtitle: string;
  details?: Record<string, any>;
  error?: string;
  timestamp: string;
}

export function DoorConsole() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [activeTab, setActiveTab] = useState<"code" | "lookup">("code");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Auto-format ticket code formatting
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.toUpperCase();
    setCode(val);
  };

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean) return;

    setLoading(true);
    setResult(null);

    // Auto-detect mode: 6 digits = Member code, otherwise Ticket code
    const isMemberCode = /^\d{6}$/.test(clean);

    try {
      if (isMemberCode) {
        const data = await api<{
          name: string;
          tier: string;
          status: string;
          expiresOn: string;
          discountPercent: number;
        }>("/staff/verify/member", {
          method: "POST",
          json: { code: clean }
        });

        setResult({
          type: "member",
          success: true,
          title: data.name,
          subtitle: `${data.tier} Member (${data.discountPercent}% Discount)`,
          details: { "Valid Until": data.expiresOn, Status: data.status },
          timestamp: new Date().toLocaleTimeString()
        });
        setCode("");
      } else {
        const data = await api<{
          ticketId: string;
          holderName: string;
          ticketType: string;
          eventTitle: string;
          checkedInAt: string;
        }>("/door/check-in", {
          method: "POST",
          json: { code: clean }
        });

        setResult({
          type: "ticket",
          success: true,
          title: data.holderName,
          subtitle: `${data.eventTitle} — ${data.ticketType}`,
          details: { "Checked In": new Date(data.checkedInAt).toLocaleTimeString() },
          timestamp: new Date().toLocaleTimeString()
        });
        setCode("");
      }
    } catch (err: any) {
      const apiErr = err instanceof ApiError ? err : null;
      let errorMsg = apiErr?.message || err.message || "Verification failed";

      setResult({
        type: isMemberCode ? "member" : "ticket",
        success: false,
        title: "Verification Failed",
        subtitle: errorMsg,
        error: apiErr?.code || "INVALID",
        timestamp: new Date().toLocaleTimeString()
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const data = await api<any[]>(`/door/tickets?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchResults(data || []);
    } catch (err: any) {
      console.error("Search failed:", err);
    } finally {
      setSearchLoading(false);
    }
  };

  const checkInSpecificTicket = async (ticketCode: string) => {
    setCode(ticketCode);
    setActiveTab("code");
    // Trigger verification directly
    setTimeout(() => {
      const btn = document.getElementById("verify-btn");
      if (btn) btn.click();
    }, 100);
  };

  return (
    <div className="max-w-xl mx-auto bg-white rounded-3xl border border-hairline shadow-sm overflow-hidden">
      {/* Mode Switcher */}
      <div className="flex border-b border-hairline bg-surface-soft p-1.5 m-3 rounded-full">
        <button
          onClick={() => setActiveTab("code")}
          className={`flex-1 py-2 text-sm font-bold rounded-full transition-all ${
            activeTab === "code"
              ? "bg-white text-ink shadow-sm"
              : "text-steel hover:text-ink"
          }`}
        >
          Code Scanner (6-digit / SKY-...)
        </button>
        <button
          onClick={() => setActiveTab("lookup")}
          className={`flex-1 py-2 text-sm font-bold rounded-full transition-all ${
            activeTab === "lookup"
              ? "bg-white text-ink shadow-sm"
              : "text-steel hover:text-ink"
          }`}
        >
          Manual Lookup
        </button>
      </div>

      <div className="p-6">
        {activeTab === "code" ? (
          <div>
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-2">
                  Enter Code
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={code}
                    onChange={handleInputChange}
                    placeholder="e.g. 583920 or SKY-XXXX-XXXX"
                    autoFocus
                    className="w-full h-14 text-center text-2xl font-mono font-bold tracking-widest rounded-2xl border-2 border-hairline focus:border-focus focus:outline-none uppercase"
                  />
                </div>
                <p className="text-xs text-steel mt-2 text-center">
                  6 numeric digits = Member Identity · 8 Crockford chars = Event Ticket
                </p>
              </div>

              <button
                id="verify-btn"
                type="submit"
                disabled={loading || !code.trim()}
                className="w-full h-13 rounded-full bg-ink-deep hover:bg-charcoal text-white font-bold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "Verify & Check In"
                )}
              </button>
            </form>

            {/* Verification Result Card */}
            {result && (
              <div
                className={`mt-6 p-6 rounded-2xl border-2 transition-all ${
                  result.success
                    ? "bg-green-50 border-success/40 text-green-950"
                    : "bg-red-50 border-critical/40 text-red-950"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-black shrink-0 ${
                      result.success
                        ? "bg-success text-white"
                        : "bg-critical text-white"
                    }`}
                  >
                    {result.success ? "✓" : "✕"}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider opacity-75">
                        {result.type === "member" ? "Member Identity" : "Event Ticket"}
                      </span>
                      <span className="text-xs opacity-60 font-mono">{result.timestamp}</span>
                    </div>
                    <h3 className="text-xl font-bold mt-0.5">{result.title}</h3>
                    <p className="text-sm opacity-85 mt-0.5">{result.subtitle}</p>

                    {result.details && (
                      <div className="mt-3 pt-3 border-t border-black/10 flex flex-wrap gap-4 text-xs font-medium">
                        {Object.entries(result.details).map(([k, v]) => (
                          <div key={k}>
                            <span className="opacity-60">{k}:</span>{" "}
                            <span className="font-bold">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <form onSubmit={handleSearch} className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search attendee by name..."
                className="flex-1 h-11 px-4 rounded-full border border-hairline focus:border-focus focus:outline-none text-sm"
              />
              <button
                type="submit"
                disabled={searchLoading}
                className="px-6 h-11 rounded-full bg-ink-deep text-white text-sm font-bold hover:bg-charcoal transition-colors"
              >
                {searchLoading ? "..." : "Search"}
              </button>
            </form>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {searchResults.length === 0 ? (
                <div className="text-center py-8 text-sm text-steel">
                  Search by holder name to inspect tickets or check in manually.
                </div>
              ) : (
                searchResults.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl border border-hairline flex items-center justify-between hover:bg-surface-soft transition-colors"
                  >
                    <div>
                      <div className="font-bold text-sm text-ink">{t.holder_name}</div>
                      <div className="text-xs text-steel font-mono">
                        {t.code} · {t.ticket_types?.name}
                      </div>
                    </div>
                    {t.status === "issued" ? (
                      <button
                        onClick={() => checkInSpecificTicket(t.code)}
                        className="px-3 py-1.5 rounded-full bg-success text-white text-xs font-bold hover:opacity-90 transition-opacity"
                      >
                        Check In
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-steel bg-surface-soft px-3 py-1 rounded-full">
                        {t.status}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
