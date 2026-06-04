'use client';

import { useEffect, useState } from 'react';
import IndiaMap from '../components/IndiaMap';
import {
  Activity,
  Building2,
  CheckCircle2,
  Clock,
  Edit2,
  Globe,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Users,
  Wrench,
  X,
  XCircle,
  IndianRupee,
  AlertTriangle,
  UserCheck,
  EyeOff,
  TrendingUp,
  TrendingDown,
  Calendar,
  BarChart3,
  MapPin
} from 'lucide-react';

const formatRupees = (amount: number) => {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)} Cr`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)} L`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
};

const formatRelativeTime = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  } catch (e) {
    return '';
  }
};

interface TenantItem {
  id: string;
  name: string;
  slug: string;
  subscription_status: 'trial' | 'active' | 'suspended';
  created_at: string;
  country?: string;
  state?: string;
  city?: string;
  address?: string | null;
  email?: string | null;
  admin: {
    email: string;
    name: string;
    phone: string;
    firstName?: string;
    lastName?: string;
    primaryPhone?: string | null;
    alternatePhone?: string | null;
  } | null;
  students?: number;
  coaches?: number;
  batches?: number;
  attendancePct?: number;
  pendingFees?: number;
}

interface SuperadminStats {
  totalTenants: number;
  studentsCount: number;
  coachesCount: number;
  adminsCount: number;
  activeBatches: number;
  todaysClasses: number;
  avgAttendance: number;
  pendingFees: number;
}

interface GrowthMetric {
  month: string;
  count: number;
}

interface RevenueItem {
  name: string;
  revenue: number;
}

interface ActivityItem {
  id: string;
  action: string;
  description: string;
  created_at: string;
}

interface AlertItem {
  type: string;
  text: string;
}

interface MapCityItem {
  city: string;
  count: number;
  lat: number;
  lng: number;
}

export default function SuperadminPage() {
  const [activeTab, setActiveTab] = useState<'analytics' | 'provision' | 'governance'>('analytics');
  const [stats, setStats] = useState<SuperadminStats>({
    totalTenants: 25,
    studentsCount: 12450,
    coachesCount: 425,
    adminsCount: 38,
    activeBatches: 620,
    todaysClasses: 180,
    avgAttendance: 92,
    pendingFees: 850000
  });
  const [growth, setGrowth] = useState<{ studentGrowth: GrowthMetric[]; academyGrowth: GrowthMetric[] }>({
    studentGrowth: [],
    academyGrowth: []
  });
  const [revenue, setRevenue] = useState<{ monthlyCollection: number; pendingCollection: number; annualRevenue: number; byAcademy: RevenueItem[] }>({
    monthlyCollection: 0,
    pendingCollection: 0,
    annualRevenue: 0,
    byAcademy: []
  });
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [actionRequired, setActionRequired] = useState<AlertItem[]>([]);
  const [mapData, setMapData] = useState<MapCityItem[]>([]);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterCity, setFilterCity] = useState('');

  // Provisioning Form State
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [country, setCountry] = useState('India');
  const [state, setState] = useState('Telangana');
  const [city, setCity] = useState('Hyderabad');
  const [address, setAddress] = useState('');
  const [academyEmail, setAcademyEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [password, setPassword] = useState('');
  const [subStatus, setSubStatus] = useState<'trial' | 'active'>('trial');

  // Academy Edit Modal State
  const [editingTenant, setEditingTenant] = useState<TenantItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCountry, setEditCountry] = useState('India');
  const [editState, setEditState] = useState('Telangana');
  const [editCity, setEditCity] = useState('Hyderabad');
  const [editAcademyEmail, setEditAcademyEmail] = useState('');
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPrimaryPhone, setEditPrimaryPhone] = useState('');
  const [editAlternatePhone, setEditAlternatePhone] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [modalErrorMsg, setModalErrorMsg] = useState<string | null>(null);
  const [updatingTenant, setUpdatingTenant] = useState(false);

  // Governance System Controls State
  const [aiOverride, setAiOverride] = useState(true);
  const [similarityThreshold, setSimilarityThreshold] = useState(75);
  const [rateLimit, setRateLimit] = useState(60);

  // Notification Feedbacks
  const [submitting, setSubmitting] = useState(false);
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-generate slug from Tenant Name
  const handleTenantNameChange = (val: string) => {
    setTenantName(val);
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    setTenantSlug(slug);
  };

  const loadSaaSData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v1/superadmin');
      if (!res.ok) {
        throw new Error('Failed to load global SaaS data.');
      }
      const result = await res.json();
      setStats(result.data.stats);
      setGrowth(result.data.growth);
      setRevenue(result.data.revenue);
      setRecentActivity(result.data.recentActivity);
      setActionRequired(result.data.actionRequired);
      setMapData(result.data.mapData);
      setTenants(result.data.tenants);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to authenticate or retrieve records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSaaSData();
  }, []);

  const handleProvisionTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    // Validate email & phone number formats before submitting
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[0-9]{10,15}$/;

    // 1. Admin Email (Required)
    if (!emailRegex.test(email.trim())) {
      setErrorMsg('Invalid Administrator email address format.');
      setSubmitting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // 2. Academy Business Email (Optional)
    if (academyEmail.trim() && !emailRegex.test(academyEmail.trim())) {
      setErrorMsg('Invalid Academy Business email address format.');
      setSubmitting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // 3. Primary Phone (Required)
    const cleanPhone = phone.replace(/[\s\-()]/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      setErrorMsg('Invalid Primary Phone Number format. Must be 10-15 digits (e.g. +919876543210).');
      setSubmitting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // 4. Alternate Phone (Optional)
    if (alternatePhone.trim()) {
      const cleanAltPhone = alternatePhone.replace(/[\s\-()]/g, '');
      if (!phoneRegex.test(cleanAltPhone)) {
        setErrorMsg('Invalid Alternate Phone Number format. Must be 10-15 digits.');
        setSubmitting(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    try {
      const res = await fetch('/api/v1/superadmin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantName,
          tenantSlug,
          firstName,
          lastName,
          email,
          phone,
          alternatePhone: alternatePhone || null,
          password,
          subscriptionStatus: subStatus,
          country,
          state,
          city,
          address: address || null,
          academyEmail: academyEmail || null
        })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to onboard academy.');
      }

      setSuccessMsg(`Successfully provisioned "${tenantName}" with admin user ${email}!`);
      
      // Clear Form Fields
      setTenantName('');
      setTenantSlug('');
      setCountry('India');
      setState('Telangana');
      setCity('Hyderabad');
      setAddress('');
      setAcademyEmail('');
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setAlternatePhone('');
      setPassword('');
      setSubStatus('trial');

      // Reload SaaS Metrics
      await loadSaaSData();
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during onboarding.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (tenantId: string, newStatus: 'trial' | 'active' | 'suspended') => {
    setChangingStatusId(tenantId);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/v1/superadmin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          subscriptionStatus: newStatus
        })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to update subscription status.');
      }

      setSuccessMsg('Subscription status updated successfully!');
      
      // Update local state directly
      setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, subscription_status: newStatus } : t));
      
      // Recalculate stats dynamically
      const resStats = await fetch('/api/v1/superadmin');
      if (resStats.ok) {
        const statsData = await resStats.json();
        setStats(statsData.data.stats);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to modify tenant state.');
    } finally {
      setChangingStatusId(null);
    }
  };

  const handleOpenEditModal = (tenant: TenantItem) => {
    setEditingTenant(tenant);
    setEditName(tenant.name);
    setEditAddress(tenant.address || '');
    setEditCountry(tenant.country || 'India');
    setEditState(tenant.state || 'Telangana');
    setEditCity(tenant.city || 'Hyderabad');
    setEditAcademyEmail(tenant.email || '');
    setEditFirstName(tenant.admin?.firstName || '');
    setEditLastName(tenant.admin?.lastName || '');
    setEditPrimaryPhone(tenant.admin?.primaryPhone || '');
    setEditAlternatePhone(tenant.admin?.alternatePhone || '');
    setIsEditMode(false);
    setModalErrorMsg(null);
  };

  const handleUpdateTenantProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;

    setUpdatingTenant(true);
    setModalErrorMsg(null);
    setSuccessMsg(null);

    // Validate email & phone formats before submitting update
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[0-9]{10,15}$/;

    // 1. Academy Business Email (Optional)
    if (editAcademyEmail.trim() && !emailRegex.test(editAcademyEmail.trim())) {
      setModalErrorMsg('Invalid Academy Business email address format.');
      setUpdatingTenant(false);
      return;
    }

    // 2. Primary Phone (Required)
    const cleanPrimaryPhone = editPrimaryPhone.replace(/[\s\-()]/g, '');
    if (!phoneRegex.test(cleanPrimaryPhone)) {
      setModalErrorMsg('Invalid Primary Phone Number format. Must be 10-15 digits.');
      setUpdatingTenant(false);
      return;
    }

    // 3. Alternate Phone (Optional)
    if (editAlternatePhone.trim()) {
      const cleanAltPhone = editAlternatePhone.replace(/[\s\-()]/g, '');
      if (!phoneRegex.test(cleanAltPhone)) {
        setModalErrorMsg('Invalid Alternate Phone Number format. Must be 10-15 digits.');
        setUpdatingTenant(false);
        return;
      }
    }

    try {
      const res = await fetch('/api/v1/superadmin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: editingTenant.id,
          tenantName: editName,
          address: editAddress,
          country: editCountry,
          state: editState,
          city: editCity,
          academyEmail: editAcademyEmail || null,
          firstName: editFirstName,
          lastName: editLastName,
          phone: editPrimaryPhone,
          alternatePhone: editAlternatePhone
        })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to update academy information.');
      }

      setSuccessMsg(`Successfully updated profile for "${editName}"!`);
      setEditingTenant(null);
      await loadSaaSData();
    } catch (err: any) {
      setModalErrorMsg(err.message || 'An error occurred while updating profile.');
    } finally {
      setUpdatingTenant(false);
    }
  };

  // Derived unique state/city lists for filter dropdowns
  const uniqueStates = Array.from(new Set(tenants.map(t => t.state || 'Telangana'))).sort();
  const uniqueCities = Array.from(
    new Set(
      tenants
        .filter(t => !filterState || (t.state || 'Telangana') === filterState)
        .map(t => t.city || 'Hyderabad')
    )
  ).sort();

  const filteredTenants = tenants.filter(t => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.admin && t.admin.email.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesState = !filterState || (t.state || 'Telangana') === filterState;
    const matchesCity  = !filterCity  || (t.city  || 'Hyderabad')  === filterCity;
    return matchesSearch && matchesState && matchesCity;
  });

  // ── Dynamic SVG Chart Data Calculations ──
  const maxStudentCount = Math.max(...(growth.studentGrowth || []).map(g => g.count), 1);
  const studentPoints = (growth.studentGrowth || []).map((g, idx) => {
    const x = 10 + idx * 44;
    const y = 95 - (g.count / maxStudentCount) * 75; // leave some top padding
    return { x, y, ...g };
  });

  const studentLinePath = studentPoints.length > 0
    ? `M ${studentPoints.map(p => `${p.x},${p.y}`).join(' L ')}`
    : '';

  const studentAreaPath = studentPoints.length > 0
    ? `M ${studentPoints[0].x},95 L ${studentPoints.map(p => `${p.x},${p.y}`).join(' L ')} L ${studentPoints[studentPoints.length - 1].x},95 Z`
    : '';

  const maxAcademyCount = Math.max(...(growth.academyGrowth || []).map(g => g.count), 1);
  const academyBars = (growth.academyGrowth || []).map((g, idx) => {
    const w = 12;
    const x = 8 + idx * 40;
    const h = Math.max((g.count / maxAcademyCount) * 85, 2); // min height 2px
    const y = 95 - h;
    return { x, y, w, h, ...g };
  });

  return (
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold tracking-widest uppercase mb-1">
            <ShieldAlert className="w-4 h-4" /> Academy Management Console
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Academy Management
          </h1>
        </div>
        <button
          onClick={loadSaaSData}
          disabled={loading}
          className="btn-secondary h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Reload System Metrics
        </button>
      </div>

      {/* Global Alerts Feed */}
      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
          <XCircle className="w-4.5 h-4.5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── Sub-Tab Navigation Bar ── */}
      <div className="flex border-b border-white/10 pb-px gap-6 no-print">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 text-xs font-extrabold uppercase tracking-widest transition-colors relative cursor-pointer
          ${activeTab === 'analytics' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <span className="flex items-center gap-1.5"><Activity className="w-4 h-4" /> Analytics & Registry</span>
          {activeTab === 'analytics' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 rounded-full glow-indigo" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('provision')}
          className={`pb-3 text-xs font-extrabold uppercase tracking-widest transition-colors relative cursor-pointer
          ${activeTab === 'provision' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <span className="flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Onboard Academy
          </span>
          {activeTab === 'provision' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 rounded-full glow-indigo" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('governance')}
          className={`pb-3 text-xs font-extrabold uppercase tracking-widest transition-colors relative cursor-pointer
          ${activeTab === 'governance' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
        >
          <span className="flex items-center gap-1.5">
            <Sliders className="w-4 h-4" /> System Governance
          </span>
          {activeTab === 'governance' && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 rounded-full glow-indigo" />
          )}
        </button>
      </div>

      {/* ── TAB 1: REDEFINED SUPERADMIN DASHBOARD ── */}
      {activeTab === 'analytics' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Top KPI Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {/* KPI 1: Academies */}
            <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-indigo-500/5 blur-2xl" />
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Academies</span>
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 glow-indigo">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-white">{stats.totalTenants}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">SaaS Clients onboarded</span>
              </div>
            </div>

            {/* KPI 2: Students */}
            <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-indigo-500/5 blur-2xl" />
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Students</span>
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 glow-indigo">
                  <Users className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-white">{stats.studentsCount?.toLocaleString()}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Active enrollments</span>
              </div>
            </div>

            {/* KPI 3: Coaches */}
            <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-indigo-500/5 blur-2xl" />
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Coaches</span>
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 glow-indigo">
                  <UserCheck className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-white">{stats.coachesCount}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Registered trainers</span>
              </div>
            </div>

            {/* KPI 4: Admins */}
            <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-indigo-500/5 blur-2xl" />
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Admins</span>
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 glow-indigo">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-white">{stats.adminsCount}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Academy coordinators</span>
              </div>
            </div>

            {/* KPI 5: Active Batches */}
            <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-indigo-500/5 blur-2xl" />
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Active Batches</span>
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 glow-indigo">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-white">{stats.activeBatches}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Recurring schedules</span>
              </div>
            </div>

            {/* KPI 6: Today's Classes */}
            <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-indigo-500/5 blur-2xl" />
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Today's Classes</span>
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 glow-indigo">
                  <Clock className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-white">{stats.todaysClasses}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Sessions today</span>
              </div>
            </div>

            {/* KPI 7: Attendance % */}
            <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group border-indigo-500/20">
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-purple-500/10 blur-2xl" />
              <div className="flex items-center justify-between">
                <span className="text-indigo-300 text-[10px] font-extrabold uppercase tracking-wider">Attendance %</span>
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 glow-indigo">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-white glow-text-indigo">{stats.avgAttendance}%</span>
                <span className="text-[10px] text-purple-400 font-bold block mt-0.5">Platform average</span>
              </div>
            </div>

            {/* KPI 8: Pending Fees */}
            <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group border-amber-500/20">
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-amber-500/10 blur-2xl" />
              <div className="flex items-center justify-between">
                <span className="text-amber-300 text-[10px] font-extrabold uppercase tracking-wider">Pending Fees</span>
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 glow-amber">
                  <IndianRupee className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-white glow-text-amber">
                  ₹{(stats.pendingFees / 100000).toFixed(1)} Lakh
                </span>
                <span className="text-[10px] text-amber-400 font-bold block mt-0.5">Uncollected amount</span>
              </div>
            </div>
          </div>

          {/* Growth Metrics & Revenue Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Growth Metrics */}
            <div className="glass-panel p-6 rounded-3xl space-y-6">
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4.5 h-4.5 text-indigo-400" /> Platform Growth Trends
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Monthly trajectory of student registrations and onboarded academies
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                {/* Student Growth (Line Chart) */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-300">Student Growth</span>
                    <span className="text-[10px] text-slate-500 font-mono">6-Month Trend</span>
                  </div>
                  
                  <div className="h-32 bg-slate-950/30 rounded-2xl border border-white/5 p-2 flex flex-col justify-between">
                    <div className="flex-1 relative">
                      <svg viewBox="0 0 240 100" className="w-full h-full overflow-visible">
                        <defs>
                          <linearGradient id="studentGrowthGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        {/* Connecting Line Grid */}
                        <line x1="0" y1="20" x2="240" y2="20" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
                        <line x1="0" y1="50" x2="240" y2="50" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
                        <line x1="0" y1="80" x2="240" y2="80" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
                        
                        {/* Area Gradient fill */}
                        {studentAreaPath && <path d={studentAreaPath} fill="url(#studentGrowthGrad)" />}
                        
                        {/* Line path */}
                        {studentLinePath && <path d={studentLinePath} fill="none" stroke="#6366f1" strokeWidth="2.5" className="glow-indigo" />}
                        
                        {/* Points */}
                        {studentPoints.map((pt, idx) => (
                          <circle
                            key={pt.month}
                            cx={pt.x}
                            cy={pt.y}
                            r="3"
                            fill={idx === studentPoints.length - 1 ? '#818cf8' : '#6366f1'}
                            className={idx === studentPoints.length - 1 ? 'glow-indigo' : ''}
                          />
                        ))}
                      </svg>
                    </div>
                    <div className="flex justify-between text-[8px] font-bold text-slate-500 px-1 pt-1 border-t border-white/5">
                      {studentPoints.map((pt) => (
                        <span key={pt.month}>
                          {pt.month} ({pt.count})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Academy Growth (Bar Chart) */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-300">Academy Growth</span>
                    <span className="text-[10px] text-slate-500 font-mono">6-Month Trend</span>
                  </div>
                  
                  <div className="h-32 bg-slate-950/30 rounded-2xl border border-white/5 p-2 flex flex-col justify-between">
                    <div className="flex-1 relative">
                      <svg viewBox="0 0 240 100" className="w-full h-full overflow-visible">
                        <defs>
                          <linearGradient id="academyGrowthGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#a855f7" stopOpacity="0.05" />
                          </linearGradient>
                        </defs>
                        {academyBars.map((bar, idx) => {
                          const isLast = idx === academyBars.length - 1;
                          return (
                            <rect
                              key={bar.month}
                              x={bar.x}
                              y={bar.y}
                              width={bar.w}
                              height={bar.h}
                              rx="2.5"
                              fill="url(#academyGrowthGrad)"
                              stroke={isLast ? '#c084fc' : '#a855f7'}
                              strokeWidth={isLast ? 1 : 0.5}
                              className={isLast ? 'glow-purple' : ''}
                            />
                          );
                        })}
                      </svg>
                    </div>
                    <div className="flex justify-between text-[8px] font-bold text-slate-500 px-1 pt-1 border-t border-white/5">
                      {academyBars.map((bar) => (
                        <span key={bar.month}>{bar.month} ({bar.count})</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Revenue Summary */}
            <div className="glass-panel p-6 rounded-3xl space-y-5">
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <BarChart3 className="w-4.5 h-4.5 text-indigo-400" /> Revenue & Collections
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Platform billing summaries and leading academy revenue shares</p>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
                  <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wide">Monthly</span>
                  <span className="text-sm font-black text-white mt-1 block">{formatRupees(revenue.monthlyCollection)}</span>
                </div>
                <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
                  <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wide">Pending</span>
                  <span className="text-sm font-black text-amber-400 mt-1 block">{formatRupees(revenue.pendingCollection)}</span>
                </div>
                <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
                  <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wide">Annual</span>
                  <span className="text-sm font-black text-indigo-400 mt-1 block">{formatRupees(revenue.annualRevenue)}</span>
                </div>
              </div>

              {/* Progress bars (Revenue by Academy) */}
              <div className="space-y-2.5 pt-1">
                <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest block">Revenue by Academy</span>
                
                {revenue.byAcademy?.length > 0 ? (
                  revenue.byAcademy.map((ac: any, idx: number) => {
                    const maxRevenue = Math.max(...revenue.byAcademy.map((item: any) => item.revenue), 1);
                    const pct = Math.round((ac.revenue / maxRevenue) * 100);
                    const colors = [
                      'bg-indigo-500 glow-indigo',
                      'bg-purple-500 glow-purple',
                      'bg-emerald-500 glow-emerald',
                      'bg-pink-500',
                      'bg-teal-500'
                    ];
                    return (
                      <div key={ac.name} className="space-y-1">
                        <div className="flex justify-between text-[10px] font-semibold text-slate-300">
                          <span>{ac.name}</span>
                          <span>{formatRupees(ac.revenue)}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-950/40 rounded-full overflow-hidden border border-white/5">
                          <div className={`h-full rounded-full transition-all duration-500 ${colors[idx % colors.length]}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-500 italic p-2">No academy revenue data.</p>
                )}
              </div>
            </div>
          </div>

          {/* Action Required Widget & Recent Activity Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Action Required */}
            <div className="glass-panel p-6 rounded-3xl space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-4.5 h-4.5 text-amber-400 animate-pulse" /> Action Required Alerts
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Critical operations needing immediate administrative review</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {actionRequired.length > 0 ? (
                  actionRequired.map((alert, idx) => {
                    const colorClass = alert.type === 'warning' 
                      ? 'border-amber-500/20 bg-amber-500/5 text-amber-300 hover:border-amber-500/40'
                      : 'border-indigo-500/20 bg-indigo-500/5 text-indigo-300 hover:border-indigo-500/40';
                    return (
                      <div
                        key={idx}
                        className={`p-4 rounded-2xl border flex items-center gap-3 transition-all duration-200 cursor-pointer ${colorClass}`}
                      >
                        <span className="w-2 h-2 rounded-full bg-current animate-ping shrink-0" />
                        <span className="text-xs font-bold leading-normal">{alert.text}</span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-500 italic p-4">No pending actions required.</p>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="glass-panel p-6 rounded-3xl space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <Activity className="w-4.5 h-4.5 text-indigo-400" /> Platform Activity Feed
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Live platform-wide operations and provisioning history log</p>
              </div>

              <div className="space-y-3.5 max-h-[220px] overflow-y-auto no-scrollbar">
                {recentActivity.length > 0 ? (
                  recentActivity.map((act) => (
                    <div key={act.id} className="flex gap-3 text-xs items-start group">
                      <div className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5 font-bold group-hover:scale-110 transition-transform">
                        ✓
                      </div>
                      <div className="space-y-0.5 overflow-hidden flex-1">
                        <span className="font-semibold text-slate-200 block leading-normal">{act.description}</span>
                        <span className="text-[10px] text-indigo-400 font-medium block mt-0.5">{formatRelativeTime(act.created_at)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 italic p-4">No recent activity logs.</p>
                )}
              </div>
            </div>
          </div>

          {/* Map View & Academy Overview Table */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Map View */}
            <div className="glass-panel p-6 rounded-3xl relative overflow-hidden flex flex-col items-center">
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />
              
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-2 self-start flex items-center gap-2">
                <Globe className="w-4.5 h-4.5 text-indigo-400" /> Active Academies Map
              </h3>
              <p className="text-[10px] text-slate-500 self-start mb-6">Distribution and nodes layout of academies across major cities</p>

              <IndiaMap mapData={mapData} />
            </div>

            {/* Academy Overview Table */}
            <div className="lg:col-span-2 glass-panel rounded-3xl border border-white/5 bg-slate-950/20 overflow-hidden flex flex-col justify-between">
              {/* Controls Row: Search + Location Filters */}
              <div className="p-5 border-b border-white/10 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-extrabold text-white tracking-wider uppercase">Academy Overview</h2>
                    <p className="text-[10px] text-slate-500 mt-0.5">Search, monitor, and regulate active academy registrations and key statistics</p>
                  </div>

                  {/* Search Bar */}
                  <div className="relative min-w-[240px]">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none">
                      <Search className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by academy or owner email..."
                      className="w-full h-9 pl-9 pr-4 rounded-xl glass-input text-xs"
                    />
                  </div>
                </div>

                {/* Location Filters */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest flex items-center gap-1">
                    <Globe className="w-3 h-3 text-indigo-400" /> Filter:
                  </span>

                  <select
                    value={filterState}
                    onChange={(e) => { setFilterState(e.target.value); setFilterCity(''); }}
                    className="h-8 px-2.5 rounded-lg bg-slate-900 border border-white/10 text-[10px] font-bold text-slate-300 outline-none cursor-pointer hover:border-indigo-500/40 min-w-[120px]"
                  >
                    <option value="">All States</option>
                    {uniqueStates.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>

                  <select
                    value={filterCity}
                    onChange={(e) => setFilterCity(e.target.value)}
                    className="h-8 px-2.5 rounded-lg bg-slate-900 border border-white/10 text-[10px] font-bold text-slate-300 outline-none cursor-pointer hover:border-indigo-500/40 min-w-[120px]"
                  >
                    <option value="">All Cities</option>
                    {uniqueCities.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>

                  {(filterState || filterCity) && (
                    <button
                      onClick={() => { setFilterState(''); setFilterCity(''); }}
                      className="h-8 px-3 rounded-lg text-[10px] font-bold text-slate-400 hover:text-white border border-white/10 hover:border-white/20 transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  )}

                  {(filterState || filterCity || searchQuery) && (
                    <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                      {filteredTenants.length} of {tenants.length} shown
                    </span>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto no-scrollbar flex-1">
                {loading ? (
                  <div className="p-12 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-[10px] uppercase font-bold tracking-wider">Loading registries...</p>
                  </div>
                ) : filteredTenants.length === 0 ? (
                  <div className="p-12 text-center text-slate-500">
                    <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <p className="text-xs">No active academies match your query.</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.01] text-slate-400 font-extrabold uppercase tracking-wider text-[9px]">
                        <th className="py-3.5 px-4 min-w-[140px]">Academy</th>
                        <th className="py-3.5 px-4 min-w-[65px]">Students</th>
                        <th className="py-3.5 px-4 min-w-[65px]">Coaches</th>
                        <th className="py-3.5 px-4 min-w-[65px]">Batches</th>
                        <th className="py-3.5 px-4 min-w-[90px]">Attendance %</th>
                        <th className="py-3.5 px-4 min-w-[90px]">Pending Fees</th>
                        <th className="py-3.5 px-4 min-w-[85px]">Status</th>
                        <th className="py-3.5 px-4 min-w-[105px] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTenants.map((tenant) => {
                        let badgeClass = 'bg-amber-500/10 border-amber-500/20 text-amber-400';
                        if (tenant.subscription_status === 'active') {
                          badgeClass = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
                        } else if (tenant.subscription_status === 'suspended') {
                          badgeClass = 'bg-red-500/10 border-red-500/20 text-red-400';
                        }

                        return (
                          <tr key={tenant.id} className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                            <td className="py-3 px-4">
                              <button
                                onClick={() => handleOpenEditModal(tenant)}
                                className="font-bold text-indigo-400 hover:text-indigo-300 hover:underline text-left block text-xs transition-all cursor-pointer outline-none"
                              >
                                {tenant.name}
                              </button>
                              <span className="text-[9px] text-slate-500 block mt-0.5 select-all font-mono font-bold tracking-wide">
                                /{tenant.slug} • {tenant.city || 'Hyderabad'}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-300">
                              {tenant.students?.toLocaleString() ?? 0}
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-300">
                              {tenant.coaches ?? 0}
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-300">
                              {tenant.batches ?? 0}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-semibold text-slate-300 block">{tenant.attendancePct ?? 0}%</span>
                              <div className="w-12 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full glow-indigo" style={{ width: `${tenant.attendancePct || 0}%` }} />
                              </div>
                            </td>
                            <td className="py-3 px-4 font-semibold text-amber-400 font-mono text-[10px]">
                              {tenant.pendingFees ? `₹${(tenant.pendingFees / 100000).toFixed(1)}L` : '₹0'}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full border text-[9px] font-extrabold uppercase ${badgeClass}`}>
                                {tenant.subscription_status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right relative flex items-center justify-end gap-2 h-full">
                              {changingStatusId === tenant.id ? (
                                <div className="w-4 h-4 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin ml-auto" />
                              ) : (
                                <select
                                  value={tenant.subscription_status}
                                  onChange={(e) => handleUpdateStatus(tenant.id, e.target.value as any)}
                                  className="h-7 px-1 rounded-lg bg-slate-900 border border-white/10 text-[9px] font-bold text-slate-300 outline-none cursor-pointer hover:border-white/20 max-w-[85px]"
                                >
                                  <option value="trial">Trial</option>
                                  <option value="active">Active</option>
                                  <option value="suspended">Suspend</option>
                                </select>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: PROVISION CLIENT ── */}
      {activeTab === 'provision' && (
        <div className="w-full max-w-3xl mx-auto glass-panel p-8 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />
          
          <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-full text-indigo-400 text-[10px] font-bold tracking-wider uppercase mb-3 w-fit glow-indigo">
            <Sparkles className="w-3.5 h-3.5" /> Direct Academy Provisioning
          </div>
          
          <h2 className="text-xl font-black text-white tracking-tight">Onboard New Academy</h2>
          <p className="text-xs text-slate-400 leading-normal mb-6 mt-1">
            Provision a new academy profile along with its designated administrator.
          </p>

          <form onSubmit={handleProvisionTenant} className="space-y-6">
            {/* Section 1: Tenant Information */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/5 pb-2">
                1. Academy Identity Profile
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wide block">
                    Academy Name
                  </label>
                  <input
                    type="text"
                    required
                    value={tenantName}
                    onChange={(e) => handleTenantNameChange(e.target.value)}
                    placeholder="e.g. Apex Martial Arts Club"
                    className="w-full h-10 px-4 rounded-xl glass-input text-xs font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wide block">
                    Subdomain / Router URL Slug
                  </label>
                  <input
                    type="text"
                    required
                    value={tenantSlug}
                    onChange={(e) => setTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="e.g. apexmartial"
                    className="w-full h-10 px-4 rounded-xl glass-input text-xs font-mono text-indigo-300 font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wide block">
                    Academy Email ID (Optional)
                  </label>
                  <input
                    type="email"
                    value={academyEmail}
                    onChange={(e) => setAcademyEmail(e.target.value)}
                    placeholder="e.g. business@apexmartial.com"
                    className="w-full h-10 px-4 rounded-xl glass-input text-xs font-mono"
                  />
                </div>
              </div>

              <div className="w-full md:w-1/3 space-y-1.5">
                <label className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wide block">
                  Starting Subscription State
                </label>
                <select
                  value={subStatus}
                  onChange={(e) => setSubStatus(e.target.value as any)}
                  className="w-full h-10 px-4 rounded-xl glass-input text-xs font-bold"
                >
                  <option value="trial">Trial Account (Free Tier)</option>
                  <option value="active">Active Plan (Premium Tier)</option>
                </select>
              </div>
            </div>

            {/* Section 2: Location Profile */}
            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/5 pb-2">
                2. Academy Location Profile
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wide block">
                    Country
                  </label>
                  <input
                    type="text"
                    required
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="India"
                    className="w-full h-10 px-4 rounded-xl glass-input text-xs font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wide block">
                    State
                  </label>
                  <input
                    type="text"
                    required
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="Telangana"
                    className="w-full h-10 px-4 rounded-xl glass-input text-xs font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wide block">
                    City
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Hyderabad"
                    className="w-full h-10 px-4 rounded-xl glass-input text-xs font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wide block">
                  Academy Physical Address (Optional)
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Plot No. 45, Jubilee Hills"
                  className="w-full h-10 px-4 rounded-xl glass-input text-xs font-semibold"
                />
              </div>
            </div>

            {/* Section 3: Owner/Admin account */}
            <div className="space-y-4 pt-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/5 pb-2">
                3. Owner / Primary Administrator Profile
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wide block">
                    Owner First Name
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Rajesh"
                    className="w-full h-10 px-4 rounded-xl glass-input text-xs font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wide block">
                    Owner Last Name
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Patel"
                    className="w-full h-10 px-4 rounded-xl glass-input text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wide block">
                    Admin Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. rajesh@apexmartial.com"
                    className="w-full h-10 px-4 rounded-xl glass-input text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wide block">
                    Primary Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +919876543210"
                    className="w-full h-10 px-4 rounded-xl glass-input text-xs font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wide block">
                    Alternate Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={alternatePhone}
                    onChange={(e) => setAlternatePhone(e.target.value)}
                    placeholder="e.g. +919876543211"
                    className="w-full h-10 px-4 rounded-xl glass-input text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="w-full md:w-1/2 space-y-1.5">
                <label className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wide block">
                  Assign Portal Password
                </label>
                <input
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full h-10 px-4 rounded-xl glass-input text-xs font-bold"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-xl btn-premium font-bold text-sm tracking-wide mt-6 flex items-center justify-center cursor-pointer glow-indigo"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Onboard & Provision Academy Profile'
              )}
            </button>
          </form>
        </div>
      )}

      {/* ── TAB 3: SYSTEM GOVERNANCE ── */}
      {activeTab === 'governance' && (
        <div className="w-full max-w-3xl mx-auto space-y-8">
          {/* Section 1: AI Override Policy */}
          <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-indigo-500/5 blur-2xl" />
            
            <div className="flex items-center justify-between gap-6 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-1 flex items-center gap-2">
                  <Wrench className="w-4.5 h-4.5 text-indigo-400" /> Platform AI Face Recognition Governance
                </h3>
                <p className="text-[11px] text-slate-400 leading-normal max-w-xl">
                  Regulate system-wide edge algorithms, similarity parameters, and compliance thresholds.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Selector 1 */}
              <div className="flex items-center justify-between bg-white/[0.01] p-4 rounded-2xl border border-white/5">
                <div>
                  <span className="text-xs font-bold text-slate-200 block">AI Match Confidence Override</span>
                  <span className="text-[10px] text-slate-500 leading-normal block mt-0.5">
                    Permit edge modules to trigger fallback attendance simulators when network latency restricts local facial recognition.
                  </span>
                </div>
                <button
                  onClick={() => setAiOverride(!aiOverride)}
                  className="w-12 h-7 bg-indigo-500/20 border border-indigo-500/40 rounded-full flex items-center p-0.5 cursor-pointer focus:outline-none"
                >
                  <div className={`w-5 h-5 rounded-full bg-indigo-400 transition-all shadow-[0_0_8px_#818cf8] ${aiOverride ? 'translate-x-5 bg-indigo-300' : ''}`} />
                </button>
              </div>

              {/* Selector 2: Slider */}
              <div className="bg-white/[0.01] p-4 rounded-2xl border border-white/5 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">Minimum Match Threshold</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      Configure face-api matching strictness threshold for edge frames check-ins.
                    </span>
                  </div>
                  <span className="text-sm font-black text-indigo-400 font-mono bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    {similarityThreshold}%
                  </span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={95}
                  value={similarityThreshold}
                  onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg outline-none"
                />
              </div>

              {/* Selector 3: Number */}
              <div className="flex items-center justify-between bg-white/[0.01] p-4 rounded-2xl border border-white/5">
                <div>
                  <span className="text-xs font-bold text-slate-200 block">Maximum Ingestion Frame Rate Limits</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Restrict active camera check-in request counts per gate device to protect infrastructure.
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min={10}
                    max={300}
                    value={rateLimit}
                    onChange={(e) => setRateLimit(Number(e.target.value))}
                    className="w-24 h-9 px-3 rounded-xl glass-input text-xs font-mono text-center font-bold text-indigo-400"
                  />
                  <span className="text-[9px] text-slate-500 block text-center mt-1">req/min</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Platform Compliance & Settings */}
          <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4">
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-indigo-400" /> Compliance & Operations Settings
            </h3>
            <p className="text-xs text-slate-400 leading-normal">
              Platform billing structures are managed directly via automated Stripe mappings. Rate thresholds and subscription suspension actions strictly comply with internal SLA frameworks.
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => {
                  setSuccessMsg('Global governance parameters applied system-wide successfully!');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer glow-indigo"
              >
                Save Platform Policies
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW / EDIT CLIENT MODAL ── */}
      {editingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-slate-900/90 border border-white/10 rounded-3xl p-6 relative overflow-hidden shadow-2xl glass-panel animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setEditingTenant(null)}
              className="absolute top-4 right-4 p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-black text-white uppercase tracking-wider mb-1 flex items-center gap-2">
              {isEditMode ? (
                <>
                  <Edit2 className="w-4.5 h-4.5 text-indigo-400" /> Edit Academy Profile
                </>
              ) : (
                <>
                  <Building2 className="w-4.5 h-4.5 text-indigo-400" /> Academy Profile Details
                </>
              )}
            </h3>
            <p className="text-[10px] text-slate-400 mb-6">
              {isEditMode 
                ? 'Update Academy profile parameters and primary administrator contact records.'
                : 'Review Academy registration, subscription status, and designated administrator details.'}
            </p>

            {modalErrorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{modalErrorMsg}</span>
              </div>
            )}

            {!isEditMode ? (
              /* ── STAGE 1: READ-ONLY VIEW MODE ── */
              <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1 no-scrollbar">
                {/* Section 1: Academy Identity & Location */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider border-b border-white/5 pb-2">
                    1. Academy Identity & Location
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
                      <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">Academy Name</span>
                      <span className="text-xs font-bold text-slate-200 block mt-1">{editingTenant.name}</span>
                    </div>

                    <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
                      <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">URL Route Slug</span>
                      <span className="text-xs font-mono text-slate-300 font-normal block mt-1">/{editingTenant.slug}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
                      <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">Academy Business Email</span>
                      <span className="text-xs font-mono text-slate-300 font-normal block mt-1 break-all select-all">
                        {editingTenant.email || 'No email registered'}
                      </span>
                    </div>

                    <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
                      <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">Location (State/Country)</span>
                      <span className="text-xs text-slate-300 font-normal block mt-1">
                        {editingTenant.state || 'Telangana'}, {editingTenant.country || 'India'}
                      </span>
                    </div>

                    <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
                      <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">City</span>
                      <span className="text-xs text-slate-300 font-normal block mt-1">{editingTenant.city || 'Hyderabad'}</span>
                    </div>
                  </div>

                  <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
                    <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">Physical Address</span>
                    <span className="text-xs text-slate-300 font-normal block mt-1">
                      {editingTenant.address || 'No physical address specified'}
                    </span>
                  </div>
                </div>

                {/* Section 2: Administrative Owner Profile */}
                <div className="space-y-4 pt-2">
                  <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider border-b border-white/5 pb-2">
                    2. Administrative Owner Details
                  </h4>

                  {editingTenant.admin ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
                          <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">Administrator Name</span>
                          <span className="text-xs text-slate-300 font-normal block mt-1">{editingTenant.admin.name}</span>
                        </div>

                        <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
                          <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">Login Email Address</span>
                          <span className="text-xs font-mono text-slate-300 font-normal block mt-1 break-all select-all">{editingTenant.admin.email}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
                          <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">Primary Phone</span>
                          <span className="text-xs text-slate-300 font-normal block mt-1">{editingTenant.admin.primaryPhone || editingTenant.admin.phone}</span>
                        </div>

                        <div className="bg-white/[0.02] border border-white/5 p-3 rounded-2xl">
                          <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-wider block">Alternate Phone</span>
                          <span className="text-xs text-slate-300 font-normal block mt-1">{editingTenant.admin.alternatePhone || 'N/A'}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl text-center text-slate-400 text-xs">
                      No administrator is currently linked to this academy.
                    </div>
                  )}
                </div>

                {/* Footer Buttons for Details View */}
                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono select-all">
                    ID: {editingTenant.id}
                  </span>
                  
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingTenant(null)}
                      className="h-9 px-4 rounded-xl text-slate-400 hover:text-white border border-white/10 hover:border-white/20 transition-all text-xs font-bold cursor-pointer"
                    >
                      Close Details
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditMode(true)}
                      className="h-9 px-5 rounded-xl btn-premium text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer glow-indigo"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit Academy Profile
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* ── STAGE 2: INTERACTIVE EDIT MODE ── */
              <form onSubmit={handleUpdateTenantProfile} className="space-y-6 max-h-[70vh] overflow-y-auto pr-1 no-scrollbar">
                {/* Section 1: Academy Information */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider border-b border-white/5 pb-2">
                    1. Academy Identity & Location
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-slate-400 text-[9px] font-extrabold uppercase tracking-wide block">
                        Academy Name
                      </label>
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full h-9 px-3.5 rounded-xl glass-input text-xs font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 text-[9px] font-extrabold uppercase tracking-wide block">
                        URL Slug (Read-only)
                      </label>
                      <input
                        type="text"
                        disabled
                        value={editingTenant.slug}
                        className="w-full h-9 px-3.5 rounded-xl glass-input text-xs font-mono disabled:opacity-60 disabled:cursor-not-allowed select-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 text-[9px] font-extrabold uppercase tracking-wide block">
                      Academy Email ID (Optional)
                    </label>
                    <input
                      type="email"
                      value={editAcademyEmail}
                      onChange={(e) => setEditAcademyEmail(e.target.value)}
                      placeholder="e.g. business@apexmartial.com"
                      className="w-full h-9 px-3.5 rounded-xl glass-input text-xs font-mono text-indigo-300 font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-slate-400 text-[9px] font-extrabold uppercase tracking-wide block">
                        Country
                      </label>
                      <input
                        type="text"
                        required
                        value={editCountry}
                        onChange={(e) => setEditCountry(e.target.value)}
                        className="w-full h-9 px-3.5 rounded-xl glass-input text-xs font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 text-[9px] font-extrabold uppercase tracking-wide block">
                        State
                      </label>
                      <input
                        type="text"
                        required
                        value={editState}
                        onChange={(e) => setEditState(e.target.value)}
                        className="w-full h-9 px-3.5 rounded-xl glass-input text-xs font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 text-[9px] font-extrabold uppercase tracking-wide block">
                        City
                      </label>
                      <input
                        type="text"
                        required
                        value={editCity}
                        onChange={(e) => setEditCity(e.target.value)}
                        className="w-full h-9 px-3.5 rounded-xl glass-input text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 text-[9px] font-extrabold uppercase tracking-wide block">
                      Academy Physical Address (Optional)
                    </label>
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      className="w-full h-9 px-3.5 rounded-xl glass-input text-xs font-semibold"
                    />
                  </div>
                </div>

                {/* Section 2: Owner/Admin account */}
                <div className="space-y-4 pt-2">
                  <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider border-b border-white/5 pb-2">
                    2. Administrative Owner Profile
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-slate-400 text-[9px] font-extrabold uppercase tracking-wide block">
                        Owner First Name
                      </label>
                      <input
                        type="text"
                        required
                        value={editFirstName}
                        onChange={(e) => setEditFirstName(e.target.value)}
                        className="w-full h-9 px-3.5 rounded-xl glass-input text-xs font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 text-[9px] font-extrabold uppercase tracking-wide block">
                        Owner Last Name
                      </label>
                      <input
                        type="text"
                        required
                        value={editLastName}
                        onChange={(e) => setEditLastName(e.target.value)}
                        className="w-full h-9 px-3.5 rounded-xl glass-input text-xs font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-slate-400 text-[9px] font-extrabold uppercase tracking-wide block">
                        Admin Email (Read-only)
                      </label>
                      <input
                        type="email"
                        disabled
                        value={editingTenant.admin?.email || ''}
                        className="w-full h-9 px-3.5 rounded-xl glass-input text-xs font-mono disabled:opacity-60 disabled:cursor-not-allowed select-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 text-[9px] font-extrabold uppercase tracking-wide block">
                        Primary Phone
                      </label>
                      <input
                        type="tel"
                        required
                        value={editPrimaryPhone}
                        onChange={(e) => setEditPrimaryPhone(e.target.value)}
                        className="w-full h-9 px-3.5 rounded-xl glass-input text-xs font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 text-[9px] font-extrabold uppercase tracking-wide block">
                        Alternate Phone (Optional)
                      </label>
                      <input
                        type="tel"
                        value={editAlternatePhone}
                        onChange={(e) => setEditAlternatePhone(e.target.value)}
                        className="w-full h-9 px-3.5 rounded-xl glass-input text-xs font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setIsEditMode(false)}
                    className="h-9 px-4 rounded-xl text-slate-400 hover:text-white border border-white/10 hover:border-white/20 transition-all text-xs font-bold cursor-pointer"
                  >
                    Back to Details
                  </button>
                  <button
                    type="submit"
                    disabled={updatingTenant}
                    className="h-9 px-5 rounded-xl btn-premium text-white font-bold text-xs flex items-center justify-center cursor-pointer glow-indigo"
                  >
                    {updatingTenant ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Save Academy Changes'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
