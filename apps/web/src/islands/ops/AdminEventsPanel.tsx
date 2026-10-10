import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { formatPaise } from "@/lib/money";

interface EventItem {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  venue: string;
  capacity: number;
  isPublished: boolean;
  ticketTypes?: Array<{
    id: string;
    name: string;
    pricePaise: number;
    memberDiscountPercent: number;
    quantity: number;
  }>;
}

interface EventSummary {
  eventId: string;
  title: string;
  capacity: number;
  sold: number;
  checkedIn: number;
  totalRevenuePaise: number;
  revenueByMethod: Record<string, number>;
}

export function AdminEventsPanel() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<EventSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // New Event Modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    startsAt: "2026-10-17T18:00",
    venue: "Main Grand Auditorium",
    capacity: 200,
    isPublished: true
  });
  const [creating, setCreating] = useState(false);

  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<EventItem[]>("/admin/events");
      setEvents(data || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api("/admin/events", {
        method: "POST",
        json: {
          ...form,
          startsAt: new Date(form.startsAt).toISOString()
        }
      });
      setShowCreate(false);
      setForm({
        title: "",
        slug: "",
        description: "",
        startsAt: "2026-10-17T18:00",
        venue: "Main Grand Auditorium",
        capacity: 200,
        isPublished: true
      });
      await loadEvents();
    } catch (err: any) {
      alert(err?.message || "Failed to create event");
    } finally {
      setCreating(false);
    }
  };

  const loadSummary = async (eventId: string) => {
    setSummaryLoading(true);
    try {
      const data = await api<EventSummary>(`/admin/events/${eventId}/summary`);
      setSelectedSummary(data);
    } catch (err: any) {
      alert(err?.message || "Failed to load event summary");
    } finally {
      setSummaryLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-surface-soft border border-hairline">
        <div>
          <h2 className="text-xl font-black text-ink-deep">Club Events & Gate Capacity</h2>
          <p className="text-xs text-steel mt-0.5">
            Configure ticketing tiers, inspect real-time gate attendance, and monitor ticket revenues.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="px-5 py-2.5 rounded-full bg-ink-deep hover:bg-charcoal text-white font-bold text-xs shadow-xs transition-all hover:scale-[1.02]"
        >
          + Create New Event
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="p-12 text-center rounded-3xl bg-white border border-hairline">
          <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-xs font-bold text-steel">Loading events inventory...</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="p-6 text-center rounded-3xl bg-critical/5 border border-critical/20 text-xs text-critical font-bold">
          ⚠️ {error}
        </div>
      )}

      {/* Events Grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {events.map((evt) => (
            <div
              key={evt.id}
              className="p-6 rounded-3xl bg-white border border-hairline shadow-xs flex flex-col justify-between hover:border-ink/20 transition-all"
            >
              <div>
                <div className="flex justify-between items-start gap-2 mb-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      evt.isPublished ? "bg-success/10 text-success" : "bg-steel/10 text-steel"
                    }`}
                  >
                    {evt.isPublished ? "Published" : "Draft"}
                  </span>
                  <span className="text-xs font-mono font-bold text-charcoal">
                    Max: {evt.capacity} seats
                  </span>
                </div>

                <h3 className="text-xl font-black text-ink-deep">{evt.title}</h3>
                <p className="text-xs text-steel mt-1">📍 {evt.venue}</p>
                <p className="text-xs text-steel mt-0.5">
                  📅 {new Date(evt.startsAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </p>

                {evt.ticketTypes && evt.ticketTypes.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-hairline/60">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-steel block mb-2">
                      Active Ticket Tiers
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {evt.ticketTypes.map((t) => (
                        <span
                          key={t.id}
                          className="px-2.5 py-1 rounded-xl bg-surface-soft border border-hairline text-xs font-bold text-charcoal"
                        >
                          {t.name}: <span className="text-success">{formatPaise(t.pricePaise)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-hairline flex items-center justify-between">
                <a
                  href={`/door?eventId=${evt.id}`}
                  className="text-xs font-bold text-steel hover:text-ink"
                >
                  🚪 Open Gate Console
                </a>
                <button
                  type="button"
                  onClick={() => loadSummary(evt.id)}
                  className="px-4 py-2 rounded-full bg-surface-soft hover:bg-hairline text-ink-deep font-bold text-xs transition-colors"
                >
                  View Summary & Revenue →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Live Event Summary Modal */}
      {selectedSummary && (
        <div className="fixed inset-0 z-50 bg-ink-deep/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg p-6 sm:p-8 rounded-3xl bg-white border border-hairline shadow-2xl text-left">
            <div className="flex justify-between items-center mb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Live Attendance & Revenue
                </span>
                <h3 className="text-xl font-black text-ink-deep">{selectedSummary.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSummary(null)}
                className="text-steel hover:text-ink font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 my-4">
              <div className="p-3 rounded-2xl bg-surface-soft text-center border border-hairline">
                <span className="text-[10px] uppercase font-bold text-steel block">Sold</span>
                <span className="text-2xl font-black text-ink-deep">{selectedSummary.sold}</span>
              </div>
              <div className="p-3 rounded-2xl bg-surface-soft text-center border border-hairline">
                <span className="text-[10px] uppercase font-bold text-steel block">Checked In</span>
                <span className="text-2xl font-black text-success">{selectedSummary.checkedIn}</span>
              </div>
              <div className="p-3 rounded-2xl bg-surface-soft text-center border border-hairline">
                <span className="text-[10px] uppercase font-bold text-steel block">Capacity</span>
                <span className="text-2xl font-black text-charcoal">{selectedSummary.capacity}</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-ink-deep text-white text-center my-4">
              <span className="text-[10px] uppercase font-bold tracking-widest text-white/60 block mb-1">
                Total Ticket Revenue
              </span>
              <span className="text-3xl font-black text-success">
                {formatPaise(selectedSummary.totalRevenuePaise || 0)}
              </span>
            </div>

            {selectedSummary.revenueByMethod && (
              <div className="space-y-1.5 text-xs text-charcoal border-t border-hairline pt-3">
                <span className="text-[10px] font-bold uppercase text-steel block mb-1">
                  Collection By Channel:
                </span>
                {Object.entries(selectedSummary.revenueByMethod).map(([method, amount]) => (
                  <div key={method} className="flex justify-between font-mono">
                    <span className="uppercase text-steel">{method}:</span>
                    <span className="font-bold text-ink-deep">{formatPaise(amount as number)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSummary(null)}
                className="px-6 py-2.5 rounded-full bg-ink-deep text-white font-bold text-xs"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-ink-deep/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-white border border-hairline shadow-2xl text-left">
            <h3 className="text-xl font-black text-ink-deep mb-2">Create New Event</h3>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="font-bold uppercase tracking-wider text-charcoal block mb-1">
                  Event Title
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => {
                    const slug = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                    setForm({ ...form, title: e.target.value, slug });
                  }}
                  placeholder="e.g. Skyline Tech Hackathon 2026"
                  className="w-full p-2.5 rounded-xl border border-hairline text-ink-deep"
                />
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider text-charcoal block mb-1">
                  Slug (URL)
                </label>
                <input
                  type="text"
                  required
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-hairline text-ink-deep font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold uppercase tracking-wider text-charcoal block mb-1">
                    Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={form.startsAt}
                    onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-hairline text-ink-deep"
                  />
                </div>
                <div>
                  <label className="font-bold uppercase tracking-wider text-charcoal block mb-1">
                    Max Capacity
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl border border-hairline text-ink-deep"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold uppercase tracking-wider text-charcoal block mb-1">
                  Venue
                </label>
                <input
                  type="text"
                  required
                  value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                  placeholder="Campus Seminar Hall B"
                  className="w-full p-2.5 rounded-xl border border-hairline text-ink-deep"
                />
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-full border border-hairline font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-2 rounded-full bg-primary hover:bg-primary-deep text-white font-bold"
                >
                  {creating ? "Saving..." : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
