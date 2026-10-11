import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  X,
  Smartphone,
  Laptop,
  Monitor,
  Trash2,
  Check,
  Plus,
  RefreshCw,
  Sparkles,
  Zap,
  Clipboard,
  Edit2,
  AlertCircle
} from 'lucide-react';
import {
  TrustedDevice,
  DevicePlatform,
  getTrustedDevices,
  saveTrustedDevice,
  revokeTrustedDevice,
  updateDeviceSettings,
  listenToTrustedDevices,
  detectPlatformFromUserAgent
} from '../utils/engine/trustedDevices';
import { useTransfer } from '../context/TransferContext';

interface TrustedDevicesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TrustedDevicesModal: React.FC<TrustedDevicesModalProps> = ({
  isOpen,
  onClose
}) => {
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newPeerId, setNewPeerId] = useState<string>('');
  const [newDeviceName, setNewDeviceName] = useState<string>('');
  const [newPlatform, setNewPlatform] = useState<DevicePlatform>('ios');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const { transferManager } = useTransfer();

  useEffect(() => {
    if (!isOpen) return;
    const unsub = listenToTrustedDevices(setDevices);
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddCurrentConnected = async () => {
    if (!transferManager.targetPeerId) return;
    const detected = detectPlatformFromUserAgent();
    const newDev: TrustedDevice = {
      id: transferManager.targetPeerId,
      name: transferManager.targetDeviceName || 'Connected Device',
      platform: detected,
      fingerprint: transferManager.sessionRawKeyHex ? transferManager.sessionRawKeyHex.slice(0, 16).toUpperCase() : undefined,
      autoAcceptFiles: true,
      allowClipboardSync: true,
      trustedAt: Date.now(),
      lastSeen: Date.now()
    };
    await saveTrustedDevice(newDev);
    setShowAddForm(false);
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPeerId.trim()) return;
    const newDev: TrustedDevice = {
      id: newPeerId.trim(),
      name: newDeviceName.trim() || `Device (${newPeerId.trim().slice(0, 8)})`,
      platform: newPlatform,
      autoAcceptFiles: true,
      allowClipboardSync: true,
      trustedAt: Date.now(),
      lastSeen: Date.now()
    };
    await saveTrustedDevice(newDev);
    setNewPeerId('');
    setNewDeviceName('');
    setShowAddForm(false);
  };

  const handleSaveRename = async (id: string) => {
    if (!editingName.trim()) return;
    await updateDeviceSettings(id, { name: editingName.trim() });
    setEditingId(null);
  };

  const getPlatformIcon = (platform: DevicePlatform) => {
    switch (platform) {
      case 'ios':
      case 'android':
        return <Smartphone className="w-5 h-5 text-sky-400" />;
      case 'macos':
      case 'windows':
      case 'linux':
        return <Laptop className="w-5 h-5 text-blue-400" />;
      default:
        return <Monitor className="w-5 h-5 text-indigo-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-sky-500/30 rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-5 border-b border-sky-500/20 flex items-center justify-between bg-gradient-to-r from-sky-950/40 via-slate-900 to-indigo-950/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">Trusted Devices Whitelist</h3>
                <span className="text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30 px-2 py-0.5 rounded-full">
                  AIRDROP STYLE
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Zero-Click Auto-Accept & Universal Continuous Clipboard Sync
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Quick Info Banner */}
          <div className="bg-sky-500/10 border border-sky-500/20 rounded-2xl p-3.5 flex items-start space-x-3 text-xs text-sky-200 leading-relaxed">
            <Zap className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <span>
              Transfers from whitelisted devices bypass the manual confirmation prompt and save directly to your downloads gallery, just like AirDrop between personal devices.
            </span>
          </div>

          {/* Currently Connected Peer Quick-Trust Banner */}
          {transferManager.targetPeerId && !devices.some((d) => d.id === transferManager.targetPeerId) && (
            <div className="bg-gradient-to-r from-emerald-950/40 to-teal-950/30 border border-emerald-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-2.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <div className="truncate">
                  <span className="text-emerald-300 font-bold block">Connected Device Detected</span>
                  <span className="text-slate-400 font-mono text-[11px] truncate block">
                    {transferManager.targetDeviceName || transferManager.targetPeerId}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddCurrentConnected}
                className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center space-x-1 transition-all shrink-0 cursor-pointer shadow-md shadow-emerald-500/20"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Trust Device</span>
              </button>
            </div>
          )}

          {/* Whitelisted Devices List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
              <span>Whitelisted Devices ({devices.length})</span>
              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                className="text-sky-400 hover:text-sky-300 flex items-center space-x-1 cursor-pointer font-normal normal-case"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Device Manually</span>
              </button>
            </div>

            {/* Manual Add Form */}
            {showAddForm && (
              <form onSubmit={handleManualAdd} className="bg-slate-950/60 border border-sky-500/30 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-white">Whitelist New Device</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Device Name</label>
                    <input
                      type="text"
                      placeholder="e.g. My iPad Air"
                      value={newDeviceName}
                      onChange={(e) => setNewDeviceName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-hidden focus:border-sky-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Platform</label>
                    <select
                      value={newPlatform}
                      onChange={(e) => setNewPlatform(e.target.value as DevicePlatform)}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-hidden focus:border-sky-400"
                    >
                      <option value="ios">Apple iOS / iPadOS</option>
                      <option value="android">Android Phone / Tablet</option>
                      <option value="macos">macOS Laptop / Desktop</option>
                      <option value="windows">Windows PC</option>
                      <option value="linux">Linux Workstation</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Peer ID or QR Address</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. beam-7a2b9f"
                    value={newPeerId}
                    onChange={(e) => setNewPeerId(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 font-mono text-xs text-white focus:outline-hidden focus:border-sky-400"
                  />
                </div>
                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs cursor-pointer shadow-md"
                  >
                    Add to Whitelist
                  </button>
                </div>
              </form>
            )}

            {devices.length === 0 ? (
              <div className="p-8 rounded-2xl border border-dashed border-slate-800 text-center space-y-2 bg-slate-950/30">
                <ShieldCheck className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400 font-semibold">No Trusted Devices Yet</p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto leading-normal">
                  Connect any phone or computer using BeamDrop QR, then tap <strong>&ldquo;Trust Device&rdquo;</strong> to enable zero-click auto-accept.
                </p>
              </div>
            ) : (
              devices.map((device) => {
                const isOnline = transferManager.targetPeerId === device.id;
                return (
                  <div
                    key={device.id}
                    className="bg-slate-950/80 border border-slate-800 hover:border-sky-500/30 rounded-2xl p-4 space-y-3 transition-colors shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                          {getPlatformIcon(device.platform)}
                        </div>
                        <div className="min-w-0">
                          {editingId === device.id ? (
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="px-2 py-0.5 rounded bg-slate-900 border border-sky-400 text-xs text-white"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveRename(device.id)}
                                className="p-1 text-emerald-400 hover:text-emerald-300"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <h4 className="font-bold text-white text-xs sm:text-sm truncate">
                                {device.name}
                              </h4>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(device.id);
                                  setEditingName(device.name);
                                }}
                                className="text-slate-400 hover:text-slate-300 p-0.5"
                                title="Rename"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          <div className="flex items-center space-x-2 text-[11px] text-slate-400 mt-0.5 font-mono">
                            <span className="uppercase">{device.platform}</span>
                            <span>•</span>
                            <span className="truncate max-w-[120px] sm:max-w-[180px]">{device.id}</span>
                            {isOnline && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-400 font-bold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                  <span>Active Link</span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => revokeTrustedDevice(device.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Revoke trust"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Permissions Toggles */}
                    <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {/* Auto Accept Switch */}
                      <label className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800/60 cursor-pointer hover:border-sky-500/20 transition-colors">
                        <div className="flex items-center space-x-2">
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-slate-300 font-medium text-[11px]">Auto-Accept Files</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={device.autoAcceptFiles}
                          onChange={(e) =>
                            updateDeviceSettings(device.id, { autoAcceptFiles: e.target.checked })
                          }
                          className="w-4 h-4 rounded text-sky-500 accent-sky-500 cursor-pointer"
                        />
                      </label>

                      {/* Universal Clipboard Mirror Switch */}
                      <label className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800/60 cursor-pointer hover:border-sky-500/20 transition-colors">
                        <div className="flex items-center space-x-2">
                          <Clipboard className="w-3.5 h-3.5 text-sky-400" />
                          <span className="text-slate-300 font-medium text-[11px]">Clipboard Sync</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={device.allowClipboardSync}
                          onChange={(e) =>
                            updateDeviceSettings(device.id, { allowClipboardSync: e.target.checked })
                          }
                          className="w-4 h-4 rounded text-sky-500 accent-sky-500 cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2 font-mono text-[11px]">
            <span className="text-slate-400">My Device:</span>
            <span className="text-sky-300 font-bold truncate max-w-[150px]">
              {transferManager.myPeerId || 'Initializing...'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs cursor-pointer transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
