import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  CreditCard,
  ShoppingBag,
  DollarSign,
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Calendar,
  Eye,
  RefreshCw,
  Receipt,
  RotateCcw,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { Expense, Ingredient, Sale } from '../../types';
import { getAllFromStore, onDBChange, processRefundTransaction } from '../../services/db';
import { formatDateTime, formatRupiah } from '../../utils/format';
import { useApp } from '../../context/AppContext';
import { ReceiptModal } from '../pos/ReceiptModal';

type DateFilter = 'today' | '7days' | 'month' | 'all';

export const DashboardModule: React.FC = () => {
  const { showToast, activeUser, setActiveTab } = useApp();

  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  // Refund dialog
  const [refundingSale, setRefundingSale] = useState<Sale | null>(null);
  const [refundReason, setRefundReason] = useState('Pelanggan membatalkan pesanan');
  const [returnInventory, setReturnInventory] = useState(true);
  const [isProcessingRefund, setIsProcessingRefund] = useState(false);

  const loadData = async () => {
    const [s, exp, ing] = await Promise.all([
      getAllFromStore<Sale>('sales'),
      getAllFromStore<Expense>('expenses'),
      getAllFromStore<Ingredient>('ingredients'),
    ]);
    setSales(s.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setExpenses(exp);
    setIngredients(ing);
  };

  useEffect(() => {
    loadData();
    const unsub = onDBChange(() => {
      loadData();
    });
    return unsub;
  }, []);

  // Filter sales & expenses by date filter
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const start7DaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const filteredSales = sales.filter((sale) => {
    const t = new Date(sale.createdAt).getTime();
    if (dateFilter === 'today') return t >= startOfDay;
    if (dateFilter === '7days') return t >= start7DaysAgo;
    if (dateFilter === 'month') return t >= startOfMonth;
    return true;
  });

  const filteredExpenses = expenses.filter((exp) => {
    const t = new Date(exp.date).getTime();
    if (dateFilter === 'today') return t >= startOfDay;
    if (dateFilter === '7days') return t >= start7DaysAgo;
    if (dateFilter === 'month') return t >= startOfMonth;
    return true;
  });

  // Calculate Metrics from REAL stored data
  const validSales = filteredSales.filter(
    (s) => s.paymentStatus === 'paid' && s.refundStatus !== 'refunded'
  );

  const totalSalesRevenue = validSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalTransactions = validSales.length;
  const averageTransactionValue =
    totalTransactions > 0 ? Math.round(totalSalesRevenue / totalTransactions) : 0;

  const totalCOGS = validSales.reduce((sum, s) => sum + (s.cogsTotal || 0), 0);
  const grossProfit = totalSalesRevenue - totalCOGS;

  const totalOperationalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const operatingProfit = grossProfit - totalOperationalExpenses;

  // Low stock ingredients alert
  const lowStockIngredients = ingredients.filter(
    (ing) => ing.currentStock <= ing.minStock
  );

  // Best selling products calculation
  const productSalesMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  validSales.forEach((sale) => {
    sale.items.forEach((item) => {
      const existing = productSalesMap.get(item.productId) || {
        name: item.productName,
        quantity: 0,
        revenue: 0,
      };
      existing.quantity += item.quantity;
      existing.revenue += item.subtotal;
      productSalesMap.set(item.productId, existing);
    });
  });

  const bestSellers = Array.from(productSalesMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // Sales Trend Chart Data (Last 7 days or periods)
  const chartDaysMap = new Map<string, { date: string; displayDate: string; total: number; cogs: number }>();

  // Initialize last 7 days keys
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
    const key = d.toISOString().split('T')[0];
    const displayDate = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    chartDaysMap.set(key, { date: key, displayDate, total: 0, cogs: 0 });
  }

  // Populate sales into chart
  sales.forEach((s) => {
    if (s.paymentStatus === 'paid' && s.refundStatus !== 'refunded') {
      const key = s.createdAt.split('T')[0];
      if (chartDaysMap.has(key)) {
        const item = chartDaysMap.get(key)!;
        item.total += s.totalAmount;
        item.cogs += s.cogsTotal || 0;
      }
    }
  });

  const chartData = Array.from(chartDaysMap.values());

  // Handle Refund Execution
  const handleConfirmRefund = async () => {
    if (!refundingSale) return;
    if (activeUser?.role === 'cashier') {
      showToast('Akses ditolak: Hanya Manajer atau Owner yang dapat mengesahkan refund.', 'warning');
      return;
    }

    setIsProcessingRefund(true);
    try {
      await processRefundTransaction(
        refundingSale.id,
        refundReason,
        activeUser?.name || 'Authorized Staff',
        returnInventory
      );
      showToast(`Refund transaksi ${refundingSale.transactionNumber} berhasil diproses.`, 'success');
      setRefundingSale(null);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsProcessingRefund(false);
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-50 space-y-6">
      {/* Header & Date Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Dashboard Kinerja Kafe
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Ringkasan pendapatan, HPP bahan baku, laba bersih, dan kesehatan stok inventaris.
          </p>
        </div>

        {/* Date Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl shadow-xs self-start sm:self-auto">
          {(
            [
              { key: 'today', label: 'Hari Ini' },
              { key: '7days', label: '7 Hari Terakhir' },
              { key: 'month', label: 'Bulan Ini' },
              { key: 'all', label: 'Semua' },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              onClick={() => setDateFilter(item.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                dateFilter === item.key
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* METRIC CARDS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {/* 1. Pendapatan Penjualan */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Penjualan</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900 truncate">
            {formatRupiah(totalSalesRevenue)}
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />
            <span>{totalTransactions} transaksi</span>
          </div>
        </div>

        {/* 2. Jumlah Transaksi & ATV */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Rata-Rata Order (ATV)</span>
            <ShoppingBag className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900 truncate">
            {formatRupiah(averageTransactionValue)}
          </div>
          <div className="text-[11px] text-slate-400">Rata-rata belanja/tiket</div>
        </div>

        {/* 3. Estimasi COGS / HPP Bahan */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>HPP Bahan (COGS)</span>
            <Boxes className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900 truncate">
            {formatRupiah(totalCOGS)}
          </div>
          <div className="text-[11px] text-amber-700 font-semibold">
            {totalSalesRevenue > 0 ? `${Math.round((totalCOGS / totalSalesRevenue) * 100)}% dari sales` : '0%'}
          </div>
        </div>

        {/* 4. Laba Kotor */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Laba Kotor</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg sm:text-xl font-black text-emerald-700 truncate">
            {formatRupiah(grossProfit)}
          </div>
          <div className="text-[11px] text-slate-400">Sales - HPP Resep</div>
        </div>

        {/* 5. Biaya Operasional */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Biaya Operasional</span>
            <CreditCard className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-lg sm:text-xl font-black text-rose-600 truncate">
            {formatRupiah(totalOperationalExpenses)}
          </div>
          <div className="text-[11px] text-slate-400">{filteredExpenses.length} pos biaya</div>
        </div>

        {/* 6. Laba Operasional Bersih */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Laba Operasional</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <div
            className={`text-lg sm:text-xl font-black truncate ${
              operatingProfit >= 0 ? 'text-slate-900' : 'text-rose-600'
            }`}
          >
            {formatRupiah(operatingProfit)}
          </div>
          <div className="text-[11px] text-slate-400">Laba Kotor - Biaya Ops</div>
        </div>
      </div>

      {/* WARNING BANNER: Low Stock Ingredients */}
      {lowStockIngredients.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-amber-900">
                Peringatan: {lowStockIngredients.length} Bahan Baku Mendekati / Melewati Batas Minimum!
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                {lowStockIngredients
                  .slice(0, 4)
                  .map((i) => `${i.name} (Sisa ${i.currentStock} ${i.unit})`)
                  .join(' • ')}
                {lowStockIngredients.length > 4 && ` dan ${lowStockIngredients.length - 4} lainnya`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('inventory')}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shrink-0 transition"
          >
            Periksa Stok Bahan &rarr;
          </button>
        </div>
      )}

      {/* CHARTS & ANALYTICS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend Chart (2 columns) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-slate-900">Tren Penjualan 7 Hari Terakhir</h3>
              <p className="text-xs text-slate-400">Perbandingan omzet penjualan dan HPP bahan baku harian</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Penjualan
              </span>
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                HPP (COGS)
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCOGS" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="displayDate" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  tickFormatter={(val) => `Rp${val / 1000}k`}
                />
                <Tooltip
                  formatter={(value: any) => [formatRupiah(Number(value) || 0), '']}
                  labelFormatter={(lbl) => `Tanggal: ${lbl}`}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '12px',
                    color: '#fff',
                    border: 'none',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorSales)"
                  name="Penjualan"
                />
                <Area
                  type="monotone"
                  dataKey="cogs"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorCOGS)"
                  name="HPP Resep"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Selling Products */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-slate-900">5 Menu Terlaris</h3>
            <span className="text-xs text-slate-400">Kuantitas</span>
          </div>

          {bestSellers.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-xs">
              Belum ada data penjualan pada periode ini.
            </div>
          ) : (
            <div className="space-y-3">
              {bestSellers.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-slate-100 font-bold text-slate-600 flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <div className="text-[10px] text-slate-400">{formatRupiah(item.revenue)}</div>
                    </div>
                  </div>
                  <span className="font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                    {item.quantity} cup/porsi
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RECENT TRANSACTIONS TABLE */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900">Transaksi Kasir Terkini</h3>
            <p className="text-xs text-slate-400">
              Daftar nota penjualan terbaru, status pembayaran, dan status sinkronisasi cloud
            </p>
          </div>

          <button
            onClick={() => setActiveTab('reports')}
            className="text-xs font-bold text-amber-600 hover:text-amber-700 transition"
          >
            Lihat Laporan Lengkap &rarr;
          </button>
        </div>

        {filteredSales.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            Belum ada transaksi pada periode yang dipilih.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">No. Nota</th>
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">Kasir</th>
                  <th className="py-2.5 px-3">Menu</th>
                  <th className="py-2.5 px-3">Metode</th>
                  <th className="py-2.5 px-3">Total</th>
                  <th className="py-2.5 px-3">Status Bayar</th>
                  <th className="py-2.5 px-3">Sync</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.slice(0, 10).map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">
                      {sale.transactionNumber}
                    </td>
                    <td className="py-3 px-3 text-slate-500">{formatDateTime(sale.createdAt)}</td>
                    <td className="py-3 px-3 text-slate-700 font-medium">{sale.cashierName}</td>
                    <td className="py-3 px-3 text-slate-600 max-w-[180px] truncate">
                      {sale.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
                    </td>
                    <td className="py-3 px-3 uppercase font-bold text-slate-700">
                      {sale.paymentMethod}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">
                      {formatRupiah(sale.totalAmount)}
                    </td>
                    <td className="py-3 px-3">
                      {sale.refundStatus === 'refunded' ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                          Refunded
                        </span>
                      ) : sale.paymentStatus === 'paid' ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          Lunas
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                          Menunggu
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                          sale.syncStatus === 'synced'
                            ? 'bg-emerald-50 text-emerald-700'
                            : sale.syncStatus === 'sync_failed'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {sale.syncStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedReceiptId(sale.id)}
                          title="Lihat & Cetak Struk"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                        </button>
                        {sale.refundStatus !== 'refunded' && (
                          <button
                            onClick={() => setRefundingSale(sale)}
                            title="Batalkan / Refund Transaksi"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECEIPT MODAL */}
      {selectedReceiptId && (
        <ReceiptModal
          saleId={selectedReceiptId}
          onClose={() => setSelectedReceiptId(null)}
        />
      )}

      {/* REFUND CONFIRMATION MODAL */}
      {refundingSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-base text-rose-600 flex items-center gap-2">
                <RotateCcw className="w-5 h-5" />
                <span>Otorisasi Refund Penjualan</span>
              </h3>
              <button
                onClick={() => setRefundingSale(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <div>No. Nota: <strong>{refundingSale.transactionNumber}</strong></div>
              <div>Total Dana Dikembalikan: <strong className="text-rose-600">{formatRupiah(refundingSale.totalAmount)}</strong></div>
              <div>Metode: <strong>{refundingSale.paymentMethod.toUpperCase()}</strong></div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Alasan Pembatalan / Refund:
              </label>
              <input
                type="text"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                id="returnInv"
                checked={returnInventory}
                onChange={(e) => setReturnInventory(e.target.checked)}
                className="rounded text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="returnInv" className="text-slate-700 font-medium">
                Kembalikan stok bahan baku resep ke inventaris kafe
              </label>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setRefundingSale(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmRefund}
                disabled={isProcessingRefund}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20"
              >
                {isProcessingRefund ? 'Memproses...' : 'Konfirmasi Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
