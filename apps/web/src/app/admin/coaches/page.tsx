'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  UserCog,
  Users,
  Plus,
  Search,
  Edit2,
  X,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Sparkles,
  IndianRupee,
  FileText,
  Upload,
  Download,
  Award,
  Clock,
  AlertCircle,
  Trash2,
  UserX,
  UserCheck,
  Calendar,
} from 'lucide-react';
import { createBrowserClient } from '@/lib/supabase';
import CustomSelect from '../components/CustomSelect';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface CoachItem {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  coach_profile: {
    expertise: string | null;
    availability_slots: string | null;
    hourly_rate: number;
    certificates: string[];
  } | null;
  batch_assignments: {
    id: string;
    status: string;
    assigned_days: number[] | null;
    batch: {
      id: string;
      name: string;
      start_time: string;
      end_time: string;
      days_of_week: number[];
      class: { name: string } | null;
    };
  }[];
}

interface BatchOption {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  class: { name: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// DB uses ISO weekday numbering: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
const DAY_LABELS: Record<number, string> = {
  1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun',
};

function formatTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${m} ${ampm}`;
}

function initials(first: string, last: string) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
}

function toastMessage(msg: string, type: 'success' | 'error' = 'success') {
  // Simple toast injection
  const toast = document.createElement('div');
  toast.className = `fixed bottom-6 right-6 z-[9999] px-5 py-3 rounded-xl text-sm font-medium shadow-lg border animate-in fade-in duration-300 ${
    type === 'success'
      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
      : 'bg-red-500/10 border-red-500/20 text-red-400'
  }`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:border-white/20 transition-all duration-300">
      <div className={`p-2.5 sm:p-3 rounded-xl ${accent} flex-shrink-0 self-start sm:self-auto`}>{icon}</div>
      <div>
        <p className="text-slate-400 text-[10px] sm:text-xs font-semibold uppercase tracking-wide sm:tracking-wider leading-tight">{label}</p>
        <p className="text-slate-100 text-xl sm:text-2xl font-bold mt-0.5 sm:mt-1">{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
        active
          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          : 'bg-red-500/10 border-red-500/20 text-red-400'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-red-400'}`} />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function AssignmentBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    pending: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    rejected: 'bg-red-500/10 border-red-500/20 text-red-400',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${
        map[status] ?? 'bg-slate-500/10 border-slate-500/20 text-slate-400'
      }`}
    >
      {status}
    </span>
  );
}

function DayBadge({ day }: { day: number }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
      {DAY_LABELS[day]}
    </span>
  );
}

function AvatarCircle({
  url,
  first,
  last,
  size = 'md',
}: {
  url: string | null;
  first: string;
  last: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-16 h-16 text-lg' }[
    size
  ];
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={`${first} ${last}`}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 border border-white/10`}
      />
    );
  }
  return (
    <div
      className={`${sizeClass} rounded-full flex-shrink-0 bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold`}
    >
      {initials(first, last)}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CoachesPage() {
  const supabase = createBrowserClient();

  // ── State ──
  const [coaches, setCoaches] = useState<CoachItem[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Modal states
  const [showOnboard, setShowOnboard] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showBatches, setShowBatches] = useState(false);
  // per-batch selected days map: batchId -> Set<number>
  const [batchDaySelections, setBatchDaySelections] = useState<Record<string, Set<number>>>({});
  // track which approved assignment is in "edit days" mode
  const [editingDaysFor, setEditingDaysFor] = useState<string | null>(null);
  // batch chosen in the "Add to Schedule" dropdown
  const [selectedBatchToAssign, setSelectedBatchToAssign] = useState<string>('');
  const [selectedCoach, setSelectedCoach] = useState<CoachItem | null>(null);

  // Form state
  const [formLoading, setFormLoading] = useState(false);
  const [onboardForm, setOnboardForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    phone: '',
    expertise: '',
    availability_slots: '',
    hourly_rate: 500,
  });
  const [onboardPhoto, setOnboardPhoto] = useState<File | null>(null);
  const [onboardPhotoPreview, setOnboardPhotoPreview] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    expertise: '',
    availability_slots: '',
    hourly_rate: 500,
  });
  const [editCerts, setEditCerts] = useState<string[]>([]);
  const [certUploading, setCertUploading] = useState(false);
  const certInputRef = useRef<HTMLInputElement>(null);

  // ── Load Data ──
  const loadCoaches = useCallback(async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) return;

      // Get current user's tenant
      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', userId)
        .single();

      const tid = profile?.tenant_id;
      setTenantId(tid);

      // Fetch coaches with their profile and assignments
      const { data: coachData, error } = await supabase
        .from('users')
        .select(
          `
          id,
          email,
          first_name,
          last_name,
          phone,
          avatar_url,
          is_active,
          coaches(
            expertise,
            availability_slots,
            hourly_rate,
            certificates
          ),
          coach_batch_assignments!coach_batch_assignments_coach_id_fkey(
            id,
            status,
            assigned_days,
            batch_id,
            batches(
              id,
              name,
              start_time,
              end_time,
              days_of_week,
              classes(name)
            )
          )
        `
        )
        .eq('tenant_id', tid)
        .eq('role', 'coach')
        .order('first_name', { ascending: true });

      if (error) throw error;

      // Normalize (Supabase returns FK-hinted key names when disambiguation is used)
      const normalized: CoachItem[] = (coachData ?? []).map((c: any) => {
        const rawAssignments =
          c['coach_batch_assignments!coach_batch_assignments_coach_id_fkey'] ??
          c.coach_batch_assignments ??
          [];

        return {
          ...c,
          coach_profile: Array.isArray(c.coaches)
            ? (c.coaches[0] ?? null)
            : (c.coaches ?? null),
          batch_assignments: rawAssignments.map((a: any) => ({
            id: a.id,
            status: a.status,
            assigned_days: a.assigned_days ?? null,
            batch: Array.isArray(a.batches)
              ? {
                  ...a.batches[0],
                  class: Array.isArray(a.batches[0]?.classes)
                    ? (a.batches[0].classes[0] ?? null)
                    : (a.batches[0]?.classes ?? null),
                }
              : a.batches
              ? {
                  ...a.batches,
                  class: Array.isArray(a.batches.classes)
                    ? (a.batches.classes[0] ?? null)
                    : (a.batches.classes ?? null),
                }
              : null,
          })),
        };
      });

      setCoaches(normalized);

      // Fetch batches for manage-batches modal
      const { data: batchData } = await supabase
        .from('batches')
        .select(
          `
          id,
          name,
          start_time,
          end_time,
          days_of_week,
          class:classes(name)
        `
        )
        .eq('tenant_id', tid)
        .eq('is_active', true)
        .order('name', { ascending: true });

      setBatches(
        (batchData ?? []).map((b: any) => ({
          ...b,
          class: Array.isArray(b.class) ? b.class[0] ?? null : b.class,
        }))
      );
    } catch (err: any) {
      console.error('Failed to load coaches:', JSON.stringify(err), err?.message, err?.details, err?.hint);
      toastMessage(`Failed to load coaches: ${err?.message ?? err}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadCoaches();
  }, [loadCoaches]);

  // ── Computed ──
  const filteredCoaches = coaches.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.first_name.toLowerCase().includes(q) ||
      c.last_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.coach_profile?.expertise ?? '').toLowerCase().includes(q)
    );
  });

  const activeCount = coaches.filter((c) => c.is_active).length;
  const pendingCount = coaches.reduce(
    (sum, c) => sum + c.batch_assignments.filter((a) => a.status === 'pending').length,
    0
  );
  const totalEarnings = coaches.reduce(
    (sum, c) => sum + (c.coach_profile?.hourly_rate ?? 0),
    0
  );

  // ── Onboard Handler ──
  const handleOnboardPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOnboardPhoto(file);
    const reader = new FileReader();
    reader.onload = (ev) => setOnboardPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      // Map form fields to API camelCase field names
      const payload: any = {
        firstName: onboardForm.first_name,
        lastName: onboardForm.last_name,
        email: onboardForm.email,
        password: onboardForm.password,
        phone: onboardForm.phone,
        expertise: onboardForm.expertise,
        availabilitySlots: onboardForm.availability_slots,
        hourlyRate: onboardForm.hourly_rate,
      };

      // Upload avatar if provided
      if (onboardPhoto) {
        const ext = onboardPhoto.name.split('.').pop();
        const path = `avatars/coach_${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('avatars')
          .upload(path, onboardPhoto, { upsert: true });
        if (!uploadErr && uploadData) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
          payload.avatarUrl = urlData.publicUrl;
        }
      }

      const res = await fetch('/api/v1/coaches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? 'Failed to onboard coach');
      }

      toastMessage('Coach onboarded successfully!');
      setShowOnboard(false);
      setOnboardForm({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        phone: '',
        expertise: '',
        availability_slots: '',
        hourly_rate: 500,
      });
      setOnboardPhoto(null);
      setOnboardPhotoPreview(null);
      await loadCoaches();
    } catch (err: any) {
      toastMessage(err.message ?? 'Error onboarding coach', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Edit Handler ──
  const openEdit = (coach: CoachItem) => {
    setSelectedCoach(coach);
    setEditForm({
      first_name: coach.first_name,
      last_name: coach.last_name,
      phone: coach.phone ?? '',
      expertise: coach.coach_profile?.expertise ?? '',
      availability_slots: coach.coach_profile?.availability_slots ?? '',
      hourly_rate: coach.coach_profile?.hourly_rate ?? 500,
    });
    setEditCerts(coach.coach_profile?.certificates ?? []);
    setShowEdit(true);
  };

  const handleCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedCoach) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setCertUploading(true);
    try {
      const path = `cert_${selectedCoach.id}_${Date.now()}.${file.name.split('.').pop()}`;
      const { error: uploadErr } = await supabase.storage
        .from('coach-certificates')
        .upload(path, file, { upsert: false });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('coach-certificates').getPublicUrl(path);
      const newCerts = [...editCerts, urlData.publicUrl];
      setEditCerts(newCerts);

      // Immediately persist certificates update
      await fetch('/api/v1/coaches', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachId: selectedCoach.id, certificates: newCerts }),
      });
      toastMessage('Certificate uploaded!');
    } catch (err: any) {
      toastMessage(err.message ?? 'Upload failed', 'error');
    } finally {
      setCertUploading(false);
      if (certInputRef.current) certInputRef.current.value = '';
    }
  };

  const handleRemoveCert = async (certUrl: string) => {
    if (!selectedCoach) return;
    const newCerts = editCerts.filter((c) => c !== certUrl);
    setEditCerts(newCerts);
    await fetch('/api/v1/coaches', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coachId: selectedCoach.id, certificates: newCerts }),
    });
    toastMessage('Certificate removed');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoach) return;
    setFormLoading(true);
    try {
      const res = await fetch('/api/v1/coaches', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId: selectedCoach.id,
          firstName: editForm.first_name,
          lastName: editForm.last_name,
          phone: editForm.phone,
          expertise: editForm.expertise,
          availabilitySlots: editForm.availability_slots,
          hourlyRate: editForm.hourly_rate,
          certificates: editCerts,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? 'Update failed');
      }
      toastMessage('Coach updated successfully!');
      setShowEdit(false);
      setSelectedCoach(null);
      await loadCoaches();
    } catch (err: any) {
      toastMessage(err.message ?? 'Error updating coach', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Toggle Active ──
  const handleToggleActive = async (coach: CoachItem) => {
    try {
      const res = await fetch('/api/v1/coaches', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachId: coach.id, action: coach.is_active ? 'deactivate' : 'reactivate' }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      toastMessage(`Coach ${coach.is_active ? 'deactivated' : 'reactivated'} successfully`);
      await loadCoaches();
    } catch (err: any) {
      toastMessage(err.message ?? 'Error', 'error');
    }
  };

  // ── Manage Batches ──
  const openBatchModal = (coach: CoachItem) => {
    setSelectedCoach(coach);
    setEditingDaysFor(null);
    setSelectedBatchToAssign('');
    setShowBatches(true);
    // Day selections initialized in useEffect when batches + coach are ready
  };

  // When the batch modal opens, initialize day selections for ALL batches
  useEffect(() => {
    if (!showBatches || !selectedCoach || batches.length === 0) return;
    setBatchDaySelections(() => {
      const map: Record<string, Set<number>> = {};
      batches.forEach((batch) => {
        // Check if coach has an existing assignment for this batch
        const assignment = selectedCoach.batch_assignments.find(
          (a) => a.batch?.id === batch.id
        );
        const days = assignment?.assigned_days ?? batch.days_of_week ?? [];
        map[batch.id] = new Set(days);
      });
      return map;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBatches, selectedCoach?.id, batches.length]);


  const toggleBatchDay = (batchId: string, day: number, batchDays: number[]) => {
    setBatchDaySelections((prev) => {
      const current = new Set(prev[batchId] ?? batchDays);
      if (current.has(day)) {
        current.delete(day);
      } else {
        current.add(day);
      }
      return { ...prev, [batchId]: current };
    });
  };

  const ensureDaySelection = (batchId: string, batchDays: number[]) => {
    setBatchDaySelections((prev) => {
      if (prev[batchId]) return prev;
      return { ...prev, [batchId]: new Set(batchDays) };
    });
  };

  const getAssignment = (coach: CoachItem, batchId: string) =>
    coach.batch_assignments.find((a) => a.batch?.id === batchId) ?? null;

  const handleAssign = async (batchId: string, batchDays: number[]) => {
    if (!selectedCoach) return;
    const selectedDays = batchDaySelections[batchId];
    const assignedDays = selectedDays ? Array.from(selectedDays).sort((a, b) => a - b) : null;
    // If all batch days are selected, store null (= all days)
    const isAllDays = assignedDays?.length === batchDays.length &&
      batchDays.every(d => assignedDays!.includes(d));
    try {
      const res = await fetch('/api/v1/coaches/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId: selectedCoach.id,
          batchId,
          assignedDays: isAllDays ? null : assignedDays,
        }),
      });
      if (!res.ok) throw new Error('Failed to assign');
      toastMessage('Coach assigned to batch!');
      await loadCoaches();
    } catch (err: any) {
      toastMessage(err.message ?? 'Error', 'error');
    }
  };

  const handleUpdateDays = async (assignmentId: string, batchId: string, batchDays: number[]) => {
    const selectedDays = batchDaySelections[batchId];
    const assignedDays = selectedDays ? Array.from(selectedDays).sort((a, b) => a - b) : null;
    const isAllDays = assignedDays?.length === batchDays.length &&
      batchDays.every(d => assignedDays!.includes(d));
    try {
      const res = await fetch('/api/v1/coaches/assignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId,
          assignedDays: isAllDays ? null : assignedDays,
        }),
      });
      if (!res.ok) throw new Error('Failed to update days');
      toastMessage('Schedule updated!');
      setEditingDaysFor(null);
      await loadCoaches();
    } catch (err: any) {
      toastMessage(err.message ?? 'Error', 'error');
    }
  };

  const handleRemoveAssignment = async (batchId: string) => {
    if (!selectedCoach) return;
    try {
      const res = await fetch(
        `/api/v1/coaches/assignments?coachId=${selectedCoach.id}&batchId=${batchId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('Failed to remove');
      toastMessage('Assignment removed');
      await loadCoaches();
    } catch (err: any) {
      toastMessage(err.message ?? 'Error', 'error');
    }
  };

  const handleApproveAssignment = async (assignmentId: string) => {
    try {
      const res = await fetch('/api/v1/coaches/assignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId: assignmentId, status: 'approved' }),
      });
      if (!res.ok) throw new Error('Failed to approve');
      toastMessage('Assignment approved!');
      await loadCoaches();
    } catch (err: any) {
      toastMessage(err.message ?? 'Error', 'error');
    }
  };

  const handleRejectAssignment = async (assignmentId: string) => {
    try {
      const res = await fetch('/api/v1/coaches/assignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId: assignmentId, status: 'rejected' }),
      });
      if (!res.ok) throw new Error('Failed to reject');
      toastMessage('Assignment rejected');
      await loadCoaches();
    } catch (err: any) {
      toastMessage(err.message ?? 'Error', 'error');
    }
  };

  // Sync selectedCoach after coaches reload
  useEffect(() => {
    if (selectedCoach && coaches.length > 0) {
      const updated = coaches.find((c) => c.id === selectedCoach.id);
      if (updated) setSelectedCoach(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coaches]);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#060814] text-slate-100 p-6 lg:p-8 space-y-8 animate-in fade-in duration-300">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <UserCog className="w-5 h-5 text-indigo-400" />
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-100">Coach Management</h1>
          </div>
          <p className="text-slate-400 text-sm ml-12">
            Coach roster &bull; Availability &bull; Session Earnings
          </p>
        </div>
        <button
          onClick={() => setShowOnboard(true)}
          className="btn-premium flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
        >
          <Plus className="w-4 h-4" />
          Onboard New Coach
        </button>
      </div>

      {/* ── Stats Row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5 text-indigo-400" />}
          label="Active Coaches"
          value={loading ? '—' : activeCount}
          accent="bg-indigo-500/10 border border-indigo-500/20"
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-amber-400" />}
          label="Pending Assignments"
          value={loading ? '—' : pendingCount}
          accent="bg-amber-500/10 border border-amber-500/20"
        />
        <StatCard
          icon={<IndianRupee className="w-5 h-5 text-emerald-400" />}
          label="Total Session Earnings"
          value={loading ? '—' : `₹${totalEarnings.toLocaleString('en-IN')}`}
          accent="bg-emerald-500/10 border border-emerald-500/20"
        />
      </div>

      {/* ── Coach Directory Table ─────────────────────────────────── */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        {/* Table Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h2 className="text-slate-100 font-semibold">Coach Directory</h2>
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              {filteredCoaches.length}
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search coaches..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="glass-input rounded-xl pl-9 pr-4 py-2 text-sm w-full sm:w-64"
            />
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
            <span>Loading coaches...</span>
          </div>
        ) : filteredCoaches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <AlertCircle className="w-8 h-8 text-slate-600" />
            <p className="text-sm">No coaches found</p>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-indigo-400 text-xs hover:text-indigo-300 transition-colors"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {[
                    { name: 'Coach', minWidth: '150px' },
                    { name: 'Phone', minWidth: '100px' },
                    { name: 'Expertise', minWidth: '100px' },
                    { name: 'Availability', minWidth: '120px' },
                    { name: 'Rate (₹/hr)', minWidth: '85px' },
                    { name: 'Batches', minWidth: '85px' },
                    { name: 'Status', minWidth: '80px' },
                    { name: 'Actions', minWidth: '110px' },
                  ].map((h) => (
                    <th
                      key={h.name}
                      style={{ minWidth: h.minWidth }}
                      className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-3 whitespace-nowrap"
                    >
                      {h.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCoaches.map((coach) => {
                  const isExpanded = expandedRow === coach.id;
                  const activeBatches = coach.batch_assignments.filter(
                    (a) => a.status === 'approved'
                  );
                  return (
                    <React.Fragment key={coach.id}>
                      <tr
                        className={`border-b border-white/5 cursor-pointer transition-colors duration-150 ${
                          isExpanded
                            ? 'bg-indigo-500/5'
                            : 'hover:bg-white/[0.02]'
                        }`}
                        onClick={() => setExpandedRow(isExpanded ? null : coach.id)}
                      >
                        {/* Avatar + Name + Email */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <AvatarCircle
                              url={coach.avatar_url}
                              first={coach.first_name}
                              last={coach.last_name}
                            />
                            <div>
                              <p className="font-semibold text-slate-100 whitespace-nowrap">
                                {coach.first_name} {coach.last_name}
                              </p>
                              <p className="text-slate-400 text-xs truncate max-w-[140px]">
                                {coach.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Phone */}
                        <td className="px-3 py-3 text-slate-300 whitespace-nowrap text-xs">
                          {coach.phone ?? <span className="text-slate-600">—</span>}
                        </td>

                        {/* Expertise */}
                        <td className="px-3 py-3">
                          {coach.coach_profile?.expertise ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 max-w-[120px] truncate">
                              <Award className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{coach.coach_profile.expertise}</span>
                            </span>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>

                        {/* Availability */}
                        <td className="px-3 py-3">
                          {coach.coach_profile?.availability_slots ? (
                            <p className="text-slate-300 text-xs max-w-[140px] line-clamp-2">
                              {coach.coach_profile.availability_slots}
                            </p>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>

                        {/* Hourly Rate */}
                        <td className="px-3 py-3 text-xs">
                          <span className="text-emerald-400 font-semibold">
                            ₹{(coach.coach_profile?.hourly_rate ?? 0).toLocaleString('en-IN')}
                          </span>
                        </td>

                        {/* Active Batches */}
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                            {activeBatches.length}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-3 py-3">
                          <StatusBadge active={coach.is_active} />
                        </td>

                        {/* Actions */}
                        <td
                          className="px-3 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEdit(coach)}
                              title="Edit Coach"
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-slate-200 transition-all duration-150"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openBatchModal(coach)}
                              title="Manage Batches"
                              className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 hover:text-indigo-300 transition-all duration-150"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleActive(coach)}
                              title={coach.is_active ? 'Deactivate' : 'Reactivate'}
                              className={`p-1.5 rounded-lg border transition-all duration-150 ${
                                coach.is_active
                                  ? 'bg-red-500/10 hover:bg-red-500/20 border-red-500/20 text-red-400 hover:text-red-300'
                                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 text-emerald-400 hover:text-emerald-300'
                              }`}
                            >
                              {coach.is_active ? (
                                <UserX className="w-3.5 h-3.5" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Row */}
                      {isExpanded && (
                        <tr key={`${coach.id}-expanded`} className="bg-indigo-500/[0.03]">
                          <td colSpan={8} className="px-8 py-5">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* Batch Assignments */}
                              <div>
                                <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5" />
                                  Batch Assignments
                                </p>
                                {coach.batch_assignments.length === 0 ? (
                                  <p className="text-slate-600 text-xs">No assignments yet</p>
                                ) : (
                                  <div className="space-y-2">
                                    {coach.batch_assignments.map((a) => (
                                      <div
                                        key={a.id}
                                        className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5"
                                      >
                                        <div>
                                          <p className="text-slate-200 text-xs font-semibold">
                                            {a.batch?.name ?? 'Unknown Batch'}
                                          </p>
                                          <p className="text-slate-500 text-[10px]">
                                            {a.batch?.class?.name ?? ''}{' '}
                                            {a.batch?.start_time
                                              ? `· ${formatTime(a.batch.start_time)} – ${formatTime(a.batch.end_time)}`
                                              : ''}
                                          </p>
                                        </div>
                                        <AssignmentBadge status={a.status} />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Certificates */}
                              <div>
                                <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                  <Award className="w-3.5 h-3.5" />
                                  Certificates
                                </p>
                                {(coach.coach_profile?.certificates ?? []).length === 0 ? (
                                  <p className="text-slate-600 text-xs">No certificates uploaded</p>
                                ) : (
                                  <div className="space-y-2">
                                    {(coach.coach_profile?.certificates ?? []).map((url, idx) => {
                                      const name = url.split('/').pop() ?? `Certificate ${idx + 1}`;
                                      return (
                                        <div
                                          key={url}
                                          className="flex items-center gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/5"
                                        >
                                          <FileText className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                                          <span className="text-slate-300 text-xs truncate flex-1 max-w-[180px]">
                                            {name}
                                          </span>
                                          <a
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1 rounded-lg hover:bg-white/10 text-indigo-400 hover:text-indigo-300 transition-colors"
                                            title="Download / Open"
                                          >
                                            <Download className="w-3.5 h-3.5" />
                                          </a>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Onboard Coach Modal ─────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {showOnboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowOnboard(false)}
          />
          {/* Panel */}
          <div className="relative glass-panel rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in duration-300">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-[#060814]/80 backdrop-blur-md z-10 rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                  <UserCheck className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-slate-100 font-semibold">Onboard New Coach</h2>
                  <p className="text-slate-400 text-xs">Add a coach to your team</p>
                </div>
              </div>
              <button
                onClick={() => setShowOnboard(false)}
                className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleOnboardSubmit} className="p-6 space-y-5">
              {/* Avatar Upload */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  {onboardPhotoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={onboardPhotoPreview}
                      alt="Preview"
                      className="w-20 h-20 rounded-full object-cover border-2 border-indigo-500/40"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-indigo-500/10 border-2 border-dashed border-indigo-500/30 flex items-center justify-center">
                      <Users className="w-8 h-8 text-indigo-400/50" />
                    </div>
                  )}
                  <label
                    htmlFor="onboard-avatar"
                    className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 cursor-pointer transition-colors border border-indigo-400/30"
                  >
                    <Upload className="w-3 h-3 text-white" />
                  </label>
                  <input
                    id="onboard-avatar"
                    type="file"
                    accept="image/*"
                    onChange={handleOnboardPhotoChange}
                    className="hidden"
                  />
                </div>
                <p className="text-slate-500 text-xs">Profile photo (optional)</p>
              </div>

              {/* Name Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    First Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="Jane"
                    value={onboardForm.first_name}
                    onChange={(e) =>
                      setOnboardForm((f) => ({ ...f, first_name: e.target.value }))
                    }
                    className="glass-input rounded-xl px-3 py-2 text-sm w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Last Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="Doe"
                    value={onboardForm.last_name}
                    onChange={(e) =>
                      setOnboardForm((f) => ({ ...f, last_name: e.target.value }))
                    }
                    className="glass-input rounded-xl px-3 py-2 text-sm w-full"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  required
                  type="email"
                  placeholder="coach@studio.com"
                  value={onboardForm.email}
                  onChange={(e) => setOnboardForm((f) => ({ ...f, email: e.target.value }))}
                  className="glass-input rounded-xl px-3 py-2 text-sm w-full"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Password <span className="text-red-400">*</span>
                </label>
                <input
                  required
                  type="password"
                  placeholder="Minimum 8 characters"
                  minLength={8}
                  value={onboardForm.password}
                  onChange={(e) => setOnboardForm((f) => ({ ...f, password: e.target.value }))}
                  className="glass-input rounded-xl px-3 py-2 text-sm w-full"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Phone</label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={onboardForm.phone}
                  onChange={(e) => setOnboardForm((f) => ({ ...f, phone: e.target.value }))}
                  className="glass-input rounded-xl px-3 py-2 text-sm w-full"
                />
              </div>

              {/* Expertise */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Expertise
                </label>
                <input
                  type="text"
                  placeholder="e.g. Yoga, Zumba, CrossFit"
                  value={onboardForm.expertise}
                  onChange={(e) => setOnboardForm((f) => ({ ...f, expertise: e.target.value }))}
                  className="glass-input rounded-xl px-3 py-2 text-sm w-full"
                />
              </div>

              {/* Availability */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Availability Slots
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Mon-Fri 6AM-9AM, Sat 7AM-11AM"
                  value={onboardForm.availability_slots}
                  onChange={(e) =>
                    setOnboardForm((f) => ({ ...f, availability_slots: e.target.value }))
                  }
                  className="glass-input rounded-xl px-3 py-2 text-sm w-full resize-none"
                />
              </div>

              {/* Hourly Rate */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Hourly Rate (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={onboardForm.hourly_rate}
                    onChange={(e) =>
                      setOnboardForm((f) => ({ ...f, hourly_rate: Number(e.target.value) }))
                    }
                    className="glass-input rounded-xl pl-7 pr-3 py-2 text-sm w-full"
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOnboard(false)}
                  className="btn-secondary flex-1 rounded-xl py-2.5 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="btn-premium flex-1 rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {formLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Onboarding...
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      Onboard Coach
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Edit Coach Modal ────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {showEdit && selectedCoach && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowEdit(false)}
          />
          <div className="relative glass-panel rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-[#060814]/80 backdrop-blur-md z-10 rounded-t-3xl">
              <div className="flex items-center gap-3">
                <AvatarCircle
                  url={selectedCoach.avatar_url}
                  first={selectedCoach.first_name}
                  last={selectedCoach.last_name}
                  size="sm"
                />
                <div>
                  <h2 className="text-slate-100 font-semibold">
                    Edit {selectedCoach.first_name} {selectedCoach.last_name}
                  </h2>
                  <p className="text-slate-400 text-xs">{selectedCoach.email}</p>
                </div>
              </div>
              <button
                onClick={() => setShowEdit(false)}
                className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-5">
              {/* Name Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    First Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={editForm.first_name}
                    onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))}
                    className="glass-input rounded-xl px-3 py-2 text-sm w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Last Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={editForm.last_name}
                    onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))}
                    className="glass-input rounded-xl px-3 py-2 text-sm w-full"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Phone</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  className="glass-input rounded-xl px-3 py-2 text-sm w-full"
                />
              </div>

              {/* Expertise */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Expertise
                </label>
                <input
                  type="text"
                  value={editForm.expertise}
                  onChange={(e) => setEditForm((f) => ({ ...f, expertise: e.target.value }))}
                  className="glass-input rounded-xl px-3 py-2 text-sm w-full"
                />
              </div>

              {/* Availability */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Availability Slots
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Mon-Fri 6AM-9AM, Sat 7AM-11AM"
                  value={editForm.availability_slots}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, availability_slots: e.target.value }))
                  }
                  className="glass-input rounded-xl px-3 py-2 text-sm w-full resize-none"
                />
              </div>

              {/* Hourly Rate */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Hourly Rate (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={50}
                    value={editForm.hourly_rate}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, hourly_rate: Number(e.target.value) }))
                    }
                    className="glass-input rounded-xl pl-7 pr-3 py-2 text-sm w-full"
                  />
                </div>
              </div>

              {/* ── Certificate Vault ── */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5" />
                    Certificate Vault
                  </p>
                  <label
                    htmlFor="cert-upload"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all border ${
                      certUploading
                        ? 'opacity-60 cursor-not-allowed bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                        : 'bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/20 text-indigo-400'
                    }`}
                  >
                    {certUploading ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-3 h-3" />
                        Add Certificate
                      </>
                    )}
                    <input
                      id="cert-upload"
                      ref={certInputRef}
                      type="file"
                      accept=".pdf,image/*"
                      onChange={handleCertUpload}
                      disabled={certUploading}
                      className="hidden"
                    />
                  </label>
                </div>

                {editCerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 rounded-xl border border-dashed border-white/10 text-slate-600 gap-2">
                    <FileText className="w-6 h-6" />
                    <p className="text-xs">No certificates uploaded yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {editCerts.map((url) => {
                      const name = decodeURIComponent(url.split('/').pop() ?? url);
                      return (
                        <div
                          key={url}
                          className="flex items-center gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                          <span className="text-slate-300 text-xs truncate flex-1 max-w-[200px]">
                            {name}
                          </span>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded-lg hover:bg-white/10 text-indigo-400 hover:text-indigo-300 transition-colors flex-shrink-0"
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleRemoveCert(url)}
                            className="p-1 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                            title="Remove certificate"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="btn-secondary flex-1 rounded-xl py-2.5 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="btn-premium flex-1 rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {formLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Manage Schedule Modal ───────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {showBatches && selectedCoach && (() => {
        // Approved assignments for this coach
        const approvedAssignments = selectedCoach.batch_assignments.filter(
          (a) => a.status === 'approved' && a.batch
        );
        // Pending assignments
        const pendingAssignments = selectedCoach.batch_assignments.filter(
          (a) => a.status === 'pending' && a.batch
        );
        // Batch IDs already assigned (approved or pending)
        const assignedBatchIds = new Set(
          selectedCoach.batch_assignments
            .filter((a) => a.status === 'approved' || a.status === 'pending')
            .map((a) => a.batch?.id)
            .filter(Boolean)
        );
        // Batches available to assign (not yet approved/pending)
        const unassignedBatches = batches.filter((b) => !assignedBatchIds.has(b.id));
        // Currently selected batch for new assignment
        const pickBatch = batches.find((b) => b.id === selectedBatchToAssign) ?? null;
        const pickDays: number[] = pickBatch?.days_of_week ?? [];
        const pickSelected: Set<number> = batchDaySelections[selectedBatchToAssign] ?? new Set(pickDays);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowBatches(false)}
            />
            <div className="relative glass-panel rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in duration-300">

              {/* ── Header ── */}
              <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-[#060814]/90 backdrop-blur-md z-10 rounded-t-3xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                    <Calendar className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-slate-100 font-semibold">Manage Schedule</h2>
                    <p className="text-slate-400 text-xs">
                      {selectedCoach.first_name} {selectedCoach.last_name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBatches(false)}
                  className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-6">

                {/* ══ SECTION 1: ACTIVE SCHEDULE ══ */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                      Active Schedule
                    </h3>
                    {approvedAssignments.length > 0 && (
                      <span className="ml-auto bg-emerald-500/15 text-emerald-400 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-emerald-500/25">
                        {approvedAssignments.length} batch{approvedAssignments.length !== 1 ? 'es' : ''}
                      </span>
                    )}
                  </div>

                  {approvedAssignments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 gap-2 text-slate-600 rounded-2xl bg-white/[0.02] border border-white/5">
                      <Calendar className="w-6 h-6" />
                      <p className="text-xs">No approved batches yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {approvedAssignments.map((assignment) => {
                        const batch = assignment.batch!;
                        const batchDays: number[] = batch.days_of_week ?? [];
                        const isEditingDays = editingDaysFor === assignment.id;
                        const editSelected: Set<number> = batchDaySelections[batch.id] ?? new Set(batchDays);

                        return (
                          <div
                            key={assignment.id}
                            className="rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/15 overflow-hidden"
                          >
                            {/* Batch info row */}
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-4">
                              <div className="flex-1 min-w-0">
                                <p className="text-slate-100 text-sm font-semibold truncate">{batch.name}</p>
                                <p className="text-slate-400 text-xs mt-0.5">
                                  {(batch as any).class?.name ?? ''}
                                  {batch.start_time ? ` · ${formatTime(batch.start_time)} – ${formatTime(batch.end_time)}` : ''}
                                </p>
                                {/* Assigned days row */}
                                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                  {assignment.assigned_days && assignment.assigned_days.length > 0 ? (
                                    <>
                                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Days:</span>
                                      {assignment.assigned_days.map((d) => (
                                        <span key={d} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">
                                          {DAY_LABELS[d]}
                                        </span>
                                      ))}
                                    </>
                                  ) : (
                                    batchDays.map((d) => <DayBadge key={d} day={d} />)
                                  )}
                                </div>
                              </div>
                              {/* Actions */}
                              {!isEditingDays && (
                                <div className="flex items-center gap-2 mt-2 sm:mt-0 w-full sm:w-auto justify-end flex-shrink-0">
                                  <button
                                    onClick={() => {
                                      ensureDaySelection(batch.id, assignment.assigned_days ?? batchDays);
                                      setEditingDaysFor(assignment.id);
                                    }}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 hover:text-indigo-300 transition-all"
                                  >
                                    <Edit2 className="w-3 h-3" /> Days
                                  </button>
                                  <button
                                    onClick={() => handleRemoveAssignment(batch.id)}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 transition-all"
                                  >
                                    <XCircle className="w-3 h-3" /> Remove
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Inline day editor */}
                            {isEditingDays && (
                              <div className="px-4 pb-4 border-t border-white/5 pt-3">
                                <p className="text-xs text-slate-400 mb-2 font-medium">Edit assigned days:</p>
                                <div className="flex flex-wrap gap-2">
                                  {batchDays.map((d) => {
                                    const isOn = editSelected.has(d);
                                    return (
                                      <button
                                        key={d}
                                        type="button"
                                        onClick={() => toggleBatchDay(batch.id, d, batchDays)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                          isOn
                                            ? 'bg-indigo-500/25 border-indigo-400/50 text-indigo-300'
                                            : 'bg-white/5 border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-400'
                                        }`}
                                      >
                                        {DAY_LABELS[d]}
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="flex items-center gap-3 mt-2">
                                  <button type="button" onClick={() => setBatchDaySelections(prev => ({ ...prev, [batch.id]: new Set(batchDays) }))} className="text-[10px] text-indigo-400 hover:text-indigo-300">All</button>
                                  <span className="text-slate-700 text-[10px]">·</span>
                                  <button type="button" onClick={() => setBatchDaySelections(prev => ({ ...prev, [batch.id]: new Set() }))} className="text-[10px] text-slate-500 hover:text-slate-400">Clear</button>
                                  <span className="ml-auto text-[10px] text-slate-500">{editSelected.size}/{batchDays.length} days</span>
                                </div>
                                <div className="flex gap-2 mt-3">
                                  <button
                                    onClick={() => handleUpdateDays(assignment.id, batch.id, batchDays)}
                                    disabled={editSelected.size === 0}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Save Schedule
                                  </button>
                                  <button
                                    onClick={() => setEditingDaysFor(null)}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 transition-all"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ══ Pending approvals (compact) ══ */}
                {pendingAssignments.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      <h3 className="text-xs font-bold text-amber-400 uppercase tracking-widest">Pending Approval</h3>
                      <span className="ml-auto bg-amber-500/15 text-amber-400 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-amber-500/25">
                        {pendingAssignments.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {pendingAssignments.map((assignment) => (
                        <div key={assignment.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-amber-500/[0.04] border border-amber-500/15">
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-200 text-xs font-semibold truncate">{assignment.batch!.name}</p>
                            <p className="text-slate-500 text-[10px] mt-0.5">
                              {assignment.batch!.start_time?.slice(0,5)} – {assignment.batch!.end_time?.slice(0,5)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 mt-2 sm:mt-0 w-full sm:w-auto justify-end flex-shrink-0">
                            <button
                              onClick={() => handleApproveAssignment(assignment.id)}
                              className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 transition-all"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Approve
                            </button>
                            <button
                              onClick={() => handleRejectAssignment(assignment.id)}
                              className="flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-all"
                            >
                              <XCircle className="w-3 h-3" /> Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ══ SECTION 2: ADD TO SCHEDULE ══ */}
                <div className="border-t border-white/10 pt-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Plus className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Add to Schedule</h3>
                  </div>
                  {unassignedBatches.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 gap-2 text-slate-600 rounded-2xl bg-white/[0.02] border border-white/5">
                      <CheckCircle2 className="w-6 h-6 text-emerald-700" />
                      <p className="text-xs">All active batches are already assigned</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(() => {
                        const unassignedOptions = [
                          { value: '', label: '-- Choose a batch --' },
                          ...unassignedBatches.map((b) => ({
                            value: b.id,
                            label: `${b.name}${b.start_time ? ` · ${b.start_time.slice(0, 5)}–${b.end_time.slice(0, 5)}` : ''}`
                          }))
                        ];
                        return (
                          <div>
                            <label className="text-slate-400 text-[10px] font-semibold block mb-1.5">Select a batch to assign</label>
                            <CustomSelect
                              value={selectedBatchToAssign}
                              onChange={(bid) => {
                                setSelectedBatchToAssign(bid);
                                if (bid) {
                                  const b = batches.find(bx => bx.id === bid);
                                  if (b) setBatchDaySelections(prev => ({ ...prev, [bid]: new Set(b.days_of_week ?? []) }));
                                }
                              }}
                              options={unassignedOptions}
                              placeholder="-- Choose a batch --"
                            />
                          </div>
                        );
                      })()}
                      {pickBatch && pickDays.length > 0 && (
                        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-3">
                          <div>
                            <p className="text-slate-200 text-xs font-semibold">{pickBatch.name}</p>
                            <p className="text-slate-400 text-[10px] mt-0.5">{formatTime(pickBatch.start_time)} {`\u2013`} {formatTime(pickBatch.end_time)}</p>
                            <div className="flex flex-wrap gap-1 mt-1.5">{pickDays.map(d => <DayBadge key={d} day={d} />)}</div>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 font-medium mb-2">Select days for this coach:</p>
                            <div className="flex flex-wrap gap-2">
                              {pickDays.map((d) => {
                                const isOn = pickSelected.has(d);
                                return (
                                  <button key={d} type="button" onClick={() => toggleBatchDay(selectedBatchToAssign, d, pickDays)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${isOn ? "bg-indigo-500/25 border-indigo-400/50 text-indigo-300" : "bg-white/5 border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-400"}`}>
                                    {DAY_LABELS[d]}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                              <button type="button" onClick={() => setBatchDaySelections(prev => ({ ...prev, [selectedBatchToAssign]: new Set(pickDays) }))} className="text-[10px] text-indigo-400 hover:text-indigo-300">All days</button>
                              <span className="text-slate-700 text-[10px]">·</span>
                              <button type="button" onClick={() => setBatchDaySelections(prev => ({ ...prev, [selectedBatchToAssign]: new Set() }))} className="text-[10px] text-slate-500 hover:text-slate-400">Clear</button>
                              <span className="ml-auto text-[10px] text-slate-500">{pickSelected.size}/{pickDays.length} days selected</span>
                            </div>
                          </div>
                          <button
                            onClick={async () => { await handleAssign(selectedBatchToAssign, pickDays); setSelectedBatchToAssign(""); }}
                            disabled={pickSelected.size === 0}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                          >
                            <Plus className="w-4 h-4" />
                            Add to Schedule ({pickSelected.size} day{pickSelected.size !== 1 ? "s" : ""})
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-6 pt-0">
                <button onClick={() => setShowBatches(false)} className="btn-secondary w-full rounded-xl py-2.5 text-sm font-semibold">Done</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

