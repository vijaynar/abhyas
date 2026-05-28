'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  IndianRupee,
  FileText,
  Eye,
  Plus,
  RefreshCw,
  Sparkles,
  Upload,
  User,
  X,
  XCircle,
  TrendingUp,
  MapPin,
  FileImage,
  Award,
  Lock
} from 'lucide-react';

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
  paid_date: string | null;
  payment_method: string | null;
  transaction_id: string | null;
  payment_proof_url: string | null;
  rejection_reason: string | null;
  waive_reason: string | null;
}

interface StudentDashboardData {
  student: {
    student_custom_id: string;
    joining_date: string;
    batch: {
      name: string;
      start_time: string;
      end_time: string;
      days_of_week: number[];
      class: {
        name: string;
      } | null;
    } | null;
  } | null;
  attendanceStats: {
    totalClasses: number;
    attendedCount: number;
    absentCount: number;
    lateCount: number;
    ratio: number;
  };
  attendanceList: AttendanceRecord[];
}

export default function StudentDashboard() {
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [fines, setFines] = useState<FineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Submit Proof Modal
  const [submittingFine, setSubmittingFine] = useState<FineItem | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'bank_transfer' | 'cash'>('upi');
  const [transactionId, setTransactionId] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Password Change States
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securitySuccess, setSecuritySuccess] = useState<string | null>(null);

  // Photo upload states
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{ id: string; first_name: string; last_name: string; avatar_url: string | null } | null>(null);

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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setPhotoUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filename = `avatar_${user.id}_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('student-portraits')
        .upload(filename, file, { contentType: file.type, upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from('student-portraits').getPublicUrl(filename);
      const { error: updateErr } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);
      if (updateErr) throw updateErr;
      setPhotoUrl(publicUrl);
      setUserProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : prev);
    } catch (err: any) {
      console.error('Photo upload failed:', err);
      alert('Failed to upload photo: ' + err.message);
    } finally {
      setPhotoUploading(false);
    }
  };

  const loadDashboardData = async (isRef = false) => {
    if (isRef) setRefreshing(true);
    else setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userId = user.id;

      // 1. Fetch Student Metadata & Batch Info
      const { data: studentProfile, error: stuErr } = await supabase
        .from('students')
        .select(`
          student_custom_id, joining_date,
          batch:batches(
            name, start_time, end_time, days_of_week,
            class:classes(name)
          )
        `)
        .eq('id', userId)
        .single();

      if (stuErr) throw stuErr;

      // Also fetch user profile for avatar
      const { data: userRec } = await supabase
        .from('users')
        .select('id, first_name, last_name, avatar_url')
        .eq('id', userId)
        .single();
      if (userRec) {
        setUserProfile(userRec);
        setPhotoUrl(userRec.avatar_url);
      }

      // 2. Fetch student's attendance records
      const { data: attLogs, error: attErr } = await supabase
        .from('attendance_logs')
        .select('id, date, status, check_in')
        .eq('student_id', userId)
        .order('date', { ascending: false });

      if (attErr) throw attErr;

      // 3. Compute stats
      const totalCount = attLogs ? attLogs.length : 0;
      let present = 0;
      let late = 0;
      let absent = 0;

      if (attLogs) {
        attLogs.forEach((log: any) => {
          if (log.status === 'present') present++;
          else if (log.status === 'late') late++;
          else if (log.status === 'absent') absent++;
        });
      }

      const attended = present + late;
      const ratio = totalCount > 0 ? Math.round((attended / totalCount) * 100) : 100;

      // 4. Fetch Fines list
      const { data: finesData, error: fineErr } = await supabase
        .from('fines')
        .select('*')
        .eq('student_id', userId)
        .order('issued_date', { ascending: false });

      if (fineErr) throw fineErr;

      setData({
        student: studentProfile as any,
        attendanceStats: {
          totalClasses: totalCount,
          attendedCount: attended,
          absentCount: absent,
          lateCount: late,
          ratio,
        },
        attendanceList: (attLogs || []) as AttendanceRecord[],
      });

      setFines((finesData || []) as unknown as FineItem[]);
    } catch (err) {
      console.error('Failed to load student dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setScreenshotFile(e.target.files[0]);
    }
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittingFine || !transactionId || !screenshotFile) return;

    setUploading(true);
    setUploadError(null);

    try {
      // 1. Upload screenshot file to supabase student-portraits bucket
      const filename = `proof_${submittingFine.id}_${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from('student-portraits')
        .upload(filename, screenshotFile, {
          contentType: screenshotFile.type,
          cacheControl: '3600',
        });

      if (uploadErr) throw uploadErr;

      // Obtain public url
      const { data: { publicUrl } } = supabase.storage
        .from('student-portraits')
        .getPublicUrl(filename);

      // 2. Update fine record with payment details and change status to pending_verification
      const { error: updateErr } = await supabase
        .from('fines')
        .update({
          status: 'pending_verification',
          payment_method: paymentMethod,
          transaction_id: transactionId,
          payment_proof_url: publicUrl,
          rejection_reason: null, // Reset previous rejection note if resubmitted
        })
        .eq('id', submittingFine.id);

      if (updateErr) throw updateErr;

      // Success! Reset states & reload dashboard
      setSubmittingFine(null);
      setTransactionId('');
      setScreenshotFile(null);
      loadDashboardData();
      alert('Proof of payment submitted successfully for verification!');
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploadError(err.message || 'Failed to submit payment details.');
    } finally {
      setUploading(false);
    }
  };

  // Helper: Get Day Name from number (1=Mon ... 7=Sun)
  const getDayName = (dayNum: number) => {
    const days = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days[dayNum] || '';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin glow-indigo" />
        <p className="text-slate-400 text-xs font-semibold tracking-widest uppercase">
          Compiling student ledger stats...
        </p>
      </div>
    );
  }

  if (!data) return null;

  const unpaidFinesList = fines.filter((f) => f.status === 'unpaid');
  const totalUnpaidINR = unpaidFinesList.reduce((sum, f) => sum + Number(f.amount), 0);

  return (
    <div className="space-y-8">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Avatar with upload */}
          <div className="relative group flex-shrink-0">
            <div className="w-16 h-16 rounded-full bg-indigo-500/10 border-2 border-indigo-500/30 overflow-hidden flex items-center justify-center text-indigo-300 font-black text-lg">
              {photoUrl
                ? <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
                : <span>{userProfile?.first_name?.[0] || 'S'}{userProfile?.last_name?.[0] || 'T'}</span>
              }
            </div>
            <label className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center">
              {photoUploading
                ? <RefreshCw className="w-5 h-5 text-white animate-spin" />
                : <Upload className="w-5 h-5 text-white" />
              }
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={photoUploading} />
            </label>
          </div>
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold tracking-widest uppercase mb-1">
              <Sparkles className="w-4 h-4" /> Student Portal Overview
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              My Attendance Dashboard
            </h1>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Roll Ref: {data.student?.student_custom_id || 'Not Assigned'}
            </p>
          </div>
        </div>

        <button
          onClick={() => loadDashboardData(true)}
          className="btn-secondary h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Stats
        </button>
      </div>

      {/* Stats Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Attendance dial */}
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group flex items-center gap-4 border-indigo-500/20">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-indigo-500/5 blur-2xl" />
          
          <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 flex items-center justify-center font-black text-white text-lg glow-indigo">
            {data.attendanceStats.ratio}%
          </div>
          <div>
            <span className="text-slate-400 text-[10px] font-bold block uppercase tracking-wide">
              Attendance Rating
            </span>
            <span className="text-xs font-extrabold text-indigo-300 mt-1 block">
              {data.attendanceStats.ratio >= 85 ? 'Excellent Standings' : 'Improvement Required'}
            </span>
          </div>
        </div>

        {/* Present KPI */}
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wide">Attended Sessions</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-white">{data.attendanceStats.attendedCount}</span>
            <span className="text-[10px] text-slate-500 block mt-1">Present: {data.attendanceStats.attendedCount - data.attendanceStats.lateCount} | Late: {data.attendanceStats.lateCount}</span>
          </div>
        </div>

        {/* Absent KPI */}
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wide">Absences Registered</span>
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-white">{data.attendanceStats.absentCount}</span>
            <span className="text-xs text-slate-500 block mt-1">Missed sessions</span>
          </div>
        </div>

        {/* Outstanding Fine Balance */}
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wide">Outstanding Penalties</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-white">₹{totalUnpaidINR.toLocaleString()}</span>
            <span className="text-xs text-slate-500 block mt-1">Pending payments</span>
          </div>
        </div>

      </div>

      {/* Main Grid Split Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Left Hand: Attendance Calendar Logs Feed (Span 3) */}
        <div className="glass-panel p-6 rounded-3xl lg:col-span-3 space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">My Historical Attendance Logs</h2>
              <p className="text-[11px] text-slate-400">Review logsheets for checking in at gates</p>
            </div>
            <Award className="w-5 h-5 text-indigo-400 animate-pulse glow-indigo" />
          </div>

          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 no-scrollbar">
            {data.attendanceList.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-12">No attendance logs logged yet.</p>
            ) : (
              data.attendanceList.map((log) => (
                <div key={log.id} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xs">
                      <Calendar className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">
                        {new Date(log.date).toLocaleDateString([], { dateStyle: 'long' })}
                      </h4>
                      <span className="text-[9px] text-slate-500 font-semibold block mt-0.5">
                        Evaluated at gate checkpoint
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    {log.status === 'present' && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                        Present
                      </span>
                    )}
                    {log.status === 'late' && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-amber-500/10 border border-amber-500/25 text-amber-400">
                        Late
                      </span>
                    )}
                    {log.status === 'absent' && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-red-500/10 border border-red-500/25 text-red-400">
                        Absent
                      </span>
                    )}
                    
                    <span className="font-mono text-[10px] text-slate-400 font-bold block mt-1">
                      {log.check_in 
                        ? new Date(log.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                        : '-'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Hand: Outstanding Fines ledger & submit proofs (Span 2) */}
        <div className="glass-panel p-6 rounded-3xl lg:col-span-2 space-y-6">
          <div className="border-b border-white/10 pb-3">
            <h2 className="text-lg font-bold text-white tracking-tight">Payment History & Settlements</h2>
            <p className="text-[11px] text-slate-400">Clear outstanding penalties with UPI/Bank proof uploads</p>
          </div>

          <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 no-scrollbar">
            {fines.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No penalties logged!</p>
                <p className="text-[10px] text-slate-600 mt-1">Your account balance is completely settled.</p>
              </div>
            ) : (
              fines.map((fine) => (
                <div key={fine.id} className="p-4 rounded-2xl bg-indigo-950/10 border border-indigo-500/15 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold uppercase">
                        Issued: {new Date(fine.issued_date).toLocaleDateString()}
                      </span>
                      <h4 className="text-xs font-bold text-slate-200 mt-0.5">{fine.reason}</h4>
                    </div>
                    <span className="text-xs font-black text-indigo-300">
                      ₹{Number(fine.amount).toLocaleString()}
                    </span>
                  </div>

                  {/* Rejection Alert */}
                  {fine.status === 'unpaid' && fine.rejection_reason && (
                    <div className="p-2 rounded-xl bg-red-500/5 border border-red-500/20 text-[9px] text-red-400 font-semibold leading-normal">
                      <strong>Audit Rejection Note:</strong> "{fine.rejection_reason}"
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-white/5">
                    {fine.status === 'unpaid' ? (
                      <>
                        <span className="inline-flex px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase bg-amber-500/10 text-amber-400">
                          Unpaid
                        </span>
                        <button
                          onClick={() => setSubmittingFine(fine)}
                          className="h-8 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] cursor-pointer glow-indigo flex items-center gap-1"
                        >
                          <Upload className="w-3.5 h-3.5" /> Submit Proof
                        </button>
                      </>
                    ) : fine.status === 'pending_verification' ? (
                      <>
                        <span className="inline-flex px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase bg-indigo-500/10 text-indigo-400 animate-pulse">
                          Pending Audit
                        </span>
                        <span className="text-[9px] text-slate-500 italic">
                          Under manual review
                        </span>
                      </>
                    ) : fine.status === 'paid' ? (
                      <>
                        <span className="inline-flex px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase bg-emerald-500/10 text-emerald-400">
                          Paid
                        </span>
                        <span className="text-[9px] text-slate-500 italic">
                          Settled on {fine.paid_date ? new Date(fine.paid_date).toLocaleDateString() : '-'}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="inline-flex px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase bg-slate-500/10 text-slate-500">
                          Waived
                        </span>
                        <span className="text-[9px] text-slate-500 italic max-w-[120px] truncate" title={fine.waive_reason || ''}>
                          Reason: "{fine.waive_reason}"
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Account Security Change Password Panel */}
        <div className="glass-panel p-6 rounded-3xl space-y-4 lg:col-span-5 border border-white/5">
          <div className="border-b border-white/10 pb-3">
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Lock className="w-5 h-5 text-indigo-400" /> Account Security
            </h2>
            <p className="text-[11px] text-slate-400">Update your learning portal access password</p>
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

      {/* ── Modal: Submit Payment Proof ── */}
      {submittingFine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md glass-panel p-6 rounded-3xl space-y-5 relative">
            <button
              onClick={() => {
                setSubmittingFine(null);
                setScreenshotFile(null);
                setUploadError(null);
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <div className="flex items-center gap-2 text-indigo-400 text-[10px] font-bold tracking-widest uppercase mb-1">
                <Sparkles className="w-3.5 h-3.5" /> Settling Account
              </div>
              <h3 className="text-lg font-bold text-white">Upload Payment Proof</h3>
              <p className="text-xs text-slate-400">
                Please transfer ₹{Number(submittingFine.amount).toLocaleString()} and submit transaction details.
              </p>
            </div>

            {uploadError && (
              <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-[10px] font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitProof} className="space-y-4 text-xs">
              
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wide">
                  Select Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e: any) => setPaymentMethod(e.target.value)}
                  className="w-full px-3.5 h-10 rounded-xl glass-input text-xs"
                >
                  <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="bank_transfer">Bank Wire Transfer</option>
                  <option value="cash">Direct Cash to Admin</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wide">
                  UPI / Bank Reference Transaction ID
                </label>
                <input
                  type="text"
                  required
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="e.g. UPI TXN ID: 98327429871"
                  className="w-full px-3.5 h-10 rounded-xl glass-input text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wide">
                  Upload screenshot Receipt
                </label>
                <div className="border border-dashed border-white/10 hover:border-indigo-500/30 rounded-xl p-6 bg-white/[0.01] hover:bg-white/[0.02] transition-colors relative flex flex-col items-center justify-center text-center cursor-pointer">
                  <input
                    type="file"
                    required
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {screenshotFile ? (
                    <div className="flex items-center gap-2 text-indigo-400">
                      <FileImage className="w-5 h-5 glow-indigo" />
                      <span className="font-bold truncate max-w-[200px]">{screenshotFile.name}</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-slate-500 mb-2" />
                      <span className="text-[10px] text-slate-400">Click or drag screenshot here to upload</span>
                      <span className="text-[9px] text-slate-600 mt-0.5">JPEG or PNG files only</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setSubmittingFine(null);
                    setScreenshotFile(null);
                    setUploadError(null);
                  }}
                  className="btn-secondary h-10 px-4 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="btn-primary h-10 px-5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer glow-indigo"
                >
                  {uploading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Submit Proof Receipt
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
