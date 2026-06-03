'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { Mail, Sparkles, CheckCircle2, AlertCircle, RefreshCw, ChevronRight } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  useEffect(() => {
    // Parse any auth error redirected back in URL search parameters
    const searchParams = new URLSearchParams(window.location.search);
    const urlError = searchParams.get('error_description') || searchParams.get('error') || searchParams.get('msg');
    
    // Parse any auth error returned in URL hash (standard for Supabase OAuth redirects)
    let hashError = null;
    if (typeof window !== 'undefined' && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      hashError = hashParams.get('error_description') || hashParams.get('error');
    }

    const activeError = urlError || hashError;
    if (activeError) {
      console.warn('[Login] Authentication error detected from callback:', activeError);
      if (activeError.toLowerCase().includes('provider is not enabled') || activeError.toLowerCase().includes('unsupported provider')) {
        setError('Google Sign-In is not enabled on this Supabase project. To use Google Login, please enable the Google Provider under "Authentication -> Providers" in your Supabase Dashboard console. Otherwise, use your Email address to sign in passwordless.');
      } else {
        setError(activeError);
      }
      
      // Clean up the URL to keep it tidy
      if (typeof window !== 'undefined' && (window.location.search || window.location.hash)) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const { error: oAuthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (oAuthError) throw oAuthError;
    } catch (err: any) {
      console.error('[Login] Google auth failed:', err);
      setError(err.message || 'Failed to start Google Sign In.');
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const targetEmail = email.trim();
    if (!targetEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (!targetEmail.includes('@') || targetEmail.length < 5) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      console.log('[Login] Triggering magic link for:', targetEmail);
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: targetEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          shouldCreateUser: true, // Automatically registers as student via DB trigger
        },
      });

      if (otpError) throw otpError;
      setMagicSent(true);
    } catch (err: any) {
      console.error('[Login] OTP Signin failed:', err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTryItFirst = async () => {
    setError(null);
    setLoading(true);
    try {
      console.log('[Login] Initiating guest student bypass session...');
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: 'demo-student@upasthiti.com',
        password: 'password123',
      });

      if (authError) throw authError;

      router.push('/student/dashboard');
      router.refresh();
    } catch (err: any) {
      console.error('[Login] Guest session failed:', err);
      setError(err.message || 'Failed to connect to the demo environment.');
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden bg-[#060814]">
      {/* Background Neon Glowing Meshes */}
      <div className="radial-mesh-bg" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl pulsing-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-purple-600/10 blur-3xl pulsing-glow" style={{ animationDelay: '-4s' }} />

      <div className="w-full max-w-md glass-panel p-8 rounded-3xl relative z-10 border border-white/10 shadow-2xl">
        
        {/* Branding header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-full text-indigo-400 text-xs font-semibold tracking-wider uppercase mb-3 glow-indigo">
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered Attendance
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight glow-text-indigo">
            UPASTHITI
          </h1>
          <p className="text-slate-400 text-xs mt-1.5 font-medium uppercase tracking-widest">
            Academy Management System
          </p>
        </div>

        {/* Dynamic Success Verification State */}
        {magicSent ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center animate-in fade-in duration-300">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Check Your Email</h2>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed px-4">
                We sent a secure activation link to <span className="text-indigo-400 font-bold">{email}</span>. 
                Click the link in the email to log in and open your secure student portal.
              </p>
            </div>
            <button
              onClick={() => {
                setMagicSent(false);
                setEmail('');
              }}
              className="mt-4 px-5 h-9 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all duration-200 cursor-pointer"
            >
              Back to Login
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold text-white tracking-tight">Log in or sign up</h2>
              <p className="text-xs text-slate-400 mt-1">Select your preferred authentication method</p>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Social Logins */}
            <div className="space-y-3">
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full h-11 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-bold tracking-wide flex items-center justify-center transition-all duration-200 cursor-pointer group hover:border-white/20 active:scale-[0.99] disabled:opacity-50"
              >
                <svg className="w-4 h-4 mr-3 transition-transform duration-200 group-hover:scale-105" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">OR</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            {/* Passwordless Email Form */}
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-extrabold tracking-wider uppercase block">
                  Email address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="w-full h-11 pl-10 pr-4 rounded-xl glass-input text-sm focus:border-indigo-500/50"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    disabled={loading}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl btn-premium font-bold text-sm tracking-wide mt-2 flex items-center justify-center gap-2 group cursor-pointer active:scale-[0.99] disabled:opacity-60"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Continue
                    <ChevronRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            {/* Bypass Login "Try it first" */}
            <div className="mt-8 pt-4 border-t border-white/5 text-center">
              <button
                onClick={handleTryItFirst}
                disabled={loading}
                className="text-xs text-slate-400 hover:text-white font-bold transition-colors cursor-pointer group inline-flex items-center gap-1.5 py-2 px-4 rounded-lg bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/10 hover:border-indigo-500/25 active:scale-[0.98] disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                Try it first
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
