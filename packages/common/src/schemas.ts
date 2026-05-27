// packages/common/src/schemas.ts
// Zod validation schemas for all API request payloads
// Used by both Next.js API routes (server) and React/Expo forms (client)

import { z } from 'zod';

// ── Auth ──────────────────────────────────────────────────────
export const SignupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number').optional(),
  role: z.enum(['admin', 'student', 'parent']),
  tenantId: z.string().uuid('Invalid tenant ID'),
});
export type SignupInput = z.infer<typeof SignupSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;

// ── Tenant ────────────────────────────────────────────────────
export const CreateTenantSchema = z.object({
  name: z.string().min(2).max(255),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  domain: z.string().optional(),
});
export type CreateTenantInput = z.infer<typeof CreateTenantSchema>;

// ── Class ─────────────────────────────────────────────────────
export const CreateClassSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});
export type CreateClassInput = z.infer<typeof CreateClassSchema>;

// ── Batch ─────────────────────────────────────────────────────
export const CreateBatchSchema = z.object({
  classId: z.string().uuid(),
  name: z.string().min(1).max(100),
  startTime: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be in HH:MM format'),
  endTime: z
    .string()
    .regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be in HH:MM format'),
  daysOfWeek: z
    .array(z.number().int().min(1).max(7))
    .min(1, 'At least one day must be selected'),
  maxCapacity: z.number().int().positive().default(50),
});
export type CreateBatchInput = z.infer<typeof CreateBatchSchema>;

// ── Student ───────────────────────────────────────────────────
export const CreateStudentSchema = z.object({
  // user fields
  email: z.string().email(),
  password: z.string().min(8).optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/).optional(),
  // student-specific fields
  studentCustomId: z.string().max(50).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  batchId: z.string().uuid().optional(),
  address: z.string().max(500).optional(),
  emergencyContact: z.string().regex(/^\+?[0-9]{10,15}$/).optional(),
});
export type CreateStudentInput = z.infer<typeof CreateStudentSchema>;

// ── Face Enrollment ───────────────────────────────────────────
export const FaceEnrollSchema = z.object({
  studentId: z.string().uuid(),
  photoUrl: z.string().url(),
  embedding: z
    .array(z.number())
    .length(128, 'Embedding must be exactly 128 dimensions'),
  label: z.string().max(100).optional(),
});
export type FaceEnrollInput = z.infer<typeof FaceEnrollSchema>;

// ── Face Match (Attendance) ───────────────────────────────────
export const FaceMatchSchema = z.object({
  embedding: z
    .array(z.number())
    .length(128, 'Embedding must be exactly 128 dimensions'),
  batchId: z.string().uuid('Batch ID required for attendance context'),
});
export type FaceMatchInput = z.infer<typeof FaceMatchSchema>;

// ── Manual Attendance Override ────────────────────────────────
export const ManualAttendanceSchema = z.object({
  studentId: z.string().uuid(),
  batchId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['present', 'late', 'absent']),
  notes: z.string().max(500).optional(),
});
export type ManualAttendanceInput = z.infer<typeof ManualAttendanceSchema>;

// ── Tenant Settings ───────────────────────────────────────────
export const UpdateTenantSettingsSchema = z.object({
  absentFineRule1: z.number().nonnegative().optional(),
  absentFineRule1Days: z.number().int().positive().optional(),
  absentFineRule2: z.number().nonnegative().optional(),
  lateThresholdMinutes: z.number().int().nonnegative().optional(),
  gracePeriodMinutes: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  weekends: z.array(z.number().int().min(1).max(7)).optional(),
  autoFineEnabled: z.boolean().optional(),
});
export type UpdateTenantSettingsInput = z.infer<typeof UpdateTenantSettingsSchema>;

// ── Fine Waiver ───────────────────────────────────────────────
export const WaiveFineSchema = z.object({
  fineId: z.string().uuid(),
  waiveReason: z.string().min(1, 'Waive reason is required').max(500),
});
export type WaiveFineInput = z.infer<typeof WaiveFineSchema>;
