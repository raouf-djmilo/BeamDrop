import React, { useState } from 'react';
import {
  Building2,
  Lock,
  Users,
  ShieldCheck,
  Zap,
  ArrowRight,
  ExternalLink,
  Laptop,
  Smartphone,
  CheckCircle2,
  Radio,
  Server
} from 'lucide-react';
import { workspaceEngine, WorkspaceNode } from '../utils/engine/workspace';
import { useTransfer } from '../context/TransferContext';

export const WorkspacesView: React.FC = () => {
  const { transferManager } = useTransfer();
  const [workspaceSlug, setWorkspaceSlug] = useState<string>('');
  const [workspacePin, setWorkspacePin] = useState<string>('');
  const [isWorkspaceActive, setIsWorkspaceActive] = useState<boolean>(false);
  const [workspaceNodes, setWorkspaceNodes] = useState<WorkspaceNode[]>([]);
  const [workspaceError, setWorkspaceError] = useState<string>('');

  const handleJoinWorkspace = async () => {
    if (!workspaceSlug.trim() || !workspacePin.trim()) return;
    setWorkspaceError('');

    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    const res = await workspaceEngine.announceInWorkspace(
      workspaceSlug.trim().toLowerCase(),
      workspacePin.trim(),
      {
        id: transferManager.myPeerId || 'node-' + Math.random().toString(36).slice(2, 7),
        name: isMobile ? 'Mobile Node' : 'Workstation Node',
        deviceType: isMobile ? 'phone' : 'laptop',
        icon: isMobile ? '📱' : '💻'
      }
    );

    if (res.success) {
      setIsWorkspaceActive(true);
      setWorkspaceNodes(res.nodes);
      workspaceEngine.startHeartbeat(
        workspaceSlug.trim().toLowerCase(),
        workspacePin.trim(),
        {
          id: transferManager.myPeerId || 'node-' + Math.random().toString(36).slice(2, 7),
          name: isMobile ? 'Mobile Node' : 'Workstation Node',
          deviceType: isMobile ? 'phone' : 'laptop',
          icon: isMobile ? '📱' : '💻'
        },
        (updatedNodes: WorkspaceNode[]) => setWorkspaceNodes(updatedNodes)
      );
    } else {
      setWorkspaceError(res.error || 'Failed to authenticate in workspace');
    }
  };

  const handleLeaveWorkspace = () => {
    workspaceEngine.stopHeartbeat();
    setIsWorkspaceActive(false);
    setWorkspaceNodes([]);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="liquid-glass-card rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 shrink-0">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-extrabold text-white">Team Workspace Mesh</h2>
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-mono font-bold">
                PRO PLAN
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-md leading-relaxed">
              Permanent virtual room for studios, agencies, and distributed teams. Connect colleagues across different Wi-Fi networks and remote offices.
            </p>
          </div>
        </div>

        {isWorkspaceActive && (
          <div className="flex items-center space-x-3">
            <div className="px-3.5 py-1.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>/w/{workspaceSlug}</span>
            </div>
            <button
              onClick={handleLeaveWorkspace}
              className="px-4 py-1.5 rounded-2xl bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Leave Room
            </button>
          </div>
        )}
      </div>

      {!isWorkspaceActive ? (
        <div className="liquid-glass-card rounded-3xl p-6 sm:p-8 space-y-5 max-w-lg mx-auto text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Lock className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-base font-bold text-white">Enter Team Workspace</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Enter your organization slug and 4-6 digit security PIN
            </p>
          </div>

          <div className="space-y-3 text-left">
            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">
                Workspace Slug:
              </label>
              <input
                type="text"
                placeholder="e.g. creatives, design-agency"
                value={workspaceSlug}
                onChange={(e) => setWorkspaceSlug(e.target.value)}
                className="w-full bg-slate-950/70 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 block mb-1">
                Security PIN (4-6 Digits):
              </label>
              <input
                type="password"
                placeholder="••••"
                maxLength={6}
                value={workspacePin}
                onChange={(e) => setWorkspacePin(e.target.value)}
                className="w-full bg-slate-950/70 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {workspaceError && (
              <p className="text-xs text-rose-400 font-mono text-center pt-1">{workspaceError}</p>
            )}

            <button
              onClick={handleJoinWorkspace}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 text-white font-bold text-xs shadow-xl shadow-indigo-500/25 transition-all cursor-pointer mt-2"
            >
              Authenticate & Join Mesh
            </button>
          </div>
        </div>
      ) : (
        <div className="liquid-glass-card rounded-3xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <span className="text-xs font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Active Colleague Nodes ({workspaceNodes.length})</span>
            </span>
            <span className="text-[10px] font-mono text-emerald-400">
              ● Live Multi-Mesh Synced
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {workspaceNodes.map((node) => (
              <div
                key={node.id}
                className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-xl">{node.icon || '💻'}</span>
                  <div>
                    <p className="text-xs font-bold text-white">{node.name}</p>
                    <p className="text-[10px] font-mono text-slate-400">ID: {node.id.slice(0, 10)}</p>
                  </div>
                </div>

                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
