'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { BookOpen, Check, Edit2, Plus, Sparkles, X } from 'lucide-react';

interface ClassItem {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  const supabase = createBrowserClient();

  const loadClasses = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile) return;

      const { data, error } = await supabase
        .from('classes')
        .select('id, name, description, is_active')
        .eq('tenant_id', profile.tenant_id)
        .order('name');

      if (error) throw error;
      setClasses(data || []);
    } catch (err) {
      console.error('Failed to load classes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
  }, []);

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile) return;

      if (editingClass) {
        // Edit Mode
        const { error } = await supabase
          .from('classes')
          .update({
            name,
            description: description || null,
            is_active: isActive,
          })
          .eq('id', editingClass.id);

        if (error) throw error;
      } else {
        // Add Mode
        const { error } = await supabase
          .from('classes')
          .insert({
            tenant_id: profile.tenant_id,
            name,
            description: description || null,
            is_active: true,
          });

        if (error) throw error;
      }

      setName('');
      setDescription('');
      setIsActive(true);
      setShowAddModal(false);
      setEditingClass(null);
      await loadClasses();
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save class.');
    }
  };

  const handleEditClick = (item: ClassItem) => {
    setEditingClass(item);
    setName(item.name);
    setDescription(item.description || '');
    setIsActive(item.is_active);
    setShowAddModal(true);
  };

  const handleToggleStatus = async (item: ClassItem) => {
    try {
      const { error } = await supabase
        .from('classes')
        .update({ is_active: !item.is_active })
        .eq('id', item.id);

      if (error) throw error;
      await loadClasses();
    } catch (err) {
      console.error('Toggle status failed:', err);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold tracking-widest uppercase mb-1">
            <Sparkles className="w-4 h-4" /> Academic Streams
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Class Management
          </h1>
        </div>
        <button
          onClick={() => {
            setEditingClass(null);
            setName('');
            setDescription('');
            setIsActive(true);
            setShowAddModal(true);
          }}
          className="btn-premium h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> Add New Class
        </button>
      </div>

      {/* Main Classes Grid */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin glow-indigo" />
        </div>
      ) : classes.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl text-center max-w-md mx-auto">
          <BookOpen className="w-12 h-12 text-indigo-400/40 mx-auto mb-4" />
          <h3 className="text-sm font-bold text-white mb-1">No Classes Registered</h3>
          <p className="text-xs text-slate-500 leading-relaxed mb-6">
            Register your institute's subjects, courses, or disciplines (e.g. Advanced Swimming, Intermediate Karate).
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-premium h-9 px-4 rounded-xl text-xs font-bold cursor-pointer"
          >
            Create Your First Class
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((item) => (
            <div
              key={item.id}
              className="glass-panel glass-panel-hover p-6 rounded-2xl flex flex-col justify-between min-h-[160px] group"
            >
              <div>
                <div className="flex justify-between items-start gap-2">
                  <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                    {item.name}
                  </h3>
                  <button
                    onClick={() => handleToggleStatus(item)}
                    className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border transition-all cursor-pointer
                    ${item.is_active 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                      : 'bg-slate-800 border-white/5 text-slate-500'}`}
                  >
                    {item.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-2.5 line-clamp-3 leading-relaxed">
                  {item.description || 'No description provided.'}
                </p>
              </div>

              <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-white/5">
                <button
                  onClick={() => handleEditClick(item)}
                  className="btn-secondary w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
                  title="Edit Class Details"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal: Add / Edit Class Form ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-6">
              {editingClass ? 'Edit Class Details' : 'Register New Class'}
            </h3>

            <form onSubmit={handleSaveClass} className="space-y-4">
              {/* Class Name */}
              <div className="space-y-1">
                <label className="text-slate-300 text-xs font-semibold block">Class Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Advanced Swimming Pool-A"
                  className="w-full h-10 px-4 rounded-xl glass-input text-xs"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-slate-300 text-xs font-semibold block">Description</label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summarize course content, levels, or guidelines..."
                  className="w-full p-3 rounded-xl glass-input text-xs"
                />
              </div>

              {/* Edit Mode Status Toggle */}
              {editingClass && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 accent-indigo-500 rounded border-white/10"
                  />
                  <label htmlFor="isActive" className="text-xs text-slate-300 font-medium">
                    This class is currently Active
                  </label>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary h-9 px-4 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-premium h-9 px-4 rounded-lg text-xs font-bold cursor-pointer"
                >
                  {editingClass ? 'Update Class' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
