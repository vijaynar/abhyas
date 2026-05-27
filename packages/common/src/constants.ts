// packages/common/src/constants.ts
// Shared enums and constants used across web and mobile apps

// ── User Roles ────────────────────────────────────────────────
export const USER_ROLES = ['superadmin', 'admin', 'student', 'parent'] as const;
export type UserRole = (typeof USER_ROLES)[number];

// ── Attendance Status ─────────────────────────────────────────
export const ATTENDANCE_STATUSES = ['present', 'late', 'absent'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

// ── Verification Modes ────────────────────────────────────────
export const VERIFICATION_MODES = ['face_live', 'face_photo', 'manual'] as const;
export type VerificationMode = (typeof VERIFICATION_MODES)[number];

// ── Fine Status ───────────────────────────────────────────────
export const FINE_STATUSES = ['unpaid', 'paid', 'waived'] as const;
export type FineStatus = (typeof FINE_STATUSES)[number];

// ── Student Status ────────────────────────────────────────────
export const STUDENT_STATUSES = ['active', 'inactive', 'suspended'] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

// ── Subscription Status ───────────────────────────────────────
export const SUBSCRIPTION_STATUSES = ['trial', 'active', 'suspended', 'cancelled'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

// ── Relationship Types ────────────────────────────────────────
export const RELATIONSHIP_TYPES = ['father', 'mother', 'guardian', 'parent'] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

// ── Day of Week mapping (ISO: 1=Mon … 7=Sun) ─────────────────
export const DAY_NAMES: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

// ── Face Matching Thresholds ──────────────────────────────────
export const FACE_MATCH_THRESHOLD_CONFIDENT  = 0.75; // Green  — high confidence
export const FACE_MATCH_THRESHOLD_REVIEW     = 0.65; // Orange — flag for admin review
export const FACE_MATCH_EMBEDDING_DIMENSIONS = 128;  // face-api.js descriptor length

// ── Currency Defaults ─────────────────────────────────────────
export const DEFAULT_CURRENCY = 'INR';
export const DEFAULT_CURRENCY_SYMBOL = '₹';

// ── Fine Defaults (editable per tenant via tenant_settings) ──
export const DEFAULT_FINE_RULE_1_AMOUNT = 1000;      // ₹1,000 per day up to rule threshold
export const DEFAULT_FINE_RULE_1_DAYS   = 4;         // rule 1 applies for absences ≤ 4 days
export const DEFAULT_FINE_RULE_2_AMOUNT = 2000;      // ₹2,000 per day beyond threshold
export const DEFAULT_GRACE_PERIOD_MINUTES    = 0;
export const DEFAULT_LATE_THRESHOLD_MINUTES  = 5;
