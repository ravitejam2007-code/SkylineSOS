/**
 * CampusOne — Unified Contracts & TypeScript Schemas
 * Odoo x NMIT 2026 Hackathon
 */

export type RoleType = 'admin' | 'treasurer' | 'door_staff' | 'volunteer' | 'member';

export interface UserRole {
  id: string;
  user_id: string;
  organization_id: string;
  role: RoleType;
  granted_by?: string | null;
  granted_at: string;
  expires_at?: string | null;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  student_id?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  timezone: string;
  currency: string;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;
}

// ─── Scene 1: Membership Models ───────────────────────────────────────────────

export interface MembershipTier {
  id: string;
  organization_id: string;
  name: string;
  description?: string | null;
  fee_paise: number; // Stored in minor units (paise)
  duration_days: number;
  ticket_discount_percent: number;
  merch_discount_percent: number;
  benefits: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ApplicationStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface MembershipApplication {
  id: string;
  organization_id: string;
  applicant_id: string;
  requested_tier_id: string;
  status: ApplicationStatus;
  revision: number;
  statement?: string | null;
  reviewer_id?: string | null;
  rejection_reason?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MembershipApplicationReview {
  id: string;
  application_id: string;
  revision: number;
  reviewer_id: string;
  decision: 'approved' | 'rejected';
  notes?: string | null;
  created_at: string;
}

export type MembershipStatus = 'pending' | 'active' | 'expired' | 'cancelled';

export interface Membership {
  id: string;
  organization_id: string;
  user_id: string;
  tier_id: string;
  status: MembershipStatus;
  starts_at: string;
  expires_at: string;
  renewed_from_id?: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  tier?: MembershipTier;
}

export interface MembershipReminder {
  id: string;
  membership_id: string;
  reminder_kind: '30_day' | '7_day';
  due_date: string;
  status: 'pending' | 'sent' | 'cancelled';
  dedupe_key: string;
  sent_at?: string | null;
  created_at: string;
}

// ─── Scene 2: Events & Tickets ───────────────────────────────────────────────

export type EventStatus = 'draft' | 'published' | 'archived' | 'cancelled';

export interface Event {
  id: string;
  organization_id: string;
  title: string;
  slug?: string | null;
  description?: string | null;
  venue: string;
  starts_at: string;
  ends_at: string;
  registration_opens_at?: string | null;
  registration_closes_at?: string | null;
  capacity: number;
  reserved_capacity: number;
  sold_count: number;
  status: EventStatus;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketType {
  id: string;
  event_id: string;
  name: string;
  price_paise: number;
  member_price_paise?: number | null;
  capacity_limit?: number | null;
  sales_start_at?: string | null;
  sales_end_at?: string | null;
  is_active: boolean;
  created_at: string;
}

export type TicketStatus = 'issued' | 'checked_in' | 'cancelled';

export interface Ticket {
  id: string;
  checkout_item_id: string;
  event_id: string;
  ticket_type_id: string;
  owner_id: string;
  qr_token: string;
  status: TicketStatus;
  issued_at: string;
  created_at: string;
  // Joins
  event?: Event;
  ticket_type?: TicketType;
  owner?: Profile;
}

export interface CheckIn {
  id: string;
  ticket_id: string;
  event_id: string;
  checked_in_by: string;
  checked_in_at: string;
}

// ─── Scene 3: Announcements & Communications ──────────────────────────────────

export type AnnouncementAudience = 'all_members' | 'active_members' | 'volunteers' | 'event_attendees' | 'public';
export type AnnouncementStatus = 'draft' | 'published' | 'archived';

export interface Announcement {
  id: string;
  organization_id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  status: AnnouncementStatus;
  author_id?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
  author?: Profile;
}

export interface MailingListPreference {
  id: string;
  user_id: string;
  email: string;
  topic: string;
  is_subscribed: boolean;
  opt_out_token?: string | null;
  unsubscribed_at?: string | null;
  updated_at: string;
}

// ─── Scene 4: Products & Merchandise ──────────────────────────────────────────

export type ProductStatus = 'draft' | 'published' | 'archived';

export interface Product {
  id: string;
  organization_id: string;
  name: string;
  description?: string | null;
  image_path?: string | null;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  size?: string | null;
  label?: string | null;
  color?: string | null;
  price_paise: number;
  stock_on_hand: number;
  reserved_quantity: number;
  available?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Scene 5: Fundraising & Tasks ─────────────────────────────────────────────

export type FundraiserStatus = 'draft' | 'active' | 'completed' | 'archived';

export interface Fundraiser {
  id: string;
  organization_id: string;
  title: string;
  description?: string | null;
  goal_paise: number;
  raised_paise: number;
  status: FundraiserStatus;
  starts_at?: string | null;
  ends_at?: string | null;
  owner_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface FundraiserTask {
  id: string;
  fundraiser_id: string;
  title: string;
  description?: string | null;
  assigned_to?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  assignee?: Profile;
}

export interface FundraiserContribution {
  id: string;
  fundraiser_id: string;
  amount_paise: number;
  method: 'cash' | 'online' | 'manual_upi';
  notes?: string | null;
  recorded_by?: string | null;
  created_at: string;
  recorder?: Profile;
}

// ─── Scene 6: Treasurer, Ledger & Checkouts ───────────────────────────────────

export type CheckoutStatus = 'draft' | 'pending_payment' | 'paid' | 'recorded' | 'fulfilled' | 'cancelled' | 'expired';
export type PaymentMethod = 'online' | 'cash' | 'manual_upi';
export type PaymentStatus = 'created' | 'pending' | 'captured' | 'verified' | 'failed';

export interface Checkout {
  id: string;
  organization_id: string;
  buyer_id: string;
  status: CheckoutStatus;
  subtotal_paise: number;
  discount_paise: number;
  total_paise: number;
  currency: string;
  payment_method?: PaymentMethod | null;
  payment_status: PaymentStatus;
  source_reference?: string | null;
  idempotency_key?: string | null;
  recorded_by?: string | null;
  notes?: string | null;
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
  items?: CheckoutItem[];
  buyer?: Profile;
}

export type CheckoutItemType = 'ticket' | 'merch' | 'membership';
export type FulfilmentStatus = 'pending' | 'fulfilled' | 'cancelled';

export interface CheckoutItem {
  id: string;
  checkout_id: string;
  item_type: CheckoutItemType;
  item_id: string;
  quantity: number;
  captured_unit_price_paise: number;
  captured_discount_paise: number;
  line_total_paise: number;
  fulfilment_status: FulfilmentStatus;
  created_at: string;
}

export interface Payment {
  id: string;
  checkout_id: string;
  provider: 'razorpay' | 'cash' | 'manual_upi';
  provider_order_id?: string | null;
  provider_payment_id?: string | null;
  amount_paise: number;
  currency: string;
  status: 'created' | 'pending' | 'captured' | 'failed' | 'refunded';
  mode: 'test' | 'live';
  verification_metadata?: Record<string, unknown>;
  verified_at?: string | null;
  created_at: string;
}

export type LedgerEntryType = 'income' | 'expense' | 'refund' | 'adjustment';
export type LedgerSourceType = 'checkout' | 'contribution' | 'expense' | 'refund' | 'adjustment';

export interface LedgerEntry {
  id: string;
  organization_id?: string;
  direction?: 'in' | 'out';
  entry_type?: LedgerEntryType;
  amount_paise: number;
  category: string;
  source_type: LedgerSourceType | string;
  source_id: string;
  payment_method?: PaymentMethod | null;
  method?: string;
  effective_date?: string;
  effective_on?: string;
  recorded_by?: string | null;
  notes?: string | null;
  memo?: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: Record<string, unknown>;
  created_at: string;
}

// ─── Deterministic Action Queue ───────────────────────────────────────────────

export type ActionQueuePriority = 'low' | 'medium' | 'high' | 'urgent';
export type ActionQueueStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';

export interface ActionQueueItem {
  id: string;
  organization_id?: string;
  action_type?: string;
  kind?: string;
  source_type?: string;
  source_id?: string;
  title: string;
  reason?: string;
  next_action?: string;
  nextAction?: string;
  priority: ActionQueuePriority | string;
  status?: ActionQueueStatus;
  assigned_role?: string | null;
  assigned_to?: string | null;
  due_at?: string | null;
  link?: string;
  dedupe_key?: string;
  detected_at?: string;
  resolved_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ActionQueueRule {
  id: string;
  organization_id: string;
  rule_key: string;
  is_enabled: boolean;
  threshold_value: number;
  description?: string | null;
  updated_at: string;
}

// ─── RPC Request and Response Types ───────────────────────────────────────────

export interface CreateCheckoutItemInput {
  item_type: CheckoutItemType;
  item_id: string;
  quantity: number;
}

export interface CreateCheckoutParams {
  p_items: CreateCheckoutItemInput[];
  p_payment_method: PaymentMethod;
  p_idempotency_key: string;
  p_notes?: string;
}

export interface CreateCheckoutResult {
  checkout_id: string;
  status: CheckoutStatus;
  subtotal_paise: number;
  discount_paise: number;
  total_paise: number;
  currency: string;
  payment_method: PaymentMethod;
}

export interface FulfillCheckoutParams {
  p_checkout_id: string;
  p_payment_id?: string;
}

export interface FulfillCheckoutResult {
  checkout_id: string;
  status: CheckoutStatus;
  tickets_issued: number;
  merch_items_fulfilled: number;
  memberships_activated: number;
  ledger_entry_id: string;
}

export interface RecordStaffPaymentParams {
  p_checkout_id: string;
  p_payment_method: 'cash' | 'manual_upi';
  p_amount_paise: number;
  p_reference?: string;
  p_notes?: string;
}

export interface RecordCashContributionParams {
  p_fundraiser_id: string;
  p_amount_paise: number;
  p_method?: 'cash' | 'manual_upi';
  p_notes?: string;
}

export interface CheckInTicketParams {
  p_ticket_id: string;
  p_qr_token?: string;
}

export interface CheckInTicketResult {
  valid: boolean;
  ticket_id: string;
  event_id?: string;
  status?: TicketStatus;
  checked_in_at: string;
  attendee_name: string;
  ticket_type?: string;
  already_checked_in?: boolean;
}

export interface TreasurerOverviewResult {
  period?: {
    start_date: string;
    end_date: string;
  };
  total_income_paise?: number;
  total_expense_paise?: number;
  net_recorded_movement_paise?: number;
  inPaise?: number;
  outPaise?: number;
  netPaise?: number;
  byMethod?: Record<string, number>;
  byCategory?: Record<string, number>;
  recent?: any[];
  by_method?: {
    online: number;
    cash: number;
    manual_upi: number;
  };
  by_source?: {
    dues: number;
    tickets: number;
    merch: number;
    fundraiser: number;
    other: number;
  };
}

export interface EventSummaryResult {
  event_id?: string;
  eventId?: string;
  title?: string;
  capacity?: number;
  sold_count?: number;
  soldCount?: number;
  reserved_capacity?: number;
  checked_in_count?: number;
  checkedInCount?: number;
  online_revenue_paise?: number;
  cash_revenue_paise?: number;
  total_revenue_paise?: number;
  revenue?: {
    online: number;
    cash: number;
    total: number;
  };
}

export interface MemberLookupResult {
  id: string;
  full_name: string;
  email: string;
  student_id: string;
  tier_name: string;
  status: 'active' | 'expired' | 'pending';
  expires_at: string;
  ticket_discount_percent: number;
  merch_discount_percent: number;
}

export interface WalkUpSignupParams {
  full_name: string;
  email: string;
  student_id: string;
  tier_id: string;
  payment_method: 'cash' | 'manual_upi';
  notes?: string;
}

// ─── Phase 3: Razorpay & Edge Function Contracts ─────────────────────────────

export interface CreatePaymentOrderInput {
  checkout_id: string;
}

export interface CreatePaymentOrderResponse {
  checkout_id: string;
  razorpay_order_id: string;
  amount: number;
  currency: string;
  key_id: string;
}

export interface VerifyPaymentInput {
  checkout_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface VerifyPaymentResponse {
  checkout_id: string;
  payment_status: 'verified';
  checkout_status: 'fulfilled';
  fulfilment?: FulfillCheckoutResult;
}

export interface RecordManualPaymentInput {
  checkout_id: string;
  payment_method: 'cash' | 'manual_upi';
  amount_paise: number;
  reference?: string;
  notes?: string;
}

export interface RecordManualPaymentResponse {
  checkout_id: string;
  payment_method: 'cash' | 'manual_upi';
  payment_status: 'captured';
  checkout_status: 'fulfilled';
  fulfilment?: FulfillCheckoutResult;
}

export interface RazorpayWebhookPayload {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    payment?: {
      entity: {
        id: string;
        amount: number;
        currency: string;
        status: string;
        order_id?: string;
        notes?: Record<string, string>;
      };
    };
    order?: {
      entity: {
        id: string;
        amount: number;
        currency: string;
        status: string;
        notes?: Record<string, string>;
      };
    };
  };
  created_at: number;
}

// ─── All-in-One Digital Student Pass & QR Identification ─────────────────────

export interface StudentPassMembershipInfo {
  is_member: boolean;
  status: 'active' | 'expired' | 'none';
  membership_id?: string | null;
  id?: string | null;
  tier_id?: string | null;
  tier_name?: string | null;
  starts_at?: string | null;
  expires_at?: string | null;
  days_remaining?: number | null;
  ticket_discount_percent: number;
  merch_discount_percent: number;
  discount_percent?: number;
  benefits?: string[];
}

export interface StudentPassEventTicket {
  ticket_id: string;
  event_id: string;
  event_title: string;
  venue: string;
  starts_at: string;
  ends_at?: string;
  ticket_type_id?: string;
  ticket_type_name: string;
  status: 'issued' | 'checked_in' | 'cancelled';
  qr_token: string;
  issued_at?: string;
}

export interface StudentAllInOnePassPayload {
  pass_token?: string;
  pass_version: string;
  issuer?: string;
  generated_at: string;
  door_verification_code?: string;
  ttl_seconds?: number;
  student: {
    user_id?: string;
    id?: string;
    full_name: string;
    email: string;
    student_id?: string | null;
  };
  membership: StudentPassMembershipInfo;
  upcoming_events: StudentPassEventTicket[];
  signature?: string;
  active_tickets?: any[];
}

export interface StudentAllInOnePassResult {
  status: 'success';
  pass_token: string;
  qr_data_url?: string;
  qr_svg?: string;
  qr_code_svg?: string;
  signature?: string;
  payload: StudentAllInOnePassPayload;
}

export interface VerifyStudentPassResult {
  status?: 'success' | 'error';
  verified?: boolean;
  valid?: boolean;
  membership_status?: string;
  tier_name?: string;
  student_id?: string;
  student_name?: string;
  checked_in_tickets?: string[];
  audit_log_id?: string;
  data?: {
    valid: boolean;
    pass_token: string;
    verified_at: string;
    verified_by?: string;
    student: {
      user_id: string;
      full_name: string;
      email: string;
      student_id?: string | null;
    };
    membership: StudentPassMembershipInfo;
    upcoming_events: StudentPassEventTicket[];
  };
  reason?: string;
}

// ─── Standard Backend Error Contracts ──────────────────────────────────────────

export type BackendErrorCode =
  | 'BAD_REQUEST'
  | 'INVALID_JSON'
  | 'INVALID_REQUEST'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE_ENTITY'
  | 'RATE_LIMITED'
  | 'CONFIG_ERROR'
  | 'INTERNAL_ERROR';

export interface BackendErrorPayload {
  success: false;
  error: {
    code: BackendErrorCode;
    message: string;
    details?: any;
  };
}

export type BackendApiResponse<T> =
  | ({ success: true } & T)
  | BackendErrorPayload;

export function isBackendError(res: any): res is BackendErrorPayload {
  return Boolean(
    res &&
    typeof res === 'object' &&
    res.success === false &&
    res.error &&
    typeof res.error.code === 'string'
  );
}

export function formatBackendErrorMessage(err: unknown): string {
  if (!err) return 'An unknown error occurred';
  if (typeof err === 'string') return err;
  if (typeof err === 'object') {
    const errorObj = err as any;
    if (errorObj.error?.message) return errorObj.error.message;
    if (errorObj.message) return errorObj.message;
    if (errorObj.details) return String(errorObj.details);
  }
  return String(err);
}

const RFC4122_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== 'string') return false;
  return RFC4122_UUID_REGEX.test(id.trim());
}

