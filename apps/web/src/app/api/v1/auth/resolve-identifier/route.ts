// apps/web/src/app/api/v1/auth/resolve-identifier/route.ts
// POST /api/v1/auth/resolve-identifier
// Resolves a login identifier (email, roll number, or plus-address) to the correct Supabase Auth email.

import { NextResponse } from 'next/server';
import { adminDb, ok, err } from '@/lib/api';

export async function POST(req: Request) {
  try {
    const { identifier } = await req.json();
    if (!identifier) {
      return err('Identifier is required', 400);
    }

    const trimmed = identifier.trim().toLowerCase();
    const db = adminDb();

    // Case 1: Already a plus-email (e.g., parent+vs00001@gmail.com)
    if (trimmed.includes('+') && trimmed.includes('@')) {
      return ok({ email: trimmed });
    }

    // Case 2: Roll Number / Custom ID or Phone Number
    if (!trimmed.includes('@')) {
      // Check if it consists only of digits (optionally starting with +) after removing spaces and dashes
      const cleanedPhone = trimmed.replace(/[\s\-\(\)]/g, '');
      const isPhone = /^\+?[0-9]{8,15}$/.test(cleanedPhone);

      if (isPhone) {
        // Query users by phone matching either raw input or cleaned input
        const { data: users, error: usersErr } = await db
          .from('users')
          .select('id, email, role, first_name, last_name, students(student_custom_id)')
          .or(`phone.eq.${trimmed},phone.eq.${cleanedPhone}`);

        if (usersErr) throw usersErr;

        if (users && users.length > 0) {
          if (users.length === 1) {
            const user = users[0];
            if (user.role === 'student' && user.students && (user.students as any).student_custom_id) {
              const [localPart, domain] = user.email.split('@');
              const customId = (user.students as any).student_custom_id.toLowerCase();
              return ok({ email: `${localPart}+${customId}@${domain}` });
            }
            return ok({ email: user.email });
          } else {
            // Multiple profiles share the same phone number (e.g. parent's phone shared by siblings)
            const studentIds = users
              .filter((u) => u.role === 'student' && u.students && (u.students as any).student_custom_id)
              .map((u) => (u.students as any).student_custom_id);

            return err(
              `Multiple student profiles share this phone number. Please sign in using your Roll Number (e.g., ${studentIds.join(' or ')}) instead.`,
              400
            );
          }
        }
      }

      // Default back to Roll Number / Custom ID search
      const { data: student, error: studentErr } = await db
        .from('students')
        .select(`
          student_custom_id,
          user:users(email)
        `)
        .eq('student_custom_id', trimmed)
        .single();

      if (studentErr || !student || !student.user) {
        return err(`Identifier (Phone or Roll Number) "${trimmed}" is not registered.`, 404);
      }

      // Reconstruct the plus-email used in Supabase Auth
      const baseEmail = (student.user as any).email;
      const [localPart, domain] = baseEmail.split('@');
      const authEmail = `${localPart}+${trimmed}@${domain}`;
      return ok({ email: authEmail });
    }

    // Case 3: Shared parent email (e.g., parent@gmail.com)
    // Check if there are multiple accounts associated with this email
    const { data: users, error: usersErr } = await db
      .from('users')
      .select('id, role, first_name, last_name, students(student_custom_id)')
      .eq('email', trimmed);

    if (usersErr) {
      throw usersErr;
    }

    if (!users || users.length === 0) {
      return err(`Email "${trimmed}" is not registered.`, 404);
    }

    // If there is only 1 user with this email, use it directly
    if (users.length === 1) {
      // If it's a student, check if they have a plus-email mapping
      const user = users[0];
      if (user.role === 'student' && user.students && (user.students as any).student_custom_id) {
        const [localPart, domain] = trimmed.split('@');
        const customId = (user.students as any).student_custom_id.toLowerCase();
        return ok({ email: `${localPart}+${customId}@${domain}` });
      }
      return ok({ email: trimmed });
    }

    // If there are multiple users (e.g., siblings sharing a parent email), they must log in using their roll number!
    const studentIds = users
      .filter((u) => u.role === 'student' && u.students && (u.students as any).student_custom_id)
      .map((u) => (u.students as any).student_custom_id);

    if (studentIds.length > 0) {
      return err(
        `Multiple student profiles share this email address. Please sign in using your Roll Number (e.g., ${studentIds.join(' or ')}) instead of your email.`,
        400
      );
    }

    // Fallback if not students
    return ok({ email: trimmed });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : 'Internal server error', 500);
  }
}
