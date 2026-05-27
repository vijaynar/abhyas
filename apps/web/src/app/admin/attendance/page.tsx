'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import {
  AlertCircle,
  CheckCircle2,
  Calendar,
  Clock,
  Edit3,
  Filter,
  RefreshCw,
  Search,
  Sparkles,
  User,
  X,
  XCircle,
  FileText,
  IndianRupee,
  Info,
  Camera
} from 'lucide-react';

interface AttendanceLog {
  id: string | null; // Null if no log exists yet for this student on this date
  student_id: string;
  student_custom_id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: 'present' | 'late' | 'absent' | 'not_logged';
  check_in: string | null;
  verification_mode: string | null;
  confidence_score: number | null;
  notes: string | null;
  fine: {
    id: string;
    amount: number;
    status: 'unpaid' | 'pending_verification' | 'paid' | 'waived';
    reason: string;
  } | null;
}

interface BatchItem {
  id: string;
  name: string;
  classes: {
    name: string;
  } | null;
}

export default function AttendanceLogsPage() {
  const router = useRouter();
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Manual Override Modal/Drawer State
  const [editingLog, setEditingLog] = useState<AttendanceLog | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<'present' | 'late' | 'absent'>('present');
  const [overrideNotes, setOverrideNotes] = useState('');
  const [overrideLoading, setOverrideLoading] = useState(false);
  
  // Waive fine state in modal
  const [waiveReason, setWaiveReason] = useState('');
  const [waivingLoading, setWaivingLoading] = useState(false);

  const supabase = createBrowserClient();

  const loadBatches = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile) return;

      const { data: batchData } = await supabase
        .from('batches')
        .select('id, name, classes(name)')
        .eq('tenant_id', profile.tenant_id)
        .order('name', { ascending: true });

      const loadedBatches = (batchData || []) as unknown as BatchItem[];
      setBatches(loadedBatches);
      if (loadedBatches.length > 0 && !selectedBatch) {
        setSelectedBatch(loadedBatches[0].id);
      }
    } catch (err) {
      console.error('Failed to load batches:', err);
    }
  };

  const loadAttendance = async (isRef = false) => {
    if (!selectedBatch) return;
    if (isRef) setRefreshing(true);
    else setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile) return;
      const tenantId = profile.tenant_id;

      // 1. Get all students assigned to this batch
      const { data: studentsData, error: stuErr } = await supabase
        .from('students')
        .select('id, student_custom_id, users(first_name, last_name, email)')
        .eq('tenant_id', tenantId)
        .eq('batch_id', selectedBatch);

      if (stuErr) throw stuErr;

      // 2. Get attendance logs for this batch on this date
      const { data: logsData, error: logErr } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('batch_id', selectedBatch)
        .eq('date', selectedDate);

      if (logErr) throw logErr;

      // 3. Get any outstanding fines issued for this batch on this date
      const { data: finesData } = await supabase
        .from('fines')
        .select('id, student_id, amount, status, reason')
        .eq('tenant_id', tenantId)
        .eq('issued_date', selectedDate);

      // Map everything together
      const mappedLogs: AttendanceLog[] = (studentsData || []).map((student: any) => {
        const userDetail = student.users as any;
        const logged = (logsData || []).find((l: any) => l.student_id === student.id);
        const associatedFine = (finesData || []).find(
          (f: any) => f.student_id === student.id && f.reason.toLowerCase().includes(selectedDate)
        );

        return {
          id: logged ? logged.id : null,
          student_id: student.id,
          student_custom_id: student.student_custom_id,
          first_name: userDetail?.first_name || '',
          last_name: userDetail?.last_name || '',
          email: userDetail?.email || '',
          status: logged ? (logged.status as any) : 'not_logged',
          check_in: logged ? logged.check_in : null,
          verification_mode: logged ? logged.verification_mode : null,
          confidence_score: logged ? Number(logged.confidence_score) : null,
          notes: logged ? logged.notes : null,
          fine: associatedFine
            ? {
                id: associatedFine.id,
                amount: Number(associatedFine.amount),
                status: associatedFine.status as any,
                reason: associatedFine.reason,
              }
            : null,
        };
      });

      setLogs(mappedLogs);
    } catch (err) {
      console.error('Failed to load attendance logs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  useEffect(() => {
    loadAttendance();
  }, [selectedBatch, selectedDate]);

  const handleOpenOverride = (log: AttendanceLog) => {
    setEditingLog(log);
    setOverrideStatus(log.status === 'not_logged' ? 'present' : (log.status as any));
    setOverrideNotes(log.notes || '');
    setWaiveReason('');
  };

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog || !selectedBatch) return;

    setOverrideLoading(true);

    try {
      const response = await fetch('/api/v1/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: editingLog.student_id,
          batchId: selectedBatch,
          date: selectedDate,
          status: overrideStatus,
          notes: overrideNotes || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || 'Failed to submit override.');
      } else {
        // If they were marked present/late, and they had a fine, let's proactively delete/waive it!
        if ((overrideStatus === 'present' || overrideStatus === 'late') && editingLog.fine) {
          // Auto waive or delete the fine associated
          await supabase
            .from('fines')
            .delete()
            .eq('id', editingLog.fine.id);
        }

        setEditingLog(null);
        loadAttendance();
      }
    } catch (err) {
      console.error(err);
      alert('Internal connection error.');
    } finally {
      setOverrideLoading(false);
    }
  };

  const handleWaiveFine = async () => {
    if (!editingLog?.fine || !waiveReason.trim()) return;
    setWaivingLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('fines')
        .update({
          status: 'waived',
          waived_by: user?.id,
          waive_reason: waiveReason,
        })
        .eq('id', editingLog.fine.id);

      if (error) throw error;

      // Reload
      alert('Fine successfully waived!');
      setEditingLog(null);
      loadAttendance();
    } catch (err: any) {
      alert('Failed to waive fine: ' + err.message);
    } finally {
      setWaivingLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    const fullName = `${log.first_name} ${log.last_name}`.toLowerCase();
    const idStr = log.student_custom_id.toLowerCase();
    return fullName.includes(search.toLowerCase()) || idStr.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-8">
      {/* Upper Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold tracking-widest uppercase mb-1">
            <Sparkles className="w-4 h-4" /> Academic Gatekeeping
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Daily Attendance Ledger
          </h1>
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            onClick={() => router.push('/admin/attendance/group-scan')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all duration-200 glow-indigo flex-shrink-0"
          >
            <Camera className="w-4 h-4" />
            Scan Group Photo
          </button>
          <button
            onClick={() => loadAttendance(true)}
            className="btn-secondary h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Ledger
          </button>
        </div>
      </div>

      {/* Selector & Filters Bar */}
      <div className="glass-panel p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        {/* Date Selector */}
        <div>
          <label className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wide">
            Select Attendance Date
          </label>
          <div className="relative">
            <Calendar className="absolute left-3.5 top-3 w-4 h-4 text-indigo-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full pl-10 pr-4 h-10 rounded-xl glass-input text-xs"
            />
          </div>
        </div>

        {/* Batch Selector */}
        <div>
          <label className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wide">
            Select Active Batch
          </label>
          <div className="relative">
            <Filter className="absolute left-3.5 top-3 w-4 h-4 text-indigo-400" />
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="w-full pl-10 pr-4 h-10 rounded-xl glass-input text-xs"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.classes ? `(${b.classes.name})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Local Search inside active logs */}
        <div>
          <label className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wide">
            Filter Results
          </label>
          <div className="relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student name or ID..."
              className="w-full pl-10 pr-4 h-10 rounded-xl glass-input text-xs"
            />
          </div>
        </div>
      </div>

      {/* Attendance Logs Table */}
      <div className="glass-panel rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.01]">
                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Student ID</th>
                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Name</th>
                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Check-in Time</th>
                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Method / confidence</th>
                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">Associated Fine</th>
                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Overrides</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin glow-indigo mx-auto mb-3" />
                    <p className="text-xs text-slate-400">Loading daily ledger logsheets...</p>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="text-xs">No attendance logs match the query parameters.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  return (
                    <tr key={log.student_id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="py-4 px-6 font-mono text-xs text-indigo-300 font-bold">
                        {log.student_custom_id}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold text-[10px]">
                            {log.first_name[0]}{log.last_name[0]}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-200">
                              {log.first_name} {log.last_name}
                            </h4>
                            <p className="text-[9px] text-slate-500 truncate max-w-[160px]">{log.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {log.status === 'present' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                            Present
                          </span>
                        )}
                        {log.status === 'late' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-amber-500/10 border border-amber-500/25 text-amber-400">
                            Late
                          </span>
                        )}
                        {log.status === 'absent' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-red-500/10 border border-red-500/25 text-red-400">
                            Absent
                          </span>
                        )}
                        {log.status === 'not_logged' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-slate-500/10 border border-slate-500/25 text-slate-400">
                            Awaiting Log
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-slate-300 font-semibold">
                        {log.check_in
                          ? new Date(log.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '-'}
                      </td>
                      <td className="py-4 px-6 text-[10px] text-slate-400 font-medium">
                        {log.verification_mode === 'face_live' && `Edge AI Match (${log.confidence_score}% similarity)`}
                        {log.verification_mode === 'face_photo' && 'Photo Upload'}
                        {log.verification_mode === 'manual' && 'Manual Override'}
                        {!log.verification_mode && '-'}
                      </td>
                      <td className="py-4 px-6">
                        {log.fine ? (
                          <div className="space-y-0.5">
                            <span className="text-xs font-black text-indigo-300 block">
                              ₹{log.fine.amount.toLocaleString()}
                            </span>
                            <span className={`inline-flex px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase 
                            ${log.fine.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' : ''}
                            ${log.fine.status === 'unpaid' ? 'bg-amber-500/10 text-amber-400' : ''}
                            ${log.fine.status === 'waived' ? 'bg-slate-500/10 text-slate-500' : ''}
                            ${log.fine.status === 'pending_verification' ? 'bg-indigo-500/10 text-indigo-400 animate-pulse' : ''}
                            `}>
                              {log.fine.status}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-600 font-semibold italic">None</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => handleOpenOverride(log)}
                          className="h-8 px-2.5 rounded-lg text-[10px] font-bold border border-white/10 hover:bg-white/5 text-slate-300 cursor-pointer transition-colors duration-200 inline-flex items-center gap-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                          Override
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal Override Drawer ── */}
      {editingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-lg glass-panel p-6 rounded-3xl space-y-6 relative">
            <button
              onClick={() => setEditingLog(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div>
              <div className="flex items-center gap-2 text-indigo-400 text-[10px] font-bold tracking-widest uppercase mb-1">
                <Sparkles className="w-3.5 h-3.5" /> Direct Override
              </div>
              <h3 className="text-lg font-bold text-white">
                Override: {editingLog.first_name} {editingLog.last_name}
              </h3>
              <p className="text-xs text-slate-400">
                Log date: <span className="font-mono font-semibold text-slate-200">{selectedDate}</span>
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleOverrideSubmit} className="space-y-5">
              
              {/* Status Radio Group */}
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wide">
                  Attendance Status
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setOverrideStatus('present')}
                    className={`h-11 rounded-xl text-xs font-bold border transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer 
                    ${overrideStatus === 'present' 
                      ? 'bg-emerald-600/10 border-emerald-500 text-emerald-400 glow-emerald' 
                      : 'border-white/5 bg-white/[0.01] text-slate-400 hover:bg-white/[0.03]'}`}
                  >
                    <CheckCircle2 className="w-4 h-4" /> Present
                  </button>

                  <button
                    type="button"
                    onClick={() => setOverrideStatus('late')}
                    className={`h-11 rounded-xl text-xs font-bold border transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer 
                    ${overrideStatus === 'late' 
                      ? 'bg-amber-600/10 border-amber-500 text-amber-400' 
                      : 'border-white/5 bg-white/[0.01] text-slate-400 hover:bg-white/[0.03]'}`}
                  >
                    <Clock className="w-4 h-4" /> Late
                  </button>

                  <button
                    type="button"
                    onClick={() => setOverrideStatus('absent')}
                    className={`h-11 rounded-xl text-xs font-bold border transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer 
                    ${overrideStatus === 'absent' 
                      ? 'bg-red-600/10 border-red-500 text-red-400' 
                      : 'border-white/5 bg-white/[0.01] text-slate-400 hover:bg-white/[0.03]'}`}
                  >
                    <XCircle className="w-4 h-4" /> Absent
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wide">
                  Reason / Notes
                </label>
                <textarea
                  value={overrideNotes}
                  onChange={(e) => setOverrideNotes(e.target.value)}
                  placeholder="e.g. Student informed beforehand. Waived absence fee."
                  rows={2}
                  className="w-full p-3 rounded-xl glass-input text-xs"
                />
              </div>

              {/* Associated Fine Actions */}
              {editingLog.fine && (
                <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/10 space-y-3.5">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-2">
                      <IndianRupee className="w-5 h-5 text-indigo-400 mt-0.5" />
                      <div>
                        <span className="text-xs font-bold text-slate-200 block">Associated Fine Outstanding</span>
                        <span className="text-[10px] text-slate-400">{editingLog.fine.reason}</span>
                      </div>
                    </div>
                    <span className="text-sm font-black text-indigo-300">
                      ₹{editingLog.fine.amount.toLocaleString()}
                    </span>
                  </div>

                  {editingLog.fine.status === 'waived' ? (
                    <div className="text-[10px] text-slate-500 italic font-semibold flex items-center gap-1">
                      <Info className="w-3.5 h-3.5" /> Fine has been Waived.
                    </div>
                  ) : (
                    <div className="border-t border-indigo-500/10 pt-3 space-y-3">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                        Waive Fine Record
                      </span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={waiveReason}
                          onChange={(e) => setWaiveReason(e.target.value)}
                          placeholder="Reason for fine waiver..."
                          className="flex-1 h-9 px-3 rounded-lg glass-input text-[10px]"
                        />
                        <button
                          type="button"
                          onClick={handleWaiveFine}
                          disabled={waivingLoading || !waiveReason.trim()}
                          className="h-9 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] cursor-pointer disabled:opacity-40"
                        >
                          Waive Fine
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingLog(null)}
                  className="btn-secondary h-10 px-4 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={overrideLoading}
                  className="btn-primary h-10 px-5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer glow-indigo"
                >
                  {overrideLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Save Override Log
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
