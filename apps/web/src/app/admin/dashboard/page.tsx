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
  XCircle,
  Calendar,
  TrendingUp,
  User,
  Bell,
  BookOpen,
  Briefcase,
} from 'lucide-react';

interface KPIMetrics {
  presentToday: number;
  absentToday: number;
  pendingFines: number;
  activePayments: number;
}

interface CoachStat {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  is_active: boolean;
  coach_profile: {
    expertise: string | null;
    availability_slots?: string | null;
    hourly_rate?: number;
  } | null;
  approvedBatchCount: number;
  estimatedEarnings: number;
  totalSessions: number;
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
  const [coachStats, setCoachStats] = useState<CoachStat[]>([]);
  const [userRole, setUserRole] = useState<string>('admin');
  const [attendanceFeed, setAttendanceFeed] = useState<AttendanceFeedItem[]>([]);
  const [verificationQueue, setVerificationQueue] = useState<FinePaymentItem[]>([]);
  const [chartData, setChartData] = useState<ChartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [activeProofUrl, setActiveProofUrl] = useState<string | null>(null);

  // Coach dashboard state
  const [profileData, setProfileData] = useState<any>(null);
  const [coachBatches, setCoachBatches] = useState<any[]>([]);
  const [coachStudents, setCoachStudents] = useState<any[]>([]);
  const [coachFeesPendingStudents, setCoachFeesPendingStudents] = useState<any[]>([]);
  const [attendancePendingCount, setAttendancePendingCount] = useState(0);
  const [coachMonthlyEarnings, setCoachMonthlyEarnings] = useState({ rate: 500, sessions: 0, total: 0 });
  const [coachAttendanceTrend, setCoachAttendanceTrend] = useState<any[]>([]);
  const [coachLeaves, setCoachLeaves] = useState<any[]>([]);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<any[]>([]);

  const handleProcessRequest = async (requestId: string, approve: boolean) => {
    setActioningId(requestId);
    try {
      const response = await fetch(`/api/v1/students/join-request/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: approve ? 'approved' : 'rejected' })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to process request');
      
      alert(approve ? 'Request approved successfully!' : 'Request rejected successfully!');
      await loadDashboardData();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Connection error');
    } finally {
      setActioningId(null);
    }
  };
  
  // Leave form state
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [applyingLeave, setApplyingLeave] = useState(false);

  const supabase = createBrowserClient();

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
          status: 'Pending'
        });
        
      if (error) throw error;
      
      setLeaveStart('');
      setLeaveEnd('');
      setLeaveReason('');
      alert('Leave requested successfully!');
      
      // Reload leaves list
      const { data: leaves } = await supabase
        .from('coach_leaves')
        .select('id, start_date, end_date, reason, status')
        .eq('coach_id', user.id)
        .order('start_date', { ascending: true });
      setCoachLeaves(leaves || []);
    } catch (err) {
      console.error('Failed to request leave:', err);
      alert('Failed to request leave.');
    } finally {
      setApplyingLeave(false);
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id, role, first_name, last_name, tenants(name)')
        .eq('id', user.id)
        .single();

      if (!profile) return;
      setProfileData(profile);
      const tenantId = profile.tenant_id;
      const role = profile.role;
      setUserRole(role);

      const todayStr = new Date().toISOString().split('T')[0];

      if (role === 'coach') {
        const now = new Date();

        // 1. Fetch Coach Batches
        const { data: coachAssignments } = await supabase
          .from('coach_batch_assignments')
          .select('batch_id, assigned_days, batches(id, name, start_time, end_time, days_of_week, max_capacity, class_id, classes(name), students(id))')
          .eq('coach_id', user.id)
          .eq('status', 'approved');
          
        const batchesList = (coachAssignments || []).map((a: any) => ({
          ...a.batches,
          assigned_days: a.assigned_days
        }));
        setCoachBatches(batchesList);

        // 2. Fetch Coach Students
        const coachBatchIds = batchesList.map((b: any) => b.id);
        let studentsList: any[] = [];
        if (coachBatchIds.length > 0) {
          const { data: enrolledStudents } = await supabase
            .from('students')
            .select('id, student_custom_id, status, user:users(first_name, last_name, email, phone)')
            .in('batch_id', coachBatchIds)
            .eq('status', 'active');
          studentsList = enrolledStudents || [];
        }
        setCoachStudents(studentsList);

        // 3. Attendance Pending Check
        let pendingAttendanceCount = 0;
        if (coachBatchIds.length > 0) {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);
          const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
          
          const { data: recentLogs } = await supabase
            .from('attendance_logs')
            .select('batch_id, date')
            .in('batch_id', coachBatchIds)
            .gte('date', sevenDaysAgoStr);

          const logsSet = new Set((recentLogs || []).map((l: any) => `${l.batch_id}_${l.date}`));

          // Check last 7 days
          for (let i = 0; i <= 7; i++) {
            const checkDate = new Date();
            checkDate.setDate(now.getDate() - i);
            const checkDateStr = checkDate.toISOString().split('T')[0];
            const checkJsDay = checkDate.getDay();
            const checkTenantDay = checkJsDay === 0 ? 7 : checkJsDay;

            const scheduledBatches = batchesList.filter((b: any) => 
              (b.assigned_days || b.days_of_week || []).includes(checkTenantDay) && 
              (b.students && b.students.length > 0)
            );
            scheduledBatches.forEach((b: any) => {
              const key = `${b.id}_${checkDateStr}`;
              if (!logsSet.has(key)) {
                pendingAttendanceCount++;
              }
            });
          }
        }
        setAttendancePendingCount(pendingAttendanceCount);

        // 4. Fees Pending Students (Unpaid Fines in Coach's Batches)
        let coachFeesPending: any[] = [];
        if (coachBatchIds.length > 0) {
          const { data: feesPending } = await supabase
            .from('fines')
            .select('id, amount, reason, issued_date, status, students:student_id(id, student_custom_id, user:users(first_name, last_name))')
            .eq('status', 'unpaid');
          
          const studentIdsInCoachBatches = new Set(studentsList.map((s: any) => s.id));
          coachFeesPending = (feesPending || []).filter((f: any) => studentIdsInCoachBatches.has(f.students?.id));
        }
        setCoachFeesPendingStudents(coachFeesPending);

        // 5. Monthly Earnings & Rate
        let monthlyConductedSessions = 0;
        let hourlyRate = 500;
        const { data: coachProf } = await supabase
          .from('coaches')
          .select('hourly_rate')
          .eq('id', user.id)
          .single();
        if (coachProf?.hourly_rate) {
          hourlyRate = coachProf.hourly_rate;
        }
        
        if (coachBatchIds.length > 0) {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
          const { data: monthLogs } = await supabase
            .from('attendance_logs')
            .select('batch_id, date')
            .in('batch_id', coachBatchIds)
            .gte('date', startOfMonth);
          
          const uniqueSessions = new Set((monthLogs || []).map((l: any) => `${l.batch_id}_${l.date}`));
          monthlyConductedSessions = uniqueSessions.size;
        }
        
        setCoachMonthlyEarnings({
          rate: hourlyRate,
          sessions: monthlyConductedSessions,
          total: monthlyConductedSessions * hourlyRate
        });

        // 6. Attendance Trend (Last 5 days attendance rates)
        const trendData: { dateLabel: string; percent: number }[] = [];
        if (coachBatchIds.length > 0 && studentsList.length > 0) {
          const fiveDaysAgo = new Date();
          fiveDaysAgo.setDate(now.getDate() - 5);
          const fiveDaysAgoStr = fiveDaysAgo.toISOString().split('T')[0];
          
          const { data: trendLogs } = await supabase
            .from('attendance_logs')
            .select('date, status')
            .in('batch_id', coachBatchIds)
            .gte('date', fiveDaysAgoStr);

          const logsByDate: Record<string, string[]> = {};
          (trendLogs || []).forEach((l: any) => {
            if (!logsByDate[l.date]) logsByDate[l.date] = [];
            logsByDate[l.date].push(l.status);
          });

          for (let i = 4; i >= 0; i--) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            const dStr = d.toISOString().split('T')[0];
            const labels = d.toLocaleDateString('default', { month: 'short', day: 'numeric' });
            
            const statuses = logsByDate[dStr] || [];
            const presentCount = statuses.filter(s => s === 'present' || s === 'late').length;
            const totalLogs = statuses.length;
            const percent = totalLogs > 0 ? Math.round((presentCount / totalLogs) * 100) : 0;
            trendData.push({ dateLabel: labels, percent });
          }
        }
        setCoachAttendanceTrend(trendData);

        // 7. Coach Leaves
        const { data: leaves } = await supabase
          .from('coach_leaves')
          .select('id, start_date, end_date, reason, status')
          .eq('coach_id', user.id)
          .order('start_date', { ascending: true });
        setCoachLeaves(leaves || []);
      }

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

      // 6. Fetch coach stats (admins only)
      if (role === 'admin' || role === 'superadmin') {
        const { data: coaches } = await supabase
          .from('users')
          .select(`
            id, first_name, last_name, avatar_url, is_active,
            coach_profile:coaches(expertise:primary_skill),
            batch_assignments:coach_batch_assignments!coach_batch_assignments_coach_id_fkey(id, status, batch_id)
          `)
          .eq('tenant_id', tenantId)
          .eq('role', 'coach')
          .eq('is_active', true);

        if (coaches && coaches.length > 0) {
          const allBatchIds = coaches.flatMap((c: any) =>
            (c.batch_assignments || []).filter((a: any) => a.status === 'approved').map((a: any) => a.batch_id)
          );

          let sessionCounts: Record<string, number> = {};
          if (allBatchIds.length > 0) {
            const { data: sessions } = await supabase
              .from('attendance_logs')
              .select('batch_id, date')
              .eq('tenant_id', tenantId)
              .in('batch_id', allBatchIds);

            if (sessions) {
              const batchDateSets: Record<string, Set<string>> = {};
              sessions.forEach((s: any) => {
                if (!batchDateSets[s.batch_id]) batchDateSets[s.batch_id] = new Set();
                batchDateSets[s.batch_id].add(s.date);
              });
              Object.entries(batchDateSets).forEach(([batchId, dates]) => {
                sessionCounts[batchId] = dates.size;
              });
            }
          }

          const stats: CoachStat[] = coaches.map((c: any) => {
            const approved = (c.batch_assignments || []).filter((a: any) => a.status === 'approved');
            const totalSessions = approved.reduce((sum: number, a: any) => sum + (sessionCounts[a.batch_id] || 0), 0);
            const hourlyRate = c.coach_profile?.hourly_rate ?? 500;
            return {
              id: c.id,
              first_name: c.first_name,
              last_name: c.last_name,
              avatar_url: c.avatar_url,
              is_active: c.is_active,
              coach_profile: c.coach_profile,
              approvedBatchCount: approved.length,
              estimatedEarnings: totalSessions * hourlyRate,
              totalSessions,
            };
          });
          setCoachStats(stats);
        }

        // Fetch pending student join requests for admin dashboard
        const { data: requests } = await supabase
          .from('student_join_requests')
          .select(`
            id,
            remark,
            created_at,
            batch:batches(id, name, class:classes(name)),
            student:students(
              id, student_custom_id,
              user:users(first_name, last_name, email)
            )
          `)
          .eq('tenant_id', tenantId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        
        setPendingJoinRequests(requests || []);
      }
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

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin glow-indigo" />
      </div>
    );
  }

  if (userRole === 'coach') {
    const now = new Date();
    const jsDay = now.getDay();
    const tenantDay = jsDay === 0 ? 7 : jsDay;
    const todayClasses = coachBatches.filter(b => (b.assigned_days || b.days_of_week || []).includes(tenantDay));
    todayClasses.sort((a, b) => a.start_time.localeCompare(b.start_time));

    const getTodayClassStatus = (startTime: string, endTime: string) => {
      const currentStr = now.toTimeString().split(' ')[0];
      
      const padTime = (t: string) => {
        const parts = t.split(':');
        if (parts.length === 2) return `${t}:00`;
        return t;
      };
      
      const start = padTime(startTime);
      const end = padTime(endTime);
      
      if (currentStr > end) {
        return { label: 'Completed', class: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' };
      } else if (currentStr >= start && currentStr <= end) {
        return { label: 'Ongoing', class: 'bg-rose-500/15 border-rose-500/30 text-rose-400 animate-pulse glow-rose' };
      } else {
        return { label: 'Upcoming', class: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' };
      }
    };

    const upcomingClassesList: any[] = [];
    for (let offset = 1; offset <= 6; offset++) {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + offset);
      const targetJsDay = targetDate.getDay();
      const targetTenantDay = targetJsDay === 0 ? 7 : targetJsDay;
      const dayBatches = coachBatches.filter(b => (b.assigned_days || b.days_of_week || []).includes(targetTenantDay));
      dayBatches.forEach(b => {
        upcomingClassesList.push({
          ...b,
          targetDate,
          dayName: targetDate.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' })
        });
      });
    }
    upcomingClassesList.sort((a, b) => a.targetDate.getTime() - b.targetDate.getTime());

    // Notifications list
    const coachNotifications = [
      { id: '1', type: 'info', title: 'Schedule Update', desc: `You are assigned to ${coachBatches.length} active batch slot(s).`, time: '1 hour ago' },
      { id: '2', type: 'warning', title: 'Attendance Pending', desc: attendancePendingCount > 0 ? `You have ${attendancePendingCount} class session(s) pending attendance registry.` : 'All attendance sessions are up to date.', time: '2 hours ago' },
      { id: '3', type: 'success', title: 'Monthly Earnings Update', desc: `Hourly teaching rate of ₹${coachMonthlyEarnings.rate}/hr calculated.`, time: '1 day ago' },
    ];

    return (
      <div className="space-y-8">
        {/* Upper Title Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold tracking-widest uppercase mb-1">
              <Sparkles className="w-4 h-4" /> Coach Portal
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              {profileData ? `${profileData.first_name} ${profileData.last_name} Dashboard` : 'Coach Dashboard'}
            </h1>
          </div>
          <button
            onClick={loadDashboardData}
            className="btn-secondary h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5`} />
            Refresh Stats
          </button>
        </div>

        {/* ── KPI Cards Row (My Batches, My Students, Attendance Pending, Monthly Earnings) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* My Batches */}
          <div className="glass-panel glass-panel-hover p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-indigo-500/5 blur-2xl group-hover:bg-indigo-500/10 transition-colors" />
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs font-bold tracking-wide uppercase">My Batches</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-white">{coachBatches.length}</span>
              <span className="text-xs text-slate-500 font-semibold block mt-1">Assigned streams</span>
            </div>
          </div>

          {/* My Students */}
          <div className="glass-panel glass-panel-hover p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-emerald-500/5 blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs font-bold tracking-wide uppercase">My Students</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-white">{coachStudents.length}</span>
              <span className="text-xs text-slate-500 font-semibold block mt-1">Active enrollments</span>
            </div>
          </div>

          {/* Attendance Pending */}
          <div className="glass-panel glass-panel-hover p-6 rounded-2xl relative overflow-hidden group border-amber-500/10">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-amber-500/5 blur-2xl group-hover:bg-amber-500/10 transition-colors" />
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs font-bold tracking-wide uppercase">Attendance Pending</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-amber-400 border border-amber-500/20 bg-amber-500/10 ${attendancePendingCount > 0 ? 'animate-pulse' : ''}`}>
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <span className={`text-3xl font-black ${attendancePendingCount > 0 ? 'text-amber-400 glow-text-amber' : 'text-white'}`}>
                {attendancePendingCount}
              </span>
              <span className="text-xs text-slate-500 font-semibold block mt-1">Sessions to verify</span>
            </div>
          </div>

          {/* Monthly Earnings */}
          <div className="glass-panel glass-panel-hover p-6 rounded-2xl relative overflow-hidden group border-purple-500/20">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-purple-500/10 blur-2xl group-hover:bg-purple-500/20 transition-colors" />
            <div className="flex items-center justify-between">
              <span className="text-slate-200 text-xs font-extrabold tracking-wide uppercase">Monthly Earnings</span>
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                <IndianRupee className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-white glow-text-purple">₹{coachMonthlyEarnings.total.toLocaleString()}</span>
              <span className="text-[10px] text-purple-400 font-bold block mt-1">
                ₹{coachMonthlyEarnings.rate}/hr • {coachMonthlyEarnings.sessions} sessions
              </span>
            </div>
          </div>
        </div>

        {/* ── Middle Widgets Section ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left Column (Today's Classes, Upcoming Classes, Notifications) */}
          <div className="lg:col-span-3 space-y-8">
            {/* Widget 1: Today's Classes */}
            <div className="glass-panel p-6 rounded-3xl flex flex-col h-[340px]">
              <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3 flex-shrink-0">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <BookOpen className="w-4.5 h-4.5 text-indigo-400" /> Today's Classes
                  </h2>
                  <p className="text-[10px] text-slate-400">Class streams scheduled to teach today</p>
                </div>
                <span className="text-[9px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded font-black uppercase">
                  {todayClasses.length} Scheduled
                </span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 no-scrollbar">
                {todayClasses.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-6">
                    <Calendar className="w-8 h-8 text-slate-600 mb-2" />
                    <p className="text-xs">No classes scheduled for today.</p>
                  </div>
                ) : (
                  todayClasses.map((b) => (
                    <div key={b.id} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between hover:bg-white/[0.04] transition-colors">
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">{b.classes.name}</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5">Batch: {b.name}</p>
                      </div>
                      <div className="text-right flex flex-col items-end justify-center">
                        <span className="text-xs font-semibold text-indigo-300 block">{b.start_time.slice(0, 5)} - {b.end_time.slice(0, 5)}</span>
                        {(() => {
                          const status = getTodayClassStatus(b.start_time, b.end_time);
                          return (
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase border mt-1.5 ${status.class}`}>
                              {status.label}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Widget 2: Upcoming Classes */}
            <div className="glass-panel p-6 rounded-3xl flex flex-col h-[340px]">
              <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3 flex-shrink-0">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <Calendar className="w-4.5 h-4.5 text-indigo-400" /> Upcoming Classes
                  </h2>
                  <p className="text-[10px] text-slate-400">Class streams scheduled for the next 6 days</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 no-scrollbar">
                {upcomingClassesList.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-6">
                    <Calendar className="w-8 h-8 text-slate-600 mb-2" />
                    <p className="text-xs">No upcoming classes scheduled.</p>
                  </div>
                ) : (
                  upcomingClassesList.map((b, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between hover:bg-white/[0.04] transition-colors gap-4">
                      {/* Column 1: Class & Batch Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-indigo-400 truncate">{b.classes.name}</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5 truncate">Batch: {b.name}</p>
                      </div>
                      {/* Column 2: Day & Date Column */}
                      <div className="text-center px-2 py-1 rounded-lg bg-slate-900/60 border border-white/5 flex-shrink-0 min-w-[75px]">
                        <span className="text-[10px] font-bold text-slate-300 block">{b.dayName.split(',')[0]}</span>
                        <span className="text-[9px] text-slate-500 block leading-tight mt-0.5">{b.dayName.split(',')[1]?.trim()}</span>
                      </div>
                      {/* Column 3: Hours Time */}
                      <div className="text-right flex-shrink-0 min-w-[70px]">
                        <span className="text-xs font-semibold text-indigo-400 block">{b.start_time.slice(0, 5)} - {b.end_time.slice(0, 5)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Widget 8: Notifications */}
            <div className="glass-panel p-6 rounded-3xl flex flex-col h-[340px]">
              <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3 flex-shrink-0">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <Bell className="w-4.5 h-4.5 text-indigo-400" /> Notifications Feed
                  </h2>
                  <p className="text-[10px] text-slate-400">Real-time alerts, check-ins, and schedule logs</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 no-scrollbar">
                {coachNotifications.map((notif) => (
                  <div key={notif.id} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-3 hover:bg-white/[0.04] transition-colors">
                    <div className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 
                      ${notif.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : notif.type === 'warning' ? 'bg-amber-500/10 text-amber-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                      {notif.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : notif.type === 'warning' ? <AlertCircle className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-xs font-bold text-slate-200 truncate">{notif.title}</h4>
                        <span className="text-[9px] text-slate-500 flex-shrink-0 font-medium">{notif.time}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{notif.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column (Attendance Trend, Fees Pending Students, Upcoming Leaves) */}
          <div className="lg:col-span-2 space-y-8">
            {/* Widget 9: Attendance Trend (SVG Bar chart widget) */}
            <div className="glass-panel p-6 rounded-3xl flex flex-col h-[340px]">
              <div className="mb-4 border-b border-white/10 pb-3 flex-shrink-0">
                <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <TrendingUp className="w-4.5 h-4.5 text-indigo-400" /> Attendance Trend
                </h2>
                <p className="text-[10px] text-slate-400">Class attendance percentage of the last 5 session days</p>
              </div>
              <div className="flex-1 flex items-end justify-between px-2 pb-2 h-44">
                {coachAttendanceTrend.length === 0 ? (
                  <div className="w-full text-center text-slate-600 text-xs italic py-12">
                    No session attendance log data found.
                  </div>
                ) : (
                  coachAttendanceTrend.map((t, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-2 flex-1 group relative">
                      {/* Tooltip on hover */}
                      <span className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 bg-slate-950 border border-white/10 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-lg transition-opacity duration-150 pointer-events-none">
                        {t.percent}%
                      </span>
                      <span className="text-[10px] text-indigo-300 font-bold group-hover:scale-110 transition-transform">{t.percent}%</span>
                      <div 
                        style={{ height: `${Math.max(t.percent, 6)}%` }} 
                        className="w-4 rounded-t bg-gradient-to-t from-indigo-600 to-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.2)] group-hover:from-indigo-500 group-hover:to-indigo-300 transition-all duration-300"
                      />
                      <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">{t.dateLabel}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Widget 6: Fees Pending Students */}
            <div className="glass-panel p-6 rounded-3xl flex flex-col h-[340px]">
              <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3 flex-shrink-0">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <IndianRupee className="w-4.5 h-4.5 text-indigo-400" /> Fees Pending Students
                  </h2>
                  <p className="text-[10px] text-slate-400">Enrolled students with outstanding unpaid fines</p>
                </div>
                <span className="text-[9px] bg-red-500/10 border border-red-500/30 text-red-300 px-2 py-0.5 rounded font-black uppercase">
                  {coachFeesPendingStudents.length} Students
                </span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 no-scrollbar">
                {coachFeesPendingStudents.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-6">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400/30 mb-2" />
                    <p className="text-xs">No students with pending fines.</p>
                  </div>
                ) : (
                  coachFeesPendingStudents.map((f) => (
                    <div key={f.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between hover:bg-white/[0.04] transition-colors">
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">
                          {f.students?.user?.first_name} {f.students?.user?.last_name}
                        </h4>
                        <p className="text-[9px] text-slate-500 mt-0.5">Reason: {f.reason}</p>
                      </div>
                      <span className="text-xs font-extrabold text-red-400 font-mono">₹{f.amount}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Widget 10: Upcoming Leaves (List + Application form) */}
            <div className="glass-panel p-6 rounded-3xl flex flex-col min-h-[440px] max-h-[500px]">
              <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3 flex-shrink-0">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <Briefcase className="w-4.5 h-4.5 text-indigo-400" /> Leave Registry
                  </h2>
                  <p className="text-[10px] text-slate-400">Request time-off and view leaves history</p>
                </div>
              </div>
              
              {/* Leaves List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 mb-4 no-scrollbar max-h-48 border-b border-white/5 pb-3">
                {coachLeaves.length === 0 ? (
                  <p className="text-[10px] text-slate-600 italic py-2 pl-1">No leave requests filed.</p>
                ) : (
                  coachLeaves.map((l) => (
                    <div key={l.id} className="p-2.5 rounded-lg bg-white/[0.01] border border-white/5 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-300 truncate">{l.reason}</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">{new Date(l.start_date).toLocaleDateString([], {month:'short', day:'numeric'})} - {new Date(l.end_date).toLocaleDateString([], {month:'short', day:'numeric'})}</p>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border uppercase flex-shrink-0
                        ${l.status === 'Approved' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : l.status === 'Rejected' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                        {l.status}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Leave Application Form */}
              <form onSubmit={handleRequestLeave} className="space-y-2.5 flex-shrink-0 bg-white/[0.01] p-3 rounded-xl border border-white/5">
                <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">Apply for Leave</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold">Start Date</label>
                    <input
                      type="date"
                      required
                      value={leaveStart}
                      onChange={(e) => setLeaveStart(e.target.value)}
                      className="w-full h-8 px-2 rounded-lg glass-input text-[10px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 font-bold">End Date</label>
                    <input
                      type="date"
                      required
                      value={leaveEnd}
                      onChange={(e) => setLeaveEnd(e.target.value)}
                      className="w-full h-8 px-2 rounded-lg glass-input text-[10px]"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold">Reason</label>
                  <input
                    type="text"
                    required
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    placeholder="e.g. Family Emergency"
                    className="w-full h-8 px-2 rounded-lg glass-input text-[10px]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={applyingLeave || !leaveStart || !leaveEnd || !leaveReason.trim()}
                  className="w-full h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] cursor-pointer transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {applyingLeave ? 'Filing Request...' : 'Submit Leave Request'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Upper Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold tracking-widest uppercase mb-1">
            <Sparkles className="w-4 h-4" /> Live Academy Insights
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            {profileData?.tenants?.name ? `${profileData.tenants.name} Dashboard` : 'Academy Dashboard'}
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

      {/* ── KPI Cards Grid — Coach KPI for admins ── */}
      {(userRole === 'admin' || userRole === 'superadmin') && coachStats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Active Coaches */}
          <div className="glass-panel glass-panel-hover p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-purple-500/5 blur-2xl group-hover:bg-purple-500/10 transition-colors" />
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs font-bold tracking-wide uppercase">Active Coaches</span>
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-white">{coachStats.length}</span>
              <span className="text-xs text-slate-500 font-semibold block mt-1">On roster</span>
            </div>
          </div>
          {/* Total Sessions */}
          <div className="glass-panel glass-panel-hover p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-cyan-500/5 blur-2xl group-hover:bg-cyan-500/10 transition-colors" />
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs font-bold tracking-wide uppercase">Total Sessions</span>
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-white">{coachStats.reduce((s, c) => s + c.totalSessions, 0)}</span>
              <span className="text-xs text-slate-500 font-semibold block mt-1">Sessions conducted</span>
            </div>
          </div>
          {/* Coach Earnings */}
          <div className="glass-panel glass-panel-hover p-6 rounded-2xl relative overflow-hidden group border-purple-500/20">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-purple-500/10 blur-2xl group-hover:bg-purple-500/20 transition-colors" />
            <div className="flex items-center justify-between">
              <span className="text-slate-200 text-xs font-extrabold tracking-wide uppercase">Est. Coach Payouts</span>
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                <IndianRupee className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-black text-white">₹{coachStats.reduce((s, c) => s + c.estimatedEarnings, 0).toLocaleString()}</span>
              <span className="text-xs text-purple-400 font-bold block mt-1">Total estimated</span>
            </div>
          </div>
        </div>
      )}

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

      {/* ── Coach Earnings & Availability Registry (Admins only) ── */}
      {(userRole === 'admin' || userRole === 'superadmin') && coachStats.length > 0 && (
        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-purple-500/5 blur-3xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" /> Coach Earnings & Availability Registry
              </h2>
              <p className="text-[11px] text-slate-400">Session earnings, availability slots, and batch assignments per coach</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-xs font-bold text-slate-400">
                  <th className="p-3 w-[25%] min-w-[160px]">Coach</th>
                  <th className="p-3 w-[15%] min-w-[120px]">Expertise</th>
                  <th className="p-3 w-[20%] min-w-[160px]">Availability</th>
                  <th className="p-3 text-center w-[10%] min-w-[70px]">Batches</th>
                  <th className="p-3 text-center w-[10%] min-w-[70px]">Sessions</th>
                  <th className="p-3 text-right w-[10%] min-w-[100px]">Rate / Session</th>
                  <th className="p-3 text-right w-[10%] min-w-[110px]">Est. Earnings</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-white/5">
                {coachStats.map((coach) => (
                  <tr key={coach.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-300 font-bold text-xs flex-shrink-0">
                          {coach.avatar_url
                            ? <img src={coach.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                            : `${coach.first_name[0]}${coach.last_name[0]}`
                          }
                        </div>
                        <div>
                          <p className="font-semibold text-slate-200">{coach.first_name} {coach.last_name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-slate-400 max-w-[140px]">
                      <span className="truncate block">{coach.coach_profile?.expertise || '—'}</span>
                    </td>
                    <td className="p-3 max-w-[160px]">
                      {coach.coach_profile?.availability_slots
                        ? <span className="text-indigo-300 text-[10px] font-semibold leading-tight block">{coach.coach_profile.availability_slots}</span>
                        : <span className="text-slate-600 italic">Not set</span>
                      }
                    </td>
                    <td className="p-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-bold">
                        {coach.approvedBatchCount}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-slate-200 font-bold">{coach.totalSessions}</span>
                    </td>
                    <td className="p-3 text-right text-slate-300 font-mono">
                      ₹{(coach.coach_profile?.hourly_rate ?? 500).toLocaleString()}
                    </td>
                    <td className="p-3 text-right">
                      <span className="text-purple-300 font-black">₹{coach.estimatedEarnings.toLocaleString()}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

        {/* Right Side: Quick Payment Verification Queue & Join Requests (Span 2) */}
        <div className="lg:col-span-2 flex flex-col gap-6 h-[520px]">
          
          {/* Student Join Requests Widget */}
          <div className="glass-panel p-5 rounded-3xl flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2 flex-shrink-0">
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-400" /> Student Join Requests
                </h2>
                <p className="text-[9px] text-slate-500">Approve requests to register in class batches</p>
              </div>
              {pendingJoinRequests.length > 0 && (
                <span className="text-[9px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 px-1.5 py-0.2 rounded font-black animate-pulse">
                  {pendingJoinRequests.length} Pending
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-3 no-scrollbar">
              {pendingJoinRequests.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-4">
                  <CheckCircle2 className="w-6 h-6 mb-1 text-emerald-400/40" />
                  <p className="text-[10px]">No pending join requests.</p>
                </div>
              ) : (
                pendingJoinRequests.map((req) => (
                  <div key={req.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-[11px] font-bold text-slate-200">
                          {req.student.user.first_name} {req.student.user.last_name}
                        </h4>
                        <p className="text-[9px] text-slate-500 mt-0.5">
                          ID: {req.student.student_custom_id} • Batch: {req.batch?.name || 'Unknown'}
                        </p>
                      </div>
                    </div>
                    {req.remark && (
                      <p className="text-[9px] text-slate-400 bg-white/[0.01] border border-white/5 p-1.5 rounded-lg italic">
                        "{req.remark}"
                      </p>
                    )}
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleProcessRequest(req.id, false)}
                        disabled={actioningId !== null}
                        className="h-6 px-2 rounded-lg border border-red-500/20 bg-red-500/5 hover:bg-red-500/15 text-red-400 font-bold text-[9px] cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleProcessRequest(req.id, true)}
                        disabled={actioningId !== null}
                        className="h-6 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[9px] cursor-pointer glow-indigo"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Payment Verification Widget */}
          <div className="glass-panel p-5 rounded-3xl flex-1 flex flex-col overflow-hidden">
            <div className="mb-3 border-b border-white/10 pb-2 flex-shrink-0">
              <h2 className="text-sm font-bold text-white tracking-tight">Payment Verification</h2>
              <p className="text-[9px] text-slate-500">Review student-submitted fine proof receipts</p>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-3.5 no-scrollbar">
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
