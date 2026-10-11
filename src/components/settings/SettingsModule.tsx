import React, { useState } from 'react';
import {
  Settings,
  Store,
  Printer,
  QrCode,
  ShieldAlert,
  Database,
  Download,
  Upload,
  Save,
  CheckCircle,
  HelpCircle,
  ExternalLink,
  Code2,
} from 'lucide-react';
import { CafeSettings } from '../../types';
import { useApp } from '../../context/AppContext';
import { PWAInstallButton } from '../pwa/PWAInstallButton';
import { getAllFromStore, putToStore } from '../../services/db';

export const SettingsModule: React.FC = () => {
  const {
    settings,
    updateSettings,
    showToast,
    factoryReset,
    resetTransactions,
    seedSampleData,
  } = useApp();

  const [formData, setFormData] = useState<CafeSettings>({ ...settings });
  const [isSaving, setIsSaving] = useState(false);
  const [showSQLModal, setShowSQLModal] = useState(false);
  const [showResetAllModal, setShowResetAllModal] = useState(false);
  const [showResetTxModal, setShowResetTxModal] = useState(false);

  const handleChange = (field: keyof CafeSettings, val: any) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateSettings(formData);
    } finally {
      setIsSaving(false);
    }
  };

  // Export Full IndexedDB Backup as JSON
  const handleExportBackup = async () => {
    try {
      const [
        cafe_settings,
        profiles,
        categories,
        ingredients,
        products,
        sales,
        inventory_movements,
        suppliers,
        purchase_orders,
        expenses,
        cash_sessions,
        refunds,
      ] = await Promise.all([
        getAllFromStore('cafe_settings'),
        getAllFromStore('profiles'),
        getAllFromStore('categories'),
        getAllFromStore('ingredients'),
        getAllFromStore('products'),
        getAllFromStore('sales'),
        getAllFromStore('inventory_movements'),
        getAllFromStore('suppliers'),
        getAllFromStore('purchase_orders'),
        getAllFromStore('expenses'),
        getAllFromStore('cash_sessions'),
        getAllFromStore('refunds'),
      ]);

      const backupData = {
        app: 'POS Lapak',
        version: '1.2.0',
        exportedAt: new Date().toISOString(),
        data: {
          cafe_settings,
          profiles,
          categories,
          ingredients,
          products,
          sales,
          inventory_movements,
          suppliers,
          purchase_orders,
          expenses,
          cash_sessions,
          refunds,
        },
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `POSLapak_Backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      showToast('Cadangan data lokal (JSON) berhasil diekspor.', 'success');
    } catch (err: any) {
      showToast(`Gagal mengekspor data: ${err.message}`, 'error');
    }
  };

  // Import Backup JSON
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed.data) {
          throw new Error('Format file cadangan tidak valid.');
        }

        if (
          !window.confirm(
            'PERINGATAN: Memulihkan cadangan akan menimpa/memperbarui data lokal Anda. Lanjutkan?'
          )
        ) {
          return;
        }

        for (const [storeName, items] of Object.entries(parsed.data)) {
          if (Array.isArray(items)) {
            for (const item of items) {
              await putToStore(storeName, item);
            }
          }
        }

        showToast('Pemulihan cadangan data berhasil diselesaikan!', 'success');
        setTimeout(() => window.location.reload(), 1000);
      } catch (err: any) {
        showToast(`Gagal memulihkan file: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-50 space-y-6">
      {/* Top Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Pengaturan Sistem POS Lapak
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Konfigurasi identitas kafe, pajak, struk thermal, QRIS, instalasi PWA, serta integrasi Supabase.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        {/* SECTION 1: PROFIL KAFE */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Store className="w-4 h-4 text-amber-500" />
            <span>Identitas & Profil Kafe</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nama Usaha / Kafe:</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Tagline Slogan:</label>
              <input
                type="text"
                value={formData.tagline}
                onChange={(e) => handleChange('tagline', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Nomor Telepon / WhatsApp:</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Email Resmi:</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Alamat Lengkap:</label>
              <textarea
                rows={2}
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: PAJAK & STRUK THERMAL */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Printer className="w-4 h-4 text-amber-500" />
            <span>Pajak, Biaya Layanan & Format Struk</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Pajak Restoran PB1 (%):</label>
              <input
                type="number"
                min="0"
                max="50"
                step="0.5"
                value={formData.taxPercentage}
                onChange={(e) => handleChange('taxPercentage', Number(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
              />
              <p className="text-[10px] text-slate-400 mt-1">Isi 0 jika harga sudah termasuk pajak (Nett).</p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Biaya Layanan Service Fee (%):</label>
              <input
                type="number"
                min="0"
                max="50"
                step="0.5"
                value={formData.servicePercentage}
                onChange={(e) => handleChange('servicePercentage', Number(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Ukuran Kertas Printer:</label>
              <select
                value={formData.paperWidth}
                onChange={(e) => handleChange('paperWidth', e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
              >
                <option value="58mm">58mm (Printer Kasir Mini Thermal)</option>
                <option value="80mm">80mm (Printer Kasir Standard Thermal)</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block font-bold text-slate-700 mb-1">Catatan Kaki Struk (Footer):</label>
              <textarea
                rows={2}
                value={formData.receiptFooter}
                onChange={(e) => handleChange('receiptFooter', e.target.value)}
                placeholder="Terima kasih atas kunjungan Anda..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: QRIS & SINGLE CASHIER POLICY */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <QrCode className="w-4 h-4 text-amber-500" />
            <span>Pengaturan QRIS & Kebijakan Kasir Offline Tunggal</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Nama Merchant QRIS BI:</label>
              <input
                type="text"
                value={formData.qrisMerchantName}
                onChange={(e) => handleChange('qrisMerchantName', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">NMID QRIS:</label>
              <input
                type="text"
                value={formData.qrisNmid}
                onChange={(e) => handleChange('qrisNmid', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-700" />
              <strong className="text-amber-900">Kebijakan Kasir Offline Tunggal (Single-Active Cashier Policy):</strong>
            </div>
            <p className="text-amber-800 text-[11px] leading-relaxed">
              Untuk menjamin konsistensi stok dan mencegah konflik inventaris ganda ketika internet terputus, hanya 1 perangkat kasir aktif yang diizinkan memotong stok resep offline. Sinkronisasi multi-kasir otomatis merekonsiliasi transaksi berdasarkan urutan timestamp dan operation ID unik.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="singleCashierToggle"
                checked={formData.singleCashierMode}
                onChange={(e) => handleChange('singleCashierMode', e.target.checked)}
                className="rounded text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="singleCashierToggle" className="font-bold text-amber-950">
                Aktifkan penguncian keselamatan Single-Active Offline Cashier
              </label>
            </div>
          </div>
        </div>

        {/* SECTION 4: PROGRESSIVE WEB APP (PWA) INSTALLATION */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <Download className="w-4 h-4 text-amber-500" />
              <span>Instalasi Progressive Web App (PWA)</span>
            </h3>
            <PWAInstallButton variant="settings" />
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            POS Lapak dapat dipasang langsung ke layar beranda Windows, Mac, Android, dan iPhone/iPad tanpa melalui Google Play atau App Store. Aplikasi berjalan cepat dan dapat membuka POS bahkan saat koneksi internet mati.
          </p>
        </div>

        {/* SECTION 5: BACKUP & RESTORE DATA */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Database className="w-4 h-4 text-amber-500" />
            <span>Cadangan & Pemulihan Data (Backup / Restore)</span>
          </h3>

          <p className="text-xs text-slate-500 leading-relaxed">
            Simpan seluruh data kafe Anda (produk, resep, transaksi penjualan, mutasi stok, laporan pengeluaran) ke dalam file JSON lokal yang dapat dipulihkan kapan saja.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExportBackup}
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition"
            >
              <Download className="w-4 h-4 text-amber-400" />
              <span>Unduh Cadangan JSON (Backup)</span>
            </button>

            <label className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-xs cursor-pointer transition">
              <Upload className="w-4 h-4 text-slate-500" />
              <span>Pulihkan Data dari JSON (Restore)</span>
              <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
            </label>
          </div>
        </div>

        {/* SECTION 6: SUPABASE CLOUD SYNC CONFIGURATION */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              <span>Konfigurasi Supabase Cloud Database (Opsional)</span>
            </h3>

            <button
              type="button"
              onClick={() => setShowSQLModal(true)}
              className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Lihat Skrip SQL Supabase</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Supabase Project URL:</label>
              <input
                type="text"
                placeholder="https://xyzcompany.supabase.co"
                value={formData.supabaseUrl || ''}
                onChange={(e) => handleChange('supabaseUrl', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Supabase Anon Key (Public):</label>
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={formData.supabaseAnonKey || ''}
                onChange={(e) => handleChange('supabaseAnonKey', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Jika dikosongkan, POS Lapak tetap berjalan 100% fungsional menggunakan IndexedDB offline-first lokal dengan relay sinkronisasi otomatis.
          </p>
        </div>

        {/* SECTION 7: DANGER ZONE & RESET DATA */}
        <div className="bg-rose-50/60 border border-rose-200 p-5 rounded-3xl space-y-4">
          <div className="border-b border-rose-200 pb-3">
            <h3 className="font-extrabold text-sm text-rose-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>Zona Bahaya: Reset & Pembersihan Data Toko</span>
            </h3>
            <p className="text-xs text-rose-700/80 mt-1">
              Gunakan opsi ini jika Anda ingin mengosongkan seluruh data untuk memulai kafe baru atau membersihkan transaksi uji coba.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Factory Reset */}
            <div className="p-4 rounded-2xl bg-white border border-rose-200 flex flex-col justify-between space-y-3 shadow-xs">
              <div>
                <h4 className="font-extrabold text-xs text-rose-700">
                  Kosongkan Semua Data (Reset Total)
                </h4>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  Menghapus <strong>seluruh data</strong> di IndexedDB: semua akun staf & Owner, produk menu, inventaris, transaksi, dan pengeluaran. POS Lapak akan kembali ke kondisi kosong bersih.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowResetAllModal(true)}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs shadow-sm transition"
              >
                Kosongkan Semua Data
              </button>
            </div>

            {/* 2. Reset Transactions Only */}
            <div className="p-4 rounded-2xl bg-white border border-amber-200 flex flex-col justify-between space-y-3 shadow-xs">
              <div>
                <h4 className="font-extrabold text-xs text-amber-800">
                  Kosongkan Riwayat Transaksi Saja
                </h4>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  Menghapus seluruh riwayat penjualan, pengeluaran, mutasi stok, dan shift kasir. <strong>Katalog produk & akun pekerja tetap tersimpan.</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowResetTxModal(true)}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition"
              >
                Kosongkan Transaksi Saja
              </button>
            </div>

            {/* 3. Load Sample Demo */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between space-y-3 shadow-xs">
              <div>
                <h4 className="font-extrabold text-xs text-slate-800">
                  Muat Menu Contoh (Demo)
                </h4>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                  Tambahkan 4 menu kopi & makanan beserta bahan baku resep untuk keperluan pengujian transaksi tanpa mengetik manual.
                </p>
              </div>

              <button
                type="button"
                onClick={async () => {
                  if (window.confirm('Muat contoh menu kopi & resep ke katalog?')) {
                    await seedSampleData();
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-sm transition"
              >
                Muat Menu Contoh
              </button>
            </div>
          </div>
        </div>

        {/* SAVE BUTTON */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm flex items-center gap-2 shadow-md shadow-amber-500/20 transition"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Semua Pengaturan'}</span>
          </button>
        </div>
      </form>

      {/* MODAL: VIEW SUPABASE SQL */}
      {showSQLModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-base text-slate-900">
                Skrip SQL DDL & Row Level Security (RLS) Supabase
              </h3>
              <button onClick={() => setShowSQLModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Jalankan skrip ini di SQL Editor pada dashboard proyek Supabase Anda untuk membuat seluruh tabel dan kebijakan keamanan data:
            </p>

            <div className="flex-1 overflow-y-auto bg-slate-900 text-slate-200 p-4 rounded-xl font-mono text-[11px] leading-relaxed">
              <pre>{`-- File: src/db/schema.sql
-- Tersedia di repositori POS Lapak
CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  transaction_number VARCHAR(50) UNIQUE NOT NULL,
  operation_id UUID UNIQUE NOT NULL, -- Idempotency key
  cashier_name VARCHAR(100) NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  payment_status VARCHAR(30) NOT NULL,
  items_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read sales" ON sales FOR SELECT USING (true);
CREATE POLICY "Public insert sales" ON sales FOR INSERT WITH CHECK (true);
`}</pre>
            </div>

            <button
              onClick={() => setShowSQLModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs"
            >
              Tutup Panduan SQL
            </button>
          </div>
        </div>
      )}

      {/* MODAL: FACTORY RESET CONFIRMATION */}
      {showResetAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-extrabold text-base text-rose-500 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" />
              <span>Konfirmasi: Kosongkan Seluruh Data Toko?</span>
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              Tindakan ini akan <strong>menghapus bersih seluruh data</strong> di database lokal perangkat Anda:
            </p>

            <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside bg-slate-950 p-3 rounded-xl border border-slate-800">
              <li>Akun Pemilik (Owner) & seluruh akun staf/pekerja</li>
              <li>Seluruh daftar produk menu & kategori</li>
              <li>Seluruh inventaris bahan baku & resep</li>
              <li>Seluruh riwayat transaksi penjualan & pengeluaran</li>
              <li>Seluruh catatan shift kasir & audit log</li>
            </ul>

            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold">
              ⚠️ Setelah reset selesai, Anda akan dialihkan ke layar pendaftaran Owner baru dari awal (Kondisi 100% Kosong).
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetAllModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-bold text-xs hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  await factoryReset();
                  setShowResetAllModal(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/30"
              >
                Ya, Kosongkan Semua
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RESET TRANSACTIONS ONLY CONFIRMATION */}
      {showResetTxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-extrabold text-base text-amber-500 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" />
              <span>Kosongkan Riwayat Transaksi Saja?</span>
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              Tindakan ini akan menghapus riwayat penjualan kasir, laporan pengeluaran, mutasi stok penjualan, dan sesi shift kasir.
            </p>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
              ✓ Daftar menu produk, bahan baku, dan akun staf <strong>TETAP AMAN</strong> dan tidak dihapus.
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetTxModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-bold text-xs hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  await resetTransactions();
                  setShowResetTxModal(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
              >
                Ya, Bersihkan Transaksi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
