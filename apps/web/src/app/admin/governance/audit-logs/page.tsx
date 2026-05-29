'use client';

import { useCallback, useEffect, useState } from 'react';
import { History, Search, Filter, Clock, User, ChevronLeft, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  description: string;
  ip_address: string | null;
  created_at: string;
  users?: { first_name: string; last_name: string; email: string; role: string } | null;
}

const SEVERITY = (action: string): { color: string; bg: string } => {
  if (action.includes('delete') || action.includes('deactivat')) return { color: 'bg-red-400',     bg: 'bg-red-400/10' };
  if (action.includes('create') || action.includes('add'))      return { color: 'bg-emerald-400', bg: 'bg-emerald-400/10' };
  if (action.includes('edit')   || action.includes('update') || action.includes('manage')) return { color: 'bg-amber-400', bg: 'bg-amber-400/10' };
  return { color: 'bg-indigo-400', bg: 'bg-indigo-400/10' };
};

const MODULES = ['students','coaches','attendance','payments','reports','users','roles','portal','audit_logs'];

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const limit = 20;

  const loadLogs = useCallback(async (p: number, mod: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(limit) });
      if (mod) params.set('module', mod);
      const res = await fetch(`/api/v1/governance/audit-logs?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setLogs(json.data.logs);
      setTotal(json.data.total);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLogs(page, moduleFilter); }, [page, moduleFilter]);

  const filtered = logs.filter(l =>
    l.description.toLowerCase().includes(search.toLowerCase()) ||
    l.action.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(total / limit);

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-full text-indigo-400 text-[10px] font-bold tracking-wider uppercase mb-3 w-fit">
          <History className="w-3.5 h-3.5" /> Audit Trail
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">Audit Logs</h1>
        <p className="text-xs text-slate-400 mt-1">Complete chronological record of all administrative actions</p>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />{errorMsg}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search actions or descriptions..."
            className="w-full h-9 pl-9 pr-4 rounded-xl glass-input text-xs" />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
          <select value={moduleFilter} onChange={e => { setModuleFilter(e.target.value); setPage(1); }}
            className="h-9 pl-8 pr-4 rounded-xl glass-input text-xs font-bold appearance-none cursor-pointer min-w-[140px]">
            <option value="">All Modules</option>
            {MODULES.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
          </select>
        </div>
        <span className="h-9 px-3 rounded-xl border border-white/10 bg-white/5 text-slate-400 text-xs font-semibold flex items-center">
          {total} events
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel rounded-3xl border border-white/5 p-16 text-center">
          <History className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          <p className="text-sm text-slate-400">No audit events found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => {
            const sev = SEVERITY(log.action);
            const actor = log.users ? `${log.users.first_name} ${log.users.last_name}` : 'System';
            const [mod, act] = log.action.split('.');
            return (
              <div key={log.id} className="glass-panel rounded-2xl border border-white/5 flex overflow-hidden hover:border-white/10 transition-all">
                {/* Severity bar */}
                <div className={`w-1 shrink-0 ${sev.color}`} />
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border border-current/20 uppercase tracking-wider ${sev.bg} ${
                          sev.color === 'bg-red-400' ? 'text-red-400' :
                          sev.color === 'bg-emerald-400' ? 'text-emerald-400' :
                          sev.color === 'bg-amber-400' ? 'text-amber-400' : 'text-indigo-400'
                        }`}>{act ?? log.action}</span>
                        <span className="text-[9px] text-slate-500 font-mono bg-white/5 px-2 py-0.5 rounded-full">{mod}</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{log.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1">
                        <User className="w-3 h-3" />
                        <span className="font-semibold">{actor}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <Clock className="w-3 h-3" />{formatTime(log.created_at)}
                      </div>
                      {log.ip_address && (
                        <p className="text-[9px] text-slate-600 font-mono mt-0.5">{log.ip_address}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer disabled:opacity-40">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-400">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer disabled:opacity-40">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
