import React, { useEffect, useState } from 'react';
import {
  Boxes,
  Plus,
  AlertTriangle,
  History,
  TrendingDown,
  RefreshCw,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  ShieldCheck,
  Trash2,
  Edit2,
  FileSpreadsheet,
} from 'lucide-react';
import { Ingredient, InventoryMovement, UnitType } from '../../types';
import { getAllFromStore, onDBChange, putToStore } from '../../services/db';
import { formatDateTime, formatRupiah, generateUUID } from '../../utils/format';
import { useApp } from '../../context/AppContext';

export const InventoryModule: React.FC = () => {
  const { showToast, activeUser } = useApp();

  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'stock' | 'movements'>('stock');

  // Modal: Add / Edit Ingredient
  const [isIngredientModalOpen, setIsIngredientModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<UnitType>('gram');
  const [currentStock, setCurrentStock] = useState<number>(1000);
  const [minStock, setMinStock] = useState<number>(200);
  const [costPerUnit, setCostPerUnit] = useState<number>(50);

  // Modal: Adjust Stock / Spoilage
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustingIngredient, setAdjustingIngredient] = useState<Ingredient | null>(null);
  const [adjustType, setAdjustType] = useState<'manual_adjustment' | 'waste_spoilage'>('manual_adjustment');
  const [adjustQuantity, setAdjustQuantity] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState('Stock opname mingguan');

  const loadData = async () => {
    const [ing, mov] = await Promise.all([
      getAllFromStore<Ingredient>('ingredients'),
      getAllFromStore<InventoryMovement>('inventory_movements'),
    ]);
    setIngredients(ing.sort((a, b) => a.name.localeCompare(b.name)));
    setMovements(
      mov.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    );
  };

  useEffect(() => {
    loadData();
    const unsub = onDBChange(() => loadData());
    return unsub;
  }, []);

  const openAddIngredientModal = () => {
    setEditingIngredient(null);
    setName('');
    setUnit('gram');
    setCurrentStock(1000);
    setMinStock(200);
    setCostPerUnit(100);
    setIsIngredientModalOpen(true);
  };

  const openEditIngredientModal = (ing: Ingredient) => {
    setEditingIngredient(ing);
    setName(ing.name);
    setUnit(ing.unit);
    setCurrentStock(ing.currentStock);
    setMinStock(ing.minStock);
    setCostPerUnit(ing.costPerUnit);
    setIsIngredientModalOpen(true);
  };

  const handleSaveIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const now = new Date().toISOString();
    const item: Ingredient = {
      id: editingIngredient ? editingIngredient.id : 'ing_' + generateUUID(),
      name: name.trim(),
      unit,
      currentStock,
      minStock,
      costPerUnit,
      updatedAt: now,
    };

    await putToStore('ingredients', item);
    showToast(`Bahan baku "${item.name}" berhasil disimpan.`, 'success');
    setIsIngredientModalOpen(false);
  };

  // Stock Adjustment Execution
  const openAdjustModal = (ing: Ingredient) => {
    setAdjustingIngredient(ing);
    setAdjustType('manual_adjustment');
    setAdjustQuantity(0);
    setAdjustReason('Stock opname fisik rutin');
    setIsAdjustModalOpen(true);
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingIngredient) return;
    if (adjustQuantity === 0) {
      showToast('Jumlah perubahan stok tidak boleh 0.', 'warning');
      return;
    }

    const prevStock = adjustingIngredient.currentStock;
    const finalChange = adjustType === 'waste_spoilage' ? -Math.abs(adjustQuantity) : adjustQuantity;
    const newStock = Math.max(0, prevStock + finalChange);
    const now = new Date().toISOString();

    // 1. Update ingredient
    adjustingIngredient.currentStock = newStock;
    adjustingIngredient.updatedAt = now;
    await putToStore('ingredients', adjustingIngredient);

    // 2. Create Movement Audit
    const movement: InventoryMovement = {
      id: generateUUID(),
      ingredientId: adjustingIngredient.id,
      ingredientName: adjustingIngredient.name,
      type: adjustType,
      quantityChange: finalChange,
      previousStock: prevStock,
      newStock,
      reason: adjustReason.trim() || 'Penyesuaian stok manual',
      performedBy: activeUser?.name || 'Petugas',
      createdAt: now,
    };
    await putToStore('inventory_movements', movement);

    showToast(`Stok "${adjustingIngredient.name}" berhasil disesuaikan.`, 'success');
    setIsAdjustModalOpen(false);
  };

  const filteredIngredients = ingredients.filter((ing) =>
    ing.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const lowStockCount = ingredients.filter((i) => i.currentStock <= i.minStock).length;

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-50 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Inventaris & Bahan Baku Resep
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Pantau stok bahan, catat opname & waste, serta audit jejak perubahan stok otomatis dari POS.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={openAddIngredientModal}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Bahan Baku</span>
          </button>
        </div>
      </div>

      {/* Sub tabs: Stock List vs Audit Trail */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('stock')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeSubTab === 'stock'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Daftar Stok Bahan ({ingredients.length})</span>
            {lowStockCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px]">
                {lowStockCount} menipis
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('movements')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeSubTab === 'movements'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Riwayat Mutasi Stok ({movements.length})</span>
          </button>
        </div>

        <div className="relative w-64 hidden sm:block">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama bahan baku..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* TAB 1: INGREDIENT STOCK TABLE */}
      {activeSubTab === 'stock' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Nama Bahan Baku</th>
                  <th className="py-3 px-4">Satuan</th>
                  <th className="py-3 px-4">Stok Saat Ini</th>
                  <th className="py-3 px-4">Batas Minimal</th>
                  <th className="py-3 px-4">Biaya Satuan</th>
                  <th className="py-3 px-4">Nilai Inventaris</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredIngredients.map((ing) => {
                  const isLow = ing.currentStock <= ing.minStock;
                  const totalValue = ing.currentStock * ing.costPerUnit;

                  return (
                    <tr key={ing.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">{ing.name}</td>
                      <td className="py-3 px-4 uppercase text-slate-600 font-semibold text-[11px]">
                        {ing.unit}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-black text-sm ${
                            isLow ? 'text-rose-600' : 'text-slate-900'
                          }`}
                        >
                          {ing.currentStock.toLocaleString('id-ID')}
                        </span>{' '}
                        <span className="text-[11px] text-slate-500">{ing.unit}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {ing.minStock.toLocaleString('id-ID')} {ing.unit}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {formatRupiah(ing.costPerUnit)} / {ing.unit}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {formatRupiah(totalValue)}
                      </td>
                      <td className="py-3 px-4">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                            <AlertTriangle className="w-3 h-3" />
                            Menipis
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            Aman
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openAdjustModal(ing)}
                            title="Sesuaikan Stok / Catat Waste"
                            className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[11px] transition"
                          >
                            Opname / Waste
                          </button>
                          <button
                            onClick={() => openEditIngredientModal(ing)}
                            title="Edit Bahan"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: INVENTORY MOVEMENTS AUDIT TRAIL */}
      {activeSubTab === 'movements' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Menampilkan seluruh jejak pergerakan stok (Penjualan POS, Pembelian, Opname, Waste).</span>
            <span className="font-semibold">{movements.length} log mutasi</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Bahan Baku</th>
                  <th className="py-3 px-4">Tipe Mutasi</th>
                  <th className="py-3 px-4">Perubahan Stok</th>
                  <th className="py-3 px-4">Stok Akhir</th>
                  <th className="py-3 px-4">Alasan & Catatan</th>
                  <th className="py-3 px-4">Oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.slice(0, 30).map((mov) => {
                  const isPositive = mov.quantityChange > 0;

                  return (
                    <tr key={mov.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 text-slate-500">{formatDateTime(mov.createdAt)}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{mov.ingredientName}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            mov.type === 'sale_deduction'
                              ? 'bg-blue-50 text-blue-700'
                              : mov.type === 'purchase_in'
                              ? 'bg-emerald-50 text-emerald-700'
                              : mov.type === 'waste_spoilage'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {mov.type === 'sale_deduction'
                            ? 'POS Penjualan'
                            : mov.type === 'purchase_in'
                            ? 'Barang Masuk (PO)'
                            : mov.type === 'waste_spoilage'
                            ? 'Basi / Rusak'
                            : 'Opname Manual'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-extrabold">
                        <span
                          className={`flex items-center gap-1 ${
                            isPositive ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {isPositive ? (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowDownRight className="w-3.5 h-3.5" />
                          )}
                          {isPositive ? `+${mov.quantityChange}` : mov.quantityChange}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {mov.newStock.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{mov.reason}</td>
                      <td className="py-3 px-4 text-slate-500">{mov.performedBy}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT INGREDIENT */}
      {isIngredientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-base text-slate-900">
                {editingIngredient ? 'Edit Bahan Baku' : 'Tambah Bahan Baku Baru'}
              </h3>
              <button
                onClick={() => setIsIngredientModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveIngredient} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Bahan Baku:</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Biji Kopi Arabika, Susu UHT..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Satuan Satuan Unit:</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as UnitType)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="gram">gram (g)</option>
                    <option value="ml">mililiter (ml)</option>
                    <option value="pcs">pieces (pcs)</option>
                    <option value="lembar">lembar</option>
                    <option value="porsi">porsi</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Harga Beli per Unit (Rp):</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={costPerUnit}
                    onChange={(e) => setCostPerUnit(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Stok Awal Saat Ini:</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={currentStock}
                    onChange={(e) => setCurrentStock(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Batas Minimal Peringatan:</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={minStock}
                    onChange={(e) => setMinStock(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsIngredientModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
                >
                  Simpan Bahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: STOCK ADJUSTMENT & WASTE */}
      {isAdjustModalOpen && adjustingIngredient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-base text-slate-900">
                Penyesuaian Stok: {adjustingIngredient.name}
              </h3>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                <span className="text-slate-600">Stok saat ini tercatat:</span>
                <span className="font-black text-sm text-slate-900">
                  {adjustingIngredient.currentStock} {adjustingIngredient.unit}
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tipe Penyesuaian:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('manual_adjustment')}
                    className={`py-2 px-3 rounded-xl border font-bold text-center transition ${
                      adjustType === 'manual_adjustment'
                        ? 'border-amber-500 bg-amber-50 text-amber-900'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Koreksi Opname
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('waste_spoilage')}
                    className={`py-2 px-3 rounded-xl border font-bold text-center transition ${
                      adjustType === 'waste_spoilage'
                        ? 'border-rose-500 bg-rose-50 text-rose-900'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    Basi / Tumpah (Waste)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {adjustType === 'waste_spoilage'
                    ? `Jumlah Terbuang / Rusak (${adjustingIngredient.unit}):`
                    : `Jumlah Selisih Stok (${adjustingIngredient.unit}) [+ atau -]:`}
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={adjustQuantity || ''}
                  onChange={(e) => setAdjustQuantity(Number(e.target.value) || 0)}
                  placeholder="Contoh: -50 atau 100"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Alasan Penyesuaian:</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Misal: Susu basi sebelum ED, tumpah saat kalibrasi mesin..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
                >
                  Terapkan Penyesuaian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
