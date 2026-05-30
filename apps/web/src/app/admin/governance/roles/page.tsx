'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Shield, ShieldCheck, Users, CheckCircle2, XCircle,
  Plus, Save, Lock, X, Loader2, AlertCircle
} from 'lucide-react';

interface Permission {
  id: string;
  module: string;
  action: string;
}

interface Role {
  id: string;
  name: string;
  is_system: boolean;
  tenant_id: string | null;
  userCount: number;
}

interface RolePermission {
  role_id: string;
  permission_id: string;
}

const MODULES = [
  { key: 'students',   label: 'Students'   },
  { key: 'coaches',    label: 'Coaches'     },
  { key: 'classes',    label: 'Classes'     },
  { key: 'batches',    label: 'Batches'     },
  { key: 'attendance', label: 'Attendance'  },
  { key: 'payments',   label: 'Payments'    },
  { key: 'reports',    label: 'Reports'     },
  { key: 'users',      label: 'Users'       },
  { key: 'portal',     label: 'Portal'      },
  { key: 'roles',      label: 'Roles'       },
  { key: 'audit_logs', label: 'Audit Logs'  },
];

const ACTIONS = [
  { key: 'view',    label: 'View'    },
  { key: 'create',  label: 'Create'  },
  { key: 'edit',    label: 'Edit'    },
  { key: 'delete',  label: 'Delete'  },
  { key: 'manage',  label: 'Manage'  },
  { key: 'mark',    label: 'Mark'    },
  { key: 'viewOwn', label: 'View Own'},
];

const ROLE_COLORS: Record<string, string> = {
  'Super Admin': 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  'Admin':       'text-indigo-400 border-indigo-500/30 bg-indigo-500/10',
  'Coach':       'text-purple-400 border-purple-500/30 bg-purple-500/10',
  'Student':     'text-slate-400 border-slate-500/30 bg-slate-500/10',
};

export default function RolesPermissionsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePerms, setRolePerms] = useState<RolePermission[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [localPerms, setLocalPerms] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/governance/roles');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setRoles(json.data.roles);
      setPermissions(json.data.permissions);
      setRolePerms(json.data.rolePermissions);
      if (json.data.roles.length > 0 && !selectedRoleId) {
        setSelectedRoleId(json.data.roles[0].id);
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedRoleId]);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!selectedRoleId) return;
    const permsForRole = new Set(
      rolePerms
        .filter(rp => rp.role_id === selectedRoleId)
        .map(rp => rp.permission_id)
    );
    setLocalPerms(permsForRole);
    setDirty(false);
  }, [selectedRoleId, rolePerms]);

  const selectedRole = roles.find(r => r.id === selectedRoleId);
  const isSuperAdmin = selectedRole?.name === 'Super Admin';

  const permId = (module: string, action: string) =>
    permissions.find(p => p.module === module && p.action === action)?.id;

  const isActive = (module: string, action: string) => {
    const id = permId(module, action);
    return id ? localPerms.has(id) : false;
  };

  const toggle = (module: string, action: string) => {
    if (isSuperAdmin) return;
    const id = permId(module, action);
    if (!id) return;
    setLocalPerms(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setDirty(true);
  };

  const saveChanges = async () => {
    if (!selectedRoleId) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      const permKeys = permissions
        .filter(p => localPerms.has(p.id))
        .map(p => `${p.module}.${p.action}`);
      const res = await fetch('/api/v1/governance/roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId: selectedRoleId, assignedPermissions: permKeys }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setDirty(false);
      setSuccessMsg('Permissions saved successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
      await loadData();
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setSaving(false);
    }
  };

  const createRole = async () => {
    if (!newRoleName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/v1/governance/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRoleName.trim(), assignedPermissions: [] }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setShowCreateModal(false);
      setNewRoleName('');
      await loadData();
      setSelectedRoleId(json.data.role.id);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-full text-indigo-400 text-[10px] font-bold tracking-wider uppercase mb-3 w-fit">
            <Shield className="w-3.5 h-3.5" /> Access Governance
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Roles & Permissions</h1>
          <p className="text-xs text-slate-400 mt-1">Configure granular access control policies for each role</p>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />{errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />{successMsg}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        </div>
      ) : (
        <div className="flex gap-5">
          {/* Left: Roles Ledger */}
          <div className="w-56 shrink-0 space-y-2">
            <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest px-1 mb-3">Active Roles</p>
            {roles.map(role => {
              const active = role.id === selectedRoleId;
              const colorClass = ROLE_COLORS[role.name] ?? 'text-slate-400 border-slate-500/30 bg-slate-500/10';
              return (
                <button
                  key={role.id}
                  onClick={() => setSelectedRoleId(role.id)}
                  className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer ${
                    active
                      ? 'bg-indigo-600/20 border-indigo-500/50 shadow-lg shadow-indigo-900/20'
                      : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${active ? 'text-white' : 'text-slate-300'}`}>{role.name}</span>
                    {role.is_system && <Lock className="w-3 h-3 text-slate-500" />}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border ${colorClass}`}>
                      {role.is_system ? 'System' : 'Custom'}
                    </span>
                    <span className="text-[9px] text-slate-500">{role.userCount} users</span>
                  </div>
                </button>
              );
            })}
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full h-9 rounded-xl border border-dashed border-indigo-500/30 text-indigo-400 hover:border-indigo-500/60 hover:bg-indigo-500/5 transition-all text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer mt-3"
            >
              <Plus className="w-3.5 h-3.5" /> Create Role
            </button>
          </div>

          {/* Right: Permission Matrix */}
          <div className="flex-1 glass-panel rounded-3xl border border-white/5 overflow-hidden">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  {selectedRole?.name ?? 'Select a role'}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {isSuperAdmin ? 'All permissions are permanently granted — cannot be modified' : 'Click cells to toggle permissions'}
                </p>
              </div>
              {dirty && !isSuperAdmin && (
                <button
                  onClick={saveChanges}
                  disabled={saving}
                  className="h-9 px-4 rounded-xl btn-premium text-white font-bold text-xs flex items-center gap-2 cursor-pointer glow-indigo"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Changes
                </button>
              )}
            </div>

            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02]">
                    <th className="py-3 px-5 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider w-36">Module</th>
                    {ACTIONS.map(a => (
                      <th key={a.key} className="py-3 px-4 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider text-center">{a.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map((mod, idx) => (
                    <tr key={mod.key} className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${
                      idx % 2 === 0 ? '' : 'bg-white/[0.01]'
                    }`}>
                      <td className="py-3.5 px-5">
                        <span className="text-xs font-semibold text-slate-300">{mod.label}</span>
                      </td>
                      {ACTIONS.map(act => {
                        const exists = !!permId(mod.key, act.key);
                        if (!exists) {
                          return <td key={act.key} className="py-3.5 px-4 text-center"><span className="text-slate-800 text-xs">—</span></td>;
                        }
                        const active = isActive(mod.key, act.key);
                        return (
                          <td key={act.key} className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => toggle(mod.key, act.key)}
                              disabled={isSuperAdmin}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto transition-all ${
                                isSuperAdmin ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:scale-110'
                              }`}
                              title={isSuperAdmin ? 'Super Admin — always granted' : (active ? 'Click to revoke' : 'Click to grant')}
                            >
                              {active
                                ? <CheckCircle2 className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                                : <XCircle className="w-5 h-5 text-slate-600 hover:text-red-400/60 transition-colors" />
                              }
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create Role Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel rounded-3xl border border-white/10 p-6 w-full max-w-sm shadow-2xl mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-white">Create Custom Role</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <label className="text-slate-400 text-[10px] font-extrabold uppercase tracking-wide block mb-1.5">Role Name</label>
            <input
              type="text"
              value={newRoleName}
              onChange={e => setNewRoleName(e.target.value)}
              placeholder="e.g. Receptionist"
              className="w-full h-10 px-4 rounded-xl glass-input text-xs font-bold mb-4"
              onKeyDown={e => e.key === 'Enter' && createRole()}
            />
            <div className="flex gap-3">
              <button onClick={() => setShowCreateModal(false)} className="flex-1 h-9 rounded-xl border border-white/10 text-slate-400 text-xs font-bold cursor-pointer hover:bg-white/5 transition-all">Cancel</button>
              <button onClick={createRole} disabled={creating || !newRoleName.trim()} className="flex-1 h-9 rounded-xl btn-premium text-white text-xs font-bold cursor-pointer glow-indigo flex items-center justify-center gap-1.5">
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
