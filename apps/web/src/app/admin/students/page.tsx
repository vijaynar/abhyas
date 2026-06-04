'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  User,
  Users,
  X,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Lock,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import CustomSelect from '../components/CustomSelect';

interface StudentItem {
  id: string;
  student_custom_id: string;
  date_of_birth: string;
  joining_date: string;
  address: string | null;
  emergency_contact: string | null;
  status: 'active' | 'inactive' | 'suspended';
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    is_active: boolean;
  };
  batch: {
    id: string;
    name: string;
    start_time: string;
    end_time: string;
    class: {
      id: string;
      name: string;
    } | null;
  } | null;
  face_count: { count: number }[];
}

interface BatchItem {
  id: string;
  name: string;
  classes: {
    name: string;
  } | null;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10);

  const batchOptions = [
    { value: 'all', label: 'All Batches' },
    ...batches.map((b) => ({
      value: b.id,
      label: `${b.name}${b.classes ? ` (${b.classes.name})` : ''}`
    }))
  ];

  const formBatchOptions = [
    { value: '', label: 'Select Batch' },
    ...batches.map((b) => ({
      value: b.id,
      label: b.name
    }))
  ];

  const statusOptions = [
    { value: 'active', label: 'Active Students' },
    { value: 'inactive', label: 'Inactive Students' },
    { value: 'suspended', label: 'Suspended Students' },
    { value: 'all', label: 'All Statuses' }
  ];

  // Form states for creating a student
  const [showAddModal, setShowAddModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fields matching CreateStudentSchema
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [studentCustomId, setStudentCustomId] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [batchId, setBatchId] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  const supabase = createBrowserClient();

  // Resizable columns state & helpers
  const [columnWidths, setColumnWidths] = useState({
    customId: 120,
    name: 220,
    batch: 200,
    status: 130,
    joiningDate: 150,
    actions: 180
  });

  const handleResizeStart = (colName: keyof typeof columnWidths, startEvent: React.MouseEvent) => {
    startEvent.preventDefault();
    const startX = startEvent.clientX;
    const startWidth = columnWidths[colName];

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setColumnWidths((prev) => ({
        ...prev,
        [colName]: Math.max(80, startWidth + deltaX)
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Student removal states & handlers
  const [removingStudent, setRemovingStudent] = useState<StudentItem | null>(null);
  const [removalRemark, setRemovalRemark] = useState('');
  const [removalLoading, setRemovalLoading] = useState(false);

  const handleRemoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!removingStudent) return;
    setRemovalLoading(true);
    try {
      const response = await fetch('/api/v1/students/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: removingStudent.id,
          remark: removalRemark
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to remove student');

      setRemovingStudent(null);
      setRemovalRemark('');
      alert('Student successfully removed from batch.');
      await loadStudents();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Connection error');
    } finally {
      setRemovalLoading(false);
    }
  };

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

      setBatches((batchData || []) as unknown as BatchItem[]);
    } catch (err) {
      console.error('Failed to load batches:', err);
    }
  };

  const loadStudents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search,
        status: statusFilter,
      });
      if (selectedBatch !== 'all') {
        params.append('batchId', selectedBatch);
      }

      const response = await fetch(`/api/v1/students?${params.toString()}`);
      const result = await response.json();

      if (response.ok && result.data) {
        setStudents(result.data.students || []);
        setTotalPages(result.data.pagination.totalPages || 1);
      } else {
        console.error('API error loading students:', result.error);
      }
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  useEffect(() => {
    loadStudents();
  }, [page, selectedBatch, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadStudents();
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    if (!password.trim() && !phone.trim()) {
      setFormError("A password or a phone number is required to provision the student's account.");
      setFormLoading(false);
      return;
    }

    const payload = {
      email,
      password: password || undefined,
      firstName,
      lastName,
      phone: phone || undefined,
      studentCustomId: studentCustomId.trim() || undefined,
      dateOfBirth,
      joiningDate: joiningDate || undefined,
      batchId: batchId || undefined,
      address: address || undefined,
      emergencyContact: emergencyContact || undefined,
    };

    try {
      const response = await fetch('/api/v1/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        setFormError(result.error || 'Failed to add student');
      } else {
        // Success
        setShowAddModal(false);
        // Reset form
        setEmail('');
        setPassword('');
        setFirstName('');
        setLastName('');
        setPhone('');
        setStudentCustomId('');
        setDateOfBirth('');
        setJoiningDate(new Date().toISOString().split('T')[0]);
        setBatchId('');
        setAddress('');
        setEmergencyContact('');
        // Reload list
        loadStudents();
      }
    } catch (err: any) {
      setFormError(err.message || 'Internal connection error');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Upper Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold tracking-widest uppercase mb-1">
            <Sparkles className="w-4 h-4" /> Academy Roster
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Student Management
          </h1>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer self-start md:self-auto glow-indigo"
        >
          <Plus className="w-4 h-4" /> Add Student Profile
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="glass-panel p-4 rounded-2xl">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, Name..."
              className="w-full pl-10 pr-4 h-10 rounded-xl glass-input text-xs"
            />
          </div>

          {/* Batch Selector */}
          <CustomSelect
            value={selectedBatch}
            onChange={(val) => {
              setSelectedBatch(val);
              setPage(1);
            }}
            options={batchOptions}
            placeholder="All Batches"
          />

          {/* Status Filter */}
          <CustomSelect
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val);
              setPage(1);
            }}
            options={statusOptions}
            placeholder="Active Students"
          />

          {/* Filter Action */}
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer transition-colors duration-200"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedBatch('all');
                setStatusFilter('active');
                setPage(1);
                loadStudents();
              }}
              className="h-10 px-3.5 rounded-xl border border-white/10 hover:bg-white/5 text-slate-300 cursor-pointer transition-colors duration-200"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* Students Data-Table */}
      <div className="glass-panel rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table style={{ tableLayout: 'fixed' }} className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.01]">
                <th style={{ width: columnWidths.customId }} className="relative py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Custom ID
                  <div
                    onMouseDown={(e) => handleResizeStart('customId', e)}
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-500/50 bg-transparent active:bg-indigo-600 z-10"
                  />
                </th>
                <th style={{ width: columnWidths.name }} className="relative py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Student Name
                  <div
                    onMouseDown={(e) => handleResizeStart('name', e)}
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-500/50 bg-transparent active:bg-indigo-600 z-10"
                  />
                </th>
                <th style={{ width: columnWidths.batch }} className="relative py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Batch Schedule
                  <div
                    onMouseDown={(e) => handleResizeStart('batch', e)}
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-500/50 bg-transparent active:bg-indigo-600 z-10"
                  />
                </th>
                <th style={{ width: columnWidths.status }} className="relative py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Face Bio Status
                  <div
                    onMouseDown={(e) => handleResizeStart('status', e)}
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-500/50 bg-transparent active:bg-indigo-600 z-10"
                  />
                </th>
                <th style={{ width: columnWidths.joiningDate }} className="relative py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Joined Date
                  <div
                    onMouseDown={(e) => handleResizeStart('joiningDate', e)}
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-500/50 bg-transparent active:bg-indigo-600 z-10"
                  />
                </th>
                <th style={{ width: columnWidths.actions }} className="relative py-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin glow-indigo mx-auto mb-3" />
                    <p className="text-xs text-slate-400">Loading Student Profiles...</p>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="text-xs">No students matching parameters found.</p>
                  </td>
                </tr>
              ) : (
                students.map((student) => {
                  const faceSampleCount = student.face_count?.[0]?.count ?? 0;
                  const isEnrolled = faceSampleCount > 0;

                  return (
                    <tr key={student.id} className="hover:bg-white/[0.01] transition-colors">
                      <td className="py-4 px-6 font-mono text-xs text-indigo-300 font-bold">
                        {student.student_custom_id}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-indigo-400 font-bold text-xs border border-white/5">
                            {student.user.first_name[0]}{student.user.last_name[0]}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-200">
                              {student.user.first_name} {student.user.last_name}
                            </h4>
                            <p className="text-[10px] text-slate-500 mt-0.5">{student.user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {student.batch ? (
                          <div>
                            <span className="text-xs font-semibold text-slate-200 block">
                              {student.batch.name}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {student.batch.start_time} - {student.batch.end_time} {student.batch.class ? `(${student.batch.class.name})` : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-semibold italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {isEnrolled ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" /> Enrolled ({faceSampleCount})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-red-500/10 border border-red-500/25 text-red-400">
                            <AlertCircle className="w-3 h-3" /> Missing Sample
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-400 font-medium">
                        {student.joining_date ? new Date(student.joining_date).toLocaleDateString([], { dateStyle: 'medium' }) : '-'}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          {student.batch && (
                            <button
                              onClick={() => {
                                setRemovingStudent(student);
                                setRemovalRemark('');
                              }}
                              className="h-8 px-2.5 rounded-lg text-[10px] font-bold border border-red-500/20 bg-red-500/5 hover:bg-red-500/15 text-red-400 cursor-pointer flex items-center gap-1"
                            >
                              Remove
                            </button>
                          )}
                          <Link
                            href={`/admin/enroll-face?studentId=${student.id}`}
                            className={`h-8 px-2.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 cursor-pointer transition-all duration-200 
                            ${isEnrolled 
                              ? 'border border-white/10 hover:bg-white/5 text-slate-300' 
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white glow-indigo'}`}
                          >
                            <Camera className="w-3.5 h-3.5" />
                            {isEnrolled ? 'Re-enroll' : 'Enroll'}
                          </Link>
                        </div>
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

      {/* ── Modal: Remove Student from Batch ── */}
      {removingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md glass-panel p-6 rounded-3xl space-y-5 relative">
            <button
              onClick={() => setRemovingStudent(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <div className="flex items-center gap-2 text-red-400 text-[10px] font-bold tracking-widest uppercase mb-1">
                <AlertCircle className="w-3.5 h-3.5" /> De-enrollment Pipeline
              </div>
              <h3 className="text-lg font-bold text-white">Remove Student from Batch</h3>
              <p className="text-xs text-slate-400">
                Are you sure you want to remove <strong>{removingStudent.user.first_name} {removingStudent.user.last_name}</strong> from <strong>{removingStudent.batch?.name}</strong>?
              </p>
            </div>

            <form onSubmit={handleRemoveSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1.5 uppercase tracking-wide">
                  Optional Removal Remark / Reason
                </label>
                <textarea
                  value={removalRemark}
                  onChange={(e) => setRemovalRemark(e.target.value)}
                  placeholder="e.g. Schedule conflict, requested transfer..."
                  rows={3}
                  className="w-full p-3 rounded-xl glass-input text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setRemovingStudent(null)}
                  className="btn-secondary h-10 px-4 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={removalLoading}
                  className="h-10 px-5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer bg-red-600 hover:bg-red-500 text-white shadow-lg"
                >
                  {removalLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Removal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Add Student Profile ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-2xl glass-panel p-6 rounded-3xl space-y-6 max-h-[90vh] overflow-y-auto no-scrollbar relative my-8">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <div className="flex items-center gap-2 text-indigo-400 text-[10px] font-bold tracking-widest uppercase mb-1">
                <Sparkles className="w-3.5 h-3.5" /> Registration Pipeline
              </div>
              <h3 className="text-lg font-bold text-white">Create Student Profile</h3>
              <p className="text-xs text-slate-400">Add credentials and details to provision student account access.</p>
            </div>

            {formError && (
              <div className="p-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs font-semibold flex items-center gap-2 animate-pulse">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleAddStudent} className="space-y-6">
              {/* Account Credentials */}
              <div className="space-y-3.5">
                <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> Portal Account Credentials
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1.5">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="arjun@email.com"
                        className="w-full pl-10 pr-4 h-10 rounded-xl glass-input text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1.5">Access Password (min 8 chars)</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-4 h-10 rounded-xl glass-input text-xs"
                      />
                    </div>
                    <span className="text-[9px] text-slate-500 mt-1 block">Optional. Defaults to Phone Number if left blank.</span>
                  </div>
                </div>
              </div>

              {/* Personal Details */}
              <div className="space-y-3.5">
                <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Personal Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1.5">First Name</label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Arjun"
                      className="w-full px-3.5 h-10 rounded-xl glass-input text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1.5">Last Name</label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Sharma"
                      className="w-full px-3.5 h-10 rounded-xl glass-input text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1.5">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="9876543210"
                        className="w-full pl-10 pr-4 h-10 rounded-xl glass-input text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1.5">Date of Birth</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                      <input
                        type="date"
                        required
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                        className="w-full pl-10 pr-4 h-10 rounded-xl glass-input text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Academy Meta */}
              <div className="space-y-3.5">
                <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Academic Records
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1.5">Custom ID / Roll Number (Optional)</label>
                    <input
                      type="text"
                      value={studentCustomId}
                      onChange={(e) => setStudentCustomId(e.target.value)}
                      placeholder="Leave blank to auto-generate"
                      className="w-full px-3.5 h-10 rounded-xl glass-input text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1.5">Assigned Batch Schedule</label>
                    <CustomSelect
                      value={batchId}
                      onChange={setBatchId}
                      options={formBatchOptions}
                      placeholder="Select Batch"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1.5">Joining Date</label>
                    <input
                      type="date"
                      value={joiningDate}
                      onChange={(e) => setJoiningDate(e.target.value)}
                      className="w-full px-3.5 h-10 rounded-xl glass-input text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1.5">Emergency Contact Mobile</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                      <input
                        type="tel"
                        value={emergencyContact}
                        onChange={(e) => setEmergencyContact(e.target.value)}
                        placeholder="9876543211"
                        className="w-full pl-10 pr-4 h-10 rounded-xl glass-input text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1.5">Home Address</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Block A, Sector 15, New Delhi"
                        className="w-full pl-10 pr-4 h-10 rounded-xl glass-input text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Form buttons */}
              <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
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
                  Register Student Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
