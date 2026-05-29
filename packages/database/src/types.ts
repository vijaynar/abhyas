// packages/database/src/types.ts
// Auto-generated Supabase DB type definitions.
// In production, run: supabase gen types typescript --local > packages/database/src/types.ts
// This handcrafted version matches our 0001_initial_schema.sql exactly.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          domain: string | null;
          subscription_status: 'trial' | 'active' | 'suspended' | 'cancelled';
          logo_url: string | null;
          email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          domain?: string | null;
          subscription_status?: 'trial' | 'active' | 'suspended' | 'cancelled';
          logo_url?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>;
      };

      users: {
        Row: {
          id: string;
          tenant_id: string;
          email: string;
          role: 'superadmin' | 'admin' | 'student' | 'parent';
          role_id?: string | null;
          first_name: string;
          last_name: string;
          phone: string | null;
          alternate_phone: string | null;
          avatar_url: string | null;
          is_active: boolean;
          expo_push_token: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          tenant_id: string;
          email: string;
          role: 'superadmin' | 'admin' | 'student' | 'parent';
          role_id?: string | null;
          first_name: string;
          last_name: string;
          phone?: string | null;
          alternate_phone?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          expo_push_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database['public']['Tables']['users']['Insert'], 'id'>>;
      };

      classes: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database['public']['Tables']['classes']['Insert'], 'tenant_id'>>;
      };

      batches: {
        Row: {
          id: string;
          tenant_id: string;
          class_id: string;
          name: string;
          start_time: string;    // "HH:MM:SS"
          end_time: string;      // "HH:MM:SS"
          days_of_week: number[]; // [1,3,5] = Mon/Wed/Fri
          max_capacity: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          class_id: string;
          name: string;
          start_time: string;
          end_time: string;
          days_of_week: number[];
          max_capacity?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database['public']['Tables']['batches']['Insert'], 'tenant_id' | 'class_id'>>;
      };

      students: {
        Row: {
          id: string;
          tenant_id: string;
          batch_id: string | null;
          student_custom_id: string;
          date_of_birth: string;
          joining_date: string;
          address: string | null;
          emergency_contact: string | null;
          status: 'active' | 'inactive' | 'suspended';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          tenant_id: string;
          batch_id?: string | null;
          student_custom_id: string;
          date_of_birth: string;
          joining_date?: string;
          address?: string | null;
          emergency_contact?: string | null;
          status?: 'active' | 'inactive' | 'suspended';
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database['public']['Tables']['students']['Insert'], 'id' | 'tenant_id'>>;
      };

      parents: {
        Row: {
          id: string;
          tenant_id: string;
          created_at: string;
        };
        Insert: {
          id: string;
          tenant_id: string;
          created_at?: string;
        };
        Update: never;
      };

      parent_student_map: {
        Row: {
          parent_id: string;
          student_id: string;
          relationship: 'father' | 'mother' | 'guardian' | 'parent';
        };
        Insert: {
          parent_id: string;
          student_id: string;
          relationship?: 'father' | 'mother' | 'guardian' | 'parent';
        };
        Update: never;
      };

      student_face_samples: {
        Row: {
          id: string;
          student_id: string;
          tenant_id: string;
          photo_url: string;
          embedding: number[]; // vector(128) — Supabase returns as number[]
          label: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          tenant_id: string;
          photo_url: string;
          embedding: number[];
          label?: string | null;
          created_at?: string;
        };
        Update: never;
      };

      attendance_logs: {
        Row: {
          id: string;
          tenant_id: string;
          student_id: string;
          batch_id: string;
          date: string;
          check_in: string | null;
          status: 'present' | 'late' | 'absent';
          verification_mode: 'face_live' | 'face_photo' | 'manual';
          confidence_score: number | null;
          verified_by: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          student_id: string;
          batch_id: string;
          date?: string;
          check_in?: string | null;
          status: 'present' | 'late' | 'absent';
          verification_mode: 'face_live' | 'face_photo' | 'manual';
          confidence_score?: number | null;
          verified_by?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database['public']['Tables']['attendance_logs']['Insert'], 'id' | 'tenant_id'>>;
      };

      tenant_settings: {
        Row: {
          tenant_id: string;
          absent_fine_rule_1: number;
          absent_fine_rule_1_days: number;
          absent_fine_rule_2: number;
          late_threshold_minutes: number;
          grace_period_minutes: number;
          currency: string;
          holidays: string[];
          weekends: number[];
          auto_fine_enabled: boolean;
          updated_at: string;
        };
        Insert: {
          tenant_id: string;
          absent_fine_rule_1?: number;
          absent_fine_rule_1_days?: number;
          absent_fine_rule_2?: number;
          late_threshold_minutes?: number;
          grace_period_minutes?: number;
          currency?: string;
          holidays?: string[];
          weekends?: number[];
          auto_fine_enabled?: boolean;
          updated_at?: string;
        };
        Update: Partial<Omit<Database['public']['Tables']['tenant_settings']['Insert'], 'tenant_id'>>;
      };

      fines: {
        Row: {
          id: string;
          tenant_id: string;
          student_id: string;
          attendance_log_id: string | null;
          amount: number;
          reason: string;
          status: 'unpaid' | 'pending_verification' | 'paid' | 'waived';
          issued_date: string;
          paid_date: string | null;
          waived_by: string | null;
          waive_reason: string | null;
          payment_proof_url: string | null;
          transaction_id: string | null;
          payment_method: 'upi' | 'bank_transfer' | 'cash' | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          student_id: string;
          attendance_log_id?: string | null;
          amount: number;
          reason: string;
          status?: 'unpaid' | 'pending_verification' | 'paid' | 'waived';
          issued_date?: string;
          paid_date?: string | null;
          waived_by?: string | null;
          waive_reason?: string | null;
          payment_proof_url?: string | null;
          transaction_id?: string | null;
          payment_method?: 'upi' | 'bank_transfer' | 'cash' | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database['public']['Tables']['fines']['Insert'], 'id' | 'tenant_id'>>;
      };

      permissions: {
        Row: {
          id: string;
          module: string;
          action: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          module: string;
          action: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['permissions']['Insert']>;
      };

      roles: {
        Row: {
          id: string;
          tenant_id: string | null;
          name: string;
          is_system: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string | null;
          name: string;
          is_system?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['roles']['Insert']>;
      };

      role_permissions: {
        Row: {
          role_id: string;
          permission_id: string;
        };
        Insert: {
          role_id: string;
          permission_id: string;
        };
        Update: never;
      };

      audit_logs: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string | null;
          action: string;
          description: string;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id?: string | null;
          action: string;
          description: string;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: Partial<Omit<Database['public']['Tables']['audit_logs']['Insert'], 'id' | 'tenant_id'>>;
      };
    };

    Functions: {
      match_face_embedding: {
        Args: {
          p_tenant_id: string;
          input_embedding: number[];
          match_threshold: number;
          match_count: number;
        };
        Returns: {
          student_id: string;
          similarity: number;
          student_name: string;
          batch_id: string;
        }[];
      };
    };

    Enums: {};
  };
};
