import React from 'react';
import { WifiOff, RefreshCw, AlertCircle, CheckCircle, ShieldAlert } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const OfflineBanner: React.FC = () => {
  const { isOnline, syncSummary, handleManualSync, settings } = useApp();

  const hasPending = syncSummary.pendingCount > 0;
  const hasFailed = syncSummary.failedCount > 0;

  // If online and nothing pending, don't show large banner (navbar has compact badge)
  if (isOnline && !hasPending && !hasFailed) {
    return null;
  }

  return (
    <div className="bg-slate-900 border-b border-slate-800 text-slate-100 text-xs px-4 py-2 transition">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {!isOnline ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/30">
              <WifiOff className="w-3.5 h-3.5 animate-pulse" />
              Mode Offline Aktif
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
              <CheckCircle className="w-3.5 h-3.5" />
              Online
            </span>
          )}

          <div className="text-slate-300">
            {!isOnline ? (
              <span>
                Data transaksi disimpan secara lokal di IndexedDB perangkat ini.{' '}
                <strong className="text-white">{syncSummary.pendingCount} transaksi</strong> siap disinkronkan saat terhubung kembali.
              </span>
            ) : hasPending ? (
              <span>
                Terdapat <strong className="text-amber-300">{syncSummary.pendingCount} transaksi lokal</strong> yang belum tersinkronkan ke server.
              </span>
            ) : null}

            {hasFailed && (
              <span className="text-rose-400 ml-2 inline-flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 inline" />
                ({syncSummary.failedCount} transaksi gagal sync: {syncSummary.lastError || 'Cek koneksi'})
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {settings.singleCashierMode && (
            <span
              title="Kebijakan Kasir Tunggal Aktif untuk mencegah konflik inventaris saat offline"
              className="hidden lg:flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700"
            >
              <ShieldAlert className="w-3 h-3 text-amber-400" />
              Kebijakan 1 Kasir Offline Aktif
            </span>
          )}

          {isOnline && hasPending && (
            <button
              onClick={handleManualSync}
              disabled={syncSummary.isSyncing}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-semibold transition text-xs shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncSummary.isSyncing ? 'animate-spin' : ''}`} />
              {syncSummary.isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
