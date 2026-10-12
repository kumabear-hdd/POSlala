import React, { useEffect, useState, useMemo } from 'react';
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
  FileText,
  Printer,
  Sparkles,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Expense, Ingredient, InventoryMovement, Refund, Sale } from '../../types';
import { getAllFromStore, onDBChange } from '../../services/db';
import { exportToCSV, formatDate, formatDateTime, formatRupiah } from '../../utils/format';
import { exportFinancialReportPDF } from '../../utils/pdfExport';
import { useApp } from '../../context/AppContext';

type ReportTab = 'income_statement' | 'sales_detail' | 'payment_methods' | 'inventory_usage' | 'refunds';

export const ReportsModule: React.FC = () => {
  const { showToast, settings } = useApp();

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
  const [isExportingPDF, setIsExportingPDF] = useState(false);

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

  // 30-Day Daily Revenue Trend (Last 30 Calendar Days)
  const last30DaysRevenue = useMemo(() => {
    const daysMap = new Map<string, { revenue: number; orderCount: number; cogs: number }>();
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Build the 30 consecutive days up to today
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const isoDate = d.toISOString().split('T')[0];
      daysMap.set(isoDate, { revenue: 0, orderCount: 0, cogs: 0 });
    }

    // Populate with actual paid sales from the last 30 days
    sales.forEach((s) => {
      if (s.paymentStatus === 'paid' && s.refundStatus !== 'refunded') {
        const sDate = s.createdAt.split('T')[0];
        if (daysMap.has(sDate)) {
          const entry = daysMap.get(sDate)!;
          entry.revenue += s.totalAmount;
          entry.orderCount += 1;
          entry.cogs += s.cogsTotal || 0;
        }
      }
    });

    return Array.from(daysMap.entries()).map(([isoDate, data]) => {
      const parts = isoDate.split('-');
      const dayNum = parts[2];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const monthLabel = monthNames[parseInt(parts[1], 10) - 1] || '';
      return {
        date: isoDate,
        label: `${dayNum} ${monthLabel}`,
        shortLabel: `${dayNum}`,
        revenue: data.revenue,
        orderCount: data.orderCount,
        cogs: data.cogs,
      };
    });
  }, [sales]);

  // Overall 30-day stats
  const total30DaysRevenue = useMemo(
    () => last30DaysRevenue.reduce((acc, d) => acc + d.revenue, 0),
    [last30DaysRevenue]
  );
  const total30DaysOrders = useMemo(
    () => last30DaysRevenue.reduce((acc, d) => acc + d.orderCount, 0),
    [last30DaysRevenue]
  );
  const avg30DaysDaily = total30DaysRevenue > 0 ? Math.round(total30DaysRevenue / 30) : 0;
  const highestDay = useMemo(() => {
    return [...last30DaysRevenue].sort((a, b) => b.revenue - a.revenue)[0];
  }, [last30DaysRevenue]);

  // Payment Breakdown Array for PDF & Visuals
  const paymentBreakdownList = useMemo(() => {
    const methodNames: Record<string, string> = {
      cash: 'Tunai (Cash)',
      qris: 'QRIS BI Standar',
      transfer: 'Transfer Bank',
      debit: 'Kartu Debit',
    };
    return Array.from(paymentBreakdownMap.entries()).map(([method, data]) => ({
      method,
      label: methodNames[method] || method.toUpperCase(),
      count: data.count,
      total: data.total,
      percentage: totalRevenue > 0 ? Math.round((data.total / totalRevenue) * 100) : 0,
    }));
  }, [paymentBreakdownMap, totalRevenue]);

  // Export to PDF
  const handleExportPDF = () => {
    try {
      setIsExportingPDF(true);
      const refundSum = filteredRefunds.reduce((acc, r) => acc + r.amount, 0);

      exportFinancialReportPDF({
        settings,
        startDate,
        endDate,
        totalRevenue,
        totalCOGS,
        grossProfit,
        grossMargin,
        totalExpenses,
        operatingProfit,
        netMargin,
        paidSalesCount: paidSales.length,
        refundedCount: filteredRefunds.length,
        totalRefundAmount: refundSum,
        expenses: filteredExpenses,
        dailyTrends: last30DaysRevenue.map((d) => ({
          date: d.date,
          displayDate: d.label,
          revenue: d.revenue,
          orderCount: d.orderCount,
        })),
        paymentBreakdown: paymentBreakdownList,
      });

      showToast('Laporan Keuangan Bulanan PDF berhasil diunduh.', 'success');
    } catch (err: any) {
      console.error('PDF export error:', err);
      showToast('Gagal membuat PDF: ' + (err.message || 'Terjadi kesalahan'), 'error');
    } finally {
      setIsExportingPDF(false);
    }
  };

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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Laporan & Analitik Keuangan
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
              Bulanan & Harian
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Grafik omzet 30 hari terakhir, laporan laba rugi komprehensif, ekspor PDF resmi, dan spreadsheet CSV.
          </p>
        </div>

        {/* Date Filters & Global PDF/CSV Export Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-xs text-xs">
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

          {/* Unduh PDF Button */}
          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition active:scale-95 disabled:opacity-60 cursor-pointer"
            title="Cetak atau simpan Laporan Keuangan ke format PDF"
          >
            <FileText className="w-4 h-4 text-white" />
            <span>{isExportingPDF ? 'Menyiapkan PDF...' : 'Unduh Laporan PDF'}</span>
          </button>
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
          <span>Laporan Laba Rugi & Grafik Omzet</span>
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

      {/* TAB 1: INCOME STATEMENT & 30-DAY DAILY BAR CHART */}
      {activeTab === 'income_statement' && (
        <div className="space-y-6">
          {/* SECTION A: GRAFIK BATANG OMZET HARIAN 30 HARI TERAKHIR */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    Visualisasi Omzet Harian (30 Hari Terakhir)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Grafik batang tren pendapatan kotor harian dari penjualan kasir POS yang telah lunas.
                </p>
              </div>

              {/* 30-Day Quick Metrics Badge */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                  <span className="text-[10px] text-emerald-600 block font-medium">Total 30 Hari:</span>
                  <span className="font-extrabold">{formatRupiah(total30DaysRevenue)}</span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
                  <span className="text-[10px] text-slate-500 block font-medium">Rata-Rata/Hari:</span>
                  <span className="font-extrabold">{formatRupiah(avg30DaysDaily)}</span>
                </div>
                {highestDay && highestDay.revenue > 0 && (
                  <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 hidden md:block">
                    <span className="text-[10px] text-amber-600 block font-medium">Puncak Tertinggi:</span>
                    <span className="font-extrabold">{highestDay.label} ({formatRupiah(highestDay.revenue)})</span>
                  </div>
                )}
              </div>
            </div>

            {/* Recharts Bar Chart Container */}
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={last30DaysRevenue}
                  margin={{ top: 10, right: 10, left: 0, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="shortLabel"
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    interval={window.innerWidth < 640 ? 4 : 1}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    tickFormatter={(val) => {
                      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}jt`;
                      if (val >= 1000) return `${Math.round(val / 1000)}k`;
                      return val;
                    }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-800">
                            <div className="font-bold text-amber-400">{data.label}</div>
                            <div className="flex justify-between gap-4 text-slate-300">
                              <span>Omzet:</span>
                              <span className="font-extrabold text-white">{formatRupiah(data.revenue)}</span>
                            </div>
                            <div className="flex justify-between gap-4 text-slate-400 text-[11px]">
                              <span>Total Transaksi:</span>
                              <span>{data.orderCount} nota</span>
                            </div>
                            {data.cogs > 0 && (
                              <div className="flex justify-between gap-4 text-slate-400 text-[11px] pt-1 border-t border-slate-800">
                                <span>COGS HPP:</span>
                                <span>{formatRupiah(data.cogs)}</span>
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey="revenue"
                    radius={[6, 6, 0, 0]}
                    fill="#f59e0b"
                  >
                    {last30DaysRevenue.map((entry, index) => {
                      const isPeak = highestDay && highestDay.date === entry.date && entry.revenue > 0;
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={isPeak ? '#d97706' : entry.revenue > 0 ? '#f59e0b' : '#e2e8f0'}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
                  <span>Omzet Normal</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-700 inline-block" />
                  <span>Omzet Tertinggi</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-slate-200 inline-block" />
                  <span>Tidak Ada Transaksi</span>
                </span>
              </div>
              <span className="text-slate-500 font-medium">
                Total {total30DaysOrders} transaksi dalam 30 hari
              </span>
            </div>
          </div>

          {/* SECTION B: LAPORAN LABA RUGI KOMPREHENSIF */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  Laporan Laba Rugi Komprehensif ({formatDate(startDate)} – {formatDate(endDate)})
                </h3>
                <p className="text-xs text-slate-500">
                  Kalkulasi pendapatan bersih, harga pokok penjualan bahan baku, serta beban operasional.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportPDF}
                  disabled={isExportingPDF}
                  className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-rose-600" />
                  <span>{isExportingPDF ? 'Proses...' : 'Unduh PDF'}</span>
                </button>
                <button
                  onClick={handleExportIncomeStatementCSV}
                  className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-500" />
                  <span>Ekspor CSV</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Detailed Financial Calculation Table */}
              <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-xs p-6 space-y-4 text-xs">
                {/* 1. REVENUE */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm font-extrabold text-slate-900 pb-1 border-b border-slate-100">
                    <span>1. PENDAPATAN PENJUALAN KAFE (REVENUE)</span>
                    <span className="text-emerald-700 font-black">{formatRupiah(totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 pl-4">
                    <span>Total transaksi lunas:</span>
                    <span className="font-semibold text-slate-700">{paidSales.length} nota</span>
                  </div>
                  <div className="flex justify-between text-slate-500 pl-4">
                    <span>Rata-rata penjualan per transaksi (ATV):</span>
                    <span className="font-semibold text-slate-700">
                      {paidSales.length > 0 ? formatRupiah(Math.round(totalRevenue / paidSales.length)) : 'Rp 0'}
                    </span>
                  </div>
                </div>

                {/* 2. COGS */}
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center text-sm font-extrabold text-slate-900 pb-1 border-b border-slate-100">
                    <span>2. HARGA POKOK PENJUALAN (COGS BAHAN BAKU)</span>
                    <span className="text-amber-800 font-black">({formatRupiah(totalCOGS)})</span>
                  </div>
                  <div className="flex justify-between text-slate-500 pl-4">
                    <span>Biaya bahan baku berdasarkan resep menu terjual</span>
                    <span className="font-semibold text-slate-700">{totalRevenue > 0 ? `${Math.round((totalCOGS / totalRevenue) * 100)}%` : '0%'}</span>
                  </div>
                </div>

                {/* GROSS PROFIT */}
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex justify-between items-center font-extrabold text-sm text-emerald-900">
                  <div>
                    <span>LABA KOTOR (GROSS PROFIT):</span>
                    <div className="text-[11px] font-normal text-emerald-700">Omzet Penjualan dikurangi HPP Resep</div>
                  </div>
                  <span className="text-base font-black">
                    {formatRupiah(grossProfit)} ({grossMargin}%)
                  </span>
                </div>

                {/* 3. OPERATING EXPENSES */}
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center text-sm font-extrabold text-slate-900 pb-1 border-b border-slate-100">
                    <span>3. BEBAN OPERASIONAL KAFE</span>
                    <span className="text-rose-600 font-black">({formatRupiah(totalExpenses)})</span>
                  </div>

                  {filteredExpenses.length === 0 ? (
                    <div className="text-slate-400 pl-4 italic text-[11px]">
                      Belum ada beban operasional tercatat pada periode ini.
                    </div>
                  ) : (
                    filteredExpenses.map((exp) => (
                      <div key={exp.id} className="flex justify-between text-slate-600 pl-4">
                        <span>
                          {exp.category} ({exp.notes || formatDate(exp.date)})
                        </span>
                        <span className="font-semibold">{formatRupiah(exp.amount)}</span>
                      </div>
                    ))
                  )}
                </div>

                {/* NET OPERATING PROFIT */}
                <div className="p-4 rounded-2xl bg-slate-900 text-white flex justify-between items-center font-extrabold text-base">
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

              {/* PDF Preview & Quick Information Card */}
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-3xl p-6 border border-slate-800 shadow-md space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                      <FileText className="w-5 h-5" />
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-extrabold uppercase tracking-wider">
                      PDF Ekspor Siap
                    </span>
                  </div>

                  <div>
                    <h4 className="font-black text-base text-white">Ekspor Laporan Keuangan Bulanan</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Dokumen resmi berformat PDF berukuran A4 yang menyajikan ringkasan keuangan, laporan laba rugi komprehensif, rincian omzet 30 hari, metode pembayaran, serta kolom tanda tangan pemilik kafe.
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800 space-y-2 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Nama Usaha:</span>
                      <span className="font-bold text-white">{settings.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Rentang Waktu:</span>
                      <span className="font-medium text-amber-400">{formatDate(startDate)} – {formatDate(endDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Format:</span>
                      <span className="font-medium">Adobe PDF (.pdf)</span>
                    </div>
                  </div>

                  <button
                    onClick={handleExportPDF}
                    disabled={isExportingPDF}
                    className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer disabled:opacity-60"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isExportingPDF ? 'Menyiapkan PDF...' : 'Unduh & Simpan PDF Sekarang'}</span>
                  </button>
                </div>

                {/* Print/Review Tips */}
                <div className="bg-amber-50/60 border border-amber-200 rounded-3xl p-5 text-xs text-amber-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-900">
                    <Printer className="w-4 h-4 text-amber-700" />
                    <span>Siap Cetak Fisik</span>
                  </div>
                  <p className="text-[11px] text-amber-800/90 leading-relaxed">
                    File PDF yang diunduh diformat khusus dengan tata letak dokumen formal, header kafe, ringkasan kartu keuangan, serta lembar pengesahan untuk arsip pembukuan kafe.
                  </p>
                </div>
              </div>
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
