import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  FileSpreadsheet,
  PieChart as PieChartIcon,
  TrendingUp,
  DollarSign,
  Boxes,
  RotateCcw,
  CheckCircle,
  WifiOff,
} from 'lucide-react';
import { Expense, Ingredient, InventoryMovement, Refund, Sale } from '../../types';
import { getAllFromStore, onDBChange } from '../../services/db';
import { exportToCSV, formatDate, formatDateTime, formatRupiah } from '../../utils/format';
import { useApp } from '../../context/AppContext';

type ReportTab = 'income_statement' | 'sales_detail' | 'payment_methods' | 'inventory_usage' | 'refunds';

export const ReportsModule: React.FC = () => {
  const { showToast } = useApp();

  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);

  const [activeTab, setActiveTab] = useState<ReportTab>('income_statement');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const loadData = async () => {
    const [s, exp, ing, mov, ref] = await Promise.all([
      getAllFromStore<Sale>('sales'),
      getAllFromStore<Expense>('expenses'),
      getAllFromStore<Ingredient>('ingredients'),
      getAllFromStore<InventoryMovement>('inventory_movements'),
      getAllFromStore<Refund>('refunds'),
    ]);
    setSales(s.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setExpenses(exp.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setIngredients(ing);
    setMovements(mov.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setRefunds(ref.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  useEffect(() => {
    loadData();
    const unsub = onDBChange(() => loadData());
    return unsub;
  }, []);

  // Filter by date range
  const startMs = new Date(startDate + 'T00:00:00').getTime();
  const endMs = new Date(endDate + 'T23:59:59').getTime();

  const filteredSales = sales.filter((s) => {
    const t = new Date(s.createdAt).getTime();
    return t >= startMs && t <= endMs;
  });

  const filteredExpenses = expenses.filter((e) => {
    const t = new Date(e.date + 'T00:00:00').getTime();
    return t >= startMs && t <= endMs;
  });

  const filteredMovements = movements.filter((m) => {
    const t = new Date(m.createdAt).getTime();
    return t >= startMs && t <= endMs;
  });

  const filteredRefunds = refunds.filter((r) => {
    const t = new Date(r.createdAt).getTime();
    return t >= startMs && t <= endMs;
  });

  // Financial Calculations for Income Statement
  const paidSales = filteredSales.filter(
    (s) => s.paymentStatus === 'paid' && s.refundStatus !== 'refunded'
  );
  const totalRevenue = paidSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalCOGS = paidSales.reduce((sum, s) => sum + (s.cogsTotal || 0), 0);
  const grossProfit = totalRevenue - totalCOGS;
  const grossMargin = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0;

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const operatingProfit = grossProfit - totalExpenses;
  const netMargin = totalRevenue > 0 ? Math.round((operatingProfit / totalRevenue) * 100) : 0;

  // Unsynced sales in current report
  const unsyncedCount = filteredSales.filter((s) => s.syncStatus !== 'synced').length;

  // Payment Breakdown
  const paymentBreakdownMap = new Map<string, { count: number; total: number }>();
  paidSales.forEach((s) => {
    const m = s.paymentMethod;
    const cur = paymentBreakdownMap.get(m) || { count: 0, total: 0 };
    cur.count++;
    cur.total += s.totalAmount;
    paymentBreakdownMap.set(m, cur);
  });

  // CSV Export functions
  const handleExportSalesCSV = () => {
    if (filteredSales.length === 0) {
      showToast('Tidak ada data penjualan untuk diekspor.', 'warning');
      return;
    }
    const rows = filteredSales.map((s) => ({
      No_Nota: s.transactionNumber,
      Waktu: s.createdAt,
      Kasir: s.cashierName,
      Pelanggan: s.customerName || '-',
      Meja: s.tableNumber || '-',
      Subtotal: s.subtotal,
      Diskon: s.discount,
      Pajak: s.taxAmount,
      Total_Bayar: s.totalAmount,
      COGS_HPP: s.cogsTotal,
      Metode_Bayar: s.paymentMethod,
      Status_Bayar: s.paymentStatus,
      Status_Refund: s.refundStatus || 'none',
      Status_Sync: s.syncStatus,
    }));
    exportToCSV(`Laporan_Penjualan_${startDate}_sd_${endDate}`, rows);
    showToast('Laporan penjualan CSV berhasil diunduh.', 'success');
  };

  const handleExportIncomeStatementCSV = () => {
    const rows = [
      { Indikator: 'Pendapatan Penjualan (Revenue)', Nilai: totalRevenue },
      { Indikator: 'Harga Pokok Penjualan (COGS Resep)', Nilai: totalCOGS },
      { Indikator: 'Laba Kotor (Gross Profit)', Nilai: grossProfit },
      { Indikator: 'Margin Kotor (%)', Nilai: `${grossMargin}%` },
      { Indikator: 'Beban Operasional Kafe', Nilai: totalExpenses },
      { Indikator: 'Laba Bersih Operasional', Nilai: operatingProfit },
      { Indikator: 'Margin Bersih (%)', Nilai: `${netMargin}%` },
    ];
    exportToCSV(`Laba_Rugi_${startDate}_sd_${endDate}`, rows);
    showToast('Laporan laba rugi CSV berhasil diunduh.', 'success');
  };

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-50 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Laporan & Analitik Keuangan
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Laporan laba rugi, rincian pergerakan kasir, metode bayar, dan ekspor data spreadsheet (CSV).
          </p>
        </div>

        {/* Date Filters */}
        <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs self-start sm:self-auto text-xs">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
          />
          <span className="text-slate-400">s/d</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
          />
        </div>
      </div>

      {/* Sync Warning Tag if report includes local un-synced data */}
      {unsyncedCount > 0 && (
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-600" />
            <span>
              Laporan ini mencakup <strong>{unsyncedCount} transaksi lokal</strong> yang belum tersinkronisasi ke database cloud.
            </span>
          </div>
          <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
            Data IndexedDB Lokal
          </span>
        </div>
      )}

      {/* Report Type Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('income_statement')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
            activeTab === 'income_statement'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Laporan Laba Rugi</span>
        </button>

        <button
          onClick={() => setActiveTab('sales_detail')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
            activeTab === 'sales_detail'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Rincian Penjualan ({filteredSales.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('payment_methods')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
            activeTab === 'payment_methods'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          <PieChartIcon className="w-4 h-4" />
          <span>Metode Pembayaran</span>
        </button>

        <button
          onClick={() => setActiveTab('inventory_usage')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
            activeTab === 'inventory_usage'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Pemakaian Bahan Baku</span>
        </button>

        <button
          onClick={() => setActiveTab('refunds')}
          className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
            activeTab === 'refunds'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Laporan Refund ({filteredRefunds.length})</span>
        </button>
      </div>

      {/* TAB 1: INCOME STATEMENT */}
      {activeTab === 'income_statement' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-base text-slate-900">
              Laporan Laba Rugi Komprehensif ({formatDate(startDate)} – {formatDate(endDate)})
            </h3>
            <button
              onClick={handleExportIncomeStatementCSV}
              className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition shadow-xs"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Ekspor CSV</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4 max-w-2xl text-xs">
            {/* 1. REVENUE */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-extrabold text-slate-900 pb-1 border-b border-slate-100">
                <span>1. PENDAPATAN PENJUALAN KAFE (REVENUE)</span>
                <span className="text-emerald-700">{formatRupiah(totalRevenue)}</span>
              </div>
              <div className="flex justify-between text-slate-500 pl-4">
                <span>Total transaksi lunas:</span>
                <span>{paidSales.length} nota</span>
              </div>
            </div>

            {/* 2. COGS */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center text-sm font-extrabold text-slate-900 pb-1 border-b border-slate-100">
                <span>2. HARGA POKOK PENJUALAN (COGS BAHAN BAKU)</span>
                <span className="text-amber-800">({formatRupiah(totalCOGS)})</span>
              </div>
              <div className="flex justify-between text-slate-500 pl-4">
                <span>Biaya bahan baku berdasarkan resep menu terjual</span>
                <span>{totalRevenue > 0 ? `${Math.round((totalCOGS / totalRevenue) * 100)}%` : '0%'}</span>
              </div>
            </div>

            {/* GROSS PROFIT */}
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 flex justify-between items-center font-extrabold text-sm text-emerald-900">
              <span>LABA KOTOR (GROSS PROFIT):</span>
              <span>
                {formatRupiah(grossProfit)} ({grossMargin}%)
              </span>
            </div>

            {/* 3. OPERATING EXPENSES */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center text-sm font-extrabold text-slate-900 pb-1 border-b border-slate-100">
                <span>3. BEBAN OPERASIONAL KAFE</span>
                <span className="text-rose-600">({formatRupiah(totalExpenses)})</span>
              </div>

              {filteredExpenses.map((exp) => (
                <div key={exp.id} className="flex justify-between text-slate-600 pl-4">
                  <span>
                    {exp.category} ({exp.notes || formatDate(exp.date)})
                  </span>
                  <span>{formatRupiah(exp.amount)}</span>
                </div>
              ))}
            </div>

            {/* NET OPERATING PROFIT */}
            <div className="p-4 rounded-xl bg-slate-900 text-white flex justify-between items-center font-extrabold text-base">
              <div>
                <span>LABA OPERASIONAL BERSIH:</span>
                <div className="text-[11px] font-normal text-slate-400">
                  Laba Kotor dikurangi Beban Operasional
                </div>
              </div>
              <span
                className={`text-xl font-black ${
                  operatingProfit >= 0 ? 'text-amber-400' : 'text-rose-400'
                }`}
              >
                {formatRupiah(operatingProfit)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SALES DETAIL */}
      {activeTab === 'sales_detail' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-base text-slate-900">
              Rincian Seluruh Transaksi Penjualan
            </h3>
            <button
              onClick={handleExportSalesCSV}
              className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition shadow-xs"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Unduh CSV</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">No. Nota</th>
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Kasir</th>
                    <th className="py-3 px-4">Subtotal</th>
                    <th className="py-3 px-4">Diskon</th>
                    <th className="py-3 px-4">Pajak</th>
                    <th className="py-3 px-4">Total</th>
                    <th className="py-3 px-4">COGS HPP</th>
                    <th className="py-3 px-4">Metode</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSales.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {s.transactionNumber}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{formatDateTime(s.createdAt)}</td>
                      <td className="py-3 px-4 text-slate-700">{s.cashierName}</td>
                      <td className="py-3 px-4 text-slate-600">{formatRupiah(s.subtotal)}</td>
                      <td className="py-3 px-4 text-rose-600">
                        {s.discount > 0 ? `-${formatRupiah(s.discount)}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{formatRupiah(s.taxAmount)}</td>
                      <td className="py-3 px-4 font-black text-slate-900">
                        {formatRupiah(s.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{formatRupiah(s.cogsTotal || 0)}</td>
                      <td className="py-3 px-4 uppercase font-bold text-slate-700">{s.paymentMethod}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            s.refundStatus === 'refunded'
                              ? 'bg-rose-100 text-rose-800'
                              : s.paymentStatus === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {s.refundStatus === 'refunded'
                            ? 'Refund'
                            : s.paymentStatus === 'paid'
                            ? 'Lunas'
                            : 'Menunggu'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PAYMENT METHODS BREAKDOWN */}
      {activeTab === 'payment_methods' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from(paymentBreakdownMap.entries()).map(([method, data]) => {
            const pct = totalRevenue > 0 ? Math.round((data.total / totalRevenue) * 100) : 0;

            return (
              <div
                key={method}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm uppercase text-slate-900 tracking-wider">
                    {method === 'cash'
                      ? 'Tunai (Cash)'
                      : method === 'qris'
                      ? 'QRIS BI Standar'
                      : method === 'transfer'
                      ? 'Transfer Bank'
                      : 'Kartu Debit'}
                  </span>
                  <span className="font-bold text-xs bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded-full">
                    {pct}% dari total
                  </span>
                </div>

                <div className="text-2xl font-black text-slate-900">{formatRupiah(data.total)}</div>
                <div className="text-xs text-slate-500 flex justify-between pt-2 border-t border-slate-100">
                  <span>Jumlah transaksi berhasil:</span>
                  <span className="font-bold text-slate-800">{data.count} transaksi</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 4: INVENTORY USAGE */}
      {activeTab === 'inventory_usage' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 text-xs font-bold text-slate-800">
            Jejak Konsumsi Bahan Baku dari Penjualan POS
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Bahan Baku</th>
                  <th className="py-3 px-4">Pemakaian Resep</th>
                  <th className="py-3 px-4">Keterangan</th>
                  <th className="py-3 px-4">Oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMovements
                  .filter((m) => m.type === 'sale_deduction')
                  .slice(0, 30)
                  .map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 text-slate-500">{formatDateTime(m.createdAt)}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{m.ingredientName}</td>
                      <td className="py-3 px-4 font-bold text-rose-600">{m.quantityChange} unit</td>
                      <td className="py-3 px-4 text-slate-600">{m.reason}</td>
                      <td className="py-3 px-4 text-slate-500">{m.performedBy}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: REFUNDS */}
      {activeTab === 'refunds' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {filteredRefunds.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              Tidak ada catatan refund / transaksi dibatalkan pada rentang tanggal ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">No. Refund</th>
                    <th className="py-3 px-4">No. Nota Penjualan</th>
                    <th className="py-3 px-4">Waktu Refund</th>
                    <th className="py-3 px-4">Nominal Dikembalikan</th>
                    <th className="py-3 px-4">Alasan Pembatalan</th>
                    <th className="py-3 px-4">Kembalikan Stok?</th>
                    <th className="py-3 px-4">Diotorisasi Oleh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRefunds.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-rose-700">{r.refundNumber}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{r.transactionNumber}</td>
                      <td className="py-3 px-4 text-slate-500">{formatDateTime(r.createdAt)}</td>
                      <td className="py-3 px-4 font-black text-rose-600">{formatRupiah(r.amount)}</td>
                      <td className="py-3 px-4 text-slate-700">{r.reason}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.returnInventory
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {r.returnInventory ? 'Ya, Stok Dikembalikan' : 'Tidak'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">{r.authorizedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
