'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import {
  Calendar,
  Briefcase,
  RefreshCw,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Cross,
  XCircle
} from 'lucide-react';

export default function LeavesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [coachLeaves, setCoachLeaves] = useState<any[]>([]);

  // Leave form state
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveType, setLeaveType] = useState('Casual Leave');
  const [applyingLeave, setApplyingLeave] = useState(false);

  const supabase = createBrowserClient();

  const getLeaveTypeIcon = (type: string) => {
    switch (type) {
      case 'Sick Leave':
        return <Cross className="w-3.5 h-3.5 text-emerald-400" />;
      case 'Earned Leave':
        return <Briefcase className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Calendar className="w-3.5 h-3.5 text-purple-400" />;
    }
  };

  const getLeaveTypeClass = (type: string) => {
    switch (type) {
      case 'Sick Leave':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'Earned Leave':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      default:
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    }
  };

  const calculateDuration = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const diffTime = Math.abs(e.getTime() - s.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    };

    if (start === end) {
      return `${formatDate(start)} (${diffDays} Day)`;
    }
    return `${formatDate(start)} - ${formatDate(end)} (${diffDays} ${diffDays > 1 ? 'Days' : 'Day'})`;
  };

  const formatAppliedDate = (ts: string) => {
    if (!ts) return 'N/A';
    const d = new Date(ts);
    const date = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    return `${date} ${time}`;
  };

  const loadLeavesData = async (isRef = false) => {
    if (isRef) setRefreshing(true);
    else setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id, role, first_name, last_name, tenants(name)')
        .eq('id', user.id)
        .single();

      if (!profile) return;
      setProfileData(profile);

      // Load leaves list for the logged-in coach
      const { data: leaves } = await supabase
        .from('coach_leaves')
        .select('id, start_date, end_date, reason, status, leave_type, created_at')
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false });
      
      setCoachLeaves(leaves || []);
    } catch (err) {
      console.error('Failed to load leaves data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLeavesData();
  }, []);

  const handleRequestLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveStart || !leaveEnd || !leaveReason.trim()) return;
    setApplyingLeave(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !profileData) return;
      
      const { error } = await supabase
        .from('coach_leaves')
        .insert({
          coach_id: user.id,
          tenant_id: profileData.tenant_id,
          start_date: leaveStart,
          end_date: leaveEnd,
          reason: leaveReason,
          leave_type: leaveType,
          status: 'Pending'
        });
        
      if (error) throw error;
      
      setLeaveStart('');
      setLeaveEnd('');
      setLeaveReason('');
      setLeaveType('Casual Leave');
      alert('Leave requested successfully!');
      
      // Reload leaves list
      loadLeavesData(true);
    } catch (err) {
      console.error('Failed to request leave:', err);
      alert('Failed to request leave.');
    } finally {
      setApplyingLeave(false);
    }
  };

  const handleCancelLeave = async (leaveId: string) => {
    if (!confirm('Are you sure you want to cancel this leave request?')) return;
    try {
      const { error } = await supabase
        .from('coach_leaves')
        .update({ status: 'Cancelled' })
        .eq('id', leaveId);

      if (error) throw error;
      alert('Leave request cancelled successfully.');
      loadLeavesData(true);
    } catch (err) {
      console.error('Failed to cancel leave:', err);
      alert('Failed to cancel leave.');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Upper Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/dashboard"
            className="w-10 h-10 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors hover:bg-white/[0.04]"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold tracking-widest uppercase mb-1">
              <Sparkles className="w-4 h-4" /> Coach Portal
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white font-display">
              Leave Management
            </h1>
          </div>
        </div>
        <button
          onClick={() => loadLeavesData(true)}
          className="btn-secondary h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Registry
        </button>
      </div>

      <div className="glass-panel p-6 rounded-3xl mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* History Table */}
          <div className="lg:col-span-3 space-y-4">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Leave Request History</h3>
            
            {loading ? (
              <div className="py-12 text-center">
                <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin glow-indigo mx-auto mb-3" />
                <p className="text-xs text-slate-400">Loading leaves history...</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/5">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.02] text-[9px] font-extrabold text-slate-500 uppercase tracking-widest">
                      <th className="py-3 px-4">Leave Type</th>
                      <th className="py-3 px-4">Duration</th>
                      <th className="py-3 px-4">Applied On</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs">
                    {coachLeaves.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500 italic">No leave request logs found.</td>
                      </tr>
                    ) : (
                      coachLeaves.map((l) => (
                        <tr key={l.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-300">
                            <div className="flex items-center gap-2">
                              <span className={`p-1.5 rounded-lg border ${getLeaveTypeClass(l.leave_type)}`}>
                                {getLeaveTypeIcon(l.leave_type)}
                              </span>
                              <span>{l.leave_type}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-400 font-medium">
                            {calculateDuration(l.start_date, l.end_date)}
                          </td>
                          <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                            {formatAppliedDate(l.created_at)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold border uppercase inline-block
                                ${l.status === 'Approved' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 
                                  l.status === 'Rejected' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 
                                  l.status === 'Cancelled' ? 'bg-slate-500/10 border-slate-500/20 text-slate-400' : 
                                  'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                                {l.status}
                              </span>
                              {l.status === 'Pending' && (
                                <button
                                  onClick={() => handleCancelLeave(l.id)}
                                  className="text-[10px] font-bold text-red-400 hover:text-red-300 hover:underline cursor-pointer flex items-center gap-1 transition-colors"
                                  title="Cancel Leave Request"
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-400 max-w-[150px] truncate" title={l.reason}>
                            {l.reason}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          {/* Form */}
          <div className="lg:col-span-2 bg-white/[0.01] p-5 rounded-2xl border border-white/5 space-y-4">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest font-display flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-indigo-400" /> File New Leave Request
            </h3>
            <form onSubmit={handleRequestLeave} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wide">Leave Type</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl glass-input text-xs"
                >
                  <option value="Casual Leave" className="bg-slate-900">Casual Leave</option>
                  <option value="Sick Leave" className="bg-slate-900">Sick Leave</option>
                  <option value="Earned Leave" className="bg-slate-900">Earned Leave</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wide">Start Date</label>
                  <input
                    type="date"
                    required
                    value={leaveStart}
                    onChange={(e) => setLeaveStart(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl glass-input text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wide">End Date</label>
                  <input
                    type="date"
                    required
                    value={leaveEnd}
                    onChange={(e) => setLeaveEnd(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl glass-input text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wide">Detailed Reason</label>
                <textarea
                  required
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="Describe reason for leave (e.g. medical emergency, scheduled travel)..."
                  rows={4}
                  className="w-full p-3 rounded-xl glass-input text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={applyingLeave || !leaveStart || !leaveEnd || !leaveReason.trim()}
                className="w-full h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed glow-indigo"
              >
                {applyingLeave ? 'Submitting Leave Request...' : 'File Leave Request'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
