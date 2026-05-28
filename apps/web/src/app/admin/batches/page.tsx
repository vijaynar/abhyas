'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Edit2,
  Plus,
  Sparkles,
  UserCog,
  X,
  XCircle,
} from 'lucide-react';
import CustomSelect from '../components/CustomSelect';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface BatchItem {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  max_capacity: number;
  is_active: boolean;
  class_id: string;
  classes: {
    name: string;
  };
}

interface ClassOption {
  id: string;
  name: string;
}

interface CoachAssignment {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  assigned_days: number[] | null;
  coach: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url: string | null;
    coach_profile: {
      expertise: string | null;
      availability_slots: string | null;
      hourly_rate: number;
    } | null;
  };
}

interface AvailableCoach {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url: string | null;
  coach_profile: {
    expertise: string | null;
    availability_slots: string | null;
    hourly_rate: number;
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true if the coach's availability_slots string overlaps with the batch time window. */
function slotsOverlap(
  availabilitySlots: string | null,
  batchStart: string,
  batchEnd: string,
): boolean {
  if (!availabilitySlots) return false;
  // availability_slots is expected as "HH:MM-HH:MM,HH:MM-HH:MM" CSV or similar
  const toMinutes = (t: string) => {
    const parts = t.trim().split(':');
    return parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10);
  };
  const bStart = toMinutes(batchStart.slice(0, 5));
  const bEnd = toMinutes(batchEnd.slice(0, 5));

  const ranges = availabilitySlots.split(',');
  for (const range of ranges) {
    const [s, e] = range.trim().split('-');
    if (!s || !e) continue;
    const sMin = toMinutes(s);
    const eMin = toMinutes(e);
    // Overlap condition
    if (sMin < bEnd && eMin > bStart) return true;
  }
  return false;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BatchesPage() {
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [classesList, setClassesList] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<BatchItem | null>(null);

  // ── Coach management state ────────────────────────────────────────────────
  const [assignments, setAssignments] = useState<Record<string, CoachAssignment[]>>({});
  const [managingBatch, setManagingBatch] = useState<BatchItem | null>(null);
  const [availableCoaches, setAvailableCoaches] = useState<AvailableCoach[]>([]);
  const [userRole, setUserRole] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedCoachId, setSelectedCoachId] = useState<string>('');
  const [assignLoading, setAssignLoading] = useState(false);
  // Day picker for coach assignment
  const [assignDaySelections, setAssignDaySelections] = useState<Set<number>>(new Set());

  // ── Batch form state ──────────────────────────────────────────────────────
  const [classId, setClassId] = useState('');
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [maxCapacity, setMaxCapacity] = useState('30');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [isActive, setIsActive] = useState(true);

  const supabase = createBrowserClient();

  const weekdayNames: Record<number, string> = {
    1: 'Mon',
    2: 'Tue',
    3: 'Wed',
    4: 'Thu',
    5: 'Fri',
    6: 'Sat',
    7: 'Sun',
  };

  // ─── Data Loaders ──────────────────────────────────────────────────────────

  const loadUserRole = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();
      if (profile) setUserRole((profile as { role: string }).role ?? '');
    } catch (err) {
      console.error('Failed to load user role:', err);
    }
  };

  const loadAvailableCoaches = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(
          `id, first_name, last_name, email, avatar_url,
           coach_profile:coaches(expertise, availability_slots, hourly_rate)`,
        )
        .eq('role', 'coach')
        .eq('is_active', true)
        .order('first_name');
      if (error) throw error;
      setAvailableCoaches((data ?? []) as unknown as AvailableCoach[]);
    } catch (err) {
      console.error('Failed to load coaches:', err);
    }
  };

  const loadAssignments = async (batchIds: string[]) => {
    if (batchIds.length === 0) return;
    try {
      const { data, error } = await supabase
        .from('coach_batch_assignments')
        .select(
          `id, batch_id, status, assigned_days,
           coach:coach_id(id, first_name, last_name, email, avatar_url,
             coach_profile:coaches(expertise, availability_slots, hourly_rate))`,
        )
        .in('batch_id', batchIds);
      if (error) throw error;

      const grouped: Record<string, CoachAssignment[]> = {};
      for (const row of (data ?? []) as unknown as (CoachAssignment & { batch_id: string })[]) {
        if (!grouped[row.batch_id]) grouped[row.batch_id] = [];
        grouped[row.batch_id].push({
          id: row.id,
          status: row.status,
          assigned_days: (row as any).assigned_days ?? null,
          coach: row.coach,
        });
      }
      setAssignments(grouped);
    } catch (err) {
      console.error('Failed to load assignments:', err);
    }
  };

  const loadBatchesAndClasses = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile) return;
      const tenantId = (profile as { tenant_id: string }).tenant_id;

      // 1. Load Batches
      const { data: batchData, error: batchErr } = await supabase
        .from('batches')
        .select(
          'id, name, start_time, end_time, days_of_week, max_capacity, is_active, class_id, classes:class_id(name)',
        )
        .eq('tenant_id', tenantId)
        .order('start_time');

      if (batchErr) throw batchErr;

      // 2. Load Classes for dropdown selection
      const { data: classData } = await supabase
        .from('classes')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name');

      const loadedBatches = (batchData ?? []) as unknown as BatchItem[];
      setBatches(loadedBatches);
      setClassesList(classData ?? []);

      // 3. Load coach assignments for all batches
      await loadAssignments(loadedBatches.map((b) => b.id));
    } catch (err) {
      console.error('Failed to load scheduling data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUserRole();
    loadAvailableCoaches();
    loadBatchesAndClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize day selections when a batch is opened for management
  useEffect(() => {
    if (managingBatch) {
      setAssignDaySelections(new Set(managingBatch.days_of_week ?? []));
      setSelectedCoachId('');
    }
  }, [managingBatch?.id]);

  // ─── Success flash helper ──────────────────────────────────────────────────

  const flashSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // ─── Batch form helpers ────────────────────────────────────────────────────

  const handleDayToggle = (day: number) => {
    if (daysOfWeek.includes(day)) {
      setDaysOfWeek(daysOfWeek.filter((d) => d !== day));
    } else {
      setDaysOfWeek([...daysOfWeek, day].sort());
    }
  };

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId || !name.trim() || daysOfWeek.length === 0) {
      alert('Please complete all scheduling fields.');
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile) return;

      // Format time as HH:MM:SS for postgres TIME format
      const formattedStart = startTime.length === 5 ? `${startTime}:00` : startTime;
      const formattedEnd = endTime.length === 5 ? `${endTime}:00` : endTime;

      if (editingBatch) {
        // Edit Mode
        const { error } = await supabase
          .from('batches')
          .update({
            name,
            start_time: formattedStart,
            end_time: formattedEnd,
            days_of_week: daysOfWeek,
            max_capacity: parseInt(maxCapacity) || 30,
            is_active: isActive,
          })
          .eq('id', editingBatch.id);

        if (error) throw error;
      } else {
        // Add Mode
        const { error } = await supabase
          .from('batches')
          .insert({
            tenant_id: (profile as { tenant_id: string }).tenant_id,
            class_id: classId,
            name,
            start_time: formattedStart,
            end_time: formattedEnd,
            days_of_week: daysOfWeek,
            max_capacity: parseInt(maxCapacity) || 30,
            is_active: true,
          });

        if (error) throw error;
      }

      setClassId('');
      setName('');
      setStartTime('09:00');
      setEndTime('10:00');
      setMaxCapacity('30');
      setDaysOfWeek([]);
      setIsActive(true);
      setShowAddModal(false);
      setEditingBatch(null);
      await loadBatchesAndClasses();
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save batch slot.');
    }
  };

  const handleEditClick = (item: BatchItem) => {
    setEditingBatch(item);
    setClassId(item.class_id);
    setName(item.name);
    // Strip trailing seconds for html time input ("09:00:00" -> "09:00")
    setStartTime(item.start_time.slice(0, 5));
    setEndTime(item.end_time.slice(0, 5));
    setMaxCapacity(item.max_capacity.toString());
    setDaysOfWeek(item.days_of_week);
    setIsActive(item.is_active);
    setShowAddModal(true);
  };

  // ─── Coach management handlers ─────────────────────────────────────────────

  /** Admin assigns a coach directly to a batch (status → approved) */
  const handleAssignCoach = async (coachId: string, batchId: string) => {
    if (!coachId || !batchId || !managingBatch) return;
    setAssignLoading(true);
    const batchDays = managingBatch.days_of_week ?? [];
    const selectedArr = Array.from(assignDaySelections).sort((a, b) => a - b);
    // null = all batch days; otherwise send the subset
    const isAll = selectedArr.length === batchDays.length &&
      batchDays.every(d => selectedArr.includes(d));
    try {
      const res = await fetch('/api/v1/coaches/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId,
          batchId,
          assignedDays: isAll ? null : selectedArr,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadAssignments(batches.map((b) => b.id));
      setSelectedCoachId('');
      setAssignDaySelections(new Set(batchDays));
      flashSuccess('Coach assigned successfully.');
    } catch (err) {
      console.error('Assign coach failed:', err);
      alert('Failed to assign coach.');
    } finally {
      setAssignLoading(false);
    }
  };

  /** Approve a pending assignment */
  const handleApproveAssignment = async (assignmentId: string) => {
    try {
      const res = await fetch('/api/v1/coaches/assignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId, status: 'approved' }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadAssignments(batches.map((b) => b.id));
      flashSuccess('Assignment approved.');
    } catch (err) {
      console.error('Approve failed:', err);
      alert('Failed to approve assignment.');
    }
  };

  /** Reject a pending assignment */
  const handleRejectAssignment = async (assignmentId: string) => {
    try {
      const res = await fetch('/api/v1/coaches/assignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId, status: 'rejected' }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadAssignments(batches.map((b) => b.id));
      flashSuccess('Assignment rejected.');
    } catch (err) {
      console.error('Reject failed:', err);
      alert('Failed to reject assignment.');
    }
  };

  /** Admin removes an approved coach from a batch */
  const handleRemoveCoach = async (coachId: string, batchId: string) => {
    if (!confirm('Remove this coach from the batch?')) return;
    try {
      const res = await fetch(
        `/api/v1/coaches/assignments?coachId=${coachId}&batchId=${batchId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error(await res.text());
      await loadAssignments(batches.map((b) => b.id));
      flashSuccess('Coach removed from batch.');
    } catch (err) {
      console.error('Remove coach failed:', err);
      alert('Failed to remove coach.');
    }
  };

  /** Coach self-requests assignment to a batch (status → pending) */
  const handleRequestAssignment = async (batchId: string) => {
    try {
      const res = await fetch('/api/v1/coaches/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachId: currentUserId, batchId, status: 'pending' }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadAssignments(batches.map((b) => b.id));
      flashSuccess('Request sent! Awaiting admin approval.');
    } catch (err) {
      console.error('Request assignment failed:', err);
      alert('Failed to submit assignment request.');
    }
  };

  // ─── Derived helpers ───────────────────────────────────────────────────────

  const isAdminOrSuperadmin = userRole === 'admin' || userRole === 'superadmin';
  const isCoachRole = userRole === 'coach';

  /** Coaches already assigned to managingBatch (any status) */
  const assignedCoachIds = managingBatch
    ? (assignments[managingBatch.id] ?? []).map((a) => a.coach.id)
    : [];

  /** Coaches not yet assigned to the currently managing batch */
  const unassignedCoaches = managingBatch
    ? availableCoaches.filter((c) => !assignedCoachIds.includes(c.id))
    : [];

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* ── Success Flash ── */}
      {successMsg && (
        <div className="fixed top-4 right-4 z-[100] flex items-center gap-2 bg-emerald-900/80 border border-emerald-500/30 text-emerald-300 text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="w-4 h-4" />
          {successMsg}
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold tracking-widest uppercase mb-1">
            <Sparkles className="w-4 h-4" /> Weekly Slots
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Batch Schedule Control
          </h1>
        </div>
        {isAdminOrSuperadmin && (
          <button
            onClick={() => {
              setEditingBatch(null);
              setClassId('');
              setName('');
              setStartTime('09:00');
              setEndTime('10:00');
              setMaxCapacity('30');
              setDaysOfWeek([]);
              setIsActive(true);
              setShowAddModal(true);
            }}
            className="btn-premium h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer self-start md:self-auto"
          >
            <Plus className="w-4 h-4" /> Add New Batch
          </button>
        )}
      </div>

      {/* ── Main Table Container ── */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin glow-indigo" />
        </div>
      ) : batches.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl text-center max-w-md mx-auto">
          <Calendar className="w-12 h-12 text-indigo-400/40 mx-auto mb-4" />
          <h3 className="text-sm font-bold text-white mb-1">No Active Batches</h3>
          <p className="text-xs text-slate-500 leading-relaxed mb-6">
            Assign custom class schedules, active check-in windows, and set capacity thresholds for
            students.
          </p>
          {isAdminOrSuperadmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-premium h-9 px-4 rounded-xl text-xs font-bold cursor-pointer"
            >
              Create Your First Batch
            </button>
          )}
        </div>
      ) : (
        <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-xs font-bold text-slate-300">
                  <th className="p-4 w-[15%] min-w-[120px]">Batch Name</th>
                  <th className="p-4 w-[15%] min-w-[130px]">Linked Course / Class</th>
                  <th className="p-4 w-[15%] min-w-[120px]">Scheduled Hours</th>
                  <th className="p-4 w-[20%] min-w-[160px]">Active Days</th>
                  <th className="p-4 w-[10%] min-w-[90px]">Capacity</th>
                  <th className="p-4 w-[10%] min-w-[80px]">Status</th>
                  <th className="p-4 w-[15%] min-w-[160px]">Coaches</th>
                  <th className="p-4 text-right w-[10%] min-w-[80px]">Actions</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-white/5 text-slate-300">
                {batches.map((item) => {
                  const batchAssignments = assignments[item.id] ?? [];
                  const approved = batchAssignments.filter((a) => a.status === 'approved');
                  const pending = batchAssignments.filter((a) => a.status === 'pending');

                  // For coaches: find their own assignment for this batch
                  const myAssignment = isCoachRole
                    ? batchAssignments.find((a) => a.coach.id === currentUserId)
                    : null;
                  const alreadyAssigned = !!myAssignment;

                  return (
                    <tr key={item.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="p-4 font-bold text-slate-200">{item.name}</td>
                      <td className="p-4">{item.classes.name}</td>
                      <td className="p-4 text-slate-400 font-medium">
                        {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {item.days_of_week.map((day) => (
                            <span
                              key={day}
                              className="px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-bold text-indigo-400"
                            >
                              {weekdayNames[day]}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">{item.max_capacity} students</td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase border
                            ${
                              item.is_active
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                : 'bg-slate-800 border-white/5 text-slate-500'
                            }`}
                        >
                          {item.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* ── Coaches Column ── */}
                      <td className="p-4">
                        <div className="flex flex-col gap-1.5 min-w-[160px]">
                          {/* Approved coaches */}
                          {approved.map((a) => (
                            <div key={a.id} className="flex items-center gap-1.5">
                              {/* Avatar circle */}
                              <div className="w-5 h-5 rounded-full bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {a.coach.avatar_url ? (
                                  <img
                                    src={a.coach.avatar_url}
                                    alt={a.coach.first_name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className="text-[8px] font-bold text-emerald-400">
                                    {a.coach.first_name.charAt(0)}
                                    {a.coach.last_name.charAt(0)}
                                  </span>
                                )}
                              </div>
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-400 truncate max-w-[110px]">
                                {a.coach.first_name} {a.coach.last_name}
                              </span>
                            </div>
                          ))}

                          {/* Pending coaches */}
                          {pending.map((a) => (
                            <div key={a.id} className="flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-amber-400 flex-shrink-0" />
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[9px] font-bold text-amber-400 truncate max-w-[120px]">
                                Pending: {a.coach.first_name} {a.coach.last_name}
                              </span>
                            </div>
                          ))}

                          {/* No coaches yet */}
                          {batchAssignments.length === 0 && (
                            <span className="text-[9px] text-slate-600 italic">No coaches</span>
                          )}

                          {/* Coach self-status + request button */}
                          {isCoachRole && (
                            <div className="mt-1">
                              {myAssignment ? (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                    myAssignment.status === 'approved'
                                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                      : myAssignment.status === 'pending'
                                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                                  }`}
                                >
                                  {myAssignment.status === 'approved'
                                    ? '✓ Assigned'
                                    : myAssignment.status === 'pending'
                                      ? '⏳ Pending'
                                      : '✕ Rejected'}
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleRequestAssignment(item.id)}
                                  disabled={alreadyAssigned}
                                  className="btn-secondary h-6 px-2 rounded-lg text-[9px] font-bold cursor-pointer whitespace-nowrap"
                                >
                                  Request Assignment
                                </button>
                              )}
                            </div>
                          )}

                          {/* Manage button for admin/superadmin */}
                          {isAdminOrSuperadmin && (
                            <button
                              onClick={() => {
                                setManagingBatch(item);
                                setSelectedCoachId('');
                              }}
                              className="mt-1 flex items-center gap-1 btn-secondary h-6 px-2 rounded-lg text-[9px] font-bold cursor-pointer whitespace-nowrap self-start"
                            >
                              <UserCog className="w-3 h-3" />
                              Manage Coaches
                            </button>
                          )}
                        </div>
                      </td>

                      {/* ── Actions Column ── */}
                      <td className="p-4 text-right">
                        {isAdminOrSuperadmin && (
                          <button
                            onClick={() => handleEditClick(item)}
                            className="btn-secondary h-7 px-2.5 rounded-lg text-[10px] font-bold cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3 mr-1 inline-block" /> Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Create / Update Batch Scheduling ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-6">
              {editingBatch ? 'Modify Batch Details' : 'Configure New Batch Slot'}
            </h3>

            <form onSubmit={handleSaveBatch} className="space-y-4">
              {/* Class Link Dropdown */}
              <div className="space-y-1">
                <label className="text-slate-300 text-xs font-semibold block">
                  Link to Academic Class
                </label>
                {(() => {
                  const classOptions = [
                    { value: '', label: '-- Select Class / Course --' },
                    ...classesList.map((c) => ({ value: c.id, label: c.name }))
                  ];
                  return (
                    <CustomSelect
                      value={classId}
                      onChange={setClassId}
                      options={classOptions}
                      placeholder="-- Select Class / Course --"
                      disabled={editingBatch !== null}
                    />
                  );
                })()}
              </div>

              {/* Batch Name */}
              <div className="space-y-1">
                <label className="text-slate-300 text-xs font-semibold block">Batch Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Morning 06:00 AM Slot"
                  className="w-full h-10 px-4 rounded-xl glass-input text-xs"
                />
              </div>

              {/* Times Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-300 text-xs font-semibold block">Start Time</label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full h-10 px-4 rounded-xl glass-input text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 text-xs font-semibold block">End Time</label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full h-10 px-4 rounded-xl glass-input text-xs"
                  />
                </div>
              </div>

              {/* Capacity Limit */}
              <div className="space-y-1">
                <label className="text-slate-300 text-xs font-semibold block">Max Capacity</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={maxCapacity}
                  onChange={(e) => setMaxCapacity(e.target.value)}
                  placeholder="30"
                  className="w-full h-10 px-4 rounded-xl glass-input text-xs"
                />
              </div>

              {/* Days of Week Multiple Selector */}
              <div className="space-y-2">
                <label className="text-slate-300 text-xs font-semibold block">
                  Scheduled Days
                </label>
                <div className="flex gap-1.5 justify-between">
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                    const selected = daysOfWeek.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleDayToggle(day)}
                        className={`flex-1 h-9 rounded-lg border text-[10px] font-bold transition-all cursor-pointer
                        ${
                          selected
                            ? 'bg-indigo-600 border-indigo-500 text-white glow-indigo'
                            : 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/5'
                        }`}
                      >
                        {weekdayNames[day]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Edit Mode Status Checkbox */}
              {editingBatch && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="isBatchActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 accent-indigo-500 rounded border-white/10"
                  />
                  <label htmlFor="isBatchActive" className="text-xs text-slate-300 font-medium">
                    This scheduling slot is currently Active
                  </label>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary h-9 px-4 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-premium h-9 px-4 rounded-lg text-xs font-bold cursor-pointer"
                >
                  {editingBatch ? 'Update Schedule' : 'Schedule Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Manage Coaches ── */}
      {managingBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg glass-panel rounded-2xl relative flex flex-col max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-2">
                <UserCog className="w-5 h-5 text-indigo-400" />
                <div>
                  <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-widest mb-0.5">
                    Coach Assignments
                  </p>
                  <h3 className="text-sm font-bold text-white leading-tight">
                    {managingBatch.name}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setManagingBatch(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              {/* ── Section 1: Pending Requests ── */}
              {(() => {
                const pendingList = (assignments[managingBatch.id] ?? []).filter(
                  (a) => a.status === 'pending',
                );
                return (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                      <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                        Pending Requests
                      </h4>
                      {pendingList.length > 0 && (
                        <span className="ml-auto bg-amber-500/20 text-amber-400 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-amber-500/30">
                          {pendingList.length}
                        </span>
                      )}
                    </div>
                    {pendingList.length === 0 ? (
                      <p className="text-[10px] text-slate-600 italic pl-1">
                        No pending requests.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {pendingList.map((a) => (
                          <div
                            key={a.id}
                            className="flex items-center gap-3 bg-amber-500/5 border border-amber-500/10 rounded-xl p-3"
                          >
                            {/* Avatar */}
                            <div className="w-8 h-8 rounded-full bg-amber-600/20 border border-amber-500/30 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {a.coach.avatar_url ? (
                                <img
                                  src={a.coach.avatar_url}
                                  alt={a.coach.first_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-[10px] font-bold text-amber-400">
                                  {a.coach.first_name.charAt(0)}
                                  {a.coach.last_name.charAt(0)}
                                </span>
                              )}
                            </div>
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-200 truncate">
                                {a.coach.first_name} {a.coach.last_name}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">{a.coach.email}</p>
                              {a.coach.coach_profile?.expertise && (
                                <p className="text-[9px] text-indigo-400 mt-0.5 truncate">
                                  {a.coach.coach_profile.expertise}
                                </p>
                              )}
                            </div>
                            {/* Actions */}
                            <div className="flex gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => handleApproveAssignment(a.id)}
                                title="Approve"
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleRejectAssignment(a.id)}
                                title="Reject"
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Section 2: Active Coaches ── */}
              {(() => {
                const approvedList = (assignments[managingBatch.id] ?? []).filter(
                  (a) => a.status === 'approved',
                );
                return (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                        Active Coaches
                      </h4>
                      {approvedList.length > 0 && (
                        <span className="ml-auto bg-emerald-500/20 text-emerald-400 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-emerald-500/30">
                          {approvedList.length}
                        </span>
                      )}
                    </div>
                    {approvedList.length === 0 ? (
                      <p className="text-[10px] text-slate-600 italic pl-1">
                        No coaches assigned yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {approvedList.map((a) => (
                          <div
                            key={a.id}
                            className="flex items-start gap-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3"
                          >
                            {/* Avatar */}
                            <div className="w-8 h-8 rounded-full bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center overflow-hidden flex-shrink-0 mt-0.5">
                              {a.coach.avatar_url ? (
                                <img
                                  src={a.coach.avatar_url}
                                  alt={a.coach.first_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-[10px] font-bold text-emerald-400">
                                  {a.coach.first_name.charAt(0)}
                                  {a.coach.last_name.charAt(0)}
                                </span>
                              )}
                            </div>
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-200 truncate">
                                {a.coach.first_name} {a.coach.last_name}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">{a.coach.email}</p>
                              {a.coach.coach_profile?.hourly_rate !== undefined && (
                                <p className="text-[9px] text-indigo-400 mt-0.5">
                                  ₹{a.coach.coach_profile.hourly_rate}/hr
                                </p>
                              )}
                              {/* Assigned days */}
                              {a.assigned_days && a.assigned_days.length > 0 ? (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {a.assigned_days.map(d => (
                                    <span key={d} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">
                                      {weekdayNames[d]}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[9px] text-slate-600 italic mt-1">All batch days</p>
                              )}
                            </div>
                            {/* Remove */}
                            <button
                              onClick={() =>
                                handleRemoveCoach(a.coach.id, managingBatch.id)
                              }
                              title="Remove coach"
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer flex-shrink-0"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── Section 3: Assign Coach ── */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Plus className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
                    Assign Coach
                  </h4>
                </div>

                {unassignedCoaches.length === 0 ? (
                  <p className="text-[10px] text-slate-600 italic pl-1">
                    All available coaches are already assigned to this batch.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {/* Coach dropdown */}
                    <div className="space-y-1.5">
                      <label className="text-slate-400 text-[10px] font-semibold block">
                        Select Coach
                      </label>
                      {(() => {
                        const coachOptions = [
                          { value: '', label: '-- Choose a coach --' },
                          ...unassignedCoaches.map((c) => {
                            const overlaps = slotsOverlap(
                              c.coach_profile?.availability_slots ?? null,
                              managingBatch.start_time,
                              managingBatch.end_time,
                            );
                            const label = `${c.first_name} ${c.last_name}${
                              c.coach_profile?.availability_slots
                                ? ` — ${c.coach_profile.availability_slots}`
                                : ''
                            }${overlaps ? ' ✓' : ''}`;
                            return { value: c.id, label };
                          })
                        ];
                        return (
                          <CustomSelect
                            value={selectedCoachId}
                            onChange={setSelectedCoachId}
                            options={coachOptions}
                            placeholder="-- Choose a coach --"
                          />
                        );
                      })()}
                    </div>

                    {/* Slot match preview */}
                    {selectedCoachId && (() => {
                      const coach = unassignedCoaches.find((c) => c.id === selectedCoachId);
                      if (!coach) return null;
                      const overlaps = slotsOverlap(
                        coach.coach_profile?.availability_slots ?? null,
                        managingBatch.start_time,
                        managingBatch.end_time,
                      );
                      return (
                        <div
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-[10px] font-semibold ${
                            overlaps
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : 'bg-slate-800/50 border-white/5 text-slate-500'
                          }`}
                        >
                          {overlaps ? (
                            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          )}
                          {overlaps
                            ? `${coach.first_name}'s availability overlaps with this batch's time slot.`
                            : `${coach.first_name}'s availability may not match this batch's time (${managingBatch.start_time.slice(0, 5)}–${managingBatch.end_time.slice(0, 5)}).`}
                        </div>
                      );
                    })()}

                    {/* ── Day picker ── */}
                    {managingBatch.days_of_week.length > 0 && (
                      <div className="space-y-2 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                        <p className="text-slate-400 text-[10px] font-semibold">Select days for this coach:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {managingBatch.days_of_week.map((d) => {
                            const isOn = assignDaySelections.has(d);
                            return (
                              <button
                                key={d}
                                type="button"
                                onClick={() => {
                                  setAssignDaySelections(prev => {
                                    const next = new Set(prev);
                                    if (next.has(d)) next.delete(d); else next.add(d);
                                    return next;
                                  });
                                }}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                                  isOn
                                    ? 'bg-indigo-600/30 border-indigo-400/50 text-indigo-300'
                                    : 'bg-white/5 border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-300'
                                }`}
                              >
                                {weekdayNames[d]}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setAssignDaySelections(new Set(managingBatch.days_of_week))}
                            className="text-[9px] text-indigo-400 hover:text-indigo-300 transition-colors"
                          >All</button>
                          <span className="text-slate-700 text-[9px]">·</span>
                          <button
                            type="button"
                            onClick={() => setAssignDaySelections(new Set())}
                            className="text-[9px] text-slate-500 hover:text-slate-400 transition-colors"
                          >Clear</button>
                          <span className="ml-auto text-[9px] text-slate-500">
                            {assignDaySelections.size}/{managingBatch.days_of_week.length} days
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Assign button */}
                    <div className="flex justify-end">
                      <button
                        onClick={() =>
                          handleAssignCoach(selectedCoachId, managingBatch.id)
                        }
                        disabled={!selectedCoachId || assignLoading || assignDaySelections.size === 0}
                        className="btn-premium h-9 px-5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {assignLoading ? (
                          <>
                            <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Assigning…
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Assign ({assignDaySelections.size} day{assignDaySelections.size !== 1 ? 's' : ''})
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 flex justify-end flex-shrink-0">
              <button
                onClick={() => setManagingBatch(null)}
                className="btn-secondary h-9 px-5 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
