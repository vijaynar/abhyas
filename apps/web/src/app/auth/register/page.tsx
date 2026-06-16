'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { Building2, Eye, EyeOff, Globe, Lock, Mail, Sparkles, User } from 'lucide-react';
import { CoachOnboardingWizard } from '@/components/CoachOnboardingWizard';

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get('role');
  const tenantId = searchParams.get('tenantId');
  const isCoach = role === 'coach' && !!tenantId;
  const supabase = createBrowserClient();

  // Test Mode Feature Flag
  const [isTestMode, setIsTestMode] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('testmode')) {
        setIsTestMode(true);
      }
    }
  }, []);

  // ----------------------------------------------------
  // COACH ONBOARDING — delegated entirely to shared component
  // ----------------------------------------------------
  if (isCoach) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-start justify-center pt-8 pb-12 px-4">
        <div className="w-full max-w-5xl">
          <CoachOnboardingWizard
            isAdminMode={false}
            tenantId={tenantId!}
            theme="light"
            testMode={isTestMode}
            onCancel={() => router.push('/auth/login')}
            onSuccess={() => {
              router.push('/admin/dashboard');
              router.refresh();
            }}
          />
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // ACADEMY REGISTRATION STATES
  // ----------------------------------------------------
  return <AcademyRegister isTestMode={isTestMode} />;
}

function AcademyRegister({ isTestMode }: { isTestMode: boolean }) {
  const router = useRouter();
  const supabase = createBrowserClient();

  const [academyFirstName, setAcademyFirstName] = useState('');
  const [academyLastName, setAcademyLastName] = useState('');
  const [academyEmail, setAcademyEmail] = useState('');
  const [academyPassword, setAcademyPassword] = useState('');
  const [academyPhone, setAcademyPhone] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [academyCountry, setAcademyCountry] = useState('India');
  const [academyState, setAcademyState] = useState('Telangana');
  const [academyCity, setAcademyCity] = useState('Hyderabad');
  const [academyAddress, setAcademyAddress] = useState('');
  const [academyShowPassword, setAcademyShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fillRandomAcademyData = () => {
    const randomId = Math.floor(1000 + Math.random() * 9000);
    const firstNames = ['Rajesh', 'Suresh', 'Kiran', 'Nisha', 'Sunil', 'Vijay'];
    const lastNames = ['Patil', 'Deshmukh', 'Reddy', 'Rao', 'Sharma', 'Gupta'];
    const academies = ['Pro Sports Academy', 'Elite Badminton Arena', 'Super Kickers Club', 'Champion Tennis Academy', 'Velocity Swim Club'];

    const randFirst = firstNames[Math.floor(Math.random() * firstNames.length)];
    const randLast = lastNames[Math.floor(Math.random() * lastNames.length)];
    const randEmail = `admin.${randFirst.toLowerCase()}.${randLast.toLowerCase()}.${randomId}@upasthiti.com`;
    const randPhone = '9' + Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
    const randPassword = `Admin@Pass${randomId}!`;
    const randName = academies[Math.floor(Math.random() * academies.length)] + ` ${randomId}`;

    setAcademyFirstName(randFirst);
    setAcademyLastName(randLast);
    setAcademyEmail(randEmail);
    setAcademyPassword(randPassword);
    setAcademyPhone(randPhone);
    setTenantName(randName);
    const slug = randName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    setTenantSlug(slug);
    setAcademyCountry('India');
    setAcademyState('Karnataka');
    setAcademyCity('Bangalore');
    setAcademyAddress(`456 Sports Hub Lane, Indiranagar, Bangalore - 560038`);
  };

  const handleTenantNameChange = (val: string) => {
    setTenantName(val);
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    setTenantSlug(slug);
  };

  const handleAcademyRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: academyEmail,
          password: academyPassword,
          firstName: academyFirstName,
          lastName: academyLastName,
          phone: academyPhone || null,
          tenantName,
          tenantSlug,
          country: academyCountry,
          state: academyState,
          city: academyCity,
          address: academyAddress || null
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to complete registration.');
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: academyEmail,
        password: academyPassword,
      });

      if (loginError) {
        throw new Error('Registration succeeded, but auto-login failed. Please sign in manually.');
      }

      router.push('/admin/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during registration.');
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center py-12 px-4 overflow-hidden">
      {/* Background Animated Nodes */}
      <div className="radial-mesh-bg" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl pulsing-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-purple-600/10 blur-3xl pulsing-glow" style={{ animationDelay: '-4s' }} />

      <div className="w-full max-w-lg glass-panel p-8 rounded-3xl relative z-10">
        {/* Logo/Branding Header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/30 rounded-full text-purple-400 text-xs font-semibold tracking-wider uppercase mb-3 glow-indigo">
            <Sparkles className="w-3.5 h-3.5" />
            Academy Onboarding
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight glow-text-indigo font-sans">
            Register Your Academy
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            SaaS attendance &amp; payment management starting at ₹0/month
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-xs leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
            {error}
          </div>
        )}

        {isTestMode && (
          <div className="mb-4 p-3 bg-purple-950/40 border border-purple-500/30 rounded-xl flex items-center justify-between animate-in fade-in duration-300">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              <span className="text-xs text-purple-300 font-bold tracking-wide uppercase text-[10px]">Test Mode Active</span>
            </div>
            <button
              type="button"
              onClick={fillRandomAcademyData}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              <span>⚡ Auto-fill Test Data</span>
            </button>
          </div>
        )}

        <form onSubmit={handleAcademyRegister} className="space-y-4">
          <div className="border-b border-white/10 pb-2 mb-2">
            <h3 className="text-sm font-semibold text-slate-300">1. Academy Details</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Institute Name */}
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-semibold block">
                Institute / Academy Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <Building2 className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={tenantName}
                  onChange={(e) => handleTenantNameChange(e.target.value)}
                  placeholder="Elite Swimming Academy"
                  className="w-full h-10 pl-9 pr-4 rounded-xl glass-input text-xs"
                />
              </div>
            </div>

            {/* Institute Slug */}
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-semibold block">
                Subdomain Slug
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <Globe className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="eliteswim"
                  className="w-full h-10 pl-9 pr-4 rounded-xl glass-input text-xs text-indigo-300 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Country, State, City Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-semibold block">Country</label>
              <input
                type="text"
                required
                value={academyCountry}
                onChange={(e) => setAcademyCountry(e.target.value)}
                placeholder="India"
                className="w-full h-10 px-4 rounded-xl glass-input text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-semibold block">State</label>
              <input
                type="text"
                required
                value={academyState}
                onChange={(e) => setAcademyState(e.target.value)}
                placeholder="Telangana"
                className="w-full h-10 px-4 rounded-xl glass-input text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-semibold block">City</label>
              <input
                type="text"
                required
                value={academyCity}
                onChange={(e) => setAcademyCity(e.target.value)}
                placeholder="Hyderabad"
                className="w-full h-10 px-4 rounded-xl glass-input text-xs"
              />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1">
            <label className="text-slate-300 text-xs font-semibold block">
              Academy Physical Address (Optional)
            </label>
            <input
              type="text"
              value={academyAddress}
              onChange={(e) => setAcademyAddress(e.target.value)}
              placeholder="e.g. Plot No. 45, Jubilee Hills"
              className="w-full h-10 px-4 rounded-xl glass-input text-xs"
            />
          </div>

          <div className="border-b border-white/10 pt-2 pb-2 mb-2">
            <h3 className="text-sm font-semibold text-slate-300">2. Owner / Admin Account</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-semibold block">First Name</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={academyFirstName}
                  onChange={(e) => setAcademyFirstName(e.target.value)}
                  placeholder="Arjun"
                  className="w-full h-10 pl-9 pr-4 rounded-xl glass-input text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-semibold block">Last Name</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={academyLastName}
                  onChange={(e) => setAcademyLastName(e.target.value)}
                  placeholder="Sharma"
                  className="w-full h-10 pl-9 pr-4 rounded-xl glass-input text-xs"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-semibold block">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  value={academyEmail}
                  onChange={(e) => setAcademyEmail(e.target.value)}
                  placeholder="arjun@elite.com"
                  className="w-full h-10 pl-9 pr-4 rounded-xl glass-input text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-semibold block">Phone Number (Optional)</label>
              <input
                type="tel"
                value={academyPhone}
                onChange={(e) => setAcademyPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full h-10 px-4 rounded-xl glass-input text-xs"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-slate-300 text-xs font-semibold block">Choose Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type={academyShowPassword ? 'text' : 'password'}
                required
                value={academyPassword}
                onChange={(e) => setAcademyPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full h-10 pl-9 pr-10 rounded-xl glass-input text-xs"
              />
              <button
                type="button"
                onClick={() => setAcademyShowPassword(!academyShowPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-300 transition-colors"
              >
                {academyShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl btn-premium font-bold text-sm tracking-wide mt-4 flex items-center justify-center"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Onboard Academy & Log In'
            )}
          </button>
        </form>

        {/* Footer Link */}
        <div className="mt-6 text-center text-xs text-slate-400">
          Already have an academy account?{' '}
          <Link href="/auth/login" className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc]">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    }>
      <RegisterContent />
    </Suspense>
  );
}
