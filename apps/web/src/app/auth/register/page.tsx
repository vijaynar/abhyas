'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { Building2, Eye, EyeOff, Globe, Lock, Mail, Sparkles, User } from 'lucide-react';

export default function RegisterPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [country, setCountry] = useState('India');
  const [state, setState] = useState('Telangana');
  const [city, setCity] = useState('Hyderabad');
  const [address, setAddress] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  // Auto-generate slug from Tenant Name
  const handleTenantNameChange = (val: string) => {
    setTenantName(val);
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    setTenantSlug(slug);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Fire registration to public register API
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          phone: phone || null,
          tenantName,
          tenantSlug,
          country,
          state,
          city,
          address: address || null
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to complete registration.');
      }

      // 2. Perform client sign-in with newly created credentials
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        throw new Error('Registration succeeded, but auto-login failed. Please sign in manually.');
      }

      // 3. Redirect to Admin Dashboard
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
            Academy Boarding
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight glow-text-indigo">
            Register Your Academy
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            SaaS attendance & payment management starting at ₹0/month
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-xs leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
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
            {/* Country */}
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-semibold block">
                Country
              </label>
              <input
                type="text"
                required
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="India"
                className="w-full h-10 px-4 rounded-xl glass-input text-xs"
              />
            </div>

            {/* State */}
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-semibold block">
                State
              </label>
              <input
                type="text"
                required
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="Telangana"
                className="w-full h-10 px-4 rounded-xl glass-input text-xs"
              />
            </div>

            {/* City */}
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-semibold block">
                City
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
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
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Plot No. 45, Jubilee Hills"
              className="w-full h-10 px-4 rounded-xl glass-input text-xs"
            />
          </div>

          <div className="border-b border-white/10 pt-2 pb-2 mb-2">
            <h3 className="text-sm font-semibold text-slate-300">2. Owner / Admin Account</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* First Name */}
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-semibold block">
                First Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Arjun"
                  className="w-full h-10 pl-9 pr-4 rounded-xl glass-input text-xs"
                />
              </div>
            </div>

            {/* Last Name */}
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-semibold block">
                Last Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Sharma"
                  className="w-full h-10 pl-9 pr-4 rounded-xl glass-input text-xs"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Email */}
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-semibold block">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="arjun@elite.com"
                  className="w-full h-10 pl-9 pr-4 rounded-xl glass-input text-xs"
                />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <label className="text-slate-300 text-xs font-semibold block">
                Phone Number (Optional)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full h-10 px-4 rounded-xl glass-input text-xs"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-slate-300 text-xs font-semibold block">
              Choose Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full h-10 pl-9 pr-10 rounded-xl glass-input text-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
