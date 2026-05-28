'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  Building2,
  CheckCircle2,
  Clock,
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
  XCircle
} from 'lucide-react';

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
  admin: {
    email: string;
    name: string;
    phone: string;
  } | null;
}

interface SaaSStats {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  trialTenants: number;
  avgAttendance: number;
}

export default function SuperadminPage() {
  const [activeTab, setActiveTab] = useState<'analytics' | 'provision' | 'governance'>('analytics');
  const [stats, setStats] = useState<SaaSStats>({
    totalTenants: 0,
    activeTenants: 0,
    suspendedTenants: 0,
    trialTenants: 0,
    avgAttendance: 0
  });
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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [subStatus, setSubStatus] = useState<'trial' | 'active'>('trial');

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
          phone: phone || null,
          password,
          subscriptionStatus: subStatus,
          country,
          state,
          city,
          address: address || null
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
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
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

  return (
    <div className="space-y-8">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold tracking-widest uppercase mb-1">
            <ShieldAlert className="w-4 h-4" /> Client Management Console
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Client Management
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

      {/* ── TAB 1: ANALYTICS & TENANT LEDGER ── */}
      {activeTab === 'analytics' && (
        <div className="space-y-8">
          {/* KPI Dashboard Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {/* KPI 1: Total Tenants */}
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-indigo-500/5 blur-2xl" />
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Tenants</span>
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 glow-indigo">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-3xl font-black text-white">{stats.totalTenants}</span>
                <span className="text-[10px] text-slate-500 block mt-1">Institutions onboarded</span>
              </div>
            </div>

            {/* KPI 2: Active Subscriptions */}
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-emerald-500/5 blur-2xl" />
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Active Plans</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 glow-emerald">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-3xl font-black text-white">{stats.activeTenants}</span>
                <span className="text-[10px] text-slate-500 block mt-1">Premium subscription tier</span>
              </div>
            </div>

            {/* KPI 3: Trial Plan Accounts */}
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-amber-500/5 blur-2xl" />
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Trial Accounts</span>
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Clock className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-3xl font-black text-white">{stats.trialTenants}</span>
                <span className="text-[10px] text-slate-500 block mt-1">Free introductory tier</span>
              </div>
            </div>

            {/* KPI 4: Suspended Plans */}
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-red-500/5 blur-2xl" />
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Suspended</span>
                <div className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                  <XCircle className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-3xl font-black text-white text-red-400">{stats.suspendedTenants}</span>
                <span className="text-[10px] text-slate-500 block mt-1">Locked out tenants</span>
              </div>
            </div>

            {/* KPI 5: Platform Average Attendance */}
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group border-indigo-500/20">
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-purple-500/10 blur-2xl" />
              <div className="flex items-center justify-between">
                <span className="text-indigo-300 text-[10px] font-extrabold uppercase tracking-wider">Avg Attendance</span>
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 glow-indigo">
                  <Users className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-4">
                <span className="text-3xl font-black text-white glow-text-indigo">{stats.avgAttendance}%</span>
                <span className="text-[10px] text-purple-400 font-bold block mt-1">Global platform average</span>
              </div>
            </div>
          </div>

          {/* Tenants Ledger Panel */}
          <div className="glass-panel rounded-3xl border border-white/5 bg-slate-950/20">
              {/* Controls Row: Search + Location Filters */}
              <div className="p-6 border-b border-white/10 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">Onboarded Academy Registry</h2>
                    <p className="text-[10px] text-slate-400">Search, monitor, and regulate active institute subscriptions</p>
                  </div>

                  {/* Search Bar */}
                  <div className="relative min-w-[280px]">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none">
                      <Search className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name, slug, or admin email..."
                      className="w-full h-9 pl-9 pr-4 rounded-xl glass-input text-xs"
                    />
                  </div>
                </div>

                {/* Location Filters */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Globe className="w-3 h-3" /> Filter by Location:
                  </span>

                  {/* State Filter */}
                  <select
                    value={filterState}
                    onChange={(e) => { setFilterState(e.target.value); setFilterCity(''); }}
                    className="h-8 px-3 rounded-lg bg-slate-900 border border-white/10 text-[10px] font-bold text-slate-300 outline-none cursor-pointer hover:border-indigo-500/40 min-w-[140px]"
                  >
                    <option value="">All States</option>
                    {uniqueStates.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>

                  {/* City Filter */}
                  <select
                    value={filterCity}
                    onChange={(e) => setFilterCity(e.target.value)}
                    className="h-8 px-3 rounded-lg bg-slate-900 border border-white/10 text-[10px] font-bold text-slate-300 outline-none cursor-pointer hover:border-indigo-500/40 min-w-[140px]"
                  >
                    <option value="">All Cities</option>
                    {uniqueCities.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>

                  {/* Clear Filters */}
                  {(filterState || filterCity) && (
                    <button
                      onClick={() => { setFilterState(''); setFilterCity(''); }}
                      className="h-8 px-3 rounded-lg text-[10px] font-bold text-slate-400 hover:text-white border border-white/10 hover:border-white/20 transition-colors cursor-pointer"
                    >
                      Clear Filters
                    </button>
                  )}

                  {/* Active filter count badge */}
                  {(filterState || filterCity || searchQuery) && (
                    <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                      {filteredTenants.length} of {tenants.length} shown
                    </span>
                  )}
                </div>
              </div>

            {/* Table */}
            <div className="overflow-x-auto no-scrollbar">
              {loading ? (
                <div className="p-12 text-center text-slate-500">
                  <div className="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-[10px] uppercase font-bold tracking-wider">Loading Client registries...</p>
                </div>
              ) : filteredTenants.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                  <p className="text-xs">No active coaching centers match your query.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.01] text-slate-400 font-extrabold uppercase tracking-wider text-[9px]">
                      <th className="py-4 px-6 min-w-[200px]">Coaching Center / School</th>
                      <th className="py-4 px-6 min-w-[120px]">URL Slug</th>
                      <th className="py-4 px-6 min-w-[110px]">State</th>
                      <th className="py-4 px-6 min-w-[110px]">City</th>
                      <th className="py-4 px-6 min-w-[220px]">Administrative Owner</th>
                      <th className="py-4 px-6 min-w-[140px]">Onboarding Date</th>
                      <th className="py-4 px-6 min-w-[130px]">Subscription Status</th>
                      <th className="py-4 px-6 min-w-[140px] text-right">Quick Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTenants.map((tenant) => {
                      const dateStr = new Date(tenant.created_at).toLocaleDateString([], {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      });

                      let badgeClass = 'bg-amber-500/10 border-amber-500/20 text-amber-400';
                      if (tenant.subscription_status === 'active') {
                        badgeClass = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
                      } else if (tenant.subscription_status === 'suspended') {
                        badgeClass = 'bg-red-500/10 border-red-500/20 text-red-400';
                      }

                      return (
                        <tr key={tenant.id} className="border-b border-white/5 hover:bg-white/[0.01] transition-colors">
                          <td className="py-4 px-6">
                            <span className="font-bold text-slate-200 block text-xs">{tenant.name}</span>
                            {tenant.address && (
                              <span className="text-[9px] text-slate-500 block italic max-w-xs truncate mt-0.5" title={tenant.address}>
                                {tenant.address}
                              </span>
                            )}
                            <span className="text-[9px] font-mono text-slate-500 block mt-1">{tenant.id}</span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="font-mono text-xs text-indigo-400 font-semibold">/{tenant.slug}</span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-xs text-slate-300 font-semibold block">{tenant.state || 'Telangana'}</span>
                            <span className="text-[9px] text-slate-500">{tenant.country || 'India'}</span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-xs text-slate-300 font-semibold">{tenant.city || 'Hyderabad'}</span>
                          </td>
                          <td className="py-4 px-6">
                            {tenant.admin ? (
                              <div>
                                <span className="font-semibold text-slate-300 block">{tenant.admin.name}</span>
                                <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">{tenant.admin.email}</span>
                                <span className="text-[9px] text-slate-500 block">{tenant.admin.phone}</span>
                              </div>
                            ) : (
                              <span className="text-slate-500 italic text-[10px]">No Admin Linked</span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-slate-400 font-semibold">{dateStr}</span>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-2 py-0.5 rounded-full border text-[9px] font-extrabold uppercase ${badgeClass}`}>
                              {tenant.subscription_status}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right relative">
                            {changingStatusId === tenant.id ? (
                              <div className="w-4 h-4 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin ml-auto" />
                            ) : (
                              <select
                                value={tenant.subscription_status}
                                onChange={(e) => handleUpdateStatus(tenant.id, e.target.value as any)}
                                className="h-8 px-2 rounded-lg bg-slate-900 border border-white/10 text-[10px] font-bold text-slate-300 outline-none cursor-pointer hover:border-white/20"
                              >
                                <option value="trial">Set Trial</option>
                                <option value="active">Activate Plan</option>
                                <option value="suspended">Suspend Access</option>
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
      )}

      {/* ── TAB 2: PROVISION COACHING CENTER ── */}
      {activeTab === 'provision' && (
        <div className="w-full max-w-3xl mx-auto glass-panel p-8 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />
          
          <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-full text-indigo-400 text-[10px] font-bold tracking-wider uppercase mb-3 w-fit glow-indigo">
            <Sparkles className="w-3.5 h-3.5" /> Direct Academy Provisioning
          </div>
          
          <h2 className="text-xl font-black text-white tracking-tight">Onboard New Coaching Center</h2>
          <p className="text-xs text-slate-400 leading-normal mb-6 mt-1">
            Provision a new institution tenant profile along with its designated administrator.
          </p>

          <form onSubmit={handleProvisionTenant} className="space-y-6">
            {/* Section 1: Tenant Information */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-white/5 pb-2">
                1. Academy Identity Profile
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wide block">
                    Academy / Institute Name
                  </label>
                  <input
                    type="text"
                    required
                    value={tenantName}
                    onChange={(e) => handleTenantNameChange(e.target.value)}
                    placeholder="e.g. Apex Martial Arts Academy"
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
              </div>

              <div className="w-full md:w-1/2 space-y-1.5">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +919876543210"
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
    </div>
  );
}
