// apps/web/src/lib/utils.ts
// Shared utility functions for the web app

import type { AttendanceStatus, FineStatus } from '@abhyas/common';

// ── Date helpers ──────────────────────────────────────────────

/** Format an ISO timestamp to a human-readable local date string */
export function formatDate(iso: string, locale = 'en-IN'): string {
  return new Date(iso).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Format an ISO timestamp to a short time string (e.g. "09:04 AM") */
export function formatTime(iso: string, locale = 'en-IN'): string {
  return new Date(iso).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Return "YYYY-MM-DD" for today (or a given date) */
export function toDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

/** Convert a "HH:MM:SS" time string to a human-readable "9:00 AM" */
export function formatTimeString(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

/** Return the start of the current month as "YYYY-MM-DD" */
export function startOfMonth(date: Date = new Date()): string {
  return new Date(date.getFullYear(), date.getMonth(), 1)
    .toISOString()
    .split('T')[0];
}

/** Return the end of the current month as "YYYY-MM-DD" */
export function endOfMonth(date: Date = new Date()): string {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
    .toISOString()
    .split('T')[0];
}

// ── Currency helpers ──────────────────────────────────────────

/** Format a number as currency (defaults to INR) */
export function formatCurrency(
  amount: number,
  currency = 'INR',
  locale = 'en-IN'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ── Status helpers ────────────────────────────────────────────

/** Returns Tailwind-friendly colour tokens for attendance status */
export function attendanceStatusColor(status: AttendanceStatus): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'present':
      return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' };
    case 'late':
      return { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' };
    case 'absent':
      return { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/30' };
  }
}

/** Returns Tailwind-friendly colour tokens for fine status */
export function fineStatusColor(status: FineStatus): {
  bg: string;
  text: string;
} {
  switch (status) {
    case 'unpaid':
      return { bg: 'bg-rose-500/20', text: 'text-rose-400' };
    case 'paid':
      return { bg: 'bg-emerald-500/20', text: 'text-emerald-400' };
    case 'waived':
      return { bg: 'bg-slate-500/20', text: 'text-slate-400' };
  }
}

// ── Face match confidence ─────────────────────────────────────

/** Classify a similarity score (0–1) into a confidence label and colour */
export function faceConfidenceLabel(similarity: number): {
  label: string;
  color: string;
} {
  if (similarity >= 0.75) return { label: 'High', color: 'text-emerald-400' };
  if (similarity >= 0.65) return { label: 'Medium', color: 'text-amber-400' };
  return { label: 'Low', color: 'text-rose-400' };
}

// ── String helpers ────────────────────────────────────────────

/** Capitalise the first letter of a string */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Generate initials from a full name (e.g. "Arjun Sharma" → "AS") */
export function initials(fullName: string): string {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('');
}

// ── Attendance fine calculation ───────────────────────────────

/**
 * Calculate the fine amount for a new absence this month
 * based on how many absences the student already has this month.
 */
export function calcAbsenceFine(
  existingAbsencesThisMonth: number,
  rule1Amount: number,
  rule1Days: number,
  rule2Amount: number
): number {
  // The NEW absence (existingAbsencesThisMonth + 1) determines the fine rate
  const newTotal = existingAbsencesThisMonth + 1;
  return newTotal <= rule1Days ? rule1Amount : rule2Amount;
}
