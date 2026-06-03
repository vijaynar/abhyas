'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  User,
  Phone,
  Mail,
  FileText,
  Upload,
  X,
  Download,
  Lock,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Award,
  IndianRupee,
} from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';

// ─── Types ──────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: string;
}

interface CoachProfile {
  expertise: string | null;
  availability_slots: string | null;
  hourly_rate: number | null;
  certificates: string[];
}

interface BatchAssignment {
  id: string;
  status: 'approved' | 'pending' | 'rejected';
  batch: {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
    days_of_week: string[];
    class: {
      name: string;
    } | null;
  } | null;
}

type ToastType = 'success' | 'error';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

// ─── Toast Component ─────────────────────────────────────────────────────────

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl backdrop-blur-md border transition-all duration-300 ${
            t.type === 'success'
              ? 'bg-emerald-900/80 border-emerald-600/50 text-emerald-100'
              : 'bg-red-900/80 border-red-600/50 text-red-100'
          }`}
        >
          {t.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          )}
          <span className="text-sm font-medium">{t.message}</span>
          <button onClick={() => onDismiss(t.id)} className="ml-2 text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    approved: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    pending: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    rejected: 'bg-red-500/20 text-red-300 border-red-500/30',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize ${
        colorMap[status] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30'
      }`}
    >
      {status}
    </span>
  );
}

// ─── Day Badge ────────────────────────────────────────────────────────────────

function DayBadge({ day }: { day: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
      {day}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CoachProfilePage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef(0);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [coach, setCoach] = useState<CoachProfile>({
    expertise: '',
    availability_slots: '',
    hourly_rate: null,
    certificates: [],
  });
  const [assignments, setAssignments] = useState<BatchAssignment[]>([]);

  // Profile form
  const [phone, setPhone] = useState('');
  const [expertise, setExpertise] = useState('');
  const [availabilitySlots, setAvailabilitySlots] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // Password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Avatar
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Certificates
  const certInputRef = useRef<HTMLInputElement>(null);
  const [certUploading, setCertUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  // ── Toast Helper ───────────────────────────────────────────────────────────
  const addToast = useCallback((message: string, type: ToastType) => {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Data Loading ───────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) throw new Error('Not authenticated');

        const userId = authData.user.id;

        const [userRes, coachRes, assignmentsRes] = await Promise.all([
          supabase
            .from('users')
            .select('id, email, first_name, last_name, phone, avatar_url, role')
            .eq('id', userId)
            .single(),
          supabase
            .from('coaches')
            .select('expertise:primary_skill, experience_years')
            .eq('id', userId)
            .single(),
          supabase
            .from('coach_batch_assignments')
            .select('id, status, batch:batch_id(id, name, start_time, end_time, days_of_week, class:classes(name))')
            .eq('coach_id', userId),
        ]);

        if (userRes.data) {
          setUser(userRes.data as UserProfile);
          setPhone(userRes.data.phone ?? '');
        }

        if (coachRes.data) {
          const cd = coachRes.data as unknown as CoachProfile;
          setCoach(cd);
          setExpertise(cd.expertise ?? '');
          setAvailabilitySlots(cd.availability_slots ?? '');
          setHourlyRate(cd.hourly_rate != null ? String(cd.hourly_rate) : '');
        }

        if (assignmentsRes.data) {
          setAssignments(assignmentsRes.data as unknown as BatchAssignment[]);
        }
      } catch (err) {
        console.error(err);
        addToast('Failed to load profile data', 'error');
      } finally {
        setLoading(false);
      }
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Avatar Upload ──────────────────────────────────────────────────────────
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setAvatarUploading(true);
    try {
      const path = `avatar_${user.id}_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('student-portraits')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('student-portraits').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setUser((prev) => (prev ? { ...prev, avatar_url: publicUrl } : prev));
      addToast('Profile photo updated!', 'success');
    } catch (err: unknown) {
      console.error(err);
      addToast((err as Error).message ?? 'Avatar upload failed', 'error');
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  }

  // ── Profile Save ───────────────────────────────────────────────────────────
  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setProfileSaving(true);
    try {
      // Update phone in users table
      await supabase.from('users').update({ phone }).eq('id', user.id);

      // Update coach details via API
      const res = await fetch('/api/v1/coaches', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId: user.id,
          expertise,
          primarySkill: expertise,
          availabilitySlots,
          hourlyRate: hourlyRate !== '' ? Number(hourlyRate) : null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? 'Failed to save profile');
      }

      setCoach((prev) => ({
        ...prev,
        expertise,
        availability_slots: availabilitySlots,
        hourly_rate: hourlyRate !== '' ? Number(hourlyRate) : null,
      }));
      addToast('Profile saved successfully!', 'success');
    } catch (err: unknown) {
      console.error(err);
      addToast((err as Error).message ?? 'Save failed', 'error');
    } finally {
      setProfileSaving(false);
    }
  }

  // ── Password Change ────────────────────────────────────────────────────────
  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError('');

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      addToast('Password updated successfully!', 'success');
    } catch (err: unknown) {
      console.error(err);
      addToast((err as Error).message ?? 'Password update failed', 'error');
    } finally {
      setPasswordSaving(false);
    }
  }

  // ── Certificate Upload ─────────────────────────────────────────────────────
  async function uploadCertificate(file: File) {
    if (!user) return;

    setCertUploading(true);
    try {
      const path = `cert_${user.id}_${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('coach-certificates')
        .upload(path, file, { upsert: false, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('coach-certificates').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const updatedCerts = [...(coach.certificates ?? []), publicUrl];

      const res = await fetch('/api/v1/coaches', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coachId: user.id,
          certificates: updatedCerts,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? 'Failed to save certificate');
      }

      setCoach((prev) => ({ ...prev, certificates: updatedCerts }));
      addToast('Certificate uploaded!', 'success');
    } catch (err: unknown) {
      console.error(err);
      addToast((err as Error).message ?? 'Upload failed', 'error');
    } finally {
      setCertUploading(false);
      if (certInputRef.current) certInputRef.current.value = '';
    }
  }

  async function handleCertFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await uploadCertificate(file);
  }

  async function handleCertDelete(certUrl: string) {
    if (!user) return;
    const updatedCerts = (coach.certificates ?? []).filter((c) => c !== certUrl);

    try {
      const res = await fetch('/api/v1/coaches', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachId: user.id, certificates: updatedCerts }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? 'Failed to delete certificate');
      }

      setCoach((prev) => ({ ...prev, certificates: updatedCerts }));
      addToast('Certificate removed.', 'success');
    } catch (err: unknown) {
      console.error(err);
      addToast((err as Error).message ?? 'Delete failed', 'error');
    }
  }

  // ── Drag-and-Drop ──────────────────────────────────────────────────────────
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }
  function handleDragLeave() {
    setDragging(false);
  }
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadCertificate(file);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function getInitials(first: string, last: string) {
    return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
  }

  function formatTime(time: string) {
    if (!time) return '';
    const [h, m] = time.split(':');
    const hour = parseInt(h, 10);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${h12}:${m} ${suffix}`;
  }

  // ── Loading Skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#060814] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin" />
          <p className="text-slate-400 text-sm">Loading profile…</p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#060814] px-4 py-10">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Hidden inputs */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarChange}
      />
      <input
        ref={certInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleCertFileChange}
      />

      <div className="max-w-4xl mx-auto space-y-8">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          {/* Avatar */}
          <div className="relative shrink-0">
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="relative group w-28 h-28 rounded-full overflow-hidden ring-4 ring-indigo-500/40 hover:ring-indigo-400/70 transition-all duration-300 focus:outline-none focus:ring-indigo-400"
              aria-label="Change profile photo"
            >
              {user?.avatar_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={user.avatar_url}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
                  <span className="text-3xl font-bold text-white">
                    {user ? getInitials(user.first_name, user.last_name) : '?'}
                  </span>
                </div>
              )}

              {/* Overlay */}
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {avatarUploading ? (
                  <RefreshCw className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Upload className="w-6 h-6 text-white" />
                )}
              </div>
            </button>

            {/* Glow dot */}
            <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-[#060814]" />
          </div>

          {/* Header text */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold text-slate-100 tracking-tight">My Coach Profile</h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                <Award className="w-3.5 h-3.5" />
                Coach
              </span>
            </div>
            <p className="text-slate-400 text-sm mb-3">
              Manage your credentials, availability &amp; certification documents
            </p>

            <div className="flex flex-wrap gap-4 text-sm text-slate-400">
              {user?.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-indigo-400" />
                  {user.email}
                </span>
              )}
              {user?.first_name && (
                <span className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-indigo-400" />
                  {user.first_name} {user.last_name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Profile Details Card ─────────────────────────────────────────── */}
        <section className="glass-panel rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 rounded-xl bg-indigo-500/10 glow-indigo">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-100">Profile Details</h2>
          </div>

          <form onSubmit={handleProfileSave} className="space-y-5">
            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-indigo-400" />
                  Phone Number
                </span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="glass-input w-full rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            {/* Expertise */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-indigo-400" />
                  Expertise / Specialty
                </span>
              </label>
              <input
                type="text"
                value={expertise}
                onChange={(e) => setExpertise(e.target.value)}
                placeholder="e.g. Cricket Coach, Swimming Expert"
                className="glass-input w-full rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            {/* Availability */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  Availability Slots
                </span>
              </label>
              <textarea
                rows={3}
                value={availabilitySlots}
                onChange={(e) => setAvailabilitySlots(e.target.value)}
                placeholder="e.g. Mon-Fri 6AM-9AM, Sat 7AM-11AM"
                className="glass-input w-full rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
              />
            </div>

            {/* Hourly Rate */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <IndianRupee className="w-4 h-4 text-indigo-400" />
                  Hourly Rate (₹)
                </span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₹</span>
                <input
                  type="number"
                  min={0}
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="500"
                  className="glass-input w-full rounded-xl pl-8 pr-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={profileSaving}
                className="btn-premium flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {profileSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Save Profile
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* ── Password Change Card ─────────────────────────────────────────── */}
        <section className="glass-panel rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 rounded-xl bg-purple-500/10">
              <Lock className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-100">Change Password</h2>
          </div>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
                className="glass-input w-full rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
                className="glass-input w-full rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>

            {passwordError && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {passwordError}
              </div>
            )}

            <div className="pt-1">
              <button
                type="submit"
                disabled={passwordSaving}
                className="btn-premium flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {passwordSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Updating…
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Update Password
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* ── Certificate Vault Card ───────────────────────────────────────── */}
        <section className="glass-panel rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 rounded-xl bg-amber-500/10">
              <FileText className="w-5 h-5 text-amber-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-100">My Certificates &amp; Credentials</h2>
          </div>

          {/* Existing certs list */}
          {coach.certificates && coach.certificates.length > 0 ? (
            <ul className="space-y-2 mb-6">
              {coach.certificates.map((certUrl) => {
                const filename = certUrl.split('/').pop() ?? 'certificate';
                return (
                  <li
                    key={certUrl}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-indigo-500/30 transition-colors group"
                  >
                    <FileText className="w-5 h-5 text-amber-400 shrink-0" />
                    <span className="flex-1 text-sm text-slate-300 truncate" title={filename}>
                      {decodeURIComponent(filename)}
                    </span>
                    <a
                      href={certUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-500/10"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </a>
                    <button
                      onClick={() => handleCertDelete(certUrl)}
                      className="flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10"
                      aria-label={`Delete ${filename}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 mb-6 rounded-xl border border-dashed border-white/10 text-slate-500">
              <FileText className="w-8 h-8 opacity-40" />
              <p className="text-sm">No certificates uploaded yet.</p>
            </div>
          )}

          {/* Upload zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !certUploading && certInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && !certUploading && certInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
              dragging
                ? 'border-indigo-400 bg-indigo-500/10'
                : 'border-white/20 hover:border-indigo-500/50 hover:bg-indigo-500/5'
            } ${certUploading ? 'cursor-not-allowed opacity-70' : ''}`}
          >
            {certUploading ? (
              <>
                <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                <p className="text-sm font-medium text-slate-400">Uploading…</p>
              </>
            ) : (
              <>
                <div className="p-3 rounded-full bg-indigo-500/10">
                  <Upload className="w-6 h-6 text-indigo-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-300">
                    Upload Certificate{' '}
                    <span className="text-indigo-400">(PDF or Image)</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Drag & drop or click to browse</p>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── Batch Assignments Card ───────────────────────────────────────── */}
        <section className="glass-panel rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 rounded-xl bg-emerald-500/10">
              <Calendar className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-100">My Batch Assignments</h2>
          </div>

          {assignments.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-slate-500">
              <Calendar className="w-12 h-12 opacity-30" />
              <p className="text-sm font-medium text-slate-400">No batch assignments yet.</p>
              <p className="text-xs text-slate-500">Request one from the Batches page.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map((assignment) => {
                const batch = assignment.batch;
                return (
                  <div
                    key={assignment.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-4 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-100 truncate">
                          {batch?.name ?? 'Unknown Batch'}
                        </span>
                        {batch?.class?.name && (
                          <span className="text-xs text-slate-400 bg-white/5 px-2 py-0.5 rounded-lg border border-white/10">
                            {batch.class.name}
                          </span>
                        )}
                      </div>

                      {batch && (batch.start_time || batch.end_time) && (
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatTime(batch.start_time)} – {formatTime(batch.end_time)}
                        </p>
                      )}

                      {batch?.days_of_week && batch.days_of_week.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {batch.days_of_week.map((day) => (
                            <DayBadge key={day} day={day} />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0">
                      <StatusBadge status={assignment.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Footer spacer */}
        <div className="h-8" />
      </div>
    </div>
  );
}
