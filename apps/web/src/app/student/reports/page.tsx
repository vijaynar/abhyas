'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  Clock,
  IndianRupee,
  AlertCircle,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Info,
  Award,
  RefreshCw
} from 'lucide-react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'present' | 'late' | 'absent';
  check_in: string | null;
}

interface FineItem {
  id: string;
  amount: number;
  reason: string;
  status: 'unpaid' | 'pending_verification' | 'paid' | 'waived';
  issued_date: string;
}

export default function StudentReportsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Date selection states
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth()); // 0-indexed

  // Data states
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [fines, setFines] = useState<FineItem[]>([]);
  const [weekends, setWeekends] = useState<number[]>([6, 7]); // Default Sat=6, Sun=7
  const [holidays, setHolidays] = useState<string[]>([]);
  const [studentCustomId, setStudentCustomId] = useState<string>('');

  const supabase = createBrowserClient();

  const loadReportData = async (isRef = false) => {
    if (isRef) setRefreshing(true);
    else setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userId = user.id;

      // 1. Fetch Student Profile Custom ID
      const { data: profile } = await supabase
        .from('students')
        .select('student_custom_id')
        .eq('id', userId)
        .single();
      
      if (profile) {
        setStudentCustomId(profile.student_custom_id);
      }

      // 2. Fetch Tenant Settings for Weekend and Holidays
      const settingsRes = await fetch('/api/v1/settings');
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        if (settings) {
          setWeekends(settings.weekends ?? [6, 7]);
          setHolidays(settings.holidays ?? []);
        }
      }

      // 3. Fetch Attendance Logs for the selected Month and Year
      // Format start and end dates of the month
      const startOfMonth = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const endOfMonth = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const { data: logs, error: logsErr } = await supabase
        .from('attendance_logs')
        .select('id, date, status, check_in')
        .eq('student_id', userId)
        .gte('date', startOfMonth)
        .lte('date', endOfMonth);

      if (logsErr) throw logsErr;
      setAttendance((logs || []) as AttendanceRecord[]);

      // 4. Fetch Fines issued in this month
      const { data: finesData, error: finesErr } = await supabase
        .from('fines')
        .select('id, amount, reason, status, issued_date')
        .eq('student_id', userId)
        .gte('issued_date', startOfMonth)
        .lte('issued_date', `${endOfMonth} 23:59:59`);

      if (finesErr) throw finesErr;
      setFines((finesData || []) as unknown as FineItem[]);

    } catch (err) {
      console.error('Failed to load monthly student report:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [selectedYear, selectedMonth]);

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  // Helper: check if a date string is today or in the future
  const getTodayStr = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  // Grid builder
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const firstDayIndex = new Date(selectedYear, selectedMonth, 1).getDay(); // 0=Sun, 1=Mon, etc.

  // Calendar days array
  const calendarCells = [];
  
  // Empty pads for offset
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null);
  }

  // Actual days
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(d);
  }

  // Calculate statistics
  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;

  attendance.forEach((log) => {
    if (log.status === 'present') presentCount++;
    else if (log.status === 'late') lateCount++;
    else if (log.status === 'absent') absentCount++;
  });

  const totalLogs = attendance.length;
  const attendedCount = presentCount + lateCount;
  const attendancePercentage = totalLogs > 0 ? Math.round((attendedCount / totalLogs) * 100) : 0;

  // Total unpaid fines in this month
  const unpaidFines = fines.filter((f) => f.status === 'unpaid' || f.status === 'pending_verification');
  const unpaidFinesTotal = unpaidFines.reduce((sum, f) => sum + Number(f.amount), 0);

  // SVG Circular progress params
  const strokeRadius = 45;
  const circumference = 2 * Math.PI * strokeRadius;
  const strokeDashoffset = circumference - (attendancePercentage / 100) * circumference;

  return (
    <div className="space-y-8">
      {/* Title Header with Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold tracking-widest uppercase mb-1">
            <Sparkles className="w-4 h-4" /> Academic Progress Reports
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Attendance History
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Student ID: {studentCustomId || 'Not Configured'}
          </p>
        </div>

        {/* Month/Year selectors */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-xl bg-slate-950/40 border border-white/5 p-1">
            <button
              onClick={handlePrevMonth}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-4.5 h-4.5" />
            </button>
            <span className="px-3 text-xs font-bold text-slate-200 select-none min-w-[120px] text-center">
              {MONTHS[selectedMonth]} {selectedYear}
            </span>
            <button
              onClick={handleNextMonth}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
            >
              <ChevronRight className="w-4.5 h-4.5" />
            </button>
          </div>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="h-10 px-3.5 rounded-xl glass-input text-xs font-bold"
          >
            {[2024, 2025, 2026, 2027, 2028].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="h-10 px-3.5 rounded-xl glass-input text-xs font-bold"
          >
            {MONTHS.map((m, idx) => (
              <option key={m} value={idx}>{m}</option>
            ))}
          </select>

          <button
            onClick={() => loadReportData(true)}
            className="btn-secondary h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin glow-indigo" />
          <p className="text-slate-400 text-xs font-semibold tracking-widest uppercase">
            Compiling monthly reporting metrics...
          </p>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-300">
          
          {/* Top Panel: Circular Gauge & KPI Summary cards */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Circular Gauge wheel */}
            <div className="glass-panel p-6 rounded-3xl border-indigo-500/20 flex flex-col items-center justify-center text-center relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-indigo-500/5 blur-2xl" />
              
              {/* Radial Progress */}
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  {/* Track */}
                  <circle
                    cx="64"
                    cy="64"
                    r={strokeRadius}
                    className="stroke-slate-800"
                    strokeWidth="10"
                    fill="transparent"
                  />
                  {/* Progress Arc */}
                  <circle
                    cx="64"
                    cy="64"
                    r={strokeRadius}
                    className="stroke-indigo-500 transition-all duration-500 ease-out glow-indigo"
                    strokeWidth="10"
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-white">{attendancePercentage}%</span>
                  <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest">Ratio</span>
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-xs font-extrabold text-slate-300 uppercase tracking-wide">Monthly Score</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {totalLogs === 0 
                    ? 'No attendance data logged' 
                    : attendancePercentage >= 85 
                    ? 'Excellent Standings' 
                    : 'Attendance improvement recommended'}
                </p>
              </div>
            </div>

            {/* Total logs details card */}
            <div className="glass-panel p-6 rounded-3xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wide">Attended Days</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-8">
                <span className="text-3xl font-black text-white">{attendedCount}</span>
                <span className="text-[10px] text-slate-500 block mt-1">
                  Present: {presentCount} | Late Check-ins: {lateCount}
                </span>
              </div>
            </div>

            {/* Absent records card */}
            <div className="glass-panel p-6 rounded-3xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wide">Absences Registered</span>
                <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                  <XCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-8">
                <span className="text-3xl font-black text-white">{absentCount}</span>
                <span className="text-[10px] text-slate-500 block mt-1">
                  Unexcused absent logs evaluated
                </span>
              </div>
            </div>

            {/* Fines accrued card */}
            <div className="glass-panel p-6 rounded-3xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wide">Monthly Penalties</span>
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <IndianRupee className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-8">
                <span className="text-3xl font-black text-white">₹{unpaidFinesTotal.toLocaleString()}</span>
                <span className="text-[10px] text-slate-500 block mt-1">
                  Outstanding for {unpaidFines.length} penalty records
                </span>
              </div>
            </div>

          </div>

          {/* Main Grid: Interactive Calendar & Monthly Fines */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            
            {/* Calendar View Panel (Span 3) */}
            <div className="glass-panel p-6 rounded-3xl lg:col-span-3 space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Interactive Calendar Grid</h2>
                  <p className="text-[11px] text-slate-400">View daily checkpoint statuses</p>
                </div>
                <Award className="w-5 h-5 text-indigo-400" />
              </div>

              {/* Grid Legend */}
              <div className="flex flex-wrap items-center gap-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 glow-emerald" /> Present
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 glow-amber" /> Late
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 glow-red" /> Absent
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-lg border border-dashed border-white/20 bg-slate-900/40" /> Weekend/Holiday
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-lg bg-slate-950" /> Future / Unmarked
                </div>
              </div>

              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider">
                <span>Sun</span>
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-2">
                {calendarCells.map((dayNum, index) => {
                  if (dayNum === null) {
                    return <div key={`empty-${index}`} className="aspect-square bg-transparent" />;
                  }

                  // Analyze the status of this specific day
                  const dStr = String(dayNum).padStart(2, '0');
                  const mStr = String(selectedMonth + 1).padStart(2, '0');
                  const dateStr = `${selectedYear}-${mStr}-${dStr}`;

                  // 1. Is it today or in the future?
                  const todayStr = getTodayStr();
                  const isFuture = dateStr > todayStr;

                  // 2. Is it a weekend?
                  const dateObj = new Date(selectedYear, selectedMonth, dayNum);
                  // JavaScript: Sun=0, Mon=1, ..., Sat=6
                  // Tenant Schema weekends: Mon=1, Tue=2, ..., Sat=6, Sun=7
                  const jsDay = dateObj.getDay();
                  const tenantDay = jsDay === 0 ? 7 : jsDay;
                  const isWeekend = weekends.includes(tenantDay);

                  // 3. Is it a holiday?
                  const isHoliday = holidays.includes(dateStr);

                  // 4. Find attendance record
                  const record = attendance.find((log) => log.date === dateStr);

                  // Style class compiler
                  let cellClass = 'bg-slate-950 border border-white/5 hover:border-slate-700 hover:bg-slate-900/50';
                  let textClass = 'text-slate-300';
                  let subText = '';

                  if (isWeekend || isHoliday) {
                    cellClass = 'bg-slate-900/40 border border-dashed border-white/5 text-slate-600';
                    textClass = 'text-slate-600';
                    subText = isHoliday ? 'Holi' : 'Wkend';
                  } else if (record) {
                    if (record.status === 'present') {
                      cellClass = 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400 glow-emerald';
                      textClass = 'text-emerald-300 font-extrabold';
                      subText = record.check_in 
                        ? new Date(record.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Present';
                    } else if (record.status === 'late') {
                      cellClass = 'bg-amber-950/20 border-amber-500/30 text-amber-400 glow-amber';
                      textClass = 'text-amber-300 font-extrabold';
                      subText = record.check_in 
                        ? new Date(record.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Late';
                    } else if (record.status === 'absent') {
                      cellClass = 'bg-red-950/20 border-red-500/30 text-red-400 glow-red';
                      textClass = 'text-red-300 font-extrabold';
                      subText = 'Absent';
                    }
                  } else if (!isFuture) {
                    // Past day with no log and not weekend/holiday
                    cellClass = 'bg-red-950/10 border-red-500/10 text-red-400/50';
                    textClass = 'text-red-400/60';
                    subText = 'No Log';
                  }

                  return (
                    <div
                      key={`day-${dayNum}`}
                      className={`aspect-square rounded-xl p-1.5 flex flex-col justify-between transition-all duration-200 select-none group relative ${cellClass}`}
                      title={record ? `Checked in: ${record.check_in || 'N/A'}` : `${dateStr}`}
                    >
                      <span className={`text-[10px] font-bold ${textClass}`}>
                        {dayNum}
                      </span>
                      {subText && (
                        <span className="text-[7px] text-slate-500 block truncate leading-none uppercase tracking-wide">
                          {subText}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Monthly Fine ledger list (Span 2) */}
            <div className="glass-panel p-6 rounded-3xl lg:col-span-2 space-y-6">
              <div className="border-b border-white/10 pb-3">
                <h2 className="text-lg font-bold text-white tracking-tight">Fines Log ({MONTHS[selectedMonth]})</h2>
                <p className="text-[11px] text-slate-400">View payment audits specific to this month</p>
              </div>

              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1 no-scrollbar">
                {fines.length === 0 ? (
                  <div className="text-center py-16">
                    <CheckCircle2 className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">No penalties recorded</p>
                    <p className="text-[9px] text-slate-600 mt-1">Excellent job keeping up perfect attendance.</p>
                  </div>
                ) : (
                  fines.map((fine) => (
                    <div key={fine.id} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[9px] text-slate-500 font-bold uppercase block">
                            Issued: {new Date(fine.issued_date).toLocaleDateString()}
                          </span>
                          <h4 className="text-xs font-bold text-slate-200 mt-0.5">{fine.reason}</h4>
                        </div>
                        <span className="text-xs font-extrabold text-indigo-400">
                          ₹{Number(fine.amount).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex justify-end pt-1 border-t border-white/5">
                        {fine.status === 'unpaid' && (
                          <span className="inline-flex px-1.5 py-0.2 rounded text-[7px] font-extrabold uppercase bg-amber-500/10 text-amber-400">
                            Unpaid
                          </span>
                        )}
                        {fine.status === 'pending_verification' && (
                          <span className="inline-flex px-1.5 py-0.2 rounded text-[7px] font-extrabold uppercase bg-indigo-500/10 text-indigo-400 animate-pulse">
                            Pending Audit
                          </span>
                        )}
                        {fine.status === 'paid' && (
                          <span className="inline-flex px-1.5 py-0.2 rounded text-[7px] font-extrabold uppercase bg-emerald-500/10 text-emerald-400">
                            Paid
                          </span>
                        )}
                        {fine.status === 'waived' && (
                          <span className="inline-flex px-1.5 py-0.2 rounded text-[7px] font-extrabold uppercase bg-slate-500/10 text-slate-500">
                            Waived
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Outstanding Alert */}
              {unpaidFinesTotal > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-950/15 border border-amber-500/20 text-amber-400 text-xs leading-normal flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Settle Pending Dues</span>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Please head to the main overview dashboard page to upload receipts and settle your outstanding balance.
                    </p>
                  </div>
                </div>
              )}

            </div>

          </div>

        </div>
      )}
    </div>
  );
}
