import { useState, useEffect } from 'react';
import { api, apiFetch } from '../../lib/api';
import { generateQrDataUrl } from '../../lib/qr';
import { ButtonSpinner } from '../ui/LoadingState';
import { getActiveSession, getCurrentUserSession, type UserSession } from '../../lib/auth';
import { openRazorpayCheckout } from '../../lib/razorpay';
import type {
  Event,
  TicketType,
  Ticket,
} from '@campusone/contracts';

export interface EventTicketPass {
  id: string;
  code: string;
  seat: string;
  otp: string;
  status: 'pending' | 'approved';
  holder_name: string;
  holder_email: string;
  event_id: string;
  event_title: string;
  tier_name: string;
  validity: string;
  created_at: string;
}

export interface CuratedEvent {
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

export const isSameEvent = (pass: EventTicketPass, targetEvent: CuratedEvent): boolean => {
  if (!pass || !targetEvent) return false;
  // If event titles match, it is the exact same event
  if (pass.event_title && targetEvent.title) {
    if (pass.event_title.trim().toLowerCase() === targetEvent.title.trim().toLowerCase()) {
      return true;
    }
  }
  // If event_ids match AND titles are not contradictory
  if (pass.event_id && targetEvent.id && pass.event_id === targetEvent.id) {
    if (pass.event_title && targetEvent.title) {
      return pass.event_title.trim().toLowerCase() === targetEvent.title.trim().toLowerCase();
    }
    return true;
  }
  return false;
};

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
    titleColor: 'text-black',
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

const SEED_APPLICATIONS: EventTicketPass[] = [
  {
    id: 'app-seed-01',
    code: 'TKT-CE7F38-46E6',
    seat: 'Seat #46E6',
    otp: '582914',
    status: 'pending',
    holder_name: 'Sarah Student',
    holder_email: 'student@studentorg.edu',
    event_id: 'e3',
    event_title: 'Annual Tech Gala & Hackathon 2026',
    tier_name: 'STANDARD DELEGATE PASS',
    validity: '11 Oct 2026',
    created_at: new Date().toISOString(),
  },
];

export default function EventsScene() {
  const [session, setSession] = useState<UserSession | null>(() => {
    if (typeof window !== 'undefined') return getActiveSession();
    return null;
  });

  const [curatedEvents, setCuratedEvents] = useState<CuratedEvent[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('skylinesos:curated_events');
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return DEFAULT_EVENTS;
  });

  const [selectedEvent, setSelectedEvent] = useState<CuratedEvent | null>(null);
  const [selectedTicketCategory, setSelectedTicketCategory] = useState<CuratedEvent['ticketCategories'][0] | null>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [isBuying, setIsBuying] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null);

  // New Event Modal State (Admin Only - Screenshots 011352 & 011447)
  const [showPostEventModal, setShowPostEventModal] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newEventVenue, setNewEventVenue] = useState('');
  const [newEventStart, setNewEventStart] = useState('17-10-2026 07:43 PM');
  const [newEventEnd, setNewEventEnd] = useState('18-10-2026 03:43 AM');
  const [newEventBanner, setNewEventBanner] = useState('https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1000&q=80');
  const [newEventCategories, setNewEventCategories] = useState<
    Array<{ id: string; name: string; quantity: number; memberPrice: number; nonMemberPrice: number; description: string }>
  >([
    {
      id: 'cat-1',
      name: 'Standard Delegate Pass',
      quantity: 100,
      memberPrice: 150,
      nonMemberPrice: 300,
      description: 'General entrance to all workshops & sessions',
    },
  ]);
  const [isPostingEvent, setIsPostingEvent] = useState(false);

  // User Ticket Passes & QR (Scoped strictly to authenticated user email for privacy)
  const getUserTicketsKey = (email?: string | null): string | null => {
    if (!email) return null;
    return `skylinesos:tickets_${email.trim().toLowerCase()}`;
  };

  const [myTicketPasses, setMyTicketPasses] = useState<EventTicketPass[]>(() => {
    if (typeof window !== 'undefined') {
      const active = getActiveSession();
      if (active?.email) {
        try {
          const userKey = `skylinesos:tickets_${active.email.trim().toLowerCase()}`;
          const stored = localStorage.getItem(userKey);
          if (stored) return JSON.parse(stored);
        } catch {}
      }
    }
    return []; // Empty by default! Fresh account has zero tickets.
  });
  const [qrUrls, setQrUrls] = useState<Record<string, string>>({});
  const [revealedOtps, setRevealedOtps] = useState<Record<string, boolean>>({});

  // Admin Console & Approval State (Screenshot 012208)
  const [ticketApplications, setTicketApplications] = useState<EventTicketPass[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('skylinesos:ticket_applications');
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return SEED_APPLICATIONS;
  });
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  const [approvalFeedback, setApprovalFeedback] = useState<{ success: boolean; message: string } | null>(null);

  // Dynamic Seats Decrement Calculations
  const getEventBookedCount = (eventId: string): number => {
    return ticketApplications.filter((t) => t.event_id === eventId).length;
  };

  const getEventRemainingSeats = (evt: CuratedEvent): number => {
    return Math.max(0, evt.seatsLeft - getEventBookedCount(evt.id));
  };

  const getCategoryBookedCount = (eventId: string, catName: string): number => {
    return ticketApplications.filter(
      (t) => t.event_id === eventId && t.tier_name?.trim().toLowerCase() === catName.trim().toLowerCase()
    ).length;
  };

  const getCategoryRemaining = (eventId: string, cat: { name: string; available: number }): number => {
    return Math.max(0, cat.available - getCategoryBookedCount(eventId, cat.name));
  };

  // Helper to load tickets strictly for the authenticated session
  const loadTicketsForSession = (currSession: UserSession | null) => {
    if (!currSession?.email) {
      setMyTicketPasses([]);
      return;
    }
    try {
      const userKey = `skylinesos:tickets_${currSession.email.trim().toLowerCase()}`;
      const stored = localStorage.getItem(userKey);
      if (stored) {
        setMyTicketPasses(JSON.parse(stored));
        return;
      }
    } catch {}
    // Fresh account: starts completely fresh with zero tickets!
    setMyTicketPasses([]);
  };

  // Load real API data and merge where available
  useEffect(() => {
    const loadBackendEvents = async () => {
      try {
        const evts = await api.getEvents();
        if (evts && evts.length > 0) {
          setCuratedEvents((prev) => {
            const updated = prev.map((curated) => {
              // Match strictly by exact slug or exact ID so distinct/new events are never overwritten with evts[0]!
              const matched = evts.find(
                (e) => (e.slug && curated.slug && e.slug === curated.slug) || e.id === curated.id
              );
              if (!matched) return curated;
              return {
                ...curated,
                id: matched.id,
                slug: matched.slug || curated.slug,
                seatsLeft: matched.capacity ? Math.max(0, matched.capacity - (matched.sold_count || 0)) : curated.seatsLeft,
              };
            });
            return updated;
          });
        }
      } catch (err) {
        console.warn('API events fallback to curated data:', err);
      }
    };

    loadBackendEvents();

    getCurrentUserSession().then((s) => {
      setSession(s);
      loadTicketsForSession(s);
    });

    const handleAuthChange = (e: CustomEvent) => {
      const updated = e.detail as UserSession | null;
      setSession(updated);
      loadTicketsForSession(updated);
    };

    const handleTicketsChanged = () => {
      const curr = getActiveSession();
      loadTicketsForSession(curr);
      try {
        const storedApps = localStorage.getItem('skylinesos:ticket_applications');
        if (storedApps) setTicketApplications(JSON.parse(storedApps));
      } catch {}
    };

    window.addEventListener('campusone:auth_changed' as any, handleAuthChange);
    window.addEventListener('campusone:tickets_updated' as any, handleTicketsChanged);
    return () => {
      window.removeEventListener('campusone:auth_changed' as any, handleAuthChange);
      window.removeEventListener('campusone:tickets_updated' as any, handleTicketsChanged);
    };
  }, []);

  // Generate QR code for every student ticket
  useEffect(() => {
    myTicketPasses.forEach((pass) => {
      if (!qrUrls[pass.id]) {
        const qrData = JSON.stringify({
          ticket: pass.code,
          seat: pass.seat,
          otp: pass.otp,
          event: pass.event_title,
          status: pass.status,
          holder: pass.holder_name,
          verification: 'SkylineSOS Official Gate Token',
        });
        generateQrDataUrl(qrData, { width: 200 }).then((url) => {
          setQrUrls((prev) => ({ ...prev, [pass.id]: url }));
        });
      }
    });
  }, [myTicketPasses]);

  // Handle Admin Add Category in New Event Form
  const handleAddCategory = () => {
    const nextNum = newEventCategories.length + 1;
    setNewEventCategories((prev) => [
      ...prev,
      {
        id: `cat-${Date.now()}`,
        name: nextNum === 2 ? 'VIP & Networking Banquet' : `Special Admission #${nextNum}`,
        quantity: 50,
        memberPrice: 400,
        nonMemberPrice: 600,
        description: 'Reserved seating plus executive dinner',
      },
    ]);
  };

  // Handle Admin Remove Category
  const handleRemoveCategory = (id: string) => {
    if (newEventCategories.length <= 1) return;
    setNewEventCategories((prev) => prev.filter((c) => c.id !== id));
  };

  // Handle Admin Publish Event Form Submit (Screenshots 011352 & 011447)
  const handlePublishNewEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim() || !newEventVenue.trim()) return;
    setIsPostingEvent(true);
    try {
      const totalSeats = newEventCategories.reduce((acc, c) => acc + (Number(c.quantity) || 0), 0) || 150;
      const createdEvt: CuratedEvent = {
        id: `evt-${Date.now()}`,
        slug: newEventTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        title: newEventTitle.trim(),
        venue: newEventVenue.trim(),
        dateStr: newEventStart.split(' ')[0] || '20 Oct 2026',
        timeStr: newEventStart.split(' ').slice(1).join(' ') || '19:00',
        seatsLeft: totalSeats,
        imageUrl: newEventBanner.trim() || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1000&q=80',
        description: newEventDescription.trim() || 'Student Organization official gathering and presentation.',
        titleColor: 'text-[#0f172a]',
        ticketCategories: newEventCategories.map((c, idx) => ({
          id: `tt-${Date.now()}-${idx}`,
          name: c.name || `Category #${idx + 1}`,
          available: Number(c.quantity) || 50,
          memberPricePaise: (Number(c.memberPrice) || 0) * 100,
          nonMemberPricePaise: (Number(c.nonMemberPrice) || 0) * 100,
        })),
      };

      const updated = [createdEvt, ...curatedEvents];
      setCuratedEvents(updated);
      try {
        localStorage.setItem('skylinesos:curated_events', JSON.stringify(updated));
      } catch {}

      setShowPostEventModal(false);
      setNewEventTitle('');
      setNewEventDescription('');
      setNewEventVenue('');
      setPurchaseSuccess(`Event "${createdEvt.title}" successfully published to campus calendar!`);
      setTimeout(() => setPurchaseSuccess(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Failed to publish event');
    } finally {
      setIsPostingEvent(false);
    }
  };

  // Handle Admin Delete Event (Screenshot user request)
  const handleDeleteEvent = (eventId: string, eventTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${eventTitle}"? This cannot be undone.`)) {
      return;
    }
    const updated = curatedEvents.filter((e) => e.id !== eventId);
    setCuratedEvents(updated);
    try {
      localStorage.setItem('skylinesos:curated_events', JSON.stringify(updated));
    } catch {}
    setPurchaseSuccess(`Event "${eventTitle}" deleted successfully from campus calendar.`);
    setTimeout(() => setPurchaseSuccess(null), 4000);
  };

  // Open reservation modal
  const openReservationModal = (event: CuratedEvent, category?: CuratedEvent['ticketCategories'][0]) => {
    if (!session) {
      window.location.href = '/login';
      return;
    }

    // Constraint: Check if event is completely sold out
    const remainingSeats = getEventRemainingSeats(event);
    if (remainingSeats <= 0) {
      alert(`Sorry! "${event.title}" is completely full (0 seats remaining). Passes can no longer be reserved.`);
      return;
    }

    // If specific category requested, check its availability
    if (category && getCategoryRemaining(event.id, category) <= 0) {
      alert(`Sorry! The tier "${category.name}" is completely full.`);
      return;
    }

    // Constraint: 1 ticket per event per student account (strict per-event matching)
    const alreadyReserved = myTicketPasses.find((p) => isSameEvent(p, event));
    if (alreadyReserved) {
      alert(`You have already generated a ticket for "${event.title}" (${alreadyReserved.seat}). Each student is limited to 1 ticket reservation per event.`);
      return;
    }

    setSelectedEvent(event);
    setSelectedTicketCategory(category || event.ticketCategories[0]);
    setPurchaseQuantity(1);
    setPurchaseSuccess(null);
  };

  // Student Reserve Pass & Generate QR Code & OTP (Screenshot 011914)
  const handleBuyPass = async () => {
    if (!selectedEvent || !selectedTicketCategory) return;
    if (!session) {
      window.location.href = '/login';
      return;
    }

    // Check overall seats
    const remainingSeats = getEventRemainingSeats(selectedEvent);
    if (remainingSeats <= 0) {
      alert(`Sorry! Seats for "${selectedEvent.title}" are full. Ticket cannot be generated.`);
      setSelectedEvent(null);
      return;
    }

    // Check category seats
    const catRemaining = getCategoryRemaining(selectedEvent.id, selectedTicketCategory);
    if (catRemaining <= 0) {
      alert(`Sorry! The selected category "${selectedTicketCategory.name}" is sold out.`);
      return;
    }

    // Double check 1 ticket limit per event (strict per-event matching)
    const alreadyReserved = myTicketPasses.find((p) => isSameEvent(p, selectedEvent));
    if (alreadyReserved) {
      alert(`You have already generated a ticket for "${selectedEvent.title}" (${alreadyReserved.seat}). Each student is limited to 1 ticket reservation per event.`);
      setSelectedEvent(null);
      return;
    }

    setIsBuying(true);
    try {
      const isMember = Boolean(session && session.role !== 'guest');
      const attendeeName = session.fullName || 'Sarah Student';
      const attendeeEmail = session.email || 'student@studentorg.edu';

      // Calculate price: member discounted vs standard rate
      const pricePaise = isMember
        ? selectedTicketCategory.memberPricePaise
        : selectedTicketCategory.nonMemberPricePaise;
      const isNominalTest = pricePaise === 0;
      const chargeAmountPaise = pricePaise > 0 ? pricePaise : 100; // Razorpay requires >= 100 paise (₹1.00)

      // Step 1: Open Razorpay Payment Gateway Modal (Test Mode)
      const paymentResult = await openRazorpayCheckout({
        amountPaise: chargeAmountPaise,
        name: 'Skyline Student Association',
        description: `${selectedEvent.title} — ${selectedTicketCategory.name}${isNominalTest ? ' (Test Gateway Verification)' : ''}`,
        prefill: {
          name: attendeeName,
          email: attendeeEmail,
        },
        notes: {
          event_id: selectedEvent.id,
          event_title: selectedEvent.title,
          category_id: selectedTicketCategory.id,
          category_name: selectedTicketCategory.name,
          user_email: attendeeEmail,
        },
      });

      // Step 2: Only upon successful payment settlement, generate distinct ticket
      const hexSuffix = Math.floor(0x1000 + Math.random() * 0xefff).toString(16).toUpperCase();
      const assignedSeat = `Seat #${hexSuffix}`;
      const cleanEventPrefix = (selectedEvent.slug || selectedEvent.id || 'EVT')
        .replace(/^evt-/, '')
        .slice(0, 8)
        .toUpperCase();
      const ticketCode = `TKT-${cleanEventPrefix}-${hexSuffix}`;
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

      const newPass: EventTicketPass = {
        id: `tkt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        code: ticketCode,
        seat: assignedSeat,
        otp: generatedOtp,
        status: 'pending',
        holder_name: attendeeName,
        holder_email: attendeeEmail,
        event_id: selectedEvent.id,
        event_title: selectedEvent.title,
        tier_name: selectedTicketCategory.name,
        validity: selectedEvent.dateStr || '11 Oct 2026',
        created_at: new Date().toISOString(),
      };

      (newPass as any).payment_id = paymentResult.paymentId;
      (newPass as any).amount_paid_paise = paymentResult.amountPaise;

      // Add to user ticket passes array scoped strictly to attendee email
      const updatedPasses = [newPass, ...myTicketPasses.filter((p) => p.id !== newPass.id)];
      setMyTicketPasses(updatedPasses);
      if (attendeeEmail) {
        const userKey = getUserTicketsKey(attendeeEmail);
        if (userKey) {
          try {
            localStorage.setItem(userKey, JSON.stringify(updatedPasses));
          } catch {}
        }
      }

      // Add to admin ticket applications so admin can review and enter OTP at door
      const updatedApplications = [newPass, ...ticketApplications.filter((a) => a.id !== newPass.id)];
      setTicketApplications(updatedApplications);
      try {
        localStorage.setItem('skylinesos:ticket_applications', JSON.stringify(updatedApplications));
      } catch {}

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('campusone:tickets_updated', { detail: updatedPasses }));
      }

      setPurchaseSuccess(
        `Payment successful via Razorpay (ID: ${paymentResult.paymentId})! Pass reserved for ${selectedEvent.title}. Your ticket is ${newPass.code}. Door OTP is securely encoded in QR.`
      );
      setSelectedEvent(null);
    } catch (err: any) {
      alert(err.message || 'Payment was not completed. Ticket was not generated.');
    } finally {
      setIsBuying(false);
    }
  };

  // Student Delete/Cancel Ticket (User request)
  const handleDeleteTicket = (ticketId: string, eventTitle: string) => {
    if (!confirm(`Are you sure you want to cancel and delete your ticket for "${eventTitle}"? This will release your reserved seat.`)) {
      return;
    }
    const updatedPasses = myTicketPasses.filter((p) => p.id !== ticketId);
    setMyTicketPasses(updatedPasses);
    if (session?.email) {
      const userKey = getUserTicketsKey(session.email);
      if (userKey) {
        try {
          localStorage.setItem(userKey, JSON.stringify(updatedPasses));
        } catch {}
      }
    }
    // Also remove from admin applications
    const updatedApps = ticketApplications.filter((a) => a.id !== ticketId);
    setTicketApplications(updatedApps);
    try {
      localStorage.setItem('skylinesos:ticket_applications', JSON.stringify(updatedApps));
    } catch {}

    setPurchaseSuccess(`Ticket for "${eventTitle}" has been cancelled and deleted.`);
    setTimeout(() => setPurchaseSuccess(null), 4000);
    window.dispatchEvent(new CustomEvent('campusone:tickets_updated'));
  };

  // Admin approves ticket via OTP (Screenshot 012208)
  const handleApproveOtp = (app: EventTicketPass) => {
    const entered = (otpInputs[app.id] || '').trim();
    if (!entered) {
      setApprovalFeedback({
        success: false,
        message: 'Please enter the attendee OTP before clicking Approve.',
      });
      setTimeout(() => setApprovalFeedback(null), 3500);
      return;
    }

    if (entered === app.otp) {
      // Correct OTP Match!
      const updatedApps = ticketApplications.map((item) =>
        item.id === app.id ? { ...item, status: 'approved' as const } : item
      );
      setTicketApplications(updatedApps);
      try {
        localStorage.setItem('skylinesos:ticket_applications', JSON.stringify(updatedApps));
      } catch {}

      // Update attendee's private ticket storage
      if (app.holder_email) {
        const attendeeKey = getUserTicketsKey(app.holder_email);
        if (attendeeKey) {
          try {
            const attendeePasses = JSON.parse(localStorage.getItem(attendeeKey) || '[]');
            const updatedAttendeePasses = attendeePasses.map((p: EventTicketPass) =>
              p.id === app.id || p.code === app.code ? { ...p, status: 'approved' as const } : p
            );
            localStorage.setItem(attendeeKey, JSON.stringify(updatedAttendeePasses));
          } catch {}
        }
      }

      // If current active session is the ticket holder, update state directly
      if (session?.email?.toLowerCase() === app.holder_email?.toLowerCase()) {
        const updatedStudentPasses = myTicketPasses.map((p) =>
          p.id === app.id || p.code === app.code ? { ...p, status: 'approved' as const } : p
        );
        setMyTicketPasses(updatedStudentPasses);
      }

      setApprovalFeedback({
        success: true,
        message: `OTP Verified! Ticket for ${app.holder_name} (${app.seat}) approved successfully! Attendee admitted.`,
      });
      setTimeout(() => setApprovalFeedback(null), 4500);

      window.dispatchEvent(new CustomEvent('campusone:tickets_updated'));
    } else {
      // Incorrect OTP!
      setApprovalFeedback({
        success: false,
        message: `Invalid OTP "${entered}"! Please check the attendee's QR code or code pass.`,
      });
      setTimeout(() => setApprovalFeedback(null), 4000);
    }
  };

  const handleRefreshApplications = () => {
    try {
      const stored = localStorage.getItem('skylinesos:ticket_applications');
      if (stored) setTicketApplications(JSON.parse(stored));
    } catch {}
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

      {/* ─── TOP BAR: ADMIN ONLY "+ Post New Event" BUTTON ─── */}
      {session?.role === 'admin' && (
        <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-pink-100 text-pink-700">
              Admin Terminal
            </span>
            <span className="text-xs text-[#64748b] font-medium">
              Create, configure ticket tiers, and publish official campus events.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowPostEventModal(true)}
            className="px-5 py-2.5 rounded-full bg-black hover:bg-slate-900 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            <span>+ Post New Event</span>
          </button>
        </div>
      )}

      {/* ─── 2-COLUMN EVENT CARDS GRID ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {curatedEvents.map((evt) => {
          const bookedCount = getEventBookedCount(evt.id);
          const remainingSeats = getEventRemainingSeats(evt);
          const isSoldOut = remainingSeats <= 0;
          const myTicketForThisEvent = myTicketPasses.find((p) => isSameEvent(p, evt));

          return (
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

                {/* Seats Left Pill (Top Right, Vibrant Cobalt or Sold Out Red) */}
                <div
                  className={`absolute top-4 right-4 text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-sm flex items-center gap-1.5 ${
                    isSoldOut ? 'bg-rose-600' : 'bg-black'
                  }`}
                >
                  {isSoldOut ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      <span>Seats Full · Sold Out</span>
                    </>
                  ) : (
                    <span>{remainingSeats} Seats Left</span>
                  )}
                </div>

                {/* Featured Star Icon */}
                {evt.id === 'e3' && (
                  <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-xs text-white p-1.5 rounded-full text-xs flex items-center justify-center">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
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
                    onClick={() => !isSoldOut && openReservationModal(evt)}
                  >
                    {evt.title}
                  </h2>

                  {/* Venue & Time with Coral Location Pin */}
                  <div className="flex items-center gap-1.5 text-xs text-[#64748b] font-medium mt-1.5">
                    <svg className="w-3.5 h-3.5 text-[#f43f5e] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
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
                    {evt.ticketCategories.map((category) => {
                      const catRemaining = getCategoryRemaining(evt.id, category);
                      const isCatFull = catRemaining <= 0 || isSoldOut;

                      return (
                        <div
                          key={category.id}
                          onClick={() => {
                            if (!isCatFull) openReservationModal(evt, category);
                          }}
                          className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                            isCatFull
                              ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                              : 'border-[#e2e8f0]/80 bg-[#f8fafc] hover:bg-[#f1f5f9] hover:border-[#cbd5e1] cursor-pointer'
                          }`}
                        >
                          <div>
                            <div className="text-[13px] font-semibold text-[#0f172a]">
                              {category.name}
                            </div>
                            <div className="text-[11px] font-medium">
                              {isCatFull ? (
                                <span className="text-rose-500 font-bold">Seats full · Sold out</span>
                              ) : (
                                <span className="text-[#94a3b8]">{catRemaining} available</span>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-[14px] font-bold text-black">
                              ₹{category.memberPricePaise / 100}{' '}
                              <span className="text-[11px] font-medium text-[#64748b]">(Member)</span>
                            </div>
                            <div className="text-[11px] text-[#94a3b8] line-through">
                              ₹{category.nonMemberPricePaise / 100} (Non-member)
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Full-width Cobalt CTA Button + Admin Delete */}
                <div className="flex items-center gap-2">
                  {isSoldOut ? (
                    <button
                      type="button"
                      disabled
                      className="flex-1 py-3.5 px-6 rounded-full font-semibold text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed text-sm flex items-center justify-center gap-2"
                    >
                      Seats Full · Ticket Sold Out
                    </button>
                  ) : myTicketForThisEvent ? (
                    <a
                      href="#my-tickets"
                      className="flex-1 py-3.5 px-6 rounded-full font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 active:scale-[0.99] transition-all text-sm shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Ticket Generated ({myTicketForThisEvent.seat}) · View in Wallet ↓</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openReservationModal(evt)}
                      className="flex-1 py-3.5 px-6 rounded-full font-semibold text-white bg-black hover:bg-slate-900 active:scale-[0.99] transition-all text-sm shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      Reserve Event Passes →
                    </button>
                  )}
                  {session?.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => handleDeleteEvent(evt.id, evt.title)}
                      className="p-3.5 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors shadow-2xs flex items-center justify-center cursor-pointer shrink-0"
                      title="Delete Event (Admin Only)"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── MODAL: CONDUCT & POST NEW EVENT (ADMIN ONLY - SCREENSHOTS 011352 & 011447) ─── */}
      {showPostEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative my-8 border border-slate-100 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-black border border-slate-200">
                  Admin & Staff Terminal
                </span>
                <h3 className="text-2xl font-bold text-[#0f172a] mt-1.5">Conduct & Post New Event</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPostEventModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-black flex items-center justify-center text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePublishNewEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#0f172a] mb-1 uppercase tracking-wide">
                  EVENT TITLE *
                </label>
                <input
                  type="text"
                  required
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="e.g. National Student AI Summit 2026"
                  className="w-full px-4 py-2.5 rounded-full border border-slate-200 text-sm focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0f172a] mb-1 uppercase tracking-wide">
                  EVENT DESCRIPTION *
                </label>
                <textarea
                  rows={3}
                  required
                  value={newEventDescription}
                  onChange={(e) => setNewEventDescription(e.target.value)}
                  placeholder="Comprehensive details regarding the event, schedule, keynote guests..."
                  className="w-full p-4 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0f172a] mb-1 uppercase tracking-wide">
                  VENUE / LOCATION *
                </label>
                <input
                  type="text"
                  required
                  value={newEventVenue}
                  onChange={(e) => setNewEventVenue(e.target.value)}
                  placeholder="e.g. Main Auditorium Hall A, Campus North"
                  className="w-full px-4 py-2.5 rounded-full border border-slate-200 text-sm focus:outline-none focus:border-black"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#0f172a] mb-1 uppercase tracking-wide">
                    START DATE & TIME *
                  </label>
                  <input
                    type="text"
                    required
                    value={newEventStart}
                    onChange={(e) => setNewEventStart(e.target.value)}
                    placeholder="17-10-2026 07:43 PM"
                    className="w-full px-4 py-2.5 rounded-full border border-slate-200 text-sm focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#0f172a] mb-1 uppercase tracking-wide">
                    END DATE & TIME *
                  </label>
                  <input
                    type="text"
                    required
                    value={newEventEnd}
                    onChange={(e) => setNewEventEnd(e.target.value)}
                    placeholder="18-10-2026 03:43 AM"
                    className="w-full px-4 py-2.5 rounded-full border border-slate-200 text-sm focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0f172a] mb-1 uppercase tracking-wide">
                  BANNER IMAGE URL
                </label>
                <input
                  type="url"
                  value={newEventBanner}
                  onChange={(e) => setNewEventBanner(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1000&q=80"
                  className="w-full px-4 py-2.5 rounded-full border border-slate-200 text-sm focus:outline-none focus:border-black"
                />
              </div>

              {/* TICKET CATEGORIES & PRICING */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#0f172a] uppercase tracking-wide">
                      TICKET CATEGORIES & PRICING
                    </h4>
                    <p className="text-[11px] text-[#64748b]">
                      Configure ticket categories, prices (member vs non-member), and available tickets.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="px-3 py-1 rounded-full border border-slate-200 hover:bg-slate-50 text-xs font-bold text-[#0f172a] cursor-pointer"
                  >
                    + Add Category
                  </button>
                </div>

                <div className="space-y-3">
                  {newEventCategories.map((cat, idx) => (
                    <div key={cat.id} className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#0f172a] uppercase tracking-wider">
                          TICKET CATEGORY #{idx + 1}
                        </span>
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCategory(cat.id)}
                            className="text-xs font-bold text-red-600 hover:underline cursor-pointer"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-[#334155] mb-1">CATEGORY NAME *</label>
                          <input
                            type="text"
                            required
                            value={cat.name}
                            onChange={(e) =>
                              setNewEventCategories((prev) =>
                                prev.map((c) => (c.id === cat.id ? { ...c, name: e.target.value } : c))
                              )
                            }
                            placeholder="Standard Delegate Pass"
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:border-black"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-[#334155] mb-1">
                            TOTAL QUANTITY / SEATS *
                          </label>
                          <input
                            type="number"
                            required
                            min={1}
                            value={cat.quantity}
                            onChange={(e) =>
                              setNewEventCategories((prev) =>
                                prev.map((c) => (c.id === cat.id ? { ...c, quantity: Number(e.target.value) } : c))
                              )
                            }
                            placeholder="100"
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:border-black"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-[#334155] mb-1">MEMBER PRICE (₹) *</label>
                          <input
                            type="number"
                            required
                            min={0}
                            value={cat.memberPrice}
                            onChange={(e) =>
                              setNewEventCategories((prev) =>
                                prev.map((c) => (c.id === cat.id ? { ...c, memberPrice: Number(e.target.value) } : c))
                              )
                            }
                            placeholder="150"
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:border-black"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-[#334155] mb-1">
                            NON-MEMBER PRICE (₹) *
                          </label>
                          <input
                            type="number"
                            required
                            min={0}
                            value={cat.nonMemberPrice}
                            onChange={(e) =>
                              setNewEventCategories((prev) =>
                                prev.map((c) => (c.id === cat.id ? { ...c, nonMemberPrice: Number(e.target.value) } : c))
                              )
                            }
                            placeholder="300"
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:border-black"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[#334155] mb-1">CATEGORY DESCRIPTION</label>
                        <input
                          type="text"
                          value={cat.description}
                          onChange={(e) =>
                            setNewEventCategories((prev) =>
                              prev.map((c) => (c.id === cat.id ? { ...c, description: e.target.value } : c))
                            )
                          }
                          placeholder="General entrance to all workshops & sessions"
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:border-black"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPostEventModal(false)}
                  className="flex-1 py-3 rounded-full border border-slate-200 text-xs sm:text-sm font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPostingEvent}
                  className="flex-1 py-3 rounded-full bg-black hover:bg-slate-900 text-white text-xs sm:text-sm font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isPostingEvent ? <ButtonSpinner size={16} /> : 'Publish & Conduct Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── RESERVATION & CHECKOUT MODAL ─── */}
      {selectedEvent && selectedTicketCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative border border-slate-100">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold text-black uppercase tracking-wider">
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
                  {selectedEvent.ticketCategories.map((cat) => {
                    const catRemaining = getCategoryRemaining(selectedEvent.id, cat);
                    const isCatFull = catRemaining <= 0;

                    return (
                      <div
                        key={cat.id}
                        onClick={() => {
                          if (!isCatFull) setSelectedTicketCategory(cat);
                        }}
                        className={`p-3 rounded-xl border flex justify-between items-center transition-all ${
                          isCatFull
                            ? 'border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed'
                            : selectedTicketCategory.id === cat.id
                            ? 'border-black bg-slate-50 ring-1 ring-black cursor-pointer'
                            : 'border-slate-200 hover:border-slate-300 bg-white cursor-pointer'
                        }`}
                      >
                        <div>
                          <div className="text-sm font-bold text-[#0f172a]">{cat.name}</div>
                          <div className="text-xs text-[#64748b]">
                            {isCatFull ? (
                              <span className="text-rose-500 font-semibold">Seats full · Sold out</span>
                            ) : (
                              `${catRemaining} passes remaining`
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-black">
                            ₹{isMember ? cat.memberPricePaise / 100 : cat.nonMemberPricePaise / 100}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {isMember ? 'Member Rate' : 'Standard Rate'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                      -₹{(((selectedTicketCategory.nonMemberPricePaise - selectedTicketCategory.memberPricePaise)) / 100)}
                    </span>
                  </div>
                )}
                <div className="border-t border-slate-200 pt-2 flex justify-between text-base font-extrabold text-[#0f172a]">
                  <span>Total Amount</span>
                  <span className="text-black">
                    ₹{(((isMember ? selectedTicketCategory.memberPricePaise : selectedTicketCategory.nonMemberPricePaise)) / 100)}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-[#64748b] bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <div>
                  <strong>Razorpay Test Gateway:</strong> API Key <code className="px-1.5 py-0.5 rounded bg-slate-200 text-black font-mono text-[10px]">rzp_test_T8GBnZ6P23gRoO</code>
                </div>
                <div>
                  Pass reservation is finalized only after successful payment settlement. Your digital entrance pass with door OTP will generate immediately upon payment completion.
                </div>
              </div>

              {/* Confirm Checkout Button */}
              {(() => {
                const isMember = Boolean(session && session.role !== 'guest');
                const pricePaise = isMember
                  ? selectedTicketCategory.memberPricePaise
                  : selectedTicketCategory.nonMemberPricePaise;
                const displayPrice = pricePaise > 0 ? pricePaise / 100 : 1;
                const isSelectedCatFull = getCategoryRemaining(selectedEvent.id, selectedTicketCategory) <= 0;
                const isEventFull = getEventRemainingSeats(selectedEvent) <= 0;
                const isDisabled = isBuying || isSelectedCatFull || isEventFull;

                return (
                  <button
                    type="button"
                    disabled={isDisabled}
                    onClick={handleBuyPass}
                    className={`w-full py-3.5 px-6 rounded-full font-bold text-white transition-all text-sm shadow-sm flex items-center justify-center gap-2 ${
                      isDisabled
                        ? 'bg-slate-400 cursor-not-allowed opacity-60'
                        : 'bg-black hover:bg-slate-900 active:scale-[0.99] cursor-pointer'
                    }`}
                  >
                    {isBuying ? (
                      <>
                        <ButtonSpinner size={16} />
                        <span>Opening Razorpay Gateway...</span>
                      </>
                    ) : isEventFull || isSelectedCatFull ? (
                      'Seats Full · Pass Unavailable'
                    ) : (
                      `Pay ₹${displayPrice} with Razorpay & Reserve Ticket →`
                    )}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ─── MY EVENT TICKET STATUS (EXACT SCREENSHOT 011914) ─── */}
      <div id="my-tickets" className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 md:p-10 shadow-2xs space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-black border border-slate-200">
              My Wallet
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-[#0f172a]">
              My Event Ticket & Door Passes
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#64748b] mt-1.5 font-normal">
            Present your personal ticket QR pass at the entrance scanner for atomic staff check-in.
          </p>
        </div>

        {!session ? (
          <div className="py-12 text-center space-y-4">
            <p className="text-xs sm:text-sm text-[#64748b]">
              Please sign in to view your booked tickets and QR codes.
            </p>
            <div>
              <a
                href="/login"
                className="inline-block px-6 py-2.5 rounded-full bg-black hover:bg-slate-900 text-white font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer"
              >
                Sign In Now
              </a>
            </div>
          </div>
        ) : myTicketPasses.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 mx-auto">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-[#0f172a]">No event passes reserved yet</p>
            <p className="text-xs text-[#64748b] max-w-sm mx-auto">
              Select an upcoming event above to reserve your pass and generate your individual entrance QR code and door OTP.
            </p>
          </div>
        ) : (
          /* Multi-Ticket Compact Grid (Small Size Individual Tickets - User Request) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myTicketPasses.map((pass) => {
              const passQrUrl = qrUrls[pass.id];
              const isOtpRevealed = Boolean(revealedOtps[pass.id]);

              return (
                <div
                  key={pass.id}
                  className="p-5 sm:p-6 rounded-3xl border border-slate-200 bg-white space-y-4 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
                >
                  {/* Top Row: Header + Status Pill */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                    <span className="text-[11px] font-bold text-[#0f172a] uppercase tracking-wider">
                      EVENT PASS
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        pass.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {pass.status === 'approved' ? 'APPROVED' : 'PENDING APPROVAL'}
                    </span>
                  </div>

                  {/* Event Title & Seat */}
                  <div>
                    <h4 className="text-sm font-bold text-[#0f172a] line-clamp-1" title={pass.event_title}>
                      {pass.event_title}
                    </h4>
                    <div className="flex items-center justify-between mt-1 text-xs">
                      <span className="text-[#64748b] font-medium truncate max-w-[140px]">
                        Tier: <strong className="text-slate-800 uppercase">{pass.tier_name}</strong>
                      </span>
                      <span className="font-mono font-extrabold text-black bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {pass.seat}
                      </span>
                    </div>
                  </div>

                  {/* Ticket Number */}
                  <div className="text-[11px] text-[#475569] font-mono bg-slate-50 p-2 rounded-xl border border-slate-100 flex justify-between items-center">
                    <span>Code:</span>
                    <strong className="text-[#0f172a]">{pass.code}</strong>
                  </div>

                  {/* Status Banner */}
                  {pass.status === 'approved' ? (
                    <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] leading-relaxed font-medium">
                      <strong>Confirmed:</strong> Ticket <strong>APPROVED</strong>. Present QR code at entrance gate.
                    </div>
                  ) : (
                    <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-[11px] leading-relaxed">
                      Status: <strong>PENDING APPROVAL</strong>. Present QR code to staff at the entrance.
                    </div>
                  )}

                  {/* Compact QR Code Box */}
                  <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 flex flex-col items-center justify-center space-y-2.5">
                    {passQrUrl ? (
                      <img
                        src={passQrUrl}
                        alt={`QR Pass for ${pass.code}`}
                        className="w-32 h-32 sm:w-36 sm:h-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xs object-contain"
                      />
                    ) : (
                      <div className="w-32 h-32 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-xs text-slate-400">
                        Generating QR...
                      </div>
                    )}

                    <div className="text-[10px] text-[#64748b] font-medium flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Scan QR at Entrance</span>
                    </div>

                    {/* Hidden OTP Block (User request: OTP is hidden until QR scan / reveal) */}
                    <div className="pt-1.5 w-full border-t border-slate-200/60 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase">Door OTP:</span>
                        {isOtpRevealed ? (
                          <span className="font-mono font-bold text-xs tracking-wider text-black bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {pass.otp}
                          </span>
                        ) : (
                          <span className="font-mono font-bold text-xs tracking-widest text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            ••••••
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedOtps((prev) => ({
                            ...prev,
                            [pass.id]: !prev[pass.id],
                          }))
                        }
                        className="text-[10px] font-bold text-black hover:underline cursor-pointer"
                      >
                        {isOtpRevealed ? 'Hide' : 'Reveal OTP'}
                      </button>
                    </div>
                  </div>

                  {/* Bottom Status Indicator */}
                  <div className="pt-2 border-t border-slate-100 text-center text-[11px] text-[#64748b]">
                    {pass.status === 'approved' ? (
                      <span className="text-emerald-700 font-bold">✓ Approved & Verified • {pass.seat}</span>
                    ) : (
                      <span>Pending Staff Approval • {pass.seat}</span>
                    )}
                  </div>

                  {/* Student Cancel & Delete Ticket Option */}
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleDeleteTicket(pass.id, pass.event_title)}
                      className="w-full py-1.5 px-3 rounded-full text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Cancel and delete this ticket pass"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Cancel & Delete Ticket</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── ADMIN: EVENTS TICKET APPLICATIONS & APPROVALS CONSOLE (SCREENSHOT 012208) ─── */}
      {session?.role === 'admin' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-pink-100 text-pink-700">
                  Admin Only
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-[#0f172a]">
                  Events Ticket Applications & Approvals Console
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-[#64748b]">
                Review student registrations, seat assignments, and enter attendee OTP for instant entrance approval.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefreshApplications}
              className="px-4 py-1.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 transition-colors shadow-2xs self-start sm:self-auto cursor-pointer"
            >
              Refresh Applications
            </button>
          </div>

          {approvalFeedback && (
            <div
              className={`p-3 rounded-2xl text-xs font-bold text-center ${
                approvalFeedback.success
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              {approvalFeedback.message}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[#64748b] uppercase font-bold tracking-wider">
                  <th className="py-3 px-4">STUDENT / EMAIL</th>
                  <th className="py-3 px-4">EVENT NAME</th>
                  <th className="py-3 px-4">STATUS</th>
                  <th className="py-3 px-4">VALIDITY DATES / SEAT</th>
                  <th className="py-3 px-4">COMMITTEE DECISION / ENTER OTP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ticketApplications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-[#0f172a]">
                      <div>{app.holder_name}</div>
                      <div className="text-[11px] font-normal text-[#64748b]">{app.holder_email}</div>
                    </td>
                    <td className="py-3.5 px-4 text-[#0f172a]">
                      <div className="font-bold">{app.event_title}</div>
                      <div className="text-[11px] text-[#64748b] font-medium uppercase">{app.tier_name}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          app.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {app.status === 'approved' ? 'APPROVED' : 'PENDING'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#334155]">
                      <div>{app.validity}</div>
                      <div className="font-extrabold text-black font-mono">{app.seat}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      {app.status === 'approved' ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          ✓ Approved & Admitted
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="ENTER OTP"
                            value={otpInputs[app.id] || ''}
                            onChange={(e) =>
                              setOtpInputs((prev) => ({ ...prev, [app.id]: e.target.value }))
                            }
                            className="w-28 px-3 py-1.5 rounded-full border border-slate-200 text-center text-xs font-mono font-bold tracking-wider uppercase focus:outline-none focus:border-black"
                          />
                          <button
                            type="button"
                            onClick={() => handleApproveOtp(app)}
                            className="px-4 py-1.5 rounded-full bg-black hover:bg-slate-900 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                          >
                            Approve
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
