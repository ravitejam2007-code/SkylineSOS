import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: "public" | "members" | "exec";
  isPublished: boolean;
  publishedAt?: string;
  authorName?: string;
}

export function AdminAnnouncementsPanel() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Announcement Form State
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    audience: "public" as "public" | "members" | "exec"
  });
  const [submitting, setSubmitting] = useState(false);

  const loadAnnouncements = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<Announcement[]>("/admin/announcements");
      setAnnouncements(data || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load announcements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api("/admin/announcements", {
        method: "POST",
        json: form
      });
      setShowCreate(false);
      setForm({ title: "", body: "", audience: "public" });
      await loadAnnouncements();
    } catch (err: any) {
      alert(err?.message || "Failed to create announcement");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePublish = async (id: string, currentlyPublished: boolean) => {
    try {
      const endpoint = currentlyPublished
        ? `/admin/announcements/${id}/archive`
        : `/admin/announcements/${id}/publish`;
      await api(endpoint, { method: "POST" });
      await loadAnnouncements();
    } catch (err: any) {
      alert(err?.message || "Action failed");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-surface-soft border border-hairline">
        <div>
          <h2 className="text-xl font-black text-ink-deep">Official Broadcasts & Comms</h2>
          <p className="text-xs text-steel mt-0.5">
            Broadcast official messages to students, members, or executive staff members.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="px-5 py-2.5 rounded-full bg-ink-deep hover:bg-charcoal text-white font-bold text-xs shadow-xs transition-all hover:scale-[1.02]"
        >
          + Draft Announcement
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="p-12 text-center rounded-3xl bg-white border border-hairline">
          <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-xs font-bold text-steel">Loading announcements...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="p-6 text-center rounded-3xl bg-critical/5 border border-critical/20 text-xs text-critical font-bold">
          ⚠️ {error}
        </div>
      )}

      {/* Announcements List */}
      {!loading && !error && (
        <div className="grid grid-cols-1 gap-4">
          {announcements.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white border border-hairline">
              <span className="text-3xl block mb-2">📢</span>
              <p className="text-sm font-bold text-ink-deep">No announcements drafted yet</p>
            </div>
          ) : (
            announcements.map((a) => (
              <div
                key={a.id}
                className="p-6 rounded-3xl bg-white border border-hairline shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        a.audience === "public"
                          ? "bg-primary/10 text-primary"
                          : a.audience === "members"
                          ? "bg-success/10 text-success"
                          : "bg-attention/15 text-ink-deep"
                      }`}
                    >
                      Audience: {a.audience}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        a.isPublished ? "bg-success text-white" : "bg-steel/20 text-steel"
                      }`}
                    >
                      {a.isPublished ? "Live" : "Draft"}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-ink-deep">{a.title}</h3>
                  <p className="text-xs text-steel mt-1 whitespace-pre-wrap leading-relaxed max-w-3xl">
                    {a.body}
                  </p>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-hairline">
                  <button
                    type="button"
                    onClick={() => handleTogglePublish(a.id, a.isPublished)}
                    className={`px-5 py-2 rounded-full font-bold text-xs transition-all shadow-xs ${
                      a.isPublished
                        ? "bg-surface-soft hover:bg-hairline text-steel"
                        : "bg-primary hover:bg-primary-deep text-white"
                    }`}
                  >
                    {a.isPublished ? "Archive" : "Publish Broadcast"}
                  </button>
                  <span className="text-[10px] text-steel">
                    {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : "Not published"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-ink-deep/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg p-6 sm:p-8 rounded-3xl bg-white border border-hairline shadow-2xl text-left">
            <h3 className="text-xl font-black text-ink-deep mb-2">New Official Broadcast</h3>
            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="font-bold uppercase tracking-wider text-charcoal block mb-1">
                  Target Audience
                </label>
                <select
                  value={form.audience}
                  onChange={(e) => setForm({ ...form, audience: e.target.value as any })}
                  className="w-full p-2.5 rounded-xl border border-hairline font-bold text-ink-deep"
                >
                  <option value="public">Public (Visible to All Students)</option>
                  <option value="members">Members Only (Dues-Paid Students)</option>
                  <option value="exec">Executive Board (Staff Only)</option>
                </select>
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider text-charcoal block mb-1">
                  Headline / Title
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Skyline Annual Gala 2026 Dress Code & Gate Guidelines"
                  className="w-full p-2.5 rounded-xl border border-hairline text-ink-deep font-bold"
                />
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider text-charcoal block mb-1">
                  Message Body
                </label>
                <textarea
                  required
                  rows={5}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="Write official announcement details..."
                  className="w-full p-3 rounded-xl border border-hairline text-ink-deep leading-relaxed"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-full border border-hairline font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 rounded-full bg-primary hover:bg-primary-deep text-white font-bold"
                >
                  {submitting ? "Saving..." : "Save Draft"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
