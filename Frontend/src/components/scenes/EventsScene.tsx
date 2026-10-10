import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { formatPaise } from '../../lib/formatters';
import { generateQrDataUrl } from '../../lib/qr';
import { LoadingCard, ButtonSpinner } from '../ui/LoadingState';
import { getActiveSession, getCurrentUserSession, type UserSession } from '../../lib/auth';
import type {
  Event,
  TicketType,
  Ticket,
  EventSummaryResult,
} from '@campusone/contracts';

export default function EventsScene() {
  const [session, setSession] = useState<UserSession | null>(() => {
    if (typeof window !== 'undefined') return getActiveSession();
    return null;
  });
  const [events, setEvents] = useState<Event[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [summary, setSummary] = useState<EventSummaryResult | null>(null);
  const [issuedTickets, setIssuedTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  // Async button loading states
  const [buyingTicketId, setBuyingTicketId] = useState<string | null>(null);
  const [isSellingDoor, setIsSellingDoor] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);

  // Door Check-in state (6-digit code or ticket token)
  const [checkInToken, setCheckInToken] = useState('482915');
  const [ticketQrDataUrl, setTicketQrDataUrl] = useState<string>('');
  const [checkInResult, setCheckInResult] = useState<{
    success: boolean;
    message: string;
    attendee?: string;
  } | null>(null);

  useEffect(() => {
    if (checkInToken && !/^\d{6}$/.test(checkInToken.trim())) {
      generateQrDataUrl(checkInToken, { width: 220 }).then(setTicketQrDataUrl);
    } else {
      setTicketQrDataUrl('');
    }
  }, [checkInToken]);

  // Cash door sale state
  const [doorAttendeeName, setDoorAttendeeName] = useState('');
  const [doorTicketTypeId, setDoorTicketTypeId] = useState('');
  const [doorSaleSuccess, setDoorSaleSuccess] = useState<string | null>(null);

  // Buy ticket success state
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);

  // Create Event state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventVenue, setNewEventVenue] = useState('');
  const [newEventCapacity, setNewEventCapacity] = useState('150');

  const loadData = async () => {
    try {
      const evts = await api.getEvents();
      setEvents(evts);
      if (evts.length > 0) {
        const [ttList, summ] = await Promise.all([
          api.getTicketTypes(evts[0].id),
          api.getEventSummary(evts[0].id),
        ]);
        setTicketTypes(ttList);
        setSummary(summ);
        if (ttList.length > 0) setDoorTicketTypeId(ttList[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    getCurrentUserSession().then((s) => {
      if (s) setSession(s);
    });

    const handleAuthChange = (e: CustomEvent) => {
      setSession(e.detail);
    };

    window.addEventListener('campusone:auth_changed' as any, handleAuthChange);
    return () => {
      window.removeEventListener('campusone:auth_changed' as any, handleAuthChange);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCreateModal(false);
      }
    };
    if (showCreateModal) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [showCreateModal]);

  // Handle Online Ticket Purchase
  const handleBuyTicket = async (tt: TicketType, isMember: boolean) => {
    setBuyingTicketId(tt.id);
    try {
      const attendeeName = isMember
        ? (session?.fullName ? `${session.fullName} (VIP Member)` : 'Rahul Verma (VIP Member)')
        : (session?.fullName || 'Campus Guest');

      const res = await api.buyTicket({
        event_id: events[0]?.id,
        ticket_type_id: tt.id,
        quantity: 1,
        payment_method: 'online',
        attendee_name: attendeeName,
      });
      setPurchaseSuccess(`Ticket ${res.ticket.qr_token} confirmed! Check-in pass generated.`);
      setIssuedTickets((prev) => [res.ticket, ...prev]);
      setCheckInToken(res.ticket.qr_token);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBuyingTicketId(null);
    }
  };

  // Handle Cash Door Sale
  const handleCashDoorSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doorAttendeeName) {
      alert('Please enter attendee name');
      return;
    }
    const tt = ticketTypes.find((t) => t.id === doorTicketTypeId) || ticketTypes[0];
    if (!tt) {
      alert('No ticket type selected');
      return;
    }
    setIsSellingDoor(true);
    try {
      const res = await api.buyTicket({
        event_id: events[0]?.id,
        ticket_type_id: tt.id,
        quantity: 1,
        payment_method: 'cash',
        attendee_name: `${doorAttendeeName} (Cash Door Sale)`,
      });
      setDoorSaleSuccess(`Door cash payment of ${formatPaise(tt.price_paise)} recorded for ${doorAttendeeName}!`);
      setDoorAttendeeName('');
      setIssuedTickets((prev) => [res.ticket, ...prev]);
      setCheckInToken(res.ticket.qr_token);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSellingDoor(false);
    }
  };

  // Handle QR Check-in
  const handleCheckIn = async () => {
    setIsCheckingIn(true);
    try {
      const res = await api.checkInTicket({
        eventId: events[0]?.id,
        code: checkInToken,
      });
      setCheckInResult({
        success: true,
        message: `Verified: ${res.attendee_name}`,
        attendee: res.attendee_name,
      });
      await loadData();
    } catch (err: any) {
      setCheckInResult({
        success: false,
        message: err.message,
      });
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Handle Create Event
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle || !newEventVenue) return;
    setIsCreatingEvent(true);
    try {
      await api.createEvent({
        title: newEventTitle,
        description: 'Official student association campus event',
        venue: newEventVenue,
        starts_at: '2026-05-15T18:00:00+05:30',
        ends_at: '2026-05-15T22:00:00+05:30',
        capacity: parseInt(newEventCapacity, 10) || 100,
        ticket_types: [
          { name: 'Standard Admission', price_paise: 20000, member_price_paise: 15000 },
        ],
      });
      setShowCreateModal(false);
      setNewEventTitle('');
      setNewEventVenue('');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsCreatingEvent(false);
    }
  };

  if (loading) {
    return <LoadingCard label="Loading Spring Gala event & ticketing records..." />;
  }

  const primaryEvent = events[0];
  const capacityPercent = primaryEvent
    ? Math.round((primaryEvent.sold_count / primaryEvent.capacity) * 100)
    : 72;

  return (
    <div className="space-y-16 t-enter">
      {/* Toast Feedbacks */}
      {purchaseSuccess && (
        <div className="p-4 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-success)] text-[var(--color-success)] flex justify-between items-center text-[14px] t-toast is-open">
          <span>✓ {purchaseSuccess}</span>
          <button onClick={() => setPurchaseSuccess(null)} className="font-bold underline ml-4 text-[12px] cursor-pointer">Dismiss</button>
        </div>
      )}
      {doorSaleSuccess && (
        <div className="p-4 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-success)] text-[var(--color-success)] flex justify-between items-center text-[14px] t-toast is-open">
          <span>✓ {doorSaleSuccess}</span>
          <button onClick={() => setDoorSaleSuccess(null)} className="font-bold underline ml-4 text-[12px] cursor-pointer">Dismiss</button>
        </div>
      )}

      {/* ─── 1. EVENT SHOWCASE HERO CARD ─── */}
      <div className="p-8 rounded-3xl bg-[var(--color-canvas)] border border-[var(--color-hairline-soft)] space-y-8 t-card-interactive">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-[var(--color-hairline-soft)]">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 rounded-full text-[12px] font-bold bg-[var(--color-warning)] text-[var(--color-ink-deep)]">
                Flagship Event
              </span>
              <span className="text-[13px] font-bold text-[var(--color-steel)]">
                Friday, April 24, 2026 · 7:00 PM IST
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-ink-deep)]">
              {primaryEvent ? primaryEvent.title : 'Skyline Annual Spring Gala: Masquerade Night'}
            </h2>
            <p className="text-[15px] text-[var(--color-steel)] mt-1">
              {primaryEvent ? primaryEvent.venue : 'Main Ballroom, Student Union Complex'}
            </p>
          </div>

          {/* Real-time Capacity Gauge */}
          <div className="bg-[var(--color-surface-soft)] p-5 rounded-2xl border border-[var(--color-hairline-soft)] min-w-[240px]">
            <div className="flex justify-between text-[13px] font-bold text-[var(--color-ink-deep)] mb-1.5">
              <span>Seats Reserved</span>
              <span>{primaryEvent?.sold_count || 182} / {primaryEvent?.capacity || 250}</span>
            </div>
            <div className="w-full bg-[var(--color-hairline)] h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-[var(--color-ink-deep)] h-full rounded-full transition-all duration-500"
                style={{ width: `${capacityPercent}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] text-[var(--color-steel)] mt-2">
              <span>{capacityPercent}% filled</span>
              <span>{(primaryEvent?.capacity || 250) - (primaryEvent?.sold_count || 182)} seats remaining</span>
            </div>
          </div>
        </div>

        {/* Ticket Tier Cards (Member vs Guest) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {ticketTypes.map((tt, idx) => {
            const isMemberTier = idx === 0;
            const isBuyingThis = buyingTicketId === tt.id;
            return (
              <div
                key={tt.id}
                className="p-6 rounded-2xl border border-[var(--color-hairline-soft)] bg-[var(--color-canvas)] flex flex-col justify-between t-card-interactive"
              >
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-[18px] text-[var(--color-ink-deep)]">{tt.name}</span>
                    {isMemberTier ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-800">
                        Save ₹150 (Member 15% Off)
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[var(--color-surface-soft)] text-[var(--color-ink)] border border-[var(--color-hairline-soft)]">
                        Open to all
                      </span>
                    )}
                  </div>

                  <p className="text-[14px] text-[var(--color-steel)] mb-4">
                    {isMemberTier
                      ? 'Requires active Skyline Student Association membership. Includes gala banquet, mask, and priority seating.'
                      : 'For campus visitors, alumni, and non-member students. Standard admission & full dinner buffet included.'}
                  </p>

                  <div className="text-3xl font-extrabold text-[var(--color-ink-deep)] mb-6">
                    {formatPaise(tt.price_paise)}
                    {isMemberTier && (
                      <span className="text-[14px] line-through text-[var(--color-stone)] font-normal ml-2">₹500</span>
                    )}
                  </div>
                </div>

                {/* Cobalt Rule strictly for Buy Tickets CTA */}
                <button
                  type="button"
                  disabled={isBuyingThis}
                  onClick={() => handleBuyTicket(tt, isMemberTier)}
                  className="w-full py-3.5 px-6 rounded-full font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-deep)] transition-all text-[15px] shadow-sm cursor-pointer t-button-action flex items-center justify-center gap-2"
                >
                  {isBuyingThis ? (
                    <ButtonSpinner size={16} />
                  ) : (
                    `Buy ${isMemberTier ? 'Member' : 'Guest'} Ticket (${formatPaise(tt.price_paise)})`
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Admin Create Event Trigger */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="text-[13px] font-bold text-[var(--color-ink-deep)] underline hover:text-black cursor-pointer t-button-action"
          >
            + Create New Campus Event (Admin)
          </button>
        </div>
      </div>

      {/* ─── MODAL: CREATE EVENT ─── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 t-modal-backdrop is-open">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 space-y-6 shadow-2xl relative t-modal is-open">
            <div className="flex justify-between items-start border-b border-[var(--color-hairline-soft)] pb-4">
              <div>
                <h3 className="text-2xl font-bold text-[var(--color-ink-deep)]">Create Campus Event</h3>
                <p className="text-[13px] text-[var(--color-steel)]">Set capacity limits and ticket availability</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-2xl text-[var(--color-steel)] hover:text-black cursor-pointer leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">Event Title</label>
                <input
                  type="text"
                  required
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="e.g. Skyline Tech Hackathon Night"
                  className="w-full px-4 py-3 rounded-full border border-[var(--color-hairline)] text-[14px] focus:outline-none focus:border-[var(--color-fb-blue)]"
                />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">Campus Venue</label>
                <input
                  type="text"
                  required
                  value={newEventVenue}
                  onChange={(e) => setNewEventVenue(e.target.value)}
                  placeholder="e.g. Auditorium Hall B"
                  className="w-full px-4 py-3 rounded-full border border-[var(--color-hairline)] text-[14px] focus:outline-none focus:border-[var(--color-fb-blue)]"
                />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">Total Seat Capacity</label>
                <input
                  type="number"
                  required
                  value={newEventCapacity}
                  onChange={(e) => setNewEventCapacity(e.target.value)}
                  className="w-full px-4 py-3 rounded-full border border-[var(--color-hairline)] text-[14px] focus:outline-none focus:border-[var(--color-fb-blue)]"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-3 rounded-full border border-[var(--color-hairline)] text-[14px] font-bold t-button-action cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingEvent}
                  className="flex-1 py-3 rounded-full bg-[var(--color-ink-deep)] text-white text-[14px] font-bold hover:bg-black cursor-pointer t-button-action flex items-center justify-center gap-2"
                >
                  {isCreatingEvent ? <ButtonSpinner size={16} /> : 'Publish Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 2. DOOR TERMINAL & CASH DOOR SALES ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Rapid Door 6-Digit Code & Ticket Check-in Terminal */}
        <div className="p-8 rounded-3xl bg-[var(--color-canvas)] border border-[var(--color-hairline-soft)] space-y-6 t-card-interactive">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--color-hairline-soft)]">
            <div>
              <h3 className="text-xl font-bold text-[var(--color-ink-deep)]">Door 6-Digit Gate Check-in</h3>
              <p className="text-[13px] text-[var(--color-steel)]">Atomic door verification with duplicate admission lock</p>
            </div>
            <span className="px-3 py-1 rounded-full text-[12px] font-bold bg-green-100 text-green-800">
              Identity Terminal
            </span>
          </div>

          <div className="p-6 rounded-2xl bg-[var(--color-surface-soft)] text-center space-y-5 border border-[var(--color-hairline-soft)]">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                6-Digit Member Pass & Ticket Verification
              </span>
              <p className="text-[12px] text-[var(--color-steel)] mt-1">
                Enter attendee's 6-digit dynamic code or 8-character Crockford ticket code:
              </p>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={checkInToken}
                onChange={(e) => setCheckInToken(e.target.value)}
                placeholder="e.g. 482915"
                className="w-full px-4 py-3 rounded-full border-2 border-[var(--color-hairline)] text-2xl font-mono font-black text-center tracking-widest text-emerald-600 bg-white focus:outline-none focus:border-emerald-500 shadow-2xs"
              />
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setCheckInToken('482915')}
                  className="px-2.5 py-0.5 rounded-full bg-white border border-[var(--color-hairline)] text-[10px] font-mono text-zinc-600 hover:bg-slate-50 cursor-pointer"
                >
                  Preset: 482915 (Member)
                </button>
                <button
                  type="button"
                  onClick={() => setCheckInToken('SKY-GALA-8492')}
                  className="px-2.5 py-0.5 rounded-full bg-white border border-[var(--color-hairline)] text-[10px] font-mono text-zinc-600 hover:bg-slate-50 cursor-pointer"
                >
                  Preset: SKY-GALA-8492 (Ticket)
                </button>
              </div>
            </div>

            <button
              type="button"
              disabled={isCheckingIn}
              onClick={handleCheckIn}
              className="px-8 py-3 rounded-full bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700 transition-all cursor-pointer t-button-action inline-flex items-center gap-2 shadow-sm"
            >
              {isCheckingIn ? <ButtonSpinner size={14} /> : 'Verify Code & Admit Attendee'}
            </button>

            {checkInResult && (
              <div
                className={`p-3 rounded-xl text-[13px] font-bold t-toast is-open ${
                  checkInResult.success
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : 'bg-red-100 text-red-800 border border-red-200'
                }`}
              >
                {checkInResult.success ? `✓ ${checkInResult.message}` : `⚠ ${checkInResult.message}`}
              </div>
            )}

            {issuedTickets.length > 0 && (
              <div className="pt-2 text-left space-y-1">
                <span className="text-[11px] font-bold text-[var(--color-steel)] uppercase">Recently Issued Tickets:</span>
                {issuedTickets.slice(0, 3).map((t) => (
                  <div key={t.id} className="text-[11px] font-mono text-[var(--color-ink)] bg-white p-2 rounded-lg border border-[var(--color-hairline-soft)] flex justify-between items-center">
                    <span>{t.qr_token}</span>
                    <span className="text-green-700 font-bold">{t.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Door Cash Ticket Sale Form */}
        <div className="p-8 rounded-3xl bg-[var(--color-canvas)] border border-[var(--color-hairline-soft)] space-y-6 t-card-interactive">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--color-hairline-soft)]">
            <div>
              <h3 className="text-xl font-bold text-[var(--color-ink-deep)]">Cash Door Sales Desk</h3>
              <p className="text-[13px] text-[var(--color-steel)]">Staff records walk-up attendee ticket cash</p>
            </div>
            <span className="px-3 py-1 rounded-full text-[12px] font-bold bg-[var(--color-surface-soft)] text-[var(--color-ink)] border border-[var(--color-hairline-soft)]">
              Cash Float Desk
            </span>
          </div>

          <form onSubmit={handleCashDoorSale} className="space-y-4">
            <div>
              <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">Attendee Full Name</label>
              <input
                type="text"
                required
                value={doorAttendeeName}
                onChange={(e) => setDoorAttendeeName(e.target.value)}
                placeholder="e.g. Siddharth Rao"
                className="w-full px-4 py-3 rounded-full border border-[var(--color-hairline)] text-[14px] focus:outline-none focus:border-[var(--color-fb-blue)]"
              />
            </div>

            <div>
              <label className="block text-[13px] font-bold text-[var(--color-ink-deep)] mb-1">Ticket Type</label>
              <select
                value={doorTicketTypeId}
                onChange={(e) => setDoorTicketTypeId(e.target.value)}
                className="w-full px-4 py-3 rounded-full border border-[var(--color-hairline)] text-[13px] focus:outline-none focus:border-[var(--color-fb-blue)] bg-white cursor-pointer"
              >
                {ticketTypes.map((tt) => (
                  <option key={tt.id} value={tt.id}>
                    {tt.name} ({formatPaise(tt.price_paise)})
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSellingDoor}
                className="w-full py-3.5 rounded-full bg-[var(--color-ink-deep)] text-white text-[14px] font-bold hover:bg-black transition-all cursor-pointer t-button-action flex items-center justify-center gap-2"
              >
                {isSellingDoor ? <ButtonSpinner size={16} /> : 'Record Cash Door Sale & Issue Ticket'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ─── 3. POST-EVENT ATTENDANCE & REVENUE SUMMARY ─── */}
      <div className="p-8 rounded-3xl bg-[var(--color-canvas)] border border-[var(--color-hairline-soft)] space-y-6 t-card-interactive">
        <div className="flex items-center justify-between pb-4 border-b border-[var(--color-hairline-soft)]">
          <div>
            <h3 className="text-2xl font-bold text-[var(--color-ink-deep)]">Event Attendance & Revenue Summary</h3>
            <p className="text-[13px] text-[var(--color-steel)]">Persisted metrics distinguished by online cards/UPI vs staff door cash</p>
          </div>
          <span className="px-3 py-1 rounded-full text-[12px] font-bold bg-[var(--color-surface-soft)] text-[var(--color-ink)] border border-[var(--color-hairline-soft)]">
            Audited Summary
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)] t-card-interactive">
            <span className="text-[12px] text-[var(--color-steel)] font-medium">Tickets Sold</span>
            <div className="text-2xl font-bold text-[var(--color-ink-deep)] mt-1">
              {summary?.sold_count || 182} / {summary?.capacity || 250}
            </div>
            <span className="text-[11px] text-[var(--color-slate)]">{capacityPercent}% capacity</span>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)] t-card-interactive">
            <span className="text-[12px] text-[var(--color-steel)] font-medium">Checked In</span>
            <div className="text-2xl font-bold text-[var(--color-success)] mt-1">
              {summary?.checked_in_count || 174} / {summary?.sold_count || 182}
            </div>
            <span className="text-[11px] text-[var(--color-slate)]">95.6% turnout</span>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)] t-card-interactive">
            <span className="text-[12px] text-[var(--color-steel)] font-medium">Online Revenue</span>
            <div className="text-2xl font-bold text-[var(--color-ink-deep)] mt-1">
              {formatPaise(summary?.online_revenue_paise || 6850000)}
            </div>
            <span className="text-[11px] text-[var(--color-slate)]">Online Cards & UPI</span>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--color-surface-soft)] border border-[var(--color-hairline-soft)] t-card-interactive">
            <span className="text-[12px] text-[var(--color-steel)] font-medium">Door Cash Recorded</span>
            <div className="text-2xl font-bold text-[var(--color-ink-deep)] mt-1">
              {formatPaise(summary?.cash_revenue_paise || 620000)}
            </div>
            <span className="text-[11px] text-[var(--color-slate)]">Door desk receipts</span>
          </div>
        </div>
      </div>
    </div>
  );
}
