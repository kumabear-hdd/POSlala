import React, { useEffect, useState } from 'react';
import {
  ReceiptText,
  Plus,
  Trash2,
  Calendar,
  CreditCard,
  Tag,
  DollarSign,
  PieChart,
  ArrowDownRight,
  ShieldAlert,
} from 'lucide-react';
import { Expense, ExpenseCategory } from '../../types';
import { deleteFromStore, getAllFromStore, onDBChange, putToStore } from '../../services/db';
import { formatDate, formatDateTime, formatRupiah, generateTransactionNumber, generateUUID } from '../../utils/format';
import { useApp } from '../../context/AppContext';

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Sewa Tempat',
  'Listrik & Air',
  'Internet & Telepon',
  'Gaji & Upah Karyawan',
  'Kemasan & Packaging',
  'Pemeliharaan & Kebersihan',
  'Bahan Penolong',
  'Operasional Lainnya',
];

export const ExpensesModule: React.FC = () => {
  const { showToast, activeUser } = useApp();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [category, setCategory] = useState<ExpenseCategory>('Listrik & Air');
  const [amount, setAmount] = useState<number>(150000);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'petty_cash'>('petty_cash');
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    const data = await getAllFromStore<Expense>('expenses');
    setExpenses(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  };

  useEffect(() => {
    loadData();
    const unsub = onDBChange((store) => {
      if (store === 'expenses' || store === 'all') loadData();
    });
    return unsub;
  }, []);

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      showToast('Nominal pengeluaran harus lebih besar dari Rp 0.', 'warning');
      return;
    }

    const now = new Date().toISOString();
    const newExpense: Expense = {
      id: 'exp_' + generateUUID(),
      expenseNumber: generateTransactionNumber('EXP'),
      category,
      amount,
      date,
      paymentMethod,
      notes: notes.trim(),
      createdBy: activeUser?.name || 'Staff',
      createdAt: now,
    };

    await putToStore('expenses', newExpense);
    showToast(`Pengeluaran ${formatRupiah(amount)} untuk "${category}" berhasil dicatat.`, 'success');
    setIsModalOpen(false);
    setAmount(100000);
    setNotes('');
  };

  const handleDeleteExpense = async (exp: Expense) => {
    if (activeUser?.role === 'cashier') {
      showToast('Akses ditolak: Hanya Manajer atau Owner yang dapat menghapus catatan pengeluaran.', 'warning');
      return;
    }

    if (window.confirm(`Hapus catatan pengeluaran ${exp.expenseNumber} (${formatRupiah(exp.amount)})?`)) {
      await deleteFromStore('expenses', exp.id);
      showToast(`Pengeluaran ${exp.expenseNumber} telah dihapus.`, 'info');
    }
  };

  // Category summary calculation
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const categoryMap = new Map<string, number>();
  expenses.forEach((e) => {
    const cur = categoryMap.get(e.category) || 0;
    categoryMap.set(e.category, cur + e.amount);
  });

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-50 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Pengeluaran & Beban Operasional
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Catat beban sewa, listrik, gaji, dan biaya pemeliharaan untuk perhitungan Laba Operasional Bersih.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Catat Biaya Baru</span>
        </button>
      </div>

      {/* Accounting Clarification Banner */}
      <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5 leading-relaxed">
          <strong className="text-blue-950">Prinsip Akuntansi Standar POS Lapak:</strong>
          <p className="text-blue-800 text-[11px]">
            HPP Bahan Baku (COGS) dihitung otomatis dari resep menu yang terjual di POS. Pembelian PO bahan baku diakui sebagai aset inventaris, sehingga tidak terjadi perhitungan ganda (double-counting) dalam Laba Bersih.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs text-slate-500 font-medium">Total Beban Operasional</span>
          <div className="text-xl font-black text-rose-600">{formatRupiah(totalExpenses)}</div>
          <p className="text-[11px] text-slate-400">{expenses.length} transaksi pengeluaran</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs text-slate-500 font-medium">Kategori Terbesar</span>
          <div className="text-lg font-bold text-slate-900 truncate">
            {Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'}
          </div>
          <p className="text-[11px] text-slate-400">
            {formatRupiah(Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[1] || 0)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-xs text-slate-500 font-medium">Metode Pembayaran Kas Kecil</span>
          <div className="text-lg font-bold text-slate-900">
            {formatRupiah(
              expenses
                .filter((e) => e.paymentMethod === 'petty_cash')
                .reduce((s, e) => s + e.amount, 0)
            )}
          </div>
          <p className="text-[11px] text-slate-400">Kas kecil / kasir kafe</p>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {expenses.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            Belum ada catatan pengeluaran operasional.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">No. Bukti</th>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Kategori Biaya</th>
                  <th className="py-3 px-4">Keterangan / Keperluan</th>
                  <th className="py-3 px-4">Metode Bayar</th>
                  <th className="py-3 px-4">Nominal</th>
                  <th className="py-3 px-4">Dicatat Oleh</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {exp.expenseNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{formatDate(exp.date)}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-bold text-[10px]">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-xs">{exp.notes || '-'}</td>
                    <td className="py-3 px-4 uppercase text-[10px] font-bold text-slate-600">
                      {exp.paymentMethod.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-4 font-black text-rose-600">{formatRupiah(exp.amount)}</td>
                    <td className="py-3 px-4 text-slate-500">{exp.createdBy}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteExpense(exp)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: ADD EXPENSE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-base text-slate-900">Catat Beban Operasional</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Kategori Beban:</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nominal Biaya (Rp):</label>
                <input
                  type="number"
                  min="1"
                  step="1000"
                  required
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal Biaya:</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Metode Bayar:</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="petty_cash">Kas Kecil Kafe</option>
                    <option value="cash">Tunai (Laci Kasir)</option>
                    <option value="transfer">Transfer Bank</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Keterangan / Keperluan:</label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Tagihan listrik PLN bulan Oktober, beli sabun cuci..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
                >
                  Simpan Biaya
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
