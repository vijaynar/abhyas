'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import { Eye, EyeOff, Lock, Mail, Sparkles, X, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  // Forgot password state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetStatus, setResetStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [resetError, setResetError] = useState<string | null>(null);

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
          // admin, superadmin, coach all go to admin dashboard
          router.push('/admin/dashboard');
        }
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
      setLoading(false);
    }
  };

  const openForgotModal = () => {
    // Pre-fill with whatever the user typed in the login email field if it looks like an email
    setResetEmail(email.includes('@') ? email : '');
    setResetStatus('idle');
    setResetError(null);
    setShowForgotModal(true);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;

    setResetLoading(true);
    setResetError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;
      setResetStatus('success');
    } catch (err: any) {
      setResetError(err.message || 'Failed to send reset email. Please try again.');
      setResetStatus('error');
    } finally {
      setResetLoading(false);
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
              <button
                type="button"
                onClick={openForgotModal}
                className="text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Forgot password?
              </button>
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

      {/* ── Forgot Password Modal ── */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm glass-panel p-6 rounded-2xl relative">
            {/* Close button */}
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Lock className="w-4 h-4 text-indigo-400" />
              </div>
              <h2 className="text-base font-bold text-white">Reset Password</h2>
            </div>
            <p className="text-xs text-slate-400 mb-5 pl-10">
              Enter your account email and we&apos;ll send a reset link.
            </p>

            {/* Success state */}
            {resetStatus === 'success' ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center animate-in fade-in duration-300">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="text-sm font-semibold text-slate-100">Reset email sent!</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Check your inbox at <span className="text-indigo-400 font-medium">{resetEmail}</span>. Click the link in the email to set a new password.
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Didn&apos;t receive it? Check your spam folder or{' '}
                  <button
                    onClick={() => setResetStatus('idle')}
                    className="text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                  >
                    try again
                  </button>.
                </p>
                <button
                  onClick={() => setShowForgotModal(false)}
                  className="mt-2 btn-secondary h-9 px-5 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="text-slate-300 text-xs font-semibold tracking-wide block mb-1.5">
                    Account Email
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full h-11 pl-10 pr-4 rounded-xl glass-input text-sm"
                      autoFocus
                    />
                  </div>
                </div>

                {resetStatus === 'error' && resetError && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs animate-in fade-in duration-200">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {resetError}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="btn-secondary flex-1 h-10 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading || !resetEmail.trim()}
                    className="btn-premium flex-1 h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {resetLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      'Send Reset Link'
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
