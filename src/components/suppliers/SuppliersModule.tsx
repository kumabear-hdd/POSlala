import React, { useEffect, useState } from 'react';
import {
  Truck,
  Plus,
  CheckCircle,
  Clock,
  Trash2,
  PackageCheck,
  Building2,
  Calendar,
  AlertCircle,
  FileText,
  DollarSign,
} from 'lucide-react';
import { Ingredient, PurchaseOrder, PurchaseOrderItem, Supplier } from '../../types';
import {
  getAllFromStore,
  onDBChange,
  putToStore,
  receivePurchaseOrder,
} from '../../services/db';
import {
  formatDateTime,
  formatRupiah,
  generateTransactionNumber,
  generateUUID,
} from '../../utils/format';
import { useApp } from '../../context/AppContext';

export const SuppliersModule: React.FC = () => {
  const { showToast, activeUser } = useApp();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [activeTab, setActiveTab] = useState<'orders' | 'suppliers'>('orders');

  // New PO Modal
  const [isPOModalOpen, setIsPOModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [poItems, setPOItems] = useState<PurchaseOrderItem[]>([]);
  const [poNotes, setPONotes] = useState('');

  // New Supplier Modal
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [supTerms, setSupTerms] = useState('COD / Tunai');

  // Receiving PO state
  const [isReceivingId, setIsReceivingId] = useState<string | null>(null);

  const loadData = async () => {
    const [sup, po, ing] = await Promise.all([
      getAllFromStore<Supplier>('suppliers'),
      getAllFromStore<PurchaseOrder>('purchase_orders'),
      getAllFromStore<Ingredient>('ingredients'),
    ]);
    setSuppliers(sup);
    setPurchaseOrders(
      po.sort((a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime())
    );
    setIngredients(ing);
  };

  useEffect(() => {
    loadData();
    const unsub = onDBChange(() => loadData());
    return unsub;
  }, []);

  // Open Create PO Modal
  const openCreatePO = () => {
    if (suppliers.length === 0) {
      showToast('Tambahkan supplier terlebih dahulu sebelum membuat PO.', 'warning');
      return;
    }
    setSelectedSupplierId(suppliers[0].id);
    setPOItems(
      ingredients.slice(0, 2).map((i) => ({
        ingredientId: i.id,
        ingredientName: i.name,
        quantity: 1000,
        unit: i.unit,
        unitPrice: i.costPerUnit,
        subtotal: 1000 * i.costPerUnit,
      }))
    );
    setPONotes('');
    setIsPOModalOpen(true);
  };

  const addPOItemRow = () => {
    if (ingredients.length === 0) return;
    const firstIng = ingredients[0];
    setPOItems([
      ...poItems,
      {
        ingredientId: firstIng.id,
        ingredientName: firstIng.name,
        quantity: 500,
        unit: firstIng.unit,
        unitPrice: firstIng.costPerUnit,
        subtotal: 500 * firstIng.costPerUnit,
      },
    ]);
  };

  const updatePOItemRow = (index: number, field: string, val: any) => {
    const updated = [...poItems];
    const row = { ...updated[index], [field]: val };

    if (field === 'ingredientId') {
      const ing = ingredients.find((i) => i.id === val);
      if (ing) {
        row.ingredientName = ing.name;
        row.unit = ing.unit;
        row.unitPrice = ing.costPerUnit;
      }
    }

    row.subtotal = (row.quantity || 0) * (row.unitPrice || 0);
    updated[index] = row;
    setPOItems(updated);
  };

  const removePOItemRow = (index: number) => {
    setPOItems(poItems.filter((_, i) => i !== index));
  };

  const poTotalAmount = poItems.reduce((sum, item) => sum + item.subtotal, 0);

  const handleSavePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (poItems.length === 0) {
      showToast('PO harus memiliki minimal 1 item barang.', 'warning');
      return;
    }

    const supplier = suppliers.find((s) => s.id === selectedSupplierId);
    const newPO: PurchaseOrder = {
      id: 'po_' + generateUUID(),
      poNumber: generateTransactionNumber('PO'),
      supplierId: selectedSupplierId,
      supplierName: supplier?.name || 'Pemasok Umum',
      items: poItems,
      totalAmount: poTotalAmount,
      status: 'ordered', // NOTE: Stock only increases when Received!
      orderedAt: new Date().toISOString(),
      notes: poNotes.trim(),
    };

    await putToStore('purchase_orders', newPO);
    showToast(`Purchase Order ${newPO.poNumber} berhasil dibuat (Status: Dipesan).`, 'success');
    setIsPOModalOpen(false);
  };

  // Crucial: Receive PO and increase stock
  const handleReceivePO = async (po: PurchaseOrder) => {
    if (po.status === 'received') return;
    if (
      !window.confirm(
        `Konfirmasi penerimaan barang untuk ${po.poNumber}?\nStok bahan baku akan bertambah otomatis ke inventaris kafe.`
      )
    ) {
      return;
    }

    setIsReceivingId(po.id);
    try {
      await receivePurchaseOrder(po.id, activeUser?.name || 'Staff');
      showToast(`Barang PO ${po.poNumber} diterima! Stok bahan baku berhasil ditambahkan.`, 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsReceivingId(null);
    }
  };

  // Add Supplier
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) return;

    const newSup: Supplier = {
      id: 'sup_' + generateUUID(),
      name: supName.trim(),
      contactPerson: supContact.trim(),
      phone: supPhone.trim(),
      address: supAddress.trim(),
      paymentTerms: supTerms.trim(),
    };

    await putToStore('suppliers', newSup);
    showToast(`Supplier "${newSup.name}" berhasil ditambahkan.`, 'success');
    setIsSupplierModalOpen(false);
    setSupName('');
    setSupContact('');
    setSupPhone('');
    setSupAddress('');
  };

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-50 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Pemasok & Pembelian (PO)
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manajemen rantai pasok: Buat PO dan tingkatkan stok secara akurat saat barang diterima.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setIsSupplierModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition shadow-xs"
          >
            <Building2 className="w-4 h-4 text-slate-500" />
            <span>Tambah Pemasok</span>
          </button>

          <button
            onClick={openCreatePO}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-md shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Buat PO Baru</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'orders'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Daftar Purchase Order ({purchaseOrders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('suppliers')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'suppliers'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Daftar Pemasok / Supplier ({suppliers.length})</span>
        </button>
      </div>

      {/* TAB 1: PURCHASE ORDERS TABLE */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {purchaseOrders.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              Belum ada purchase order yang dibuat.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">No. PO</th>
                    <th className="py-3 px-4">Pemasok</th>
                    <th className="py-3 px-4">Tanggal Pesan</th>
                    <th className="py-3 px-4">Rincian Barang</th>
                    <th className="py-3 px-4">Total Biaya</th>
                    <th className="py-3 px-4">Status Pesanan</th>
                    <th className="py-3 px-4 text-right">Aksi Penerimaan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchaseOrders.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{po.poNumber}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{po.supplierName}</td>
                      <td className="py-3 px-4 text-slate-500">{formatDateTime(po.orderedAt)}</td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs">
                        {po.items.map((i) => `${i.quantity} ${i.unit} ${i.ingredientName}`).join(', ')}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {formatRupiah(po.totalAmount)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            po.status === 'received'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {po.status === 'received' ? 'Diterima (Stok Masuk)' : 'Menunggu Pengiriman'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {po.status !== 'received' ? (
                          <button
                            onClick={() => handleReceivePO(po)}
                            disabled={isReceivingId === po.id}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-xs transition flex items-center gap-1 ml-auto"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>{isReceivingId === po.id ? 'Memproses...' : 'Terima Barang'}</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">
                            Diterima: {formatDateTime(po.receivedAt)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SUPPLIERS LIST */}
      {activeTab === 'suppliers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((sup) => (
            <div key={sup.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">{sup.name}</h4>
                  <p className="text-[11px] text-slate-500">Kontak: {sup.contactPerson || '-'}</p>
                </div>
              </div>

              <div className="space-y-1 text-xs text-slate-600 border-t border-slate-100 pt-2">
                <div>Telp: <strong>{sup.phone || '-'}</strong></div>
                <div>Alamat: {sup.address || '-'}</div>
                <div className="text-[11px] text-slate-500">Syarat Bayar: <strong>{sup.paymentTerms}</strong></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL: CREATE PURCHASE ORDER */}
      {isPOModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-base text-slate-900">
                Buat Purchase Order (PO) Bahan Baku
              </h3>
              <button
                onClick={() => setIsPOModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePO} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Pilih Pemasok / Supplier:</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.paymentTerms})
                    </option>
                  ))}
                </select>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700">Daftar Bahan Baku yang Dipesan:</label>
                  <button
                    type="button"
                    onClick={addPOItemRow}
                    className="px-2 py-1 bg-amber-100 text-amber-900 font-bold rounded-lg text-[11px] flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Tambah Baris</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {poItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200"
                    >
                      <select
                        value={item.ingredientId}
                        onChange={(e) => updatePOItemRow(idx, 'ingredientId', e.target.value)}
                        className="flex-1 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                      >
                        {ingredients.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} ({i.unit})
                          </option>
                        ))}
                      </select>

                      <div className="w-24">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updatePOItemRow(idx, 'quantity', Number(e.target.value) || 0)
                          }
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs text-right font-bold"
                          placeholder="Jumlah"
                        />
                      </div>

                      <div className="w-28">
                        <input
                          type="number"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updatePOItemRow(idx, 'unitPrice', Number(e.target.value) || 0)
                          }
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs text-right font-bold"
                          placeholder="Harga Satuan"
                        />
                      </div>

                      <div className="w-28 text-right font-bold text-slate-900 text-xs">
                        {formatRupiah(item.subtotal)}
                      </div>

                      <button
                        type="button"
                        onClick={() => removePOItemRow(idx)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-200 font-bold text-sm">
                  <span>Total Estimasi Tagihan PO:</span>
                  <span className="text-amber-700 text-base">{formatRupiah(poTotalAmount)}</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan Tambahan:</label>
                <input
                  type="text"
                  placeholder="Kirim hari Senin pagi, kemasan tersegel..."
                  value={poNotes}
                  onChange={(e) => setPONotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-50 text-[11px] text-amber-900 border border-amber-200">
                Penting: Stok bahan baku <strong>hanya akan bertambah</strong> saat status PO diubah menjadi "Diterima" oleh staf kafe.
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsPOModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/20"
                >
                  Buat Pesanan PO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD SUPPLIER */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-base text-slate-900">Tambah Pemasok Baru</h3>
              <button
                onClick={() => setIsSupplierModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Perusahaan / Supplier:</label>
                <input
                  type="text"
                  required
                  placeholder="PT Sumber Rasa Kopi"
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Sales / PIC:</label>
                <input
                  type="text"
                  placeholder="Budi Santos"
                  value={supContact}
                  onChange={(e) => setSupContact(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nomor Telepon / WhatsApp:</label>
                <input
                  type="text"
                  placeholder="0812-3456-7890"
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Alamat Gudang:</label>
                <input
                  type="text"
                  placeholder="Kawasan Industri, Jakarta"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Syarat Pembayaran:</label>
                <input
                  type="text"
                  placeholder="COD, Tempo 14 Hari..."
                  value={supTerms}
                  onChange={(e) => setSupTerms(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
                >
                  Simpan Pemasok
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
