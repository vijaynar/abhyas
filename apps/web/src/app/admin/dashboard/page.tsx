'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  IndianRupee,
  Eye,
  RefreshCw,
  Sparkles,
  Users,
  XCircle
} from 'lucide-react';

interface KPIMetrics {
  presentToday: number;
  absentToday: number;
  pendingFines: number;
  activePayments: number;
}

interface ChartItem {
  label: string;
  key: string;
  collected: number;
  pending: number;
}

interface AttendanceFeedItem {
  id: string;
  check_in: string | null;
  status: 'present' | 'late' | 'absent';
  verification_mode: 'face_live' | 'face_photo' | 'manual';
  confidence_score: number | null;
  students: {
    first_name: string;
    last_name: string;
    student_custom_id: string;
  };
  batches: {
    name: string;
  };
}

interface FinePaymentItem {
  id: string;
  amount: number;
  reason: string;
  transaction_id: string | null;
  payment_method: string | null;
  payment_proof_url: string | null;
  students: {
    first_name: string;
    last_name: string;
    student_custom_id: string;
  };
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<KPIMetrics>({
    presentToday: 0,
    absentToday: 0,
    pendingFines: 0,
    activePayments: 0,
  });
  const [attendanceFeed, setAttendanceFeed] = useState<AttendanceFeedItem[]>([]);
  const [verificationQueue, setVerificationQueue] = useState<FinePaymentItem[]>([]);
  const [chartData, setChartData] = useState<ChartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [activeProofUrl, setActiveProofUrl] = useState<string | null>(null);

  const supabase = createBrowserClient();

  const loadDashboardData = async () => {
    setLoading(true);
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
      const todayStr = new Date().toISOString().split('T')[0];

      // 1. Fetch Today's Attendance Logs (Present / Absent)
      const { data: attLogs } = await supabase
        .from('attendance_logs')
        .select('status')
        .eq('tenant_id', tenantId)
        .eq('date', todayStr);

      let presentCount = 0;
      let absentCount = 0;
      if (attLogs) {
        attLogs.forEach((log: any) => {
          if (log.status === 'present' || log.status === 'late') {
            presentCount++;
          } else if (log.status === 'absent') {
            absentCount++;
          }
        });
      }

      // 2. Fetch Outstanding Unpaid Fines Sum
      const { data: unpaidFines } = await supabase
        .from('fines')
        .select('amount')
        .eq('tenant_id', tenantId)
        .eq('status', 'unpaid');

      const totalUnpaid = unpaidFines
        ? unpaidFines.reduce((sum: number, fine: any) => sum + Number(fine.amount), 0)
        : 0;

      // 3. Fetch Payments Pending Verification Count
      const { data: pendingPayments, count: pendingCount } = await supabase
        .from('fines')
        .select('id, amount, reason, transaction_id, payment_method, payment_proof_url, students:student_id(first_name, last_name, student_custom_id)', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('status', 'pending_verification');

      // 4. Fetch Live Attendance Feed (Today's Logs)
      const { data: feedData } = await supabase
        .from('attendance_logs')
        .select('id, check_in, status, verification_mode, confidence_score, students:student_id(first_name, last_name, student_custom_id), batches:batch_id(name)')
        .eq('tenant_id', tenantId)
        .eq('date', todayStr)
        .order('check_in', { ascending: false });

      // 5. Fetch month-by-month fine collection stats (last 6 months)
      const { data: allFines } = await supabase
        .from('fines')
        .select('amount, status, issued_date, paid_date')
        .eq('tenant_id', tenantId);

      const monthsList: ChartItem[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthsList.push({
          label: d.toLocaleString('default', { month: 'short' }),
          key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          collected: 0,
          pending: 0,
        });
      }

      if (allFines) {
        allFines.forEach((fine: any) => {
          const dateStr = fine.status === 'paid' && fine.paid_date ? fine.paid_date : fine.issued_date;
          if (!dateStr) return;

          const date = new Date(dateStr);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

          const bucket = monthsList.find(m => m.key === key);
          if (bucket) {
            if (fine.status === 'paid') {
              bucket.collected += Number(fine.amount);
            } else if (fine.status === 'unpaid' || fine.status === 'pending_verification') {
              bucket.pending += Number(fine.amount);
            }
          }
        });
      }

      setMetrics({
        presentToday: presentCount,
        absentToday: absentCount,
        pendingFines: totalUnpaid,
        activePayments: pendingCount || 0,
      });

      setAttendanceFeed((feedData || []) as unknown as AttendanceFeedItem[]);
      setVerificationQueue((pendingPayments || []) as unknown as FinePaymentItem[]);
      setChartData(monthsList);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleApprovePayment = async (fineId: string) => {
    setActioningId(fineId);
    try {
      const { error } = await supabase
        .from('fines')
        .update({
          status: 'paid',
          paid_date: new Date().toISOString(),
        })
        .eq('id', fineId);

      if (error) throw error;
      await loadDashboardData();
    } catch (err) {
      console.error('Approval failed:', err);
      alert('Failed to approve payment.');
    } finally {
      setActioningId(null);
    }
  };

  const handleRejectPayment = async () => {
    if (!rejectingId || !rejectionReason.trim()) return;
    setActioningId(rejectingId);
    try {
      const { error } = await supabase
        .from('fines')
        .update({
          status: 'unpaid',
          rejection_reason: rejectionReason,
          payment_proof_url: null, // Clear bad proof
        })
        .eq('id', rejectingId);

      if (error) throw error;
      setRejectingId(null);
      setRejectionReason('');
      await loadDashboardData();
    } catch (err) {
      console.error('Rejection failed:', err);
      alert('Failed to reject payment.');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Upper Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold tracking-widest uppercase mb-1">
            <Sparkles className="w-4 h-4" /> Live Academy Insights
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Operations Center
          </h1>
        </div>
        <button
          onClick={loadDashboardData}
          className="btn-secondary h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Stats
        </button>
      </div>

      {/* ── KPI Cards Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Present */}
        <div className="glass-panel glass-panel-hover p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-emerald-500/5 blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-bold tracking-wide uppercase">Present Today</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 glow-emerald">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-white">{metrics.presentToday}</span>
            <span className="text-xs text-slate-500 font-semibold block mt-1">Checked in successfully</span>
          </div>
        </div>

        {/* Card 2: Absent */}
        <div className="glass-panel glass-panel-hover p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-red-500/5 blur-2xl group-hover:bg-red-500/10 transition-colors" />
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-bold tracking-wide uppercase">Absent Today</span>
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-white">{metrics.absentToday}</span>
            <span className="text-xs text-slate-500 font-semibold block mt-1">Absentees compiled</span>
          </div>
        </div>

        {/* Card 3: Pending Fines */}
        <div className="glass-panel glass-panel-hover p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-amber-500/5 blur-2xl group-hover:bg-amber-500/10 transition-colors" />
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-bold tracking-wide uppercase">Unpaid Fines</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-white">₹{metrics.pendingFines.toLocaleString()}</span>
            <span className="text-xs text-slate-500 font-semibold block mt-1">Outstanding balance</span>
          </div>
        </div>

        {/* Card 4: Active Payments */}
        <div className="glass-panel glass-panel-hover p-6 rounded-2xl relative overflow-hidden group border-indigo-500/20">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-indigo-500/10 blur-2xl group-hover:bg-indigo-500/20 transition-colors" />
          <div className="flex items-center justify-between">
            <span className="text-slate-200 text-xs font-extrabold tracking-wide uppercase">Active Payments</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 glow-indigo">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-white glow-text-indigo">{metrics.activePayments}</span>
            <span className="text-xs text-indigo-400 font-bold block mt-1 animate-pulse">Pending verification</span>
          </div>
        </div>
      </div>

      {/* ── Month-by-Month Fines Collection Trends ── */}
      <div className="glass-panel p-6 rounded-3xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" /> Fine Collection Analytics
            </h2>
            <p className="text-[11px] text-slate-400">Month-by-month comparisons of collected vs. outstanding penalties</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold">
            <div className="flex items-center gap-1.5 bg-emerald-500/5 px-2.5 py-1 rounded-lg border border-emerald-500/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse" />
              <span className="text-slate-300">Collected (Paid)</span>
            </div>
            <div className="flex items-center gap-1.5 bg-amber-500/5 px-2.5 py-1 rounded-lg border border-amber-500/10">
              <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)] animate-pulse" />
              <span className="text-slate-300">Pending / Unpaid</span>
            </div>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center text-slate-500">
            <AlertCircle className="w-8 h-8 mb-2 text-slate-600 animate-bounce" />
            <p className="text-xs">No active fines data to plot.</p>
          </div>
        ) : (
          (() => {
            const maxVal = Math.max(...chartData.map(d => d.collected + d.pending), 5000);
            const yTicks = [maxVal, maxVal * 0.75, maxVal * 0.5, maxVal * 0.25, 0];

            return (
              <div className="space-y-4">
                <div className="relative h-64 w-full flex items-end gap-2 md:gap-8 pt-6 pb-2 px-4 border-b border-white/10">
                  {/* Y-Axis Grid Lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[9px] text-slate-600 font-mono pr-2 font-semibold">
                    {yTicks.map((tick, i) => (
                      <div key={i} className="w-full flex items-center justify-between border-t border-white/[0.03] pt-1">
                        <span className="bg-slate-950/80 px-1 rounded">₹{Math.round(tick).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  {/* Bars */}
                  <div className="relative z-10 w-full h-full flex justify-around items-end">
                    {chartData.map((d) => {
                      const colPercent = (d.collected / maxVal) * 100;
                      const pendPercent = (d.pending / maxVal) * 100;
                      
                      return (
                        <div key={d.key} className="flex flex-col items-center group relative w-16">
                          {/* Tooltip on Hover */}
                          <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center bg-slate-950 border border-white/10 rounded-xl p-3 shadow-2xl text-[10px] text-slate-300 z-30 min-w-[140px] pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
                            <span className="font-bold text-white mb-1.5 tracking-wide text-xs block">{d.label} {d.key.split('-')[0]}</span>
                            <div className="flex justify-between w-full text-emerald-400 font-medium py-0.5">
                              <span>Paid:</span>
                              <span className="font-bold">₹{d.collected.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between w-full text-amber-400 font-medium py-0.5">
                              <span>Pending:</span>
                              <span className="font-bold">₹{d.pending.toLocaleString()}</span>
                            </div>
                            <div className="border-t border-white/10 w-full mt-1.5 pt-1.5 flex justify-between text-indigo-400 font-bold">
                              <span>Total Fines:</span>
                              <span>₹{(d.collected + d.pending).toLocaleString()}</span>
                            </div>
                          </div>

                          {/* Bar Column Container */}
                          <div className="w-full h-48 flex items-end gap-1.5 justify-center">
                            {/* Collected Bar */}
                            <div 
                              style={{ height: `${Math.max(colPercent, 3)}%` }} 
                              className="w-3 md:w-4 rounded-t bg-gradient-to-t from-emerald-600 to-emerald-400 group-hover:brightness-110 transition-all shadow-[0_0_8px_rgba(16,185,129,0.15)] group-hover:shadow-[0_0_12px_rgba(16,185,129,0.35)] duration-300 cursor-pointer"
                            />
                            {/* Pending Bar */}
                            <div 
                              style={{ height: `${Math.max(pendPercent, 3)}%` }} 
                              className="w-3 md:w-4 rounded-t bg-gradient-to-t from-amber-600 to-amber-400 group-hover:brightness-110 transition-all shadow-[0_0_8px_rgba(245,158,11,0.15)] group-hover:shadow-[0_0_12px_rgba(245,158,11,0.35)] duration-300 cursor-pointer"
                            />
                          </div>

                          {/* Month Label */}
                          <span className="text-[10px] text-slate-400 font-bold mt-2 group-hover:text-white transition-colors duration-200 uppercase tracking-wider">
                            {d.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()
        )}
      </div>

      {/* ── Main Dashboard Split Panels ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left Side: Real-Time Attendance Feed (Span 3) */}
        <div className="glass-panel p-6 rounded-3xl lg:col-span-3 flex flex-col h-[520px]">
          <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Today's Attendance Feed</h2>
              <p className="text-[11px] text-slate-400">Chronological check-in activity at the gate</p>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shadow-[0_0_10px_#10b981]" />
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-3 no-scrollbar">
            {attendanceFeed.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-8">
                <AlertCircle className="w-8 h-8 mb-2 text-slate-600" />
                <p className="text-xs">No active check-ins recorded today yet.</p>
              </div>
            ) : (
              attendanceFeed.map((item) => (
                <div key={item.id} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between transition-colors hover:bg-white/[0.04]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold text-xs">
                      {item.students.first_name[0]}{item.students.last_name[0]}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">
                        {item.students.first_name} {item.students.last_name}
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        ID: {item.students.student_custom_id} • Batch: {item.batches.name}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      {item.status === 'late' ? (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-amber-500/10 border border-amber-500/20 text-amber-400">
                          Late
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                          Present
                        </span>
                      )}
                      <span className="text-[10px] text-slate-300 font-semibold">
                        {item.check_in ? new Date(item.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-500 mt-1">
                      {item.verification_mode === 'face_live' && `Edge AI Match (${Math.round(Number(item.confidence_score || 0))}% similarity)`}
                      {item.verification_mode === 'face_photo' && 'Photo Upload'}
                      {item.verification_mode === 'manual' && 'Manual Override'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Quick Payment Verification Queue (Span 2) */}
        <div className="glass-panel p-6 rounded-3xl lg:col-span-2 flex flex-col h-[520px]">
          <div className="mb-4 border-b border-white/10 pb-3">
            <h2 className="text-lg font-bold text-white tracking-tight">Payment Verification</h2>
            <p className="text-[11px] text-slate-400">Review student-submitted fine proof receipts</p>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-4 no-scrollbar">
            {verificationQueue.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-8">
                <CheckCircle2 className="w-8 h-8 mb-2 text-indigo-400" />
                <p className="text-xs">Payment verification queue is empty.</p>
                <p className="text-[10px] text-slate-600 mt-1">Outstanding fine settlements are fully cleared</p>
              </div>
            ) : (
              verificationQueue.map((item) => (
                <div key={item.id} className="p-4 rounded-2xl bg-indigo-950/10 border border-indigo-500/15 space-y-3.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">
                        {item.students.first_name} {item.students.last_name}
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        ID: {item.students.student_custom_id} • Fine: {item.reason}
                      </p>
                    </div>
                    <span className="text-xs font-black text-indigo-300">
                      ₹{Number(item.amount).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-900/50 p-2 rounded-xl border border-white/5">
                    <div>
                      <span className="text-slate-500 block">Method</span>
                      <span className="text-slate-300 font-semibold uppercase">{item.payment_method || 'UPI'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Reference ID</span>
                      <span className="text-slate-300 font-semibold truncate block max-w-full">{item.transaction_id || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.payment_proof_url ? (
                      <button
                        onClick={() => setActiveProofUrl(item.payment_proof_url)}
                        className="btn-secondary h-8 px-2.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Receipt
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-semibold">No Attachment</span>
                    )}

                    <div className="flex-1 flex gap-2 justify-end">
                      <button
                        onClick={() => setRejectingId(item.id)}
                        disabled={actioningId !== null}
                        className="h-8 px-2.5 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/15 text-red-400 font-bold text-[10px] cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApprovePayment(item.id)}
                        disabled={actioningId !== null}
                        className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] cursor-pointer glow-emerald"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Modal 1: View Receipt Screenshot ── */}
      {activeProofUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative max-w-lg w-full glass-panel p-4 rounded-2xl flex flex-col max-h-[85vh]">
            <button
              onClick={() => setActiveProofUrl(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              ×
            </button>
            <div className="flex-1 overflow-hidden flex items-center justify-center bg-slate-950 rounded-xl border border-white/5 min-h-[300px]">
              <img
                src={activeProofUrl}
                alt="Payment Proof Receipt"
                className="max-w-full max-h-[60vh] object-contain rounded-lg"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-3 text-center">
              Verify this receipt matches transaction records before closing
            </p>
          </div>
        </div>
      )}

      {/* ── Modal 2: Rejection Reason Input ── */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">Reject Payment Proof</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Please enter the reason for rejecting this payment proof. The fine status will revert to Unpaid and the student will be notified.
            </p>
            <textarea
              required
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. UPI Reference ID not found in bank ledger."
              className="w-full p-3 rounded-xl glass-input text-xs"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setRejectingId(null);
                  setRejectionReason('');
                }}
                className="btn-secondary h-9 px-3 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectPayment}
                disabled={!rejectionReason.trim()}
                className="h-9 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer"
              >
                Reject Proof
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
