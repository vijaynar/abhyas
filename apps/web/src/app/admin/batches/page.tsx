'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { Calendar, Check, Edit2, Plus, Sparkles, X } from 'lucide-react';

interface BatchItem {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  max_capacity: number;
  is_active: boolean;
  class_id: string;
  classes: {
    name: string;
  };
}

interface ClassOption {
  id: string;
  name: string;
}

export default function BatchesPage() {
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [classesList, setClassesList] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<BatchItem | null>(null);

  // Form states
  const [classId, setClassId] = useState('');
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [maxCapacity, setMaxCapacity] = useState('30');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [isActive, setIsActive] = useState(true);

  const supabase = createBrowserClient();

  const weekdayNames: Record<number, string> = {
    1: 'Mon',
    2: 'Tue',
    3: 'Wed',
    4: 'Thu',
    5: 'Fri',
    6: 'Sat',
    7: 'Sun',
  };

  const loadBatchesAndClasses = async () => {
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
      const tenantId = profile.tenant_id;

      // 1. Load Batches
      const { data: batchData, error: batchErr } = await supabase
        .from('batches')
        .select('id, name, start_time, end_time, days_of_week, max_capacity, is_active, class_id, classes:class_id(name)')
        .eq('tenant_id', tenantId)
        .order('start_time');

      if (batchErr) throw batchErr;

      // 2. Load Classes for dropdown selection
      const { data: classData } = await supabase
        .from('classes')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name');

      setBatches((batchData || []) as unknown as BatchItem[]);
      setClassesList(classData || []);
    } catch (err) {
      console.error('Failed to load scheduling data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatchesAndClasses();
  }, []);

  const handleDayToggle = (day: number) => {
    if (daysOfWeek.includes(day)) {
      setDaysOfWeek(daysOfWeek.filter((d) => d !== day));
    } else {
      setDaysOfWeek([...daysOfWeek, day].sort());
    }
  };

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId || !name.trim() || daysOfWeek.length === 0) {
      alert('Please complete all scheduling fields.');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile) return;

      // Format time as HH:MM:SS for postgres TIME format
      const formattedStart = startTime.length === 5 ? `${startTime}:00` : startTime;
      const formattedEnd = endTime.length === 5 ? `${endTime}:00` : endTime;

      if (editingBatch) {
        // Edit Mode
        const { error } = await supabase
          .from('batches')
          .update({
            name,
            start_time: formattedStart,
            end_time: formattedEnd,
            days_of_week: daysOfWeek,
            max_capacity: parseInt(maxCapacity) || 30,
            is_active: isActive,
          })
          .eq('id', editingBatch.id);

        if (error) throw error;
      } else {
        // Add Mode
        const { error } = await supabase
          .from('batches')
          .insert({
            tenant_id: profile.tenant_id,
            class_id: classId,
            name,
            start_time: formattedStart,
            end_time: formattedEnd,
            days_of_week: daysOfWeek,
            max_capacity: parseInt(maxCapacity) || 30,
            is_active: true,
          });

        if (error) throw error;
      }

      setClassId('');
      setName('');
      setStartTime('09:00');
      setEndTime('10:00');
      setMaxCapacity('30');
      setDaysOfWeek([]);
      setIsActive(true);
      setShowAddModal(false);
      setEditingBatch(null);
      await loadBatchesAndClasses();
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save batch slot.');
    }
  };

  const handleEditClick = (item: BatchItem) => {
    setEditingBatch(item);
    setClassId(item.class_id);
    setName(item.name);
    // Strip trailing seconds for html time input ("09:00:00" -> "09:00")
    setStartTime(item.start_time.slice(0, 5));
    setEndTime(item.end_time.slice(0, 5));
    setMaxCapacity(item.max_capacity.toString());
    setDaysOfWeek(item.days_of_week);
    setIsActive(item.is_active);
    setShowAddModal(true);
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold tracking-widest uppercase mb-1">
            <Sparkles className="w-4 h-4" /> Weekly Slots
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Batch Schedule Control
          </h1>
        </div>
        <button
          onClick={() => {
            setEditingBatch(null);
            setClassId('');
            setName('');
            setStartTime('09:00');
            setEndTime('10:00');
            setMaxCapacity('30');
            setDaysOfWeek([]);
            setIsActive(true);
            setShowAddModal(true);
          }}
          className="btn-premium h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <Plus className="w-4 h-4" /> Add New Batch
        </button>
      </div>

      {/* Main Table Container */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin glow-indigo" />
        </div>
      ) : batches.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl text-center max-w-md mx-auto">
          <Calendar className="w-12 h-12 text-indigo-400/40 mx-auto mb-4" />
          <h3 className="text-sm font-bold text-white mb-1">No Active Batches</h3>
          <p className="text-xs text-slate-500 leading-relaxed mb-6">
            Assign custom class schedules, active check-in windows, and set capacity thresholds for students.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-premium h-9 px-4 rounded-xl text-xs font-bold cursor-pointer"
          >
            Create Your First Batch
          </button>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl overflow-hidden border border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-xs font-bold text-slate-300">
                  <th className="p-4">Batch Name</th>
                  <th className="p-4">Linked Course / Class</th>
                  <th className="p-4">Scheduled Hours</th>
                  <th className="p-4">Active Days</th>
                  <th className="p-4">Capacity</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-white/5 text-slate-300">
                {batches.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="p-4 font-bold text-slate-200">{item.name}</td>
                    <td className="p-4">{item.classes.name}</td>
                    <td className="p-4 text-slate-400 font-medium">
                      {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {item.days_of_week.map((day) => (
                          <span
                            key={day}
                            className="px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-bold text-indigo-400"
                          >
                            {weekdayNames[day]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4">{item.max_capacity} students</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase border
                        ${item.is_active 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                          : 'bg-slate-800 border-white/5 text-slate-500'}`}
                      >
                        {item.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleEditClick(item)}
                        className="btn-secondary h-7 px-2.5 rounded-lg text-[10px] font-bold cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3 mr-1 inline-block" /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal: Create / Update Batch Scheduling ── */}
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
              {editingBatch ? 'Modify Batch Details' : 'Configure New Batch Slot'}
            </h3>

            <form onSubmit={handleSaveBatch} className="space-y-4">
              {/* Class Link Dropdown */}
              <div className="space-y-1">
                <label className="text-slate-300 text-xs font-semibold block">Link to Academic Class</label>
                <select
                  required
                  disabled={editingBatch !== null}
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl glass-input text-xs"
                >
                  <option value="" className="bg-[#0f172a]">-- Select Class / Course --</option>
                  {classesList.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#0f172a]">{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Batch Name */}
              <div className="space-y-1">
                <label className="text-slate-300 text-xs font-semibold block">Batch Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Morning 06:00 AM Slot"
                  className="w-full h-10 px-4 rounded-xl glass-input text-xs"
                />
              </div>

              {/* Times Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-300 text-xs font-semibold block">Start Time</label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full h-10 px-4 rounded-xl glass-input text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-300 text-xs font-semibold block">End Time</label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full h-10 px-4 rounded-xl glass-input text-xs"
                  />
                </div>
              </div>

              {/* Capacity Limit */}
              <div className="space-y-1">
                <label className="text-slate-300 text-xs font-semibold block">Max Capacity</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={maxCapacity}
                  onChange={(e) => setMaxCapacity(e.target.value)}
                  placeholder="30"
                  className="w-full h-10 px-4 rounded-xl glass-input text-xs"
                />
              </div>

              {/* Days of Week Multiple Selector */}
              <div className="space-y-2">
                <label className="text-slate-300 text-xs font-semibold block">Scheduled Days</label>
                <div className="flex gap-1.5 justify-between">
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                    const selected = daysOfWeek.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleDayToggle(day)}
                        className={`flex-1 h-9 rounded-lg border text-[10px] font-bold transition-all cursor-pointer
                        ${selected 
                          ? 'bg-indigo-600 border-indigo-500 text-white glow-indigo' 
                          : 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/5'}`}
                      >
                        {weekdayNames[day]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Edit Mode Status Checkbox */}
              {editingBatch && (
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="isBatchActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 accent-indigo-500 rounded border-white/10"
                  />
                  <label htmlFor="isBatchActive" className="text-xs text-slate-300 font-medium">
                    This scheduling slot is currently Active
                  </label>
                </div>
              )}

              {/* Form Actions */}
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
                  {editingBatch ? 'Update Schedule' : 'Schedule Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
