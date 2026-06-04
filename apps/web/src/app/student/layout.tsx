'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createBrowserClient } from '@/lib/supabase';
import {
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Sparkles,
  User,
  AlertCircle,
  Calendar
} from 'lucide-react';

interface StudentProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  available_roles: string[];
  tenants: {
    name: string;
  };
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createBrowserClient();

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          router.push('/auth/login');
          return;
        }

        // Fetch user profile and joined tenant info
        const { data: userProfile, error: dbError } = await supabase
          .from('users')
          .select('id, email, first_name, last_name, role, available_roles, tenants(name)')
          .eq('id', user.id)
          .single();

        if (dbError || !userProfile) {
          console.error('Error fetching student profile:', dbError);
          return;
        }

        if (userProfile.role !== 'student' && userProfile.role !== 'parent') {
          // If not student/parent, eject to admin dashboard
          router.push('/admin/dashboard');
          return;
        }

        setProfile(userProfile as unknown as StudentProfile);
      } catch (err) {
        console.error('Failed to authenticate student:', err);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  const handleSwitchRole = async (targetRole: string) => {
    try {
      const res = await fetch('/api/v1/users/switch-role', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: targetRole }),
      });
      if (res.ok) {
        if (targetRole === 'student' || targetRole === 'parent') {
          window.location.href = '/student/dashboard';
        } else {
          window.location.href = '/admin/dashboard';
        }
      } else {
        console.error('Failed to switch role:', await res.text());
      }
    } catch (err) {
      console.error('Error switching role:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center relative bg-[#060814]">
        <div className="radial-mesh-bg" />
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin glow-indigo" />
        <p className="text-slate-400 text-xs font-semibold tracking-widest mt-4 uppercase">
          Securing Student Workspace...
        </p>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#060814] text-slate-100 relative">
      {/* Background Glows */}
      <div className="radial-mesh-bg" />
      <div className="absolute top-0 right-1/4 w-[400px] h-[400px] rounded-full bg-indigo-600/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-purple-600/5 blur-3xl pointer-events-none" />

      {/* Header bar */}
      <header className="w-full h-16 border-b border-white/10 glass-panel sticky top-0 z-40 flex items-center justify-between px-6 md:px-12">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <GraduationCap className="w-4 h-4" />
          </div>
          <div>
            <span className="font-extrabold text-sm tracking-wider text-white">
              {profile.tenants.name.toUpperCase()}
            </span>
            <span className="text-[9px] text-indigo-400 font-extrabold tracking-widest block uppercase">
              Student Workspace
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex items-center gap-1.5 bg-slate-950/40 border border-white/5 p-1 rounded-xl">
          <Link
            href="/student/dashboard"
            className={`h-8 px-3.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all ${
              pathname === '/student/dashboard'
                ? 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-300'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Dashboard</span>
          </Link>
          <Link
            href="/student/reports"
            className={`h-8 px-3.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all ${
              pathname === '/student/reports'
                ? 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-300'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Reports</span>
          </Link>
        </nav>

        {/* User context & log out */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-indigo-400 text-xs font-bold">
              {profile.first_name[0]}{profile.last_name[0]}
            </div>
            <div className="hidden sm:block text-left">
              <h5 className="text-xs font-bold text-slate-200">
                {profile.first_name} {profile.last_name}
              </h5>
              {profile.available_roles && profile.available_roles.length > 1 ? (
                <div className="mt-0.5">
                  <select
                    value={profile.role}
                    onChange={(e) => handleSwitchRole(e.target.value)}
                    className="bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-500/30 text-indigo-300 text-[10px] font-extrabold rounded-lg px-2 py-0.5 uppercase tracking-wider outline-none cursor-pointer transition-colors duration-200"
                  >
                    {profile.available_roles.map((r) => (
                      <option key={r} value={r} className="bg-[#0f111a] text-slate-300 uppercase">
                        {r === 'superadmin' ? 'Super Admin' : r}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="text-[9px] text-slate-500 uppercase font-semibold">{profile.role}</span>
              )}
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="h-9 px-3 rounded-lg border border-red-500/10 hover:border-red-500/30 bg-red-500/5 hover:bg-red-500/10 text-red-400 font-semibold text-[10px] transition-all duration-200 flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Page Body Wrapper */}
      <main className="flex-1 p-6 md:p-10 max-w-6xl w-full mx-auto animate-in fade-in duration-300">
        {children}
      </main>

      {/* Footer copyright */}
      <footer className="py-6 border-t border-white/5 text-center text-[10px] text-slate-600 font-semibold tracking-wide mt-12 relative z-10">
        POWERED BY UPASTHITI ATTEENDANCE • ALL RIGHTS RESERVED
      </footer>
    </div>
  );
}
