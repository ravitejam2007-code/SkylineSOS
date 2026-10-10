import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { formatPaise } from '../../lib/formatters';
import { ButtonSpinner } from '../ui/LoadingState';
import { getActiveSession, getCurrentUserSession, type UserSession } from '../../lib/auth';
import type {
  Event,
  TicketType,
  Ticket,
} from '@campusone/contracts';

interface CuratedEvent {
  id: string;
  slug: string;
  title: string;
  venue: string;
  dateStr: string;
  timeStr: string;
  seatsLeft: number;
  imageUrl: string;
  description: string;
  titleColor?: string;
  ticketCategories: {
    id: string;
    name: string;
    available: number;
    memberPricePaise: number;
    nonMemberPricePaise: number;
  }[];
}

const DEFAULT_EVENTS: CuratedEvent[] = [
  {
    id: 'e3',
    slug: 'annual-tech-gala-2026',
    title: 'Annual Tech Gala & Hackathon 2026',
    venue: 'Skyline Auditorium Hall A',
    dateStr: '17 Oct 2026',
    timeStr: '23:40',
    seatsLeft: 186,
    imageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
    description:
      'The flagship university technical gathering featuring keynote speakers, hackathon project showcases, and student awards banquet.',
    titleColor: 'text-[#0064e0]',
    ticketCategories: [
      {
        id: 'tt_delegate_pass',
        name: 'Standard Delegate Pass',
        available: 138,
        memberPricePaise: 15000,
        nonMemberPricePaise: 30000,
      },
      {
        id: 'tt_vip_banquet',
        name: 'VIP & Networking Banquet',
        available: 48,
        memberPricePaise: 40000,
        nonMemberPricePaise: 60000,
      },
    ],
  },
  {
    id: 'e4',
    slug: 'robotics-ai-summit-2026',
    title: 'Autonomous Robotics & AI Summit',
    venue: 'Innovation Hub, Lab 3',
    dateStr: '24 Oct 2026',
    timeStr: '23:40',
    seatsLeft: 94,
    imageUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1200&q=80',
    description:
      'Hands-on exhibition with microcontrollers, ROS2 robotics frameworks, and computer vision competitions.',
    titleColor: 'text-[#0f172a]',
    ticketCategories: [
      {
        id: 'tt_summit_pass',
        name: 'Summit Student Pass',
        available: 94,
        memberPricePaise: 0,
        nonMemberPricePaise: 20000,
      },
    ],
  },
];

export default function EventsScene() {
  const [session, setSession] = useState<UserSession | null>(() => {
    if (typeof window !== 'undefined') return getActiveSession();
    return null;
  });

  const [curatedEvents, setCuratedEvents] = useState<CuratedEvent[]>(DEFAULT_EVENTS);
  const [selectedEvent, setSelectedEvent] = useState<CuratedEvent | null>(null);
  const [selectedTicketCategory, setSelectedTicketCategory] = useState<CuratedEvent['ticketCategories'][0] | null>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [isBuying, setIsBuying] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);

  // Staff tools & check-in state
  const [showStaffTools, setShowStaffTools] = useState(false);
  const [checkInToken, setCheckInToken] = useState('482915');
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkInResult, setCheckInResult] = useState<{
    success: boolean;
    message: string;
    attendee?: string;
  } | null>(null);

  const [doorAttendeeName, setDoorAttendeeName] = useState('');
  const [doorSelectedEventId, setDoorSelectedEventId] = useState('e3');
  const [isSellingDoor, setIsSellingDoor] = useState(false);
  const [doorSaleSuccess, setDoorSaleSuccess] = useState<string | null>(null);

  // Load real API data and merge where available
  useEffect(() => {
    const loadBackendEvents = async () => {
      try {
        const evts = await api.getEvents();
        if (evts && evts.length > 0) {
          // Reconcile real backend IDs into curated events
          setCuratedEvents((prev) =>
            prev.map((curated, idx) => {
              const matched = evts[idx] || evts[0];
              if (!matched) return curated;
              return {
                ...curated,
                id: matched.id,
                slug: matched.slug || curated.slug,
              };
            })
          );
        }
      } catch (err) {
        console.warn('API events fallback to curated data:', err);
      }
    };

    loadBackendEvents();

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

  const openReservationModal = (event: CuratedEvent, category?: CuratedEvent['ticketCategories'][0]) => {
    setSelectedEvent(event);
    setSelectedTicketCategory(category || event.ticketCategories[0]);
    setPurchaseQuantity(1);
    setPurchaseSuccess(null);
  };

  const handleBuyPass = async () => {
    if (!selectedEvent || !selectedTicketCategory) return;
    setIsBuying(true);
    try {
      const isMember = Boolean(session && session.role !== 'guest');
      const attendeeName = session?.fullName
        ? `${session.fullName} (${isMember ? 'Active Member' : 'Guest Pass'})`
        : 'Siddharth Rao (Student Pass)';

      const res = await api.buyTicket({
        event_id: selectedEvent.id,
        ticket_type_id: selectedTicketCategory.id,
        quantity: purchaseQuantity,
        payment_method: 'online',
        attendee_name: attendeeName,
      });

      setPurchaseSuccess(
        `Pass successfully reserved! Ticket code: ${res.ticket.qr_token || 'SKY-TKT-CONFIRMED'}`
      );
      setSelectedEvent(null);
    } catch (err: any) {
      alert(err.message || 'Payment initiation failed');
    } finally {
      setIsBuying(false);
    }
  };

  // Handle staff gate check-in
  const handleCheckIn = async () => {
    setIsCheckingIn(true);
    try {
      const res = await api.checkInTicket({
        eventId: curatedEvents[0]?.id,
        code: checkInToken.trim(),
      });
      setCheckInResult({
        success: true,
        message: `Admitted: ${res.attendee_name || 'Attendee'}`,
        attendee: res.attendee_name,
      });
    } catch (err: any) {
      setCheckInResult({
        success: false,
        message: err.message || 'Check-in failed',
      });
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Handle staff cash door sale
  const handleCashDoorSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doorAttendeeName.trim()) return;
    setIsSellingDoor(true);
    try {
      const targetEvent = curatedEvents.find((e) => e.id === doorSelectedEventId) || curatedEvents[0];
      const targetCategory = targetEvent.ticketCategories[0];
      const res = await api.buyTicket({
        event_id: targetEvent.id,
        ticket_type_id: targetCategory.id,
        quantity: 1,
        payment_method: 'cash',
        attendee_name: `${doorAttendeeName} (Staff Cash Desk)`,
      });
      setDoorSaleSuccess(`Cash ticket issued for ${doorAttendeeName} (${res.ticket.qr_token})!`);
      setDoorAttendeeName('');
    } catch (err: any) {
      alert(err.message || 'Failed to record door sale');
    } finally {
      setIsSellingDoor(false);
    }
  };

  const isMember = Boolean(session && session.role !== 'guest');

  return (
    <div className="space-y-12">
      {/* Toast Feedback */}
      {purchaseSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex justify-between items-center text-sm shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">✓</span>
            <span className="font-semibold">{purchaseSuccess}</span>
          </div>
          <button
            onClick={() => setPurchaseSuccess(null)}
            className="text-xs font-bold underline cursor-pointer text-emerald-700 hover:text-emerald-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ─── 2-COLUMN EVENT CARDS GRID (EXACT SCREENSHOT LAYOUT) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {curatedEvents.map((evt) => (
          <div
            key={evt.id}
            className="bg-white rounded-[28px] border border-[#e2e8f0] shadow-xs hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col justify-between"
          >
            {/* Top Media Banner */}
            <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-slate-900">
              <img
                src={evt.imageUrl}
                alt={evt.title}
                className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700 ease-out"
                loading="lazy"
              />

              {/* Date Pill (Top Left) */}
              <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-xs text-[#0f172a] text-xs font-bold px-3.5 py-1.5 rounded-full shadow-sm">
                {evt.dateStr}
              </div>

              {/* Seats Left Pill (Top Right, Vibrant Cobalt) */}
              <div className="absolute top-4 right-4 bg-[#0064e0] text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-sm">
                {evt.seatsLeft} Seats Left
              </div>

              {/* Sparkle Icon (Bottom Right of First Event) */}
              {evt.id === 'e3' && (
                <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-xs text-white p-1.5 rounded-full text-xs flex items-center justify-center">
                  ✨
                </div>
              )}
            </div>

            {/* Event Content Body */}
            <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between">
              <div>
                {/* Title */}
                <h2
                  className={`text-xl sm:text-2xl font-bold tracking-tight cursor-pointer hover:underline transition-colors ${
                    evt.titleColor || 'text-[#0f172a]'
                  }`}
                  onClick={() => openReservationModal(evt)}
                >
                  {evt.title}
                </h2>

                {/* Venue & Time with Coral Location Pin */}
                <div className="flex items-center gap-1.5 text-xs text-[#64748b] font-medium mt-1.5">
                  <span className="text-[#f43f5e]">📍</span>
                  <span>
                    {evt.venue} • {evt.timeStr}
                  </span>
                </div>

                {/* Description */}
                <p className="text-sm text-[#475569] mt-3 leading-relaxed">
                  {evt.description}
                </p>

                {/* Divider Line */}
                <div className="border-t border-[#f1f5f9] my-5" />

                {/* Ticket Categories Header */}
                <div className="text-[11px] font-bold tracking-wider text-[#94a3b8] uppercase mb-3">
                  TICKET CATEGORIES
                </div>

                {/* Ticket Category Items */}
                <div className="space-y-2 mb-6">
                  {evt.ticketCategories.map((category) => (
                    <div
                      key={category.id}
                      onClick={() => openReservationModal(evt, category)}
                      className="p-3.5 rounded-xl border border-[#e2e8f0]/80 bg-[#f8fafc] hover:bg-[#f1f5f9] hover:border-[#cbd5e1] transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <div className="text-[13px] font-semibold text-[#0f172a]">
                          {category.name}
                        </div>
                        <div className="text-[11px] text-[#94a3b8] font-medium">
                          {category.available} available
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[14px] font-bold text-[#0064e0]">
                          ₹{category.memberPricePaise / 100}{' '}
                          <span className="text-[11px] font-medium text-[#64748b]">(Member)</span>
                        </div>
                        <div className="text-[11px] text-[#94a3b8] line-through">
                          ₹{category.nonMemberPricePaise / 100} (Non-member)
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Full-width Cobalt CTA Button */}
              <button
                type="button"
                onClick={() => openReservationModal(evt)}
                className="w-full py-3.5 px-6 rounded-full font-semibold text-white bg-[#0064e0] hover:bg-[#0052b8] active:scale-[0.99] transition-all text-sm shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                Reserve Event Passes →
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ─── RESERVATION & CHECKOUT MODAL ─── */}
      {selectedEvent && selectedTicketCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative border border-slate-100">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold text-[#0064e0] uppercase tracking-wider">
                  Pass Reservation
                </span>
                <h3 className="text-xl font-bold text-[#0f172a] mt-0.5">{selectedEvent.title}</h3>
                <p className="text-xs text-[#64748b]">{selectedEvent.venue} • {selectedEvent.dateStr}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-black flex items-center justify-center text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Category Selector */}
              <div>
                <label className="block text-xs font-bold text-[#0f172a] mb-2 uppercase tracking-wide">
                  Select Ticket Type
                </label>
                <div className="space-y-2">
                  {selectedEvent.ticketCategories.map((cat) => (
                    <div
                      key={cat.id}
                      onClick={() => setSelectedTicketCategory(cat)}
                      className={`p-3 rounded-xl border flex justify-between items-center cursor-pointer transition-all ${
                        selectedTicketCategory.id === cat.id
                          ? 'border-[#0064e0] bg-blue-50/50 ring-1 ring-[#0064e0]'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-bold text-[#0f172a]">{cat.name}</div>
                        <div className="text-xs text-[#64748b]">{cat.available} passes remaining</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-[#0064e0]">
                          ₹{isMember ? cat.memberPricePaise / 100 : cat.nonMemberPricePaise / 100}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {isMember ? 'Member Rate' : 'Standard Rate'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quantity Picker */}
              <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-xs font-bold text-[#0f172a]">Number of Passes</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPurchaseQuantity(Math.max(1, purchaseQuantity - 1))}
                    className="w-8 h-8 rounded-full bg-white border border-slate-200 font-bold text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <span className="font-bold text-sm w-4 text-center">{purchaseQuantity}</span>
                  <button
                    type="button"
                    onClick={() => setPurchaseQuantity(Math.min(5, purchaseQuantity + 1))}
                    className="w-8 h-8 rounded-full bg-white border border-slate-200 font-bold text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Total Calculation */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
                <div className="flex justify-between text-xs text-[#64748b]">
                  <span>Unit Price</span>
                  <span>
                    ₹{((isMember ? selectedTicketCategory.memberPricePaise : selectedTicketCategory.nonMemberPricePaise) / 100)}
                  </span>
                </div>
                {isMember && selectedTicketCategory.memberPricePaise < selectedTicketCategory.nonMemberPricePaise && (
                  <div className="flex justify-between text-xs text-emerald-600 font-semibold">
                    <span>Active Member Discount</span>
                    <span>
                      -₹{(((selectedTicketCategory.nonMemberPricePaise - selectedTicketCategory.memberPricePaise) * purchaseQuantity) / 100)}
                    </span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-2 flex justify-between text-base font-extrabold text-[#0f172a]">
                  <span>Total Amount</span>
                  <span className="text-[#0064e0]">
                    ₹{(((isMember ? selectedTicketCategory.memberPricePaise : selectedTicketCategory.nonMemberPricePaise) * purchaseQuantity) / 100)}
                  </span>
                </div>
              </div>

              {/* Confirm Checkout Button */}
              <button
                type="button"
                disabled={isBuying}
                onClick={handleBuyPass}
                className="w-full py-3.5 px-6 rounded-full font-bold text-white bg-[#0064e0] hover:bg-[#0052b8] active:scale-[0.99] transition-all text-sm shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isBuying ? <ButtonSpinner size={16} /> : `Confirm & Pay with Razorpay →`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── STAFF ACCORDION (GATE DESK & FLOAT CASH RECORDING) ─── */}
      <div className="border border-slate-200 rounded-3xl bg-slate-50/50 overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => setShowStaffTools(!showStaffTools)}
          className="w-full p-5 flex justify-between items-center text-left hover:bg-slate-100/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#0064e0]/10 text-[#0064e0]">
              Staff Console
            </span>
            <span className="text-sm font-bold text-[#0f172a]">
              Door 6-Digit Gate Check-In & Cash Desk Operations
            </span>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {showStaffTools ? '▲ Hide Staff Tools' : '▼ Show Staff Tools'}
          </span>
        </button>

        {showStaffTools && (
          <div className="p-6 md:p-8 border-t border-slate-200 bg-white grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Gate Check-In Desk */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-base font-bold text-[#0f172a]">Door Gate Verification</h4>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Instant Gate Pass
                </span>
              </div>
              <p className="text-xs text-[#64748b]">
                Enter attendee's 6-digit dynamic pass code or 8-character ticket code:
              </p>

              <div className="space-y-2">
                <input
                  type="text"
                  value={checkInToken}
                  onChange={(e) => setCheckInToken(e.target.value)}
                  placeholder="e.g. 482915"
                  className="w-full px-4 py-3 rounded-full border-2 border-slate-200 text-xl font-mono font-bold text-center tracking-widest text-[#0064e0] bg-white focus:outline-none focus:border-[#0064e0]"
                />
                <div className="flex justify-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setCheckInToken('482915')}
                    className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Preset: 482915 (Member)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckInToken('SKY-GALA-8492')}
                    className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Preset: SKY-GALA-8492 (Ticket)
                  </button>
                </div>
              </div>

              <button
                type="button"
                disabled={isCheckingIn}
                onClick={handleCheckIn}
                className="w-full py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {isCheckingIn ? <ButtonSpinner size={14} /> : 'Verify Code & Admit Attendee'}
              </button>

              {checkInResult && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold text-center ${
                    checkInResult.success
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-100 text-rose-800 border border-rose-200'
                  }`}
                >
                  {checkInResult.success ? `✓ ${checkInResult.message}` : `⚠ ${checkInResult.message}`}
                </div>
              )}
            </div>

            {/* Cash Float Sale Desk */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-base font-bold text-[#0f172a]">Cash Door Sale Desk</h4>
                <span className="text-[11px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full">
                  Cash Float
                </span>
              </div>
              <p className="text-xs text-[#64748b]">
                Record walk-up cash payments and generate immediate ticket codes:
              </p>

              <form onSubmit={handleCashDoorSale} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[#0f172a] mb-1">Attendee Name</label>
                  <input
                    type="text"
                    required
                    value={doorAttendeeName}
                    onChange={(e) => setDoorAttendeeName(e.target.value)}
                    placeholder="e.g. Siddharth Rao"
                    className="w-full px-3.5 py-2.5 rounded-full border border-slate-200 text-xs bg-white focus:outline-none focus:border-[#0064e0]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0f172a] mb-1">Target Event</label>
                  <select
                    value={doorSelectedEventId}
                    onChange={(e) => setDoorSelectedEventId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-full border border-slate-200 text-xs bg-white focus:outline-none focus:border-[#0064e0]"
                  >
                    {curatedEvents.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.title}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isSellingDoor}
                  className="w-full py-3 rounded-full bg-[#0f172a] hover:bg-black text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  {isSellingDoor ? <ButtonSpinner size={14} /> : 'Record Cash Sale & Issue Ticket'}
                </button>

                {doorSaleSuccess && (
                  <div className="p-3 rounded-xl text-xs font-bold text-center bg-emerald-100 text-emerald-800 border border-emerald-200">
                    ✓ {doorSaleSuccess}
                  </div>
                )}
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
