export type SessionStage = {
  id: string;
  name: string;
  code: string;
};

export type SessionClient = {
  id: string;
  first_name: string;
  last_name: string;
};

export type SessionPayment = {
  id: string;
  amount_cents: number;
  voucher_unused_cents: number;
  paid_at: string | null;
  paid_date: string | null;
  category: string;
  payment_method_name: string;
  applied_voucher_id: string | null;
  reference: string | null;
  notes: string | null;
};

export type SessionExtra = {
  id: string;
  service_type_id: string | null;
  service_name: string;
  price_cents: number;
  quantity: number;
  notes: string | null;
  created_at: string;
};

export type SessionStageHistory = {
  id: string;
  stage_name: string;
  changed_at: string;
  notes: string | null;
};

export type Session = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  service_name: string;
  service_detail: string | null;
  notes: string | null;
  agreed_price_cents: number;
  is_settled: boolean;
  image_consent_granted_at: string | null;
  image_consent_revoked_at: string | null;
  service_type_id: string;
  current_stage: SessionStage | null;
  client: SessionClient | null;
  payments: SessionPayment[];
  stage_history: SessionStageHistory[];
  extras: SessionExtra[];
};

export type SessionCreateInput = {
  clientId: string;
  serviceTypeId: string;
  scheduledAt: string;
  durationMinutes: number;
  priceEuros: number;
  location?: string | null;
  notes?: string | null;
  serviceDetail?: string | null;
  imageConsentGranted?: boolean;
};

export type SessionUpdateInput = {
  action: string;
  stageId?: string;
  changedAt?: string;
  notes?: string | null;
};

export type SessionExtra_CreateInput = {
  sessionId: string;
  serviceTypeId: string;
  serviceName: string;
  priceEuros: number;
  notes?: string | null;
};

/**
 * Calculate total amount due for a session (agreed price + extras)
 */
export function calculateSessionDue(session: Session): number {
  const extrasCents = session.extras.reduce((sum, extra) => sum + extra.price_cents * extra.quantity, 0);
  return session.agreed_price_cents + extrasCents;
}

/**
 * Calculate total amount paid for a session
 */
export function calculateSessionPaid(session: Session): number {
  return session.payments.reduce((sum, payment) => sum + payment.amount_cents, 0);
}

export function calculateRemainingBalance(totalDueCents: number, totalPaidCents: number): number {
  return Math.max(totalDueCents - totalPaidCents, 0);
}

export function calculateVoucherApplication(voucherCreditCents: number, totalDueCents: number, totalPaidCents: number) {
  const remainingCents = calculateRemainingBalance(totalDueCents, totalPaidCents);
  const amountCents = Math.min(voucherCreditCents, remainingCents);
  return { amountCents, unusedCents: voucherCreditCents - amountCents, remainingCents };
}

/**
 * Determine payment status of a session
 */
export function getSessionPaymentStatus(session: Session): "paid" | "unpaid" | "partial" {
  const totalDue = calculateSessionDue(session);
  const totalPaid = calculateSessionPaid(session);

  if (totalDue === 0) return "paid"; // Zero-price sessions auto-settle
  if (totalPaid === 0) return "unpaid";
  if (totalPaid < totalDue) return "partial";
  return "paid";
}

/**
 * Check if session has image consent
 */
export function hasImageConsent(session: Session): boolean {
  return session.image_consent_granted_at !== null && session.image_consent_revoked_at === null;
}
