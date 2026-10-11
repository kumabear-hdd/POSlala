import React, { useState } from 'react';
import { Coffee, ShieldCheck, ArrowRight, Store, User, Lock, Mail, Phone, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const RegisterOwnerScreen: React.FC = () => {
  const { registerOwner, seedSampleData, showToast } = useApp();

  const [cafeName, setCafeName] = useState('POS Lapak Kopi');
  const [ownerName, setOwnerName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [includeDemoMenu, setIncludeDemoMenu] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cafeName.trim()) {
      showToast('Nama kafe/toko wajib diisi.', 'warning');
      return;
    }
    if (!ownerName.trim()) {
      showToast('Nama lengkap pemilik (owner) wajib diisi.', 'warning');
      return;
    }
    if (!pin || pin.length < 4 || pin.length > 6) {
      showToast('PIN login harus berupa 4-6 digit angka.', 'warning');
      return;
    }
    if (pin !== confirmPin) {
      showToast('Konfirmasi PIN tidak cocok dengan PIN yang dibuat.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await registerOwner(cafeName, ownerName, pin, email, phone);
      if (includeDemoMenu) {
        await seedSampleData();
      }
    } catch (err: any) {
      showToast(`Gagal mendaftar: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100 font-sans selection:bg-amber-500 selection:text-white">
      {/* Background ambient decoration */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 mx-auto shadow-2xl shadow-amber-500/20">
            <Coffee className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Selamat Datang di POS Lapak
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Daftarkan Akun Pemilik (Owner) untuk Memulai Operasional Kafe Anda
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="text-amber-200">Hak Akses Pemilik (Owner):</strong>
              <p className="text-[11px] text-amber-300/90 leading-relaxed">
                Sebagai pendaftar pertama, Anda bertindak sebagai Owner. Anda dapat mengelola seluruh menu, laporan laba rugi, serta menambahkan pekerja kasir & manajer dengan PIN mereka masing-masing.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-amber-500" />
                <span>Nama Usaha Kafe / Kedai:</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Kopi Lapak Melawai"
                value={cafeName}
                onChange={(e) => setCafeName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-500" />
                <span>Nama Lengkap Pemilik (Owner):</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Budi Hartono"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-amber-500" />
                  <span>No. WhatsApp / HP:</span>
                </label>
                <input
                  type="text"
                  placeholder="0812-3456-7890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-amber-500" />
                  <span>Email (Opsional):</span>
                </label>
                <input
                  type="email"
                  placeholder="owner@poslapak.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Buat PIN Masuk (4-6 Angka):</span>
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  placeholder="Contoh: 1234"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-bold tracking-widest text-center focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Konfirmasi PIN:</span>
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  placeholder="Ketik ulang PIN"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm font-bold tracking-widest text-center focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                <input
                  type="checkbox"
                  checked={includeDemoMenu}
                  onChange={(e) => setIncludeDemoMenu(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-amber-500 focus:ring-amber-500 w-4 h-4 bg-slate-900"
                />
                <div className="text-[11px] text-slate-300">
                  <span className="font-bold text-white block">Muat contoh menu kopi & resep awal (Opsional)</span>
                  <span className="text-slate-500 text-[10px]">
                    Biarkan tidak dicentang jika Anda ingin memulai dari menu kosong 100%.
                  </span>
                </div>
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-4 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 transition disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Mendaftarkan Akun...' : 'Daftar Sebagai Owner & Masuk'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-500">
          Sistem POS Lapak • Offline-First PWA • Data tersimpan aman di perangkat lokal Anda
        </div>
      </div>
    </div>
  );
};
