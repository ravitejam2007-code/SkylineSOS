import React, { useState } from "react";
import { supabase } from "../lib/auth.ts";
import { api } from "../lib/api.ts";
import { redirectByRole } from "../lib/guards.ts";

const DEMO_ROLES = [
  { role: "admin", label: "Admin", email: "admin@skylinesos.demo" },
  { role: "treasurer", label: "Treasurer", email: "treasurer@skylinesos.demo" },
  { role: "door", label: "Door Staff", email: "door@skylinesos.demo" },
  { role: "volunteer", label: "Volunteer", email: "volunteer@skylinesos.demo" },
  { role: "member", label: "Member", email: "member@skylinesos.demo" }
];

export function LoginPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Skyline@2026");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim()
      });

      if (authError || !data.user) {
        throw new Error(authError?.message || "Sign in failed");
      }

      // Check user role via /me
      const profile = await api<{ role: string }>("/me");
      const targetUrl = redirectByRole(profile.role);
      window.location.href = targetUrl;
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDemoRole = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("Skyline@2026");
    setError(null);
  };

  return (
    <div className="max-w-md mx-auto p-8 bg-white rounded-3xl border border-hairline shadow-sm">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-black text-ink-deep">Welcome to SkylineSOS</h2>
        <p className="text-sm text-steel mt-1">Sign in to your club account</p>
      </div>

      {/* Quick Demo Accounts Selection */}
      <div className="mb-6 bg-surface-soft p-3 rounded-2xl border border-hairline-soft">
        <div className="text-xs font-bold text-charcoal uppercase tracking-wider mb-2 text-center">
          ⚡ One-Click Demo Role Sign-In
        </div>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {DEMO_ROLES.map((r) => (
            <button
              key={r.role}
              type="button"
              onClick={() => handleSelectDemoRole(r.email)}
              className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all text-center ${
                email === r.email
                  ? "bg-ink-deep text-white border-ink-deep shadow-sm"
                  : "bg-white text-ink border-hairline hover:border-steel"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">
            Email address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@skylinesos.demo"
            className="w-full h-11 px-4 rounded-xl border border-hairline focus:border-focus focus:outline-none text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">
            Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-11 px-4 rounded-xl border border-hairline focus:border-focus focus:outline-none text-sm font-mono"
          />
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-critical/30 text-critical text-xs font-medium">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="w-full h-12 rounded-full bg-ink-deep hover:bg-charcoal text-white font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            "Sign In"
          )}
        </button>
      </form>
    </div>
  );
}
