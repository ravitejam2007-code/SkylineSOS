import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface MemberRecord {
  id: string;
  fullName: string;
  email: string;
  role: string;
  studentId?: string;
  tier?: string;
  status?: string;
  expiresOn?: string;
}

export function AdminMembersPanel() {
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Walk-up Modal State
  const [showWalkUp, setShowWalkUp] = useState(false);
  const [walkUpForm, setWalkUpForm] = useState({
    fullName: "",
    email: "",
    studentId: "",
    tierId: "active"
  });
  const [walkUpLoading, setWalkUpLoading] = useState(false);
  const [walkUpSuccess, setWalkUpSuccess] = useState<string | null>(null);

  const searchMembers = async (q: string = "") => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<MemberRecord[]>(`/staff/members?q=${encodeURIComponent(q)}`);
      setMembers(data || []);
    } catch (err: any) {
      setError(err?.message || "Failed to search member directory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    searchMembers("");
  }, []);

  const handleWalkUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWalkUpLoading(true);
    setWalkUpSuccess(null);
    try {
      const res = await api<{ message: string; tempPass?: string }>("/admin/members/walk-up", {
        method: "POST",
        json: walkUpForm
      });
      setWalkUpSuccess(res?.message || "Walk-up member successfully enrolled!");
      setWalkUpForm({ fullName: "", email: "", studentId: "", tierId: "active" });
      await searchMembers(query);
    } catch (err: any) {
      alert(err?.message || "Failed to enroll walk-up member");
    } finally {
      setWalkUpLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!confirm(`Are you sure you want to change user role to ${newRole}?`)) return;
    try {
      await api(`/admin/users/${userId}/role`, {
        method: "PATCH",
        json: { role: newRole }
      });
      await searchMembers(query);
    } catch (err: any) {
      alert(err?.message || "Role change failed");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-surface-soft border border-hairline">
        <div>
          <h2 className="text-xl font-black text-ink-deep">Student Directory & Roles</h2>
          <p className="text-xs text-steel mt-0.5">
            Search enrolled students, grant staff permissions, and process walk-up counter registrations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowWalkUp(true);
              setWalkUpSuccess(null);
            }}
            className="px-5 py-2.5 rounded-full bg-ink-deep hover:bg-charcoal text-white font-bold text-xs shadow-xs transition-all hover:scale-[1.02]"
          >
            + Walk-up Registration
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            searchMembers(e.target.value);
          }}
          placeholder="Search by student name, email, or institutional ID..."
          className="flex-1 px-4 py-3 rounded-2xl border border-hairline bg-white text-xs text-ink-deep focus:outline-none focus:border-primary shadow-xs"
        />
        <button
          type="button"
          onClick={() => searchMembers(query)}
          className="px-6 py-3 rounded-2xl bg-surface-soft border border-hairline font-bold text-xs text-ink-deep hover:bg-hairline/50 transition-colors"
        >
          Search
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="p-8 text-center rounded-3xl bg-white border border-hairline">
          <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-xs font-bold text-steel">Searching directory records...</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="p-6 text-center rounded-3xl bg-critical/5 border border-critical/20 text-xs text-critical font-bold">
          ⚠️ {error}
        </div>
      )}

      {/* Results Table */}
      {!loading && !error && (
        <div className="rounded-3xl bg-white border border-hairline shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-soft text-[10px] uppercase font-bold text-steel border-b border-hairline tracking-wider">
                <tr>
                  <th className="py-3.5 px-6">Student / Member</th>
                  <th className="py-3.5 px-4">Student ID</th>
                  <th className="py-3.5 px-4">Membership Tier</th>
                  <th className="py-3.5 px-4">System Role</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-steel">
                      No matching student records found.
                    </td>
                  </tr>
                ) : (
                  members.map((m) => (
                    <tr key={m.id} className="hover:bg-surface-soft/40 transition-colors">
                      <td className="py-3.5 px-6">
                        <div className="font-bold text-ink-deep">{m.fullName || "Unnamed User"}</div>
                        <div className="text-[11px] text-steel">{m.email}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-charcoal">
                        {m.studentId || "—"}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface-soft border border-hairline text-charcoal">
                          {m.tier || "General"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.id, e.target.value)}
                          className="px-2.5 py-1 rounded-lg border border-hairline bg-surface-soft text-[11px] font-bold text-ink-deep focus:outline-none focus:border-primary"
                        >
                          <option value="member">Member</option>
                          <option value="volunteer">Volunteer</option>
                          <option value="door">Door Staff</option>
                          <option value="treasurer">Treasurer</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-6 text-right font-medium">
                        <span className="text-[11px] text-success font-bold">Active</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Walk-Up Registration Modal */}
      {showWalkUp && (
        <div className="fixed inset-0 z-50 bg-ink-deep/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-white border border-hairline shadow-2xl text-left">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-black text-ink-deep">Walk-Up Registration</h3>
              <button
                type="button"
                onClick={() => setShowWalkUp(false)}
                className="text-steel hover:text-ink font-bold text-lg"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-steel mb-6">
              Instant registration for attendees paying dues or joining in person at the club counter.
            </p>

            {walkUpSuccess && (
              <div className="mb-4 p-3 rounded-2xl bg-success/10 border border-success/20 text-xs text-success font-bold">
                ✓ {walkUpSuccess}
              </div>
            )}

            <form onSubmit={handleWalkUpSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={walkUpForm.fullName}
                  onChange={(e) => setWalkUpForm({ ...walkUpForm, fullName: e.target.value })}
                  placeholder="e.g. Rahul Verma"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-hairline text-xs text-ink-deep focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal mb-1">
                  College Email
                </label>
                <input
                  type="email"
                  required
                  value={walkUpForm.email}
                  onChange={(e) => setWalkUpForm({ ...walkUpForm, email: e.target.value })}
                  placeholder="rahul.v@campus.edu"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-hairline text-xs text-ink-deep focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-charcoal mb-1">
                  Student ID Number
                </label>
                <input
                  type="text"
                  required
                  value={walkUpForm.studentId}
                  onChange={(e) => setWalkUpForm({ ...walkUpForm, studentId: e.target.value })}
                  placeholder="e.g. 1MS22CS088"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-hairline text-xs text-ink-deep focus:outline-none focus:border-primary"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowWalkUp(false)}
                  className="px-4 py-2 rounded-full border border-hairline text-xs font-bold text-charcoal hover:bg-surface-soft"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={walkUpLoading}
                  className="px-6 py-2 rounded-full bg-primary hover:bg-primary-deep text-white text-xs font-bold transition-all shadow-xs disabled:opacity-50"
                >
                  {walkUpLoading ? "Registering..." : "Enroll Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
