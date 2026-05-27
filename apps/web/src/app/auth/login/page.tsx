'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { Eye, EyeOff, Lock, Mail, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Resolve identifier (email or roll number) to correct Supabase Auth email
      const resolveRes = await fetch('/api/v1/auth/resolve-identifier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email }),
      });

      const resolveData = await resolveRes.json();
      if (!resolveRes.ok) {
        throw new Error(resolveData.error || 'Failed to resolve login account details.');
      }

      const loginEmail = resolveData.data.email;

      // 2. Sign in with the resolved email
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (data?.user) {
        // Query user role in public.users to determine dashboard redirect
        const { data: profile, error: dbError } = await supabase
          .from('users')
          .select('role')
          .eq('id', data.user.id)
          .single();

        if (dbError || !profile) {
          throw new Error('Failed to retrieve user profile.');
        }

        // Redirect based on role
        if (profile.role === 'student' || profile.role === 'parent') {
          router.push('/student/dashboard');
        } else {
          router.push('/admin/dashboard');
        }
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      {/* Background Animated Nodes */}
      <div className="radial-mesh-bg" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl pulsing-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-purple-600/10 blur-3xl pulsing-glow" style={{ animationDelay: '-4s' }} />

      <div className="w-full max-w-md glass-panel p-8 rounded-3xl relative z-10">
        {/* Logo/Branding Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-full text-indigo-400 text-xs font-semibold tracking-wider uppercase mb-3 glow-indigo">
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered Attendance
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight glow-text-indigo">
            UPASTHITI
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Access your secure learning portal
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-xs leading-relaxed animate-in fade-in slide-in-from-top-1 duration-200">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          {/* Email/Roll Number/Phone Field */}
          <div className="space-y-1.5">
            <label className="text-slate-300 text-xs font-semibold tracking-wide block">
              Email, Roll Number, or Phone
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@academy.com, vs00001, or 9876543210"
                className="w-full h-11 pl-10 pr-4 rounded-xl glass-input text-sm"
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-slate-300 text-xs font-semibold tracking-wide block">
                Password
              </label>
              <a href="#" className="text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-colors">
                Forgot password?
              </a>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 pl-10 pr-10 rounded-xl glass-input text-sm"
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

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl btn-premium font-bold text-sm tracking-wide mt-2 flex items-center justify-center"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Footer Link */}
        <div className="mt-8 text-center text-xs text-slate-400">
          First time here?{' '}
          <Link href="/auth/register" className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors">
            Create an Account
          </Link>
        </div>
      </div>
    </div>
  );
}
