'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  IndianRupee,
  Calendar,
  Save,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Plus,
  RefreshCw,
  Info,
  Lock
} from 'lucide-react';

const WEEKDAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' }
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Fields (maps to UpdateTenantSettingsSchema)
  const [autoFineEnabled, setAutoFineEnabled] = useState(true);
  const [lateThresholdMinutes, setLateThresholdMinutes] = useState(5);
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState(0);
  const [absentFineRule1, setAbsentFineRule1] = useState(1000);
  const [absentFineRule1Days, setAbsentFineRule1Days] = useState(4);
  const [absentFineRule2, setAbsentFineRule2] = useState(2000);
  const [currency, setCurrency] = useState('INR');
  const [weekends, setWeekends] = useState<number[]>([6, 7]);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [role, setRole] = useState<string>('');
  
  // Custom new holiday date picker input state
  const [newHoliday, setNewHoliday] = useState('');

  // Password Change States
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securitySuccess, setSecuritySuccess] = useState<string | null>(null);

  const supabase = createBrowserClient();

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError(null);
    setSecuritySuccess(null);

    if (newPassword.length < 8) {
      setSecurityError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setSecurityError('Passwords do not match.');
      return;
    }

    setSecurityLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        throw error;
      }
      setSecuritySuccess('Password successfully updated!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setSecurityError(err.message || 'Failed to update password.');
    } finally {
      setSecurityLoading(false);
    }
  };

  const loadSettings = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await fetch('/api/v1/settings');
      const result = await response.json();

      if (response.ok && result.data) {
        const s = result.data;
        setAutoFineEnabled(s.auto_fine_enabled ?? true);
        setLateThresholdMinutes(s.late_threshold_minutes ?? 5);
        setGracePeriodMinutes(s.grace_period_minutes ?? 0);
        setAbsentFineRule1(Number(s.absent_fine_rule_1) ?? 1000);
        setAbsentFineRule1Days(s.absent_fine_rule_1_days ?? 4);
        setAbsentFineRule2(Number(s.absent_fine_rule_2) ?? 2000);
        setCurrency(s.currency ?? 'INR');
        setWeekends(s.weekends ?? [6, 7]);
        setHolidays(s.holidays ?? []);
      } else {
        setErrorMsg(result.error || 'Failed to fetch tenant configuration settings.');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to connect to the backend settings server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function fetchRole() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();
          if (profile) {
            setRole(profile.role);
          }
        }
      } catch (err) {
        console.error('Error fetching role in settings:', err);
      }
    }
    fetchRole();
    loadSettings();
  }, []);

  const handleToggleWeekend = (dayValue: number) => {
    setWeekends((prev) =>
      prev.includes(dayValue) ? prev.filter((d) => d !== dayValue) : [...prev, dayValue].sort()
    );
  };

  const handleAddHoliday = () => {
    if (!newHoliday) return;
    if (holidays.includes(newHoliday)) {
      alert('This holiday date is already added.');
      return;
    }
    setHolidays((prev) => [...prev, newHoliday].sort());
    setNewHoliday('');
  };

  const handleRemoveHoliday = (dateStr: string) => {
    setHolidays((prev) => prev.filter((h) => h !== dateStr));
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload = {
      autoFineEnabled,
      lateThresholdMinutes,
      gracePeriodMinutes,
      absentFineRule1,
      absentFineRule1Days,
      absentFineRule2,
      currency,
      weekends,
      holidays,
    };

    try {
      const response = await fetch('/api/v1/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMsg(result.error || 'Failed to save rules updates.');
      } else {
        setSuccessMsg('Academy policies and threshold rules successfully saved!');
        setTimeout(() => setSuccessMsg(null), 3000);
        loadSettings();
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to sync policy settings updates.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin glow-indigo" />
        <p className="text-slate-400 text-xs font-semibold tracking-widest uppercase">
          Loading configuration...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Title Header */}
      <div>
        <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold tracking-widest uppercase mb-1">
          <Sparkles className="w-4 h-4" /> {role === 'superadmin' ? 'System Governance' : 'Academy Governance'}
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white animate-in fade-in slide-in-from-top-4 duration-300">
          {role === 'superadmin' ? 'Global Rules & Settings' : 'Academy Rules & Settings'}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          {role === 'superadmin'
            ? 'Configure system-wide fallback check-in boundaries, default calendar schedules, and automatic absentee fine tiers.'
            : 'Configure check-in boundaries, calendar schedules, and automatic absentee fine tiers for this academy.'}
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-pulse glow-emerald">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-8">
        
        {/* Section 1: Auto-Fines Governance Toggle */}
        <div className={`p-6 rounded-3xl border transition-all duration-300 relative overflow-hidden group 
        ${autoFineEnabled 
          ? 'bg-indigo-950/20 border-indigo-500/20' 
          : 'bg-slate-950/20 border-white/5'}`}>
          
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-indigo-500/5 blur-2xl" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative">
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-1 flex items-center gap-2">
                <IndianRupee className="w-4.5 h-4.5 text-indigo-400" /> Automatic Absentee Fines
              </h3>
              <p className="text-xs text-slate-400 leading-normal max-w-xl">
                When enabled, the scheduler evaluates attendance at the end of the grace period. Unexcused absentees automatically receive a fine record logged against their ledger profiles.
              </p>
            </div>
            
            <button
              type="button"
              onClick={() => setAutoFineEnabled(!autoFineEnabled)}
              className="self-start sm:self-auto cursor-pointer focus:outline-none"
            >
              {autoFineEnabled ? (
                <ToggleRight className="w-14 h-10 text-indigo-500 glow-indigo" />
              ) : (
                <ToggleLeft className="w-14 h-10 text-slate-600" />
              )}
            </button>
          </div>
        </div>

        {/* Section 2: Attendance Timing Limits */}
        <div className="glass-panel p-6 rounded-3xl space-y-6">
          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider border-b border-white/10 pb-3 flex items-center gap-2">
            <Clock className="w-4.5 h-4.5 text-indigo-400" /> Check-in Boundaries & Times
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wide">
                Late Check-in Threshold (Minutes)
              </label>
              <input
                type="number"
                required
                min={0}
                max={60}
                value={lateThresholdMinutes}
                onChange={(e) => setLateThresholdMinutes(Number(e.target.value))}
                className="w-full px-3.5 h-10 rounded-xl glass-input text-xs"
              />
              <span className="text-[9px] text-slate-500 mt-1 block leading-normal">
                Check-ins recorded after this many minutes from start time will mark status as <strong>Late</strong>.
              </span>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wide">
                Absent Grace Window (Minutes)
              </label>
              <input
                type="number"
                required
                min={0}
                max={120}
                value={gracePeriodMinutes}
                onChange={(e) => setGracePeriodMinutes(Number(e.target.value))}
                className="w-full px-3.5 h-10 rounded-xl glass-input text-xs"
              />
              <span className="text-[9px] text-slate-500 mt-1 block leading-normal">
                Extra window buffer after start time before auto-marking absent (0 means instant evaluation).
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Fine Tier Rules */}
        <div className="glass-panel p-6 rounded-3xl space-y-6">
          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider border-b border-white/10 pb-3 flex items-center gap-2">
            <IndianRupee className="w-4.5 h-4.5 text-indigo-400" /> Fine Tier Pricing
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <label className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wide">
                Standard Fine (INR)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-xs text-indigo-400 font-black">₹</span>
                <input
                  type="number"
                  required
                  min={0}
                  value={absentFineRule1}
                  onChange={(e) => setAbsentFineRule1(Number(e.target.value))}
                  className="w-full pl-8 pr-4 h-10 rounded-xl glass-input text-xs"
                />
              </div>
              <span className="text-[9px] text-slate-500 mt-1 block">
                Standard fine applied for initial absences.
              </span>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wide">
                Absence Day Threshold
              </label>
              <input
                type="number"
                required
                min={1}
                max={30}
                value={absentFineRule1Days}
                onChange={(e) => setAbsentFineRule1Days(Number(e.target.value))}
                className="w-full px-3.5 h-10 rounded-xl glass-input text-xs"
              />
              <span className="text-[9px] text-slate-500 mt-1 block">
                Moving to higher tier after this many days of unexcused absences.
              </span>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wide">
                Escalated Fine (INR)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-xs text-indigo-400 font-black">₹</span>
                <input
                  type="number"
                  required
                  min={0}
                  value={absentFineRule2}
                  onChange={(e) => setAbsentFineRule2(Number(e.target.value))}
                  className="w-full pl-8 pr-4 h-10 rounded-xl glass-input text-xs"
                />
              </div>
              <span className="text-[9px] text-slate-500 mt-1 block">
                Escalated fine applied after exceeding the day threshold.
              </span>
            </div>
          </div>
        </div>

        {/* Section 4: Calendar Schedule, Weekends & Holidays */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Weekends List */}
          <div className="glass-panel p-6 rounded-3xl space-y-4">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider border-b border-white/10 pb-3 flex items-center gap-2">
              <Calendar className="w-4.5 h-4.5 text-indigo-400" /> Active Weekends
            </h3>
            
            <p className="text-[10px] text-slate-500 leading-normal">
              Mark which days are default weekends. Attendance ledger routines bypass weekend days when compiling unexcused absentees.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {WEEKDAYS.map((day) => {
                const active = weekends.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => handleToggleWeekend(day.value)}
                    className={`h-9 px-3.5 rounded-lg text-[10px] font-bold border transition-colors duration-200 cursor-pointer
                    ${active 
                      ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-300' 
                      : 'border-white/5 bg-white/[0.01] text-slate-400 hover:bg-white/[0.03]'}`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Holidays List Widget */}
          <div className="glass-panel p-6 rounded-3xl space-y-4">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider border-b border-white/10 pb-3 flex items-center gap-2">
              <Calendar className="w-4.5 h-4.5 text-indigo-400" /> Scheduled Holidays
            </h3>
            
            <div className="flex gap-2">
              <input
                type="date"
                value={newHoliday}
                onChange={(e) => setNewHoliday(e.target.value)}
                className="flex-1 px-3.5 h-9 rounded-lg glass-input text-xs"
              />
              <button
                type="button"
                onClick={handleAddHoliday}
                className="h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Date
              </button>
            </div>

            <div className="max-h-[120px] overflow-y-auto no-scrollbar space-y-1.5">
              {holidays.length === 0 ? (
                <p className="text-[10px] text-slate-600 italic pt-6 text-center">No holiday dates configured.</p>
              ) : (
                holidays.map((dateStr) => (
                  <div key={dateStr} className="flex justify-between items-center p-2 rounded-lg bg-white/[0.02] border border-white/5">
                    <span className="font-mono text-xs text-slate-300">{dateStr}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveHoliday(dateStr)}
                      className="text-red-400 hover:text-red-300 p-1 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Global Save Rules Update Drawer Action */}
        <div className="flex justify-end pt-4 border-t border-white/10">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary h-12 px-6 rounded-2xl text-xs font-bold flex items-center gap-2 cursor-pointer glow-indigo"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {role === 'superadmin' ? 'Save Global Policies' : 'Save Academy Policies'}
          </button>
        </div>

      </form>

      {/* Account Security Change Password Panel */}
      <div className="glass-panel p-6 rounded-3xl space-y-4 border border-white/5 mt-8">
        <div className="border-b border-white/10 pb-3">
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Lock className="w-5 h-5 text-indigo-400" /> Account Security
          </h2>
          <p className="text-[11px] text-slate-400">Update your administrative access password</p>
        </div>

        {securityError && (
          <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-[10px] font-semibold flex items-center gap-1.5 animate-pulse">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{securityError}</span>
          </div>
        )}

        {securitySuccess && (
          <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-[10px] font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{securitySuccess}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wide">
                New Password (min 8 characters)
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-10 px-3.5 rounded-xl glass-input text-xs"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wide">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-10 px-3.5 rounded-xl glass-input text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={securityLoading}
            className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer transition-colors duration-200 flex items-center justify-center gap-2 glow-indigo"
          >
            {securityLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              'Update Access Password'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
