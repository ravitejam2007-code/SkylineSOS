import React, { useState, useEffect } from "react";

export function LandingHeroDemo() {
  const [activeTab, setActiveTab] = useState<"door" | "card" | "ledger">("door");
  const [testCode, setTestCode] = useState("SKY-GALA-0042");
  const [checkResult, setCheckResult] = useState<{
    status: "idle" | "success" | "denied";
    title?: string;
    detail?: string;
    time?: string;
  }>({
    status: "success",
    title: "Ticket Verified: Aditi Sharma",
    detail: "VIP Front Row · Gala 2026 · Admitted to Auditorium Zone A",
    time: "21:40:12"
  });

  // Countdown timer for member pass demo
  const [countdown, setCountdown] = useState(42);
  const [memberCode, setMemberCode] = useState("839 204");

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // generate random 6-digit code
          const newCode = Math.floor(100000 + Math.random() * 900000).toString();
          setMemberCode(`${newCode.slice(0, 3)} ${newCode.slice(3)}`);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleTestVerify = (codeToTest: string) => {
    setTestCode(codeToTest);
    const clean = codeToTest.trim().toUpperCase();
    if (clean.includes("GALA") || clean === "839204" || clean === "482910") {
      setCheckResult({
        status: "success",
        title: clean.startsWith("SKY") ? "Ticket Verified: Aditi Sharma" : "Active Member: Rohan Mehta",
        detail: clean.startsWith("SKY") ? "Gala 2026 · General Admission · Admitted" : "Engineering Tier · 25% Merch Discount active",
        time: new Date().toLocaleTimeString()
      });
    } else {
      setCheckResult({
        status: "denied",
        title: "Code Rejected: Unrecognized or Expired",
        detail: "No active reservation matching this code. Ask attendee for active app screen.",
        time: new Date().toLocaleTimeString()
      });
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto rounded-3xl bg-white border border-hairline shadow-md overflow-hidden text-left">
      {/* Interactive Tabs Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-surface-soft border-b border-hairline flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse"></span>
          <span className="text-xs font-bold uppercase tracking-wider text-charcoal">
            Live Interactive Simulator
          </span>
        </div>
        <div className="flex items-center gap-1.5 p-1 bg-white rounded-full border border-hairline">
          <button
            type="button"
            onClick={() => setActiveTab("door")}
            className={`px-3.5 py-1 text-xs font-bold rounded-full transition-all ${
              activeTab === "door"
                ? "bg-ink-deep text-white shadow-xs"
                : "text-steel hover:text-ink hover:bg-surface-soft"
            }`}
          >
            Door Gate
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("card")}
            className={`px-3.5 py-1 text-xs font-bold rounded-full transition-all ${
              activeTab === "card"
                ? "bg-ink-deep text-white shadow-xs"
                : "text-steel hover:text-ink hover:bg-surface-soft"
            }`}
          >
            Digital Pass
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ledger")}
            className={`px-3.5 py-1 text-xs font-bold rounded-full transition-all ${
              activeTab === "ledger"
                ? "bg-ink-deep text-white shadow-xs"
                : "text-steel hover:text-ink hover:bg-surface-soft"
            }`}
          >
            Immutable Ledger
          </button>
        </div>
      </div>

      {/* Tab 1: Door Gate */}
      {activeTab === "door" && (
        <div className="p-6 sm:p-8">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6">
            <div className="flex-1">
              <span className="text-xs font-bold uppercase tracking-wider text-steel">
                Zero-Camera Gate Check-in
              </span>
              <h3 className="text-xl font-black text-ink-deep mt-1">
                Test Instant Code Verification
              </h3>
              <p className="text-xs text-steel mt-1 leading-relaxed">
                Staff enter the attendee's 8-character Crockford ticket code or 6-digit rotating member code. Single tap verification in under 0.5s.
              </p>

              <div className="mt-4 flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleTestVerify("SKY-GALA-0042")}
                  className="px-2.5 py-1 rounded-full bg-surface-soft hover:bg-hairline text-ink text-xs font-mono font-bold transition-colors"
                >
                  SKY-GALA-0042 (Valid)
                </button>
                <button
                  type="button"
                  onClick={() => handleTestVerify("482910")}
                  className="px-2.5 py-1 rounded-full bg-surface-soft hover:bg-hairline text-ink text-xs font-mono font-bold transition-colors"
                >
                  482910 (Member Code)
                </button>
                <button
                  type="button"
                  onClick={() => handleTestVerify("EXPIRED-999")}
                  className="px-2.5 py-1 rounded-full bg-surface-soft hover:bg-hairline text-critical text-xs font-mono font-bold transition-colors"
                >
                  EXPIRED-999 (Invalid)
                </button>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <input
                  type="text"
                  value={testCode}
                  onChange={(e) => setTestCode(e.target.value.toUpperCase())}
                  placeholder="Enter ticket or member code..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-hairline bg-surface-soft font-mono font-bold text-sm text-ink-deep uppercase tracking-wider focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => handleTestVerify(testCode)}
                  className="px-6 py-2.5 rounded-xl bg-ink-deep hover:bg-charcoal text-white font-bold text-sm transition-all shadow-xs"
                >
                  Verify
                </button>
              </div>
            </div>

            {/* Outcome Display Card */}
            <div className="w-full md:w-80 shrink-0">
              <div
                className={`p-5 rounded-2xl border transition-all ${
                  checkResult.status === "success"
                    ? "bg-success/5 border-success/30"
                    : "bg-critical/5 border-critical/30"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      checkResult.status === "success"
                        ? "bg-success text-white"
                        : "bg-critical text-white"
                    }`}
                  >
                    {checkResult.status === "success" ? "✓ APPROVED" : "✕ DENIED"}
                  </span>
                  <span className="text-[10px] text-steel font-mono">
                    {checkResult.time}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-ink-deep">
                  {checkResult.title}
                </h4>
                <p className="text-xs text-steel mt-1 leading-relaxed">
                  {checkResult.detail}
                </p>
                <div className="mt-3 pt-3 border-t border-hairline/40 flex justify-between text-[11px] font-semibold text-charcoal">
                  <span>Gate: South Gate 1</span>
                  <span>Counter: 142/200</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Digital Pass */}
      {activeTab === "card" && (
        <div className="p-6 sm:p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex-1">
              <span className="text-xs font-bold uppercase tracking-wider text-steel">
                Anti-Screenshot Security
              </span>
              <h3 className="text-xl font-black text-ink-deep mt-1">
                60-Second Rotating Dynamic Code
              </h3>
              <p className="text-xs text-steel mt-1 leading-relaxed">
                Screenshots cannot be shared with friends. The member pass generates a cryptographic, server-verified 6-digit code valid for exactly 60 seconds with live countdown ring.
              </p>
              <div className="mt-4 flex items-center gap-4 text-xs text-charcoal font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-success"></span>
                  Active Dues Paid
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary"></span>
                  Member ID: #SK-8812
                </span>
              </div>
            </div>

            {/* Virtual Member Card */}
            <div className="w-full sm:w-72 p-6 rounded-3xl bg-gradient-to-br from-ink-deep via-ink to-charcoal text-white shadow-xl relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/60">
                    Skyline Student Asscn.
                  </span>
                  <h4 className="text-base font-bold tracking-tight text-white mt-0.5">
                    Aditi Sharma
                  </h4>
                  <span className="text-xs text-white/70">CSE · Class of 2027</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold uppercase tracking-wider text-white">
                  Active
                </span>
              </div>

              <div className="my-6 text-center py-3 bg-white/10 rounded-2xl backdrop-blur-xs border border-white/10">
                <span className="text-[10px] uppercase font-bold tracking-wider text-white/60 block mb-1">
                  Dynamic Door Code
                </span>
                <span className="text-3xl font-black font-mono tracking-widest text-white">
                  {memberCode}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-white/80">
                <span className="flex items-center gap-1 font-mono">
                  ⏱️ Rotates in {countdown}s
                </span>
                <span className="text-[11px] text-white/60">Tier: Executive</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Immutable Ledger */}
      {activeTab === "ledger" && (
        <div className="p-6 sm:p-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-steel">
                Double-Entry Traceability
              </span>
              <h3 className="text-xl font-black text-ink-deep mt-1">
                Live Audited Transaction Stream
              </h3>
              <p className="text-xs text-steel mt-0.5">
                Every sale, dues payment, or expense creates an immutable ledger entry linking directly to its source receipt.
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-steel block">
                Net Verified Treasury
              </span>
              <span className="text-2xl font-black text-success">
                ₹1,42,850.00
              </span>
            </div>
          </div>

          <div className="border border-hairline rounded-2xl overflow-hidden bg-surface-soft text-xs">
            <div className="grid grid-cols-4 px-4 py-2.5 font-bold text-steel border-b border-hairline uppercase tracking-wider text-[10px]">
              <span>Reference</span>
              <span>Category</span>
              <span>Amount</span>
              <span className="text-right">Method</span>
            </div>
            <div className="divide-y divide-hairline bg-white">
              <div className="grid grid-cols-4 px-4 py-2.5 items-center font-medium">
                <span className="font-mono text-ink-deep font-bold">TX-2026-881</span>
                <span className="text-charcoal">Gala Ticket #42</span>
                <span className="text-success font-bold">+₹400.00</span>
                <span className="text-right text-steel font-mono">UPI / Test</span>
              </div>
              <div className="grid grid-cols-4 px-4 py-2.5 items-center font-medium">
                <span className="font-mono text-ink-deep font-bold">TX-2026-880</span>
                <span className="text-charcoal">Hoodie Pre-Order (L)</span>
                <span className="text-success font-bold">+₹850.00</span>
                <span className="text-right text-steel font-mono">Razorpay</span>
              </div>
              <div className="grid grid-cols-4 px-4 py-2.5 items-center font-medium">
                <span className="font-mono text-ink-deep font-bold">TX-2026-879</span>
                <span className="text-charcoal">Stage Sound Rental</span>
                <span className="text-critical font-bold">-₹15,000.00</span>
                <span className="text-right text-steel font-mono">Approved Bank</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
