'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import {
  Megaphone,
  Calendar,
  Trophy,
  Activity,
  AlertTriangle,
  ArrowLeft,
  MoreVertical,
  Trash2,
  Archive,
  Edit,
  Clock,
  Bell,
  CheckCircle2,
  ChevronDown
} from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  message: string;
  status: 'Published' | 'Scheduled' | 'Archived';
  category: string;
  dateLabel: string;
  audience: string;
  scheduleTime?: string;
  iconType: 'megaphone' | 'trophy' | 'calendar' | 'activity' | 'ban';
}

const getAttendanceColorClass = (rate: number) => {
  if (rate >= 90) return 'text-emerald-400';
  if (rate >= 80) return 'text-amber-400';
  return 'text-rose-400';
};



export default function AnnouncementsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'All' | 'Published' | 'Scheduled' | 'Archived'>('All');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dbCategories, setDbCategories] = useState<string[]>(['General', 'Badminton A', 'All Batches']);
  const [dbBatches, setDbBatches] = useState<{ id: string; name: string }[]>([
    { id: 'b1', name: 'Badminton A' },
    { id: 'b2', name: 'Badminton B' },
    { id: 'b3', name: 'Badminton C' }
  ]);

  const supabase = createBrowserClient();

  // Load from LocalStorage & Supabase
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('coach_announcements');
      if (stored) {
        setAnnouncements(JSON.parse(stored));
      } else {
        setAnnouncements([]);
      }
    }

    const loadRealData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch coach assignments
        const { data: coachAssignments } = await supabase
          .from('coach_batch_assignments')
          .select('batch_id, batches(id, name, classes(name))')
          .eq('coach_id', user.id)
          .eq('status', 'approved');

        const batchesList = (coachAssignments || [])
          .map((a: any) => a.batches)
          .filter(Boolean);

        if (batchesList.length > 0) {
          const uniqueClasses: string[] = Array.from(
            new Set(batchesList.map((b: any) => b.classes?.name).filter(Boolean))
          );
          setDbCategories(['General', ...uniqueClasses]);
          setDbBatches(batchesList.map((b: any) => ({ id: b.id, name: b.name })));
        }
      } catch (err) {
        console.error('Failed to load real categories and batches:', err);
      }
    };

    loadRealData();
  }, []);

  // Save to LocalStorage helper
  const saveAnnouncements = (newList: Announcement[]) => {
    setAnnouncements(newList);
    if (typeof window !== 'undefined') {
      localStorage.setItem('coach_announcements', JSON.stringify(newList));
    }
  };

  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<string>('General');
  const [audience, setAudience] = useState('All Students');
  const [scheduleOption, setScheduleOption] = useState<'now' | 'later'>('now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Dynamic KPI counts calculated directly from current announcements list
  const publishedCount = announcements.filter(a => a.status === 'Published').length;
  const scheduledCount = announcements.filter(a => a.status === 'Scheduled').length;
  const archivedCount = announcements.filter(a => a.status === 'Archived').length;
  const totalCount = announcements.length;

  // Pagination mock
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const filteredAnnouncements = announcements.filter(a => {
    if (activeTab === 'All') return true;
    return a.status === activeTab;
  });

  const paginatedAnnouncements = filteredAnnouncements.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredAnnouncements.length / itemsPerPage) || 1;

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    // Detect icon type based on keywords
    let iconType: 'megaphone' | 'trophy' | 'calendar' | 'activity' | 'ban' = 'megaphone';
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('match') || lowerTitle.includes('tournament') || lowerTitle.includes('cup') || lowerTitle.includes('win')) {
      iconType = 'trophy';
    } else if (lowerTitle.includes('schedule') || lowerTitle.includes('camp') || lowerTitle.includes('date')) {
      iconType = 'calendar';
    } else if (lowerTitle.includes('shoe') || lowerTitle.includes('train') || lowerTitle.includes('practice')) {
      iconType = 'activity';
    } else if (lowerTitle.includes('close') || lowerTitle.includes('maintenance') || lowerTitle.includes('cancel')) {
      iconType = 'ban';
    }

    const formattedDate = scheduleOption === 'later' && scheduleDate
      ? new Date(scheduleDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' • ' + new Date(scheduleDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' • ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    let updatedList: Announcement[] = [];

    if (editingId) {
      // Edit existing
      updatedList = announcements.map(a => {
        if (a.id === editingId) {
          return {
            ...a,
            title,
            message,
            category,
            audience,
            status: scheduleOption === 'later' ? 'Scheduled' : 'Published',
            dateLabel: formattedDate,
            iconType
          };
        }
        return a;
      });
      setEditingId(null);
      alert('Announcement updated successfully!');
    } else {
      // Create new
      const newAnn: Announcement = {
        id: 'ann-' + Date.now(),
        title,
        message,
        category,
        audience,
        status: scheduleOption === 'later' ? 'Scheduled' : 'Published',
        dateLabel: formattedDate,
        iconType
      };
      updatedList = [newAnn, ...announcements];
      alert('Announcement published successfully!');
    }

    saveAnnouncements(updatedList);

    // Reset Form
    setTitle('');
    setMessage('');
    setCategory('General');
    setAudience('All Students');
    setScheduleOption('now');
    setScheduleDate('');
  };

  const handleEdit = (ann: Announcement) => {
    setTitle(ann.title);
    setMessage(ann.message);
    setCategory(ann.category);
    setAudience(ann.audience);
    setScheduleOption(ann.status === 'Scheduled' ? 'later' : 'now');
    setEditingId(ann.id);
    setActiveMenuId(null);
  };

  const handleArchive = (id: string) => {
    const updated = announcements.map(a => {
      if (a.id === id) {
        return { ...a, status: 'Archived' as const };
      }
      return a;
    });
    saveAnnouncements(updated);
    setActiveMenuId(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this announcement?')) {
      const updated = announcements.filter(a => a.id !== id);
      saveAnnouncements(updated);
      setActiveMenuId(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/dashboard"
            className="w-10 h-10 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors hover:bg-white/[0.04]"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold tracking-widest uppercase mb-1">
              <Megaphone className="w-4 h-4" /> Coach Portal
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white font-display flex items-center gap-2">
              Announcements <Megaphone className="w-6 h-6 text-indigo-400 stroke-[2.5]" />
            </h1>
            <p className="text-xs text-slate-400 mt-1">Share important updates and announcements with your students.</p>
          </div>
        </div>

        {/* Date Selector mockup */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <button className="glass-panel h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer border border-white/10 text-slate-200 bg-slate-900/60">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} (Today)</span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1: Total Announcements */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-purple-500/5 blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Announcements</span>
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <Megaphone className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-white">{totalCount}</span>
            <span className="text-[10px] text-purple-400 font-bold block mt-0.5">All time</span>
          </div>
          {/* Sparkline line SVG */}
          <svg viewBox="0 0 100 20" className="absolute bottom-0 left-0 w-full h-5 pointer-events-none opacity-30">
            <path d="M0,15 Q15,5 30,12 T60,5 T90,10 L100,10 L100,20 L0,20 Z" fill="none" stroke="#a855f7" strokeWidth="1.2" />
          </svg>
        </div>

        {/* KPI 2: Published */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-emerald-500/5 blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Published</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-white">{publishedCount}</span>
            <span className="text-[10px] text-emerald-400 font-bold block mt-0.5">Active announcements</span>
          </div>
          {/* Sparkline line SVG */}
          <svg viewBox="0 0 100 20" className="absolute bottom-0 left-0 w-full h-5 pointer-events-none opacity-30">
            <path d="M0,12 Q20,18 40,8 T80,15 L100,10 L100,20 L0,20 Z" fill="none" stroke="#10b981" strokeWidth="1.2" />
          </svg>
        </div>

        {/* KPI 3: Scheduled */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-amber-500/5 blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Scheduled</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-white">{scheduledCount}</span>
            <span className="text-[10px] text-amber-400 font-bold block mt-0.5">Upcoming announcements</span>
          </div>
          {/* Sparkline line SVG */}
          <svg viewBox="0 0 100 20" className="absolute bottom-0 left-0 w-full h-5 pointer-events-none opacity-30">
            <path d="M0,15 Q15,18 30,10 T70,14 L100,8 L100,20 L0,20 Z" fill="none" stroke="#f59e0b" strokeWidth="1.2" />
          </svg>
        </div>

        {/* KPI 4: Archived */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-rose-500/5 blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Archived</span>
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
              <Archive className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-white">{archivedCount}</span>
            <span className="text-[10px] text-rose-400 font-bold block mt-0.5">Completed / Expired</span>
          </div>
          {/* Sparkline line SVG */}
          <svg viewBox="0 0 100 20" className="absolute bottom-0 left-0 w-full h-5 pointer-events-none opacity-30">
            <path d="M0,8 Q25,18 50,10 T90,15 L100,10 L100,20 L0,20 Z" fill="none" stroke="#f43f5e" strokeWidth="1.2" />
          </svg>
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="flex border-b border-white/10 pb-px">
        {['All', 'Published', 'Scheduled', 'Archived'].map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab as any); setCurrentPage(1); }}
            className={`px-6 py-3 text-xs font-bold transition-all relative border-b-2
              ${activeTab === tab 
                ? 'border-indigo-500 text-indigo-400 font-extrabold' 
                : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            {tab === 'All' ? 'All Announcements' : tab}
          </button>
        ))}
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Left Column: Feed List */}
        <div className="lg:col-span-3 space-y-4">
          <div className="space-y-4">
            {paginatedAnnouncements.length === 0 ? (
              <div className="glass-panel p-12 text-center text-slate-500 rounded-3xl">
                <Bell className="w-8 h-8 mx-auto mb-3 text-slate-600" />
                <p className="text-xs">No announcements in this category.</p>
              </div>
            ) : (
              paginatedAnnouncements.map((item) => {
                let badgeColor = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
                if (item.status === 'Scheduled') {
                  badgeColor = 'bg-amber-500/10 border-amber-500/20 text-amber-400';
                } else if (item.status === 'Archived') {
                  badgeColor = 'bg-slate-500/10 border-slate-500/20 text-slate-400';
                }

                // Icon styling based on iconType
                let Icon = Megaphone;
                let iconWrapperClass = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
                if (item.iconType === 'trophy') {
                  Icon = Trophy;
                  iconWrapperClass = 'bg-blue-500/10 border-blue-500/20 text-blue-400';
                } else if (item.iconType === 'calendar') {
                  Icon = Calendar;
                  iconWrapperClass = 'bg-amber-500/10 border-amber-500/20 text-amber-400';
                } else if (item.iconType === 'activity') {
                  Icon = Activity;
                  iconWrapperClass = 'bg-purple-500/10 border-purple-500/20 text-purple-400';
                } else if (item.iconType === 'ban') {
                  Icon = AlertTriangle;
                  iconWrapperClass = 'bg-rose-500/10 border-rose-500/20 text-rose-400';
                }

                let tagClass = 'bg-purple-500/10 border-purple-500/20 text-purple-300';
                if (item.category === 'Badminton A') {
                  tagClass = 'bg-blue-500/10 border-blue-500/20 text-blue-300';
                } else if (item.category === 'All Batches') {
                  tagClass = 'bg-rose-500/10 border-rose-500/20 text-rose-300';
                }

                return (
                  <div
                    key={item.id}
                    className="glass-panel p-5 rounded-2xl flex gap-4 items-start relative hover:bg-white/[0.02] transition-all"
                  >
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${iconWrapperClass}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    
                    <div className="flex-1 min-w-0 pr-6 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black border uppercase ${badgeColor}`}>
                          {item.status}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black border uppercase ${tagClass}`}>
                          {item.category}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white leading-snug">{item.title}</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">{item.message}</p>
                      
                      <div className="flex items-center gap-3 text-[10px] text-slate-500 pt-1 flex-wrap">
                        <span>{item.dateLabel}</span>
                        <span>•</span>
                        <span className="font-semibold text-slate-400">Audience: {item.audience}</span>
                      </div>
                    </div>

                    {/* 3-Dot Action Menu */}
                    <div className="absolute top-4 right-4">
                      <button
                        onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
                        className="p-1 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      
                      {activeMenuId === item.id && (
                        <div className="absolute right-0 mt-1 w-28 bg-slate-900 border border-white/10 rounded-xl py-1 z-30 shadow-2xl animate-in fade-in slide-in-from-top-1 duration-150">
                          <button
                            onClick={() => handleEdit(item)}
                            className="w-full px-3 py-1.5 text-left text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" /> Edit
                          </button>
                          {item.status !== 'Archived' && (
                            <button
                              onClick={() => handleArchive(item.id)}
                              className="w-full px-3 py-1.5 text-left text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-1.5 cursor-pointer"
                            >
                              <Archive className="w-3.5 h-3.5" /> Archive
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="w-full px-3 py-1.5 text-left text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-white/5 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-white/5 pt-4">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredAnnouncements.length)} of {filteredAnnouncements.length} announcements
              </span>
              
              <div className="flex gap-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                  className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-40 disabled:hover:text-slate-300 cursor-pointer"
                >
                  &lt;
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`w-8 h-8 rounded-lg border text-xs font-bold cursor-pointer
                      ${currentPage === p
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_8px_#6366f1]'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'}`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                  className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-40 disabled:hover:text-slate-300 cursor-pointer"
                >
                  &gt;
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Creation Panel */}
        <div className="lg:col-span-2">
          <div className="glass-panel p-6 rounded-3xl border border-white/5 bg-slate-950/20 space-y-5">
            <div className="flex items-start gap-3 border-b border-white/5 pb-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 glow-indigo">
                <Megaphone className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">
                  {editingId ? 'Edit Announcement' : 'Create New Announcement'}
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Share important updates with your students.</p>
              </div>
            </div>

            <form onSubmit={handlePublish} className="space-y-4">
              {/* Title input */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wide">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter announcement title"
                  className="w-full h-10 px-3.5 rounded-xl glass-input text-xs font-bold"
                />
              </div>

              {/* Message textarea */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wide">
                    Message <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[9px] text-slate-500 font-bold">{message.length}/1000</span>
                </div>
                <textarea
                  required
                  maxLength={1000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write your announcement..."
                  rows={5}
                  className="w-full p-3.5 rounded-xl glass-input text-xs leading-relaxed"
                />
              </div>

              {/* Tag Category (General/Badminton A/All Batches) */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wide">
                  Tag Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl glass-input text-xs font-bold"
                >
                  {dbCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Audience selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wide">
                  Audience <span className="text-rose-500">*</span>
                </label>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl glass-input text-xs font-bold"
                >
                  <option value="All Students">All Students</option>
                  {dbBatches.map(b => (
                    <option key={b.id} value={b.name}>{b.name} Batch Only</option>
                  ))}
                </select>
                <span className="text-[8px] text-slate-500 block leading-normal">
                  Choose who should see this announcement
                </span>
              </div>

              {/* Schedule options */}
              <div className="space-y-2 pt-1.5">
                <label className="text-[10px] text-slate-400 font-bold block uppercase tracking-wide">Schedule</label>
                
                <div className="flex gap-6 items-center">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                    <input
                      type="radio"
                      name="scheduleOpt"
                      checked={scheduleOption === 'now'}
                      onChange={() => setScheduleOption('now')}
                      className="accent-indigo-500"
                    />
                    Publish Now
                  </label>
                  
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                    <input
                      type="radio"
                      name="scheduleOpt"
                      checked={scheduleOption === 'later'}
                      onChange={() => setScheduleOption('later')}
                      className="accent-indigo-500"
                    />
                    Schedule for Later
                  </label>
                </div>
                
                {scheduleOption === 'now' ? (
                  <span className="text-[9px] text-slate-500 block">Publish immediately</span>
                ) : (
                  <div className="space-y-1.5 pt-1.5 animate-in slide-in-from-top-1 duration-150">
                    <input
                      type="datetime-local"
                      required={scheduleOption === 'later'}
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-xl glass-input text-xs font-bold font-mono"
                    />
                    <span className="text-[9px] text-slate-500 block">Choose date and time</span>
                  </div>
                )}
              </div>

              {/* Submit panel */}
              <div className="flex gap-3 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setTitle('');
                    setMessage('');
                    setCategory('General');
                    setAudience('All Students');
                    setScheduleOption('now');
                    setScheduleDate('');
                    setEditingId(null);
                  }}
                  className="flex-1 h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 font-bold text-xs cursor-pointer transition-colors"
                >
                  {editingId ? 'Cancel' : 'Save as Draft'}
                </button>
                
                <button
                  type="submit"
                  disabled={!title.trim() || !message.trim()}
                  className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer transition-colors glow-indigo disabled:opacity-40"
                >
                  {editingId ? 'Save Changes' : 'Publish Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
