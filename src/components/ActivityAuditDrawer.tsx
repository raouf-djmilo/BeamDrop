import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  X,
  Search,
  Download,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  Lock,
  Copy,
  Check,
  RefreshCw,
  FileCheck,
  FileSpreadsheet,
  FileText,
  ExternalLink,
  Filter,
  Layers,
  Sparkles
} from 'lucide-react';
import {
  AuditLedgerEntry,
  getAuditHistory,
  deleteAuditEntry,
  clearAuditHistory,
  exportLedgerJson,
  exportLedgerCsv,
  computeSha256
} from '../utils/engine/auditLedger';
import { formatBytes, formatSpeed } from '../utils/formatters';

interface ActivityAuditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActivityAuditDrawer: React.FC<ActivityAuditDrawerProps> = ({
  isOpen,
  onClose
}) => {
  const [entries, setEntries] = useState<AuditLedgerEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterTab, setFilterTab] = useState<'all' | 'verified' | 'sent' | 'received'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isVerifyingFile, setIsVerifyingFile] = useState<boolean>(false);
  const [verifiedFileResult, setVerifiedFileResult] = useState<{
    fileName: string;
    computedHash: string;
    matchedEntry: AuditLedgerEntry | null;
  } | null>(null);

  const loadHistory = async () => {
    const list = await getAuditHistory();
    setEntries(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filtered entries
  const filtered = entries.filter((e) => {
    const matchesSearch =
      e.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.peerId && e.peerId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (e.senderChecksum && e.senderChecksum.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterTab === 'verified') return e.status === 'VERIFIED';
    if (filterTab === 'sent') return e.direction === 'sent';
    if (filterTab === 'received') return e.direction === 'received';
    return true;
  });

  // Aggregate stats
  const totalBytesTransferred = entries.reduce((acc, e) => acc + (e.fileSize || 0), 0);
  const verifiedCount = entries.filter((e) => e.status === 'VERIFIED').length;
  const matchRate = entries.length > 0 ? Math.round((verifiedCount / entries.length) * 100) : 100;

  const handleCopyHash = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: string) => {
    await deleteAuditEntry(id);
    await loadHistory();
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to clear the entire transfer activity audit ledger?')) {
      await clearAuditHistory();
      setEntries([]);
      setVerifiedFileResult(null);
    }
  };

  const handleExportJson = async () => {
    const jsonStr = await exportLedgerJson();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beamdrop-audit-ledger-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = async () => {
    const csvStr = await exportLedgerCsv();
    const blob = new Blob([csvStr], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `beamdrop-audit-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // One-click Re-Verification of an arbitrary file against the ledger
  const handleVerifyLocalFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsVerifyingFile(true);
    setVerifiedFileResult(null);

    try {
      const hash = await computeSha256(file);
      const matched = entries.find(
        (ent) => ent.senderChecksum === hash || ent.receiverChecksum === hash
      ) || null;

      setVerifiedFileResult({
        fileName: file.name,
        computedHash: hash,
        matchedEntry: matched
      });
    } catch (err) {
      console.warn('File verification notice:', err);
    } finally {
      setIsVerifyingFile(false);
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-md flex justify-end animate-fade-in">
      <div className="w-full max-w-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl h-full shadow-2xl flex flex-col border-l border-sky-200 dark:border-sky-900/50">
        {/* Drawer Header */}
        <div className="p-5 border-b border-sky-100 dark:border-slate-800 flex items-center justify-between bg-sky-50/50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-lg shadow-sky-600/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Transfer Activity &amp; Audit Ledger
                </h2>
                <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 px-2 py-0.5 rounded-full">
                  SHA-256 E2EE
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cryptographic integrity ledger with zero-knowledge session proofs
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Summary Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 border-b border-sky-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
          <div className="p-2.5 rounded-xl bg-sky-50/70 dark:bg-slate-800/60 border border-sky-200/70 dark:border-slate-700">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Total Audits</p>
            <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{entries.length}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50">
            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">Match Rate</p>
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">{matchRate}% Verified</p>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/50">
            <p className="text-[10px] text-indigo-700 dark:text-indigo-400 font-medium">Data Streamed</p>
            <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300 mt-0.5">{formatBytes(totalBytesTransferred)}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50">
            <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">Cipher Suite</p>
            <p className="text-sm font-bold text-amber-800 dark:text-amber-300 mt-0.5 font-mono text-[11px]">AES-256-GCM</p>
          </div>
        </div>

        {/* Interactive File Re-Verification Tool */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/40 border-b border-sky-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <FileCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Audit Inspector:
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Verify any file against ledger
              </span>
            </div>

            <label className="px-3 py-1 rounded-xl bg-white dark:bg-slate-700 border border-sky-300 dark:border-slate-600 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-slate-600 text-xs font-semibold shadow-xs cursor-pointer flex items-center space-x-1.5 transition-all">
              <Search className="w-3.5 h-3.5" />
              <span>{isVerifyingFile ? 'Computing SHA-256...' : 'Select File to Check'}</span>
              <input
                type="file"
                className="hidden"
                onChange={handleVerifyLocalFile}
                disabled={isVerifyingFile}
              />
            </label>
          </div>

          {verifiedFileResult && (
            <div
              className={`mt-2.5 p-3 rounded-xl border text-xs animate-fade-in ${
                verifiedFileResult.matchedEntry
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
                  : 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {verifiedFileResult.matchedEntry ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <span className="font-bold truncate max-w-xs">{verifiedFileResult.fileName}</span>
                </div>
                <span className="font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-white/80 dark:bg-slate-900/80 border border-current">
                  {verifiedFileResult.matchedEntry ? 'VERIFIED MATCH' : 'NO RECORD IN LEDGER'}
                </span>
              </div>
              <p className="mt-1 font-mono text-[10px] text-slate-600 dark:text-slate-400 truncate">
                SHA-256: {verifiedFileResult.computedHash}
              </p>
              {verifiedFileResult.matchedEntry && (
                <p className="mt-0.5 text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold">
                  Matched transfer record from {new Date(verifiedFileResult.matchedEntry.timestamp).toLocaleString()} ({verifiedFileResult.matchedEntry.transitProtocol})
                </p>
              )}
            </div>
          )}
        </div>

        {/* Filter Controls & Search */}
        <div className="p-4 border-b border-sky-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by file name, peer, or hash..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
            {(['all', 'verified', 'sent', 'received'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilterTab(tab)}
                className={`px-2.5 py-1 rounded-lg font-semibold capitalize transition-all cursor-pointer ${
                  filterTab === tab
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Audit Entries List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-sky-50 dark:bg-slate-800 border border-sky-200 dark:border-slate-700 flex items-center justify-center text-sky-600 dark:text-sky-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No Transfer Audits Found</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Completed P2P transfers are cryptographically audited and recorded here with bit-exact SHA-256 hashes.
              </p>
            </div>
          ) : (
            filtered.map((entry) => (
              <div
                key={entry.id}
                className="bg-white dark:bg-slate-800/80 border border-sky-100 dark:border-slate-700 rounded-2xl p-4 shadow-xs hover:border-sky-300 dark:hover:border-slate-600 transition-all space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start space-x-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border shadow-xs ${
                        entry.direction === 'sent'
                          ? 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800'
                          : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                      }`}
                    >
                      {entry.direction === 'sent' ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownLeft className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {entry.fileName}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        <span>{formatBytes(entry.fileSize)}</span>
                        <span>•</span>
                        <span>{entry.transitProtocol}</span>
                        <span>•</span>
                        <span>{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border flex items-center gap-1 ${
                        entry.status === 'VERIFIED'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                      }`}
                    >
                      {entry.status === 'VERIFIED' ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                      )}
                      <span>{entry.status}</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => handleDelete(entry.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                      title="Delete Entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Cryptographic Hash and Security Block */}
                <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-2.5 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5 text-[11px] font-mono">
                  {entry.keyFingerprint && (
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Lock className="w-3 h-3 text-emerald-600" />
                        <span>Key Safety Fingerprint:</span>
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {entry.keyFingerprint}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-sky-600" />
                      <span>SHA-256 Digest:</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-800 dark:text-slate-200 truncate max-w-[180px] sm:max-w-xs" title={entry.receiverChecksum || entry.senderChecksum}>
                        {entry.receiverChecksum || entry.senderChecksum || 'N/A'}
                      </span>
                      {(entry.receiverChecksum || entry.senderChecksum) && (
                        <button
                          type="button"
                          onClick={() => handleCopyHash(entry.receiverChecksum || entry.senderChecksum || '', entry.id)}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                          title="Copy Full Hash"
                        >
                          {copiedId === entry.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800 text-[10px] text-slate-500">
                    <span>Duration: {(entry.durationMs / 1000).toFixed(2)}s</span>
                    <span>Throughput: {formatSpeed(entry.averageSpeed || 0)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-sky-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleExportJson}
              disabled={entries.length === 0}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-sky-300 font-semibold text-slate-700 dark:text-slate-200 hover:text-sky-700 shadow-2xs transition-all cursor-pointer disabled:opacity-40 flex items-center space-x-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={entries.length === 0}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-sky-300 font-semibold text-slate-700 dark:text-slate-200 hover:text-sky-700 shadow-2xs transition-all cursor-pointer disabled:opacity-40 flex items-center space-x-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleClearAll}
            disabled={entries.length === 0}
            className="px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold transition-colors cursor-pointer disabled:opacity-40 flex items-center space-x-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Ledger</span>
          </button>
        </div>
      </div>
    </div>
  );
};
