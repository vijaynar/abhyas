// packages/common/src/types.ts
// Core TypeScript interfaces shared between apps/web and apps/mobile
// These mirror the database row types but are UI/domain-friendly

import type {
  UserRole,
  AttendanceStatus,
  VerificationMode,
  FineStatus,
  StudentStatus,
  SubscriptionStatus,
  RelationshipType,
} from './constants';

// ── Tenant ────────────────────────────────────────────────────
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  subscriptionStatus: SubscriptionStatus;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── User ──────────────────────────────────────────────────────
export interface User {
  id: string;
  tenantId: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  fullName: string;             // computed: firstName + ' ' + lastName
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Class ─────────────────────────────────────────────────────
export interface Class {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Batch ─────────────────────────────────────────────────────
export interface Batch {
  id: string;
  tenantId: string;
  classId: string;
  name: string;
  startTime: string;            // "HH:MM:SS"
  endTime: string;              // "HH:MM:SS"
  daysOfWeek: number[];         // [1,3,5] = Mon/Wed/Fri
  maxCapacity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Joined fields (when fetched with class info)
  class?: Pick<Class, 'id' | 'name'>;
}

// ── Student ───────────────────────────────────────────────────
export interface Student {
  id: string;
  tenantId: string;
  batchId: string | null;
  studentCustomId: string;
  dateOfBirth: string;
  joiningDate: string;
  address: string | null;
  emergencyContact: string | null;
  status: StudentStatus;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'fullName' | 'email' | 'phone' | 'avatarUrl'>;
  batch?: Pick<Batch, 'id' | 'name' | 'startTime' | 'endTime'>;
  faceEnrolled?: boolean;       // true if at least one face sample exists
}

// ── Parent ────────────────────────────────────────────────────
export interface Parent {
  id: string;
  tenantId: string;
  createdAt: string;
  user?: Pick<User, 'id' | 'firstName' | 'lastName' | 'fullName' | 'email' | 'phone'>;
  children?: Student[];
}

// ── Parent-Student Link ───────────────────────────────────────
export interface ParentStudentLink {
  parentId: string;
  studentId: string;
  relationship: RelationshipType;
}

// ── Face Sample ───────────────────────────────────────────────
export interface FaceSample {
  id: string;
  studentId: string;
  tenantId: string;
  photoUrl: string;
  embedding: number[];          // 128-float vector
  label: string | null;
  createdAt: string;
}

// ── Attendance Log ────────────────────────────────────────────
export interface AttendanceLog {
  id: string;
  tenantId: string;
  studentId: string;
  batchId: string;
  date: string;                 // "YYYY-MM-DD"
  checkIn: string | null;       // ISO timestamp
  status: AttendanceStatus;
  verificationMode: VerificationMode;
  confidenceScore: number | null;
  verifiedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  student?: Pick<Student, 'id' | 'studentCustomId'> & {
    user?: Pick<User, 'firstName' | 'lastName' | 'fullName' | 'avatarUrl'>;
  };
  batch?: Pick<Batch, 'id' | 'name'>;
}

// ── Tenant Settings ───────────────────────────────────────────
export interface TenantSettings {
  tenantId: string;
  absentFineRule1: number;
  absentFineRule1Days: number;
  absentFineRule2: number;
  lateThresholdMinutes: number;
  gracePeriodMinutes: number;
  currency: string;
  holidays: string[];           // "YYYY-MM-DD" date strings
  weekends: number[];           // [6, 7] = Sat + Sun
  autoFineEnabled: boolean;
  updatedAt: string;
}

// ── Fine ──────────────────────────────────────────────────────
export interface Fine {
  id: string;
  tenantId: string;
  studentId: string;
  attendanceLogId: string | null;
  amount: number;
  reason: string;
  status: FineStatus;
  issuedDate: string;
  paidDate: string | null;
  waivedBy: string | null;
  waiveReason: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  student?: Pick<Student, 'id' | 'studentCustomId'> & {
    user?: Pick<User, 'firstName' | 'lastName' | 'fullName'>;
  };
}

// ── Face Match Result (from pgvector RPC) ────────────────────
export interface FaceMatchResult {
  studentId: string;
  similarity: number;           // 0.0 – 1.0
  studentName: string;
  batchId: string;
}

// ── API Response Wrappers ─────────────────────────────────────
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ── Dashboard KPI types ───────────────────────────────────────
export interface DashboardKPIs {
  presentToday: number;
  absentToday: number;
  lateToday: number;
  totalStudents: number;
  attendancePercentage: number;
  pendingFinesCount: number;
  pendingFinesAmount: number;
}
