import React, { useState, useEffect } from "react";
import { api } from "../lib/api.ts";

export function MemberCard() {
  const [code, setCode] = useState<string>("------");
  const [secondsLeft, setSecondsLeft] = useState<number>(60);
  const [loading, setLoading] = useState<boolean>(true);
  const [membership, setMembership] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  const fetchCode = async () => {
    try {
      setLoading(true);
      const res = await api<{ code: string; expiresInSeconds: number }>("/me/verify-code", {
        method: "POST"
      });
      setCode(res.code);
      setSecondsLeft(res.expiresInSeconds || 60);
    } catch (err: any) {
      console.warn("Could not fetch verification code:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const [u, m] = await Promise.all([
        api<any>("/me"),
        api<any>("/me/membership")
      ]);
      setUser(u);
      setMembership(m);
      if (m && m.status === "active") {
        fetchCode();
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (secondsLeft <= 0) {
      if (membership && membership.status === "active") {
        fetchCode();
      }
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [secondsLeft, membership]);

  if (!membership || membership.status !== "active") {
    return (
      <div className="max-w-md mx-auto p-8 rounded-3xl bg-surface-soft border border-hairline text-center">
        <h3 className="text-xl font-bold text-ink-deep mb-2">No Active Membership</h3>
        <p className="text-sm text-steel mb-6">
          Apply for membership or renew to unlock your rotating door verification code and exclusive perks.
        </p>
        <a
          href="/membership"
          class="inline-flex px-6 py-3 rounded-full bg-ink-deep text-white font-bold text-sm hover:bg-charcoal transition-colors"
        >
          View Membership Tiers
        </a>
      </div>
    );
  }

  const tier = membership.membership_tiers;

  return (
    <div className="max-w-md mx-auto">
      {/* Visual Member Card */}
      <div className="bg-gradient-to-br from-ink-deep via-charcoal to-ink text-white rounded-3xl p-7 shadow-xl border border-white/10 relative overflow-hidden">
        {/* Background Decorative Accent */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-primary/20 blur-2xl pointer-events-none" />

        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="text-xs uppercase font-bold tracking-wider text-steel">Skyline Student Association</div>
            <div className="text-lg font-bold mt-0.5">Member Identity</div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-primary text-white">
            {tier?.name || "Member"}
          </span>
        </div>

        <div className="mb-6">
          <div className="text-2xl font-black">{user?.fullName || "Club Member"}</div>
          <div className="text-sm text-stone font-mono">{user?.studentId || user?.email}</div>
        </div>

        {/* Dynamic Verification Code Box */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 text-center">
          <div className="text-xs text-stone uppercase tracking-widest font-bold mb-1">
            Door Verification Code
          </div>
          <div className="text-4xl font-mono font-black tracking-widest py-1">
            {loading ? "..." : code}
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-stone mt-1">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span>Rotates in {secondsLeft}s</span>
          </div>
        </div>

        <div className="flex justify-between items-center text-xs text-stone mt-6 pt-4 border-t border-white/10">
          <span>Valid through {membership.expires_on}</span>
          <span>{tier?.discount_percent}% Merch Discount</span>
        </div>
      </div>

      <p className="text-xs text-steel text-center mt-4">
        Present this 6-digit code at event check-in desks. No camera or QR scanner required.
      </p>
    </div>
  );
}
