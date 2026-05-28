'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'invalid'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  const router = useRouter();
  const supabase = createBrowserClient();

  // Supabase sends the recovery token in the URL hash fragment.
  // The @supabase/ssr client picks it up automatically on page load.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setStatus('success');
      // Redirect to login after 3 seconds
      setTimeout(() => router.push('/auth/login'), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please request a new reset link.');
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      <div className="radial-mesh-bg" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl pulsing-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-purple-600/10 blur-3xl pulsing-glow" style={{ animationDelay: '-4s' }} />

      <div className="w-full max-w-md glass-panel p-8 rounded-3xl relative z-10">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-full text-indigo-400 text-xs font-semibold tracking-wider uppercase mb-3 glow-indigo">
            <Sparkles className="w-3.5 h-3.5" />
            Secure Reset
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight glow-text-indigo">
            New Password
          </h1>
          <p className="text-slate-400 text-sm mt-1 text-center">
            Choose a strong password for your account
          </p>
        </div>

        {/* Success */}
        {status === 'success' ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <p className="text-lg font-bold text-slate-100">Password updated!</p>
            <p className="text-xs text-slate-400">Redirecting you to login in a moment…</p>
            <div className="w-5 h-5 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {!sessionReady && (
              <div className="mb-5 flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Waiting for reset link to be validated… If this takes too long, please request a new reset link.
              </div>
            )}

            {error && (
              <div className="mb-5 flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs animate-in fade-in duration-200">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <form onSubmit={handleReset} className="space-y-5">
              {/* New Password */}
              <div className="space-y-1.5">
                <label className="text-slate-300 text-xs font-semibold tracking-wide block">
                  New Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full h-11 pl-10 pr-10 rounded-xl glass-input text-sm"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Strength indicator */}
                {password.length > 0 && (
                  <div className="flex gap-1 mt-1.5">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                          password.length >= level * 3
                            ? level <= 1 ? 'bg-red-500'
                            : level === 2 ? 'bg-amber-500'
                            : level === 3 ? 'bg-emerald-500'
                            : 'bg-indigo-500'
                            : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="text-slate-300 text-xs font-semibold tracking-wide block">
                  Confirm Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className={`w-full h-11 pl-10 pr-10 rounded-xl glass-input text-sm transition-colors ${
                      confirmPassword.length > 0 && password !== confirmPassword
                        ? 'border-red-500/40 ring-1 ring-red-500/20'
                        : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && password === confirmPassword && (
                  <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1">
                    <CheckCircle2 className="w-3 h-3" /> Passwords match
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !sessionReady}
                className="w-full h-11 rounded-xl btn-premium font-bold text-sm tracking-wide flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  'Set New Password'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => router.push('/auth/login')}
                className="text-slate-500 hover:text-slate-300 text-xs transition-colors cursor-pointer"
              >
                ← Back to Login
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
