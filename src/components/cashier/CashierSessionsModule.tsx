import React, { useEffect, useState } from 'react';
import {
  Clock,
  Play,
  Square,
  Banknote,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Calendar,
  History,
  User,
  CreditCard,
  QrCode,
  FileText,
} from 'lucide-react';
import { CashSession, Sale } from '../../types';
import { getAllFromStore, onDBChange, putToStore } from '../../services/db';
import { formatDateTime, formatRupiah, generateUUID } from '../../utils/format';
import { useApp } from '../../context/AppContext';

export const CashierSessionsModule: React.FC = () => {
  const { activeSession, refreshActiveSession, activeUser, showToast } = useApp();

  const [allSessions, setAllSessions] = useState<CashSession[]>([]);
  const [sessionSales, setSessionSales] = useState<Sale[]>([]);

  // Open Shift Modal
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [openingBalance, setOpeningBalance] = useState<number>(200000);
  const [openNotes, setOpenNotes] = useState('Shift Kasir Utama');

  // Close Shift Modal
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [actualCash, setActualCash] = useState<number>(0);
  const [closeNotes, setCloseNotes] = useState('');

  const loadData = async () => {
    const [sess, sales] = await Promise.all([
      getAllFromStore<CashSession>('cash_sessions'),
      getAllFromStore<Sale>('sales'),
    ]);
    setAllSessions(
      sess.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime())
    );

    if (activeSession) {
      setSessionSales(sales.filter((s) => s.sessionId === activeSession.id));
    } else {
      setSessionSales([]);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = onDBChange(() => {
      loadData();
    });
    return unsub;
  }, [activeSession]);

  // Handle Open Shift
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeSession) {
      showToast('Masih ada shift kasir yang aktif. Tutup shift terlebih dahulu.', 'warning');
      return;
    }

    const now = new Date().toISOString();
    const newSession: CashSession = {
      id: 'sess_' + generateUUID(),
      cashierId: activeUser?.id || 'usr_anon',
      cashierName: activeUser?.name || 'Kasir',
      openedAt: now,
      openingBalance,
      cashSales: 0,
      nonCashSales: 0,
      expectedCash: openingBalance,
      status: 'open',
      notes: openNotes.trim(),
    };

    await putToStore('cash_sessions', newSession);
    await refreshActiveSession();
    showToast(`Shift kasir untuk "${newSession.cashierName}" berhasil dibuka!`, 'success');
    setIsOpenShiftModalOpen(false);
  };

  // Handle Close Shift
  const handleOpenCloseShiftModal = () => {
    if (!activeSession) return;
    setActualCash(activeSession.expectedCash);
    setCloseNotes('');
    setIsCloseShiftModalOpen(true);
  };

  const handleConfirmCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;

    const diff = actualCash - activeSession.expectedCash;
    const now = new Date().toISOString();

    const closed: CashSession = {
      ...activeSession,
      closedAt: now,
      actualCash,
      difference: diff,
      status: 'closed',
      notes: closeNotes.trim()
        ? `${activeSession.notes || ''} | Tutup: ${closeNotes.trim()}`
        : activeSession.notes,
    };

    await putToStore('cash_sessions', closed);
    await refreshActiveSession();

    if (diff === 0) {
      showToast('Shift kasir ditutup sempurna tanpa selisih kas fisik!', 'success');
    } else if (diff < 0) {
      showToast(
        `Shift ditutup. Peringatan: Terdapat selisih KURANG kas sebesar ${formatRupiah(Math.abs(diff))}.`,
        'warning'
      );
    } else {
      showToast(
        `Shift ditutup. Terdapat selisih LEBIH kas sebesar ${formatRupiah(diff)}.`,
        'info'
      );
    }

    setIsCloseShiftModalOpen(false);
  };

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-50 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Sesi Kasir & Rekonsiliasi Shift
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Buka shift kasir, monitor arus kas laci tunai, dan rekonsiliasi uang fisik saat serah terima.
          </p>
        </div>

        {activeSession ? (
          <button
            onClick={handleOpenCloseShiftModal}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm self-start sm:self-auto"
          >
            <Square className="w-4 h-4 fill-current" />
            <span>Tutup Shift & Hitung Kas Fisik</span>
          </button>
        ) : (
          <button
            onClick={() => setIsOpenShiftModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-sm self-start sm:self-auto"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Buka Shift Kasir Baru</span>
          </button>
        )}
      </div>

      {/* ACTIVE SHIFT LIVE MONITORING */}
      {activeSession ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <Clock className="w-6 h-6 animate-spin-slow" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-slate-900">Shift Sedang Aktif</h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    TERBUKA
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kasir: <strong>{activeSession.cashierName}</strong> • Dibuka sejak{' '}
                  {formatDateTime(activeSession.openedAt)}
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-xs text-slate-400">Total Uang Kas Diharapkan di Laci:</span>
              <div className="text-2xl font-black text-emerald-700">
                {formatRupiah(activeSession.expectedCash)}
              </div>
            </div>
          </div>

          {/* Shift Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-slate-500 font-medium">Modal Awal Kasir</span>
              <div className="text-lg font-black text-slate-900">
                {formatRupiah(activeSession.openingBalance)}
              </div>
              <p className="text-[10px] text-slate-400">Uang receh pembuka shift</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-slate-500 font-medium">Penjualan Tunai (Cash)</span>
              <div className="text-lg font-black text-emerald-600">
                {formatRupiah(activeSession.cashSales || 0)}
              </div>
              <p className="text-[10px] text-slate-400">Masuk ke laci kasir</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-slate-500 font-medium">Penjualan Non-Tunai</span>
              <div className="text-lg font-black text-blue-600">
                {formatRupiah(activeSession.nonCashSales || 0)}
              </div>
              <p className="text-[10px] text-slate-400">QRIS / EDC / Transfer</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-slate-500 font-medium">Jumlah Transaksi Shift Ini</span>
              <div className="text-lg font-black text-slate-900">{sessionSales.length} Nota</div>
              <p className="text-[10px] text-slate-400">Diproses oleh kasir aktif</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 rounded-3xl bg-amber-50/60 border border-amber-200 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-700 flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-slate-900">Shift Kasir Belum Dibuka</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto mt-1">
              Buka shift kasir terlebih dahulu dengan modal uang awal sebelum kasir mulai memproses pesanan di POS.
            </p>
          </div>
          <button
            onClick={() => setIsOpenShiftModalOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm transition"
          >
            Buka Shift Sekarang
          </button>
        </div>
      )}

      {/* HISTORICAL SHIFTS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-2">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            Riwayat Sesi Shift Kasir Terdahulu
          </h4>
          <span className="text-xs text-slate-400">{allSessions.length} total sesi shift</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Kasir</th>
                <th className="py-3 px-4">Waktu Buka</th>
                <th className="py-3 px-4">Waktu Tutup</th>
                <th className="py-3 px-4">Modal Awal</th>
                <th className="py-3 px-4">Sales Tunai</th>
                <th className="py-3 px-4">Kas Diharapkan</th>
                <th className="py-3 px-4">Uang Fisik Dihitung</th>
                <th className="py-3 px-4">Selisih Kas</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allSessions.map((sess) => (
                <tr key={sess.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-4 font-bold text-slate-900">{sess.cashierName}</td>
                  <td className="py-3 px-4 text-slate-600">{formatDateTime(sess.openedAt)}</td>
                  <td className="py-3 px-4 text-slate-600">
                    {sess.closedAt ? formatDateTime(sess.closedAt) : 'Sedang Berjalan'}
                  </td>
                  <td className="py-3 px-4 text-slate-600">{formatRupiah(sess.openingBalance)}</td>
                  <td className="py-3 px-4 text-slate-800 font-semibold">
                    {formatRupiah(sess.cashSales || 0)}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {formatRupiah(sess.expectedCash)}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {sess.actualCash !== undefined ? formatRupiah(sess.actualCash) : '-'}
                  </td>
                  <td className="py-3 px-4 font-extrabold">
                    {sess.difference !== undefined ? (
                      <span
                        className={
                          sess.difference === 0
                            ? 'text-emerald-600'
                            : sess.difference < 0
                            ? 'text-rose-600'
                            : 'text-amber-600'
                        }
                      >
                        {sess.difference === 0
                          ? 'Pas (Rp 0)'
                          : sess.difference < 0
                          ? `Kurang ${formatRupiah(Math.abs(sess.difference))}`
                          : `Lebih ${formatRupiah(sess.difference)}`}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        sess.status === 'open'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {sess.status === 'open' ? 'Buka' : 'Selesai'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: OPEN SHIFT */}
      {isOpenShiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <Play className="w-4 h-4 fill-emerald-600 text-emerald-600" />
                <span>Buka Shift Kasir Baru</span>
              </h3>
              <button
                onClick={() => setIsOpenShiftModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOpenShift} className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500">Kasir yang bertugas:</span>
                <div className="font-bold text-sm text-slate-900 mt-0.5">
                  {activeUser?.name || 'Kasir'} ({activeUser?.role})
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Modal Awal Uang Tunai di Laci (Rp):
                </label>
                <input
                  type="number"
                  min="0"
                  step="5000"
                  required
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-base text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan Shift:</label>
                <input
                  type="text"
                  value={openNotes}
                  onChange={(e) => setOpenNotes(e.target.value)}
                  placeholder="Misal: Shift Pagi (08:00 - 16:00)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsOpenShiftModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-600/20"
                >
                  Buka Shift Sekarang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CLOSE SHIFT & RECONCILIATION */}
      {isCloseShiftModalOpen && activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <Square className="w-4 h-4 fill-rose-600 text-rose-600" />
                <span>Tutup Shift Kasir & Rekonsiliasi</span>
              </h3>
              <button
                onClick={() => setIsCloseShiftModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmCloseShift} className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-900 text-white space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Modal Awal:</span>
                  <span>{formatRupiah(activeSession.openingBalance)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Penjualan Tunai:</span>
                  <span>+{formatRupiah(activeSession.cashSales || 0)}</span>
                </div>
                <div className="flex justify-between font-extrabold text-sm pt-1 border-t border-slate-700">
                  <span>Uang Kas Diharapkan di Laci:</span>
                  <span className="text-amber-400">{formatRupiah(activeSession.expectedCash)}</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Uang Fisik Dihitung (Hasil Perhitungan Laci Tunai):
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  required
                  value={actualCash || ''}
                  onChange={(e) => setActualCash(Number(e.target.value) || 0)}
                  placeholder="Masukkan total uang cash di laci..."
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-black text-base text-slate-900"
                />
              </div>

              {/* Difference live indicator */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center font-bold">
                <span className="text-slate-600">Selisih Kas Fisik:</span>
                <span
                  className={`text-sm ${
                    actualCash - activeSession.expectedCash === 0
                      ? 'text-emerald-700'
                      : actualCash - activeSession.expectedCash < 0
                      ? 'text-rose-600'
                      : 'text-amber-600'
                  }`}
                >
                  {actualCash - activeSession.expectedCash === 0
                    ? 'Sesuai (Rp 0)'
                    : actualCash - activeSession.expectedCash < 0
                    ? `Kurang ${formatRupiah(Math.abs(actualCash - activeSession.expectedCash))}`
                    : `Lebih ${formatRupiah(actualCash - activeSession.expectedCash)}`}
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Catatan Penutupan / Serah Terima:
                </label>
                <input
                  type="text"
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Misal: Uang receh 200rb diserahkan ke kasir shift sore..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCloseShiftModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
                >
                  Tutup Shift Sekarang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
