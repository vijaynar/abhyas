'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import {
  AlertCircle,
  CheckCircle2,
  IndianRupee,
  Eye,
  FileText,
  Filter,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  User,
  X,
  XCircle,
  Calendar,
  Info,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import CustomSelect from '../components/CustomSelect';

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
  student: {
    id: string;
    student_custom_id: string;
    user: {
      first_name: string;
      last_name: string;
      avatar_url: string | null;
    } | null;
  } | null;
}

interface StudentDropdownItem {
  id: string;
  student_custom_id: string;
  users: {
    first_name: string;
    last_name: string;
  } | null;
}

export default function FinesPage() {
  const [fines, setFines] = useState<FineItem[]>([]);
  const [students, setStudents] = useState<StudentDropdownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(15);

  // Stats
  const [unpaidSum, setUnpaidSum] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [paidSum, setPaidSum] = useState(0);

  // Manual creation modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [fineAmount, setFineAmount] = useState('');
  const [fineReason, setFineReason] = useState('');

  // Payment Verification State
  const [activeProofUrl, setActiveProofUrl] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actioningId, setActioningId] = useState<string | null>(null);

  const supabase = createBrowserClient();

  const loadDropdownStudents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile) return;

      const { data: stuData } = await supabase
        .from('students')
        .select('id, student_custom_id, users(first_name, last_name)')
        .eq('tenant_id', profile.tenant_id);

      setStudents((stuData || []) as unknown as StudentDropdownItem[]);
    } catch (err) {
      console.error(err);
    }
  };

  const loadFines = async (isRef = false) => {
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

      // 1. First fetch stats summary for header (all outstanding and paid)
      const { data: allFines } = await supabase
        .from('fines')
        .select('amount, status')
        .eq('tenant_id', tenantId);

      let unpaid = 0;
      let pending = 0;
      let paid = 0;
      if (allFines) {
        allFines.forEach((f: any) => {
          const amt = Number(f.amount);
          if (f.status === 'unpaid') unpaid += amt;
          else if (f.status === 'pending_verification') pending++;
          else if (f.status === 'paid') paid += amt;
        });
      }
      setUnpaidSum(unpaid);
      setPendingCount(pending);
      setPaidSum(paid);

      // 2. Fetchpaginated ledger records
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/v1/fines?${params.toString()}`);
      const result = await response.json();

      if (response.ok && result.data) {
        setFines(result.data.fines || []);
        setTotalPages(result.data.pagination.totalPages || 1);
      } else {
        console.error('API fine loading error:', result.error);
      }
    } catch (err) {
      console.error('Failed to load fines:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDropdownStudents();
  }, []);

  useEffect(() => {
    loadFines();
  }, [page, statusFilter]);

  const handleCreateFineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !fineAmount || !fineReason.trim()) return;

    setFormLoading(true);
    setFormError(null);

    try {
      const response = await fetch('/api/v1/fines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudentId,
          amount: Number(fineAmount),
          reason: fineReason,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setFormError(result.error || 'Failed to manually issue fine');
      } else {
        setShowAddModal(false);
        setSelectedStudentId('');
        setFineAmount('');
        setFineReason('');
        loadFines();
      }
    } catch (err: any) {
      setFormError(err.message || 'Internal connection error');
    } finally {
      setFormLoading(false);
    }
  };

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
      loadFines();
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
          payment_proof_url: null, // Clear bad proof link
        })
        .eq('id', rejectingId);

      if (error) throw error;
      setRejectingId(null);
      setRejectionReason('');
      loadFines();
    } catch (err) {
      console.error('Rejection failed:', err);
      alert('Failed to reject payment proof.');
    } finally {
      setActioningId(null);
    }
  };

  const filteredFines = fines.filter((fine) => {
    if (!fine.student?.user) return true;
    const name = `${fine.student.user.first_name} ${fine.student.user.last_name}`.toLowerCase();
    const id = fine.student.student_custom_id.toLowerCase();
    return name.includes(search.toLowerCase()) || id.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-8">
      {/* Upper Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold tracking-widest uppercase mb-1">
            <Sparkles className="w-4 h-4" /> Fine settlements pipeline
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Payment Records & Audit
          </h1>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => loadFines(true)}
            className="btn-secondary h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer glow-indigo"
          >
            <Plus className="w-4 h-4" /> Issue Manual Fine
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wide">Total Unpaid Balance</span>
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-white">₹{unpaidSum.toLocaleString()}</span>
            <span className="text-xs text-slate-500 block mt-1">Outstanding absence fees</span>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group border-indigo-500/25">
          <div className="flex items-center justify-between">
            <span className="text-slate-200 text-xs font-extrabold uppercase tracking-wide">Pending Verifications</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 glow-indigo">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-white glow-text-indigo">{pendingCount}</span>
            <span className="text-xs text-indigo-400 font-bold block mt-1 animate-pulse">Awaiting manual approval</span>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-xs font-bold uppercase tracking-wide">Fines Recovered</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-white">₹{paidSum.toLocaleString()}</span>
            <span className="text-xs text-slate-500 block mt-1">Fully settled accounts</span>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row gap-4 items-center justify-between">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student custom ID or Name..."
            className="w-full pl-10 pr-4 h-10 rounded-xl glass-input text-xs"
          />
        </div>

        {/* Status Tab buttons */}
        <div className="flex gap-1.5 p-1 rounded-xl bg-white/[0.02] border border-white/5 w-full sm:w-auto overflow-x-auto">
          {[
            { id: 'all', label: 'All Fines' },
            { id: 'unpaid', label: 'Unpaid' },
            { id: 'pending_verification', label: 'Verification Queue' },
            { id: 'paid', label: 'Paid' },
            { id: 'waived', label: 'Waived' }
          ].map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setStatusFilter(tab.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap
                ${active 
                  ? 'bg-indigo-600 text-white font-semibold glow-indigo' 
                  : 'text-slate-400 hover:text-slate-200'}`}
              >
                {tab.id === 'pending_verification' && pendingCount > 0 ? (
                  <span className="flex items-center gap-1">
                    {tab.label} <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black animate-pulse">{pendingCount}</span>
                  </span>
                ) : (
                  tab.label
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Fines Table */}
      <div className="glass-panel rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.01]">
                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider w-[15%] min-w-[120px]">Date Issued</th>
                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider w-[15%] min-w-[110px]">Student ID</th>
                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider w-[15%] min-w-[150px]">Student Name</th>
                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider w-[25%] min-w-[200px]">Reason for Penalty</th>
                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider w-[10%] min-w-[100px]">Fine Amount</th>
                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider w-[10%] min-w-[90px]">Status</th>
                <th className="py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider text-right w-[10%] min-w-[150px]">Verification Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin glow-indigo mx-auto mb-3" />
                    <p className="text-xs text-slate-400">Loading fine ledger registries...</p>
                  </td>
                </tr>
              ) : filteredFines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="text-xs">No records matching parameters found.</p>
                  </td>
                </tr>
              ) : (
                filteredFines.map((fine) => {
                  return (
                    <tr key={fine.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="py-4 px-6 text-xs text-slate-400 font-medium">
                        {new Date(fine.issued_date).toLocaleDateString([], { dateStyle: 'medium' })}
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-indigo-300 font-bold">
                        {fine.student?.student_custom_id}
                      </td>
                      <td className="py-4 px-6">
                        {fine.student?.user ? (
                          <div>
                            <h4 className="text-xs font-bold text-slate-200">
                              {fine.student.user.first_name} {fine.student.user.last_name}
                            </h4>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">Unknown Student</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-300 max-w-[200px] truncate">
                        {fine.reason}
                      </td>
                      <td className="py-4 px-6 font-black text-slate-100 text-xs">
                        ₹{Number(fine.amount).toLocaleString()}
                      </td>
                      <td className="py-4 px-6">
                        {fine.status === 'unpaid' && (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-amber-500/10 border border-amber-500/25 text-amber-400">
                            Unpaid
                          </span>
                        )}
                        {fine.status === 'paid' && (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                            Paid
                          </span>
                        )}
                        {fine.status === 'waived' && (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-slate-500/10 border border-slate-500/25 text-slate-500">
                            Waived
                          </span>
                        )}
                        {fine.status === 'pending_verification' && (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 animate-pulse glow-indigo">
                            Pending Audit
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {fine.status === 'pending_verification' ? (
                          <div className="flex gap-2 justify-end">
                            {fine.payment_proof_url && (
                              <button
                                onClick={() => setActiveProofUrl(fine.payment_proof_url)}
                                className="h-8 px-2.5 rounded-lg text-[10px] font-bold border border-white/10 hover:bg-white/5 text-slate-300 cursor-pointer flex items-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5 text-indigo-400" /> View Receipt
                              </button>
                            )}
                            <button
                              onClick={() => setRejectingId(fine.id)}
                              disabled={actioningId !== null}
                              className="h-8 px-2.5 rounded-lg border border-red-500/25 bg-red-500/5 hover:bg-red-500/15 text-red-400 font-bold text-[10px] cursor-pointer disabled:opacity-40"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleApprovePayment(fine.id)}
                              disabled={actioningId !== null}
                              className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] cursor-pointer glow-emerald disabled:opacity-40"
                            >
                              Approve
                            </button>
                          </div>
                        ) : fine.status === 'paid' && fine.paid_date ? (
                          <span className="text-[10px] text-slate-500 font-semibold italic">
                            Settled on {new Date(fine.paid_date).toLocaleDateString()} via {fine.payment_method?.toUpperCase() || 'UPI'}
                          </span>
                        ) : fine.status === 'waived' && fine.waive_reason ? (
                          <span className="text-[10px] text-slate-500 font-semibold italic max-w-[200px] truncate block" title={fine.waive_reason}>
                            Waived: "{fine.waive_reason}"
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-600 italic">No Actions</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-semibold uppercase">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="w-8 h-8 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="w-8 h-8 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
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
              Verify transaction ledger details before approving
            </p>
          </div>
        </div>
      )}

      {/* ── Modal 2: Rejection Reason Input ── */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">Reject Payment Audit</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Please enter the explanation for rejecting this transaction proof. The record status will revert to Unpaid.
            </p>
            <textarea
              required
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Transaction Reference ID does not match UPI bank credits."
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
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 3: Add Manual Fine ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md glass-panel p-6 rounded-3xl space-y-5 relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <div className="flex items-center gap-2 text-indigo-400 text-[10px] font-bold tracking-widest uppercase mb-1">
                <Sparkles className="w-3.5 h-3.5" /> Penalty pipeline
              </div>
              <h3 className="text-lg font-bold text-white">Manually Issue Fine</h3>
              <p className="text-xs text-slate-400">Issue an outstanding penalty record for class infractions.</p>
            </div>

            {formError && (
              <div className="p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateFineSubmit} className="space-y-4">
              
              {(() => {
                const studentOptions = [
                  { value: '', label: 'Choose Student...' },
                  ...students.map((s) => ({
                    value: s.id,
                    label: `${s.users?.first_name} ${s.users?.last_name} (${s.student_custom_id})`
                  }))
                ];
                return (
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wide">
                      Select Student Profile
                    </label>
                    <CustomSelect
                      value={selectedStudentId}
                      onChange={setSelectedStudentId}
                      options={studentOptions}
                      placeholder="Choose Student..."
                    />
                  </div>
                );
              })()}

              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wide">
                  Fine Amount (INR)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-xs font-black text-indigo-400">₹</span>
                  <input
                    type="number"
                    required
                    min={1}
                    value={fineAmount}
                    onChange={(e) => setFineAmount(e.target.value)}
                    placeholder="1000"
                    className="w-full pl-8 pr-4 h-10 rounded-xl glass-input text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wide">
                  Reason for Penalty
                </label>
                <textarea
                  required
                  value={fineReason}
                  onChange={(e) => setFineReason(e.target.value)}
                  placeholder="e.g. Failure to mark attendance for 3 consecutive days."
                  rows={3}
                  className="w-full p-3 rounded-xl glass-input text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary h-10 px-4 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="btn-primary h-10 px-5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer glow-indigo"
                >
                  {formLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Issue Fine Record
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
