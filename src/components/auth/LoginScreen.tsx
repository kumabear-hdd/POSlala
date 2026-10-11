import React, { useEffect, useState } from 'react';
import {
  Coffee,
  Lock,
  User,
  Delete,
  Shield,
  ArrowRight,
  AlertCircle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { UserProfile } from '../../types';
import { useApp } from '../../context/AppContext';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

export const LoginScreen: React.FC = () => {
  const { allUsers, settings, loginWithPIN, factoryReset, showToast } = useApp();

  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(() => {
    return allUsers.length > 0 ? allUsers[0] : null;
  });
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  useEffect(() => {
    if (allUsers.length > 0 && !selectedUser) {
      setSelectedUser(allUsers[0]);
    }
  }, [allUsers, selectedUser]);

  const handleKeyPress = (num: string) => {
    if (pin.length < 6) {
      setErrorMessage(null);
      const nextPin = pin + num;
      setPin(nextPin);
      // Auto-submit if 4 digits and user selected
      if (nextPin.length === 4 && selectedUser) {
        attemptLogin(nextPin, selectedUser.id);
      }
    }
  };

  const handleBackspace = () => {
    setErrorMessage(null);
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setErrorMessage(null);
    setPin('');
  };

  const attemptLogin = async (pinToTry: string, userId?: string) => {
    if (!pinToTry) {
      setErrorMessage('Masukkan PIN Anda.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await loginWithPIN(pinToTry, userId || selectedUser?.id);
      if (!res.success) {
        setErrorMessage(res.message || 'PIN salah. Silakan coba lagi.');
        setPin('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Physical keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Enter') {
        if (pin.length >= 4) {
          attemptLogin(pin, selectedUser?.id);
        }
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, selectedUser]);

  const handleConfirmReset = async () => {
    await factoryReset();
    setShowResetModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between items-center p-4 sm:p-6 text-slate-100 font-sans select-none">
      {/* Top Navbar */}
      <div className="w-full max-w-4xl flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 shadow-md">
            <Coffee className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <h2 className="font-extrabold text-sm text-white tracking-tight">{settings.name}</h2>
            <p className="text-[11px] text-slate-400">POS Lapak Terminal Kasir</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PWAInstallButton variant="navbar" />
          <button
            onClick={() => setShowResetModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-rose-400 border border-slate-800 text-xs font-semibold transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Data Pabrik</span>
          </button>
        </div>
      </div>

      {/* Center PIN Authentication Box */}
      <div className="w-full max-w-sm my-auto space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-black text-white tracking-tight">Masuk ke POS Lapak</h1>
          <p className="text-xs text-slate-400">
            Pilih nama Anda dan masukkan PIN yang telah ditentukan Owner
          </p>
        </div>

        {/* Staff Selector */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">
            Pilih Pengguna / Pekerja:
          </label>
          <div className="grid grid-cols-3 gap-2">
            {allUsers.map((user) => {
              const isSelected = selectedUser?.id === user.id;
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    setSelectedUser(user);
                    setPin('');
                    setErrorMessage(null);
                  }}
                  className={`p-2.5 rounded-2xl border text-center transition flex flex-col items-center gap-1 ${
                    isSelected
                      ? 'border-amber-500 bg-amber-500/20 text-white font-bold ring-2 ring-amber-500/30'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black ${
                      isSelected ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {user.name.charAt(0)}
                  </div>
                  <span className="text-xs truncate w-full">{user.name}</span>
                  <span
                    className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded ${
                      user.role === 'owner'
                        ? 'bg-amber-500/20 text-amber-300'
                        : user.role === 'manager'
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    {user.role}
                  </span>
                </button>
              );
            })}
          </div>

          {allUsers.length <= 1 && (
            <p className="text-[10px] text-amber-400/80 text-center pt-1">
              💡 Pemilik dapat menambahkan pekerja & mengatur PIN mereka di menu <strong>Staf & Peran</strong>.
            </p>
          )}
        </div>

        {/* PIN Display Bullets */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl text-center space-y-4">
          <div className="flex justify-center items-center gap-3 py-2">
            {[0, 1, 2, 3, 4, 5].slice(0, Math.max(4, pin.length)).map((idx) => {
              const isFilled = pin.length > idx;
              return (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full transition duration-150 ${
                    isFilled
                      ? 'bg-amber-400 shadow-md shadow-amber-400/50 scale-110'
                      : 'border-2 border-slate-700 bg-slate-950'
                  }`}
                />
              );
            })}
          </div>

          {errorMessage && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-rose-400 font-semibold bg-rose-500/10 border border-rose-500/20 py-2 px-3 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Numeric Touch Keypad */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleKeyPress(digit)}
                className="h-14 rounded-2xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800 active:scale-95 text-xl font-bold text-white transition flex items-center justify-center shadow-xs"
              >
                {digit}
              </button>
            ))}

            <button
              type="button"
              onClick={handleClear}
              className="h-14 rounded-2xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-xs font-bold text-slate-400 hover:text-white transition flex items-center justify-center"
            >
              Hapus
            </button>

            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              className="h-14 rounded-2xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800 active:scale-95 text-xl font-bold text-white transition flex items-center justify-center shadow-xs"
            >
              0
            </button>

            <button
              type="button"
              onClick={handleBackspace}
              className="h-14 rounded-2xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition flex items-center justify-center"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => attemptLogin(pin, selectedUser?.id)}
            disabled={pin.length < 4 || isSubmitting}
            className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition shadow-lg ${
              pin.length >= 4 && !isSubmitting
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <span>{isSubmitting ? 'Memeriksa PIN...' : 'Masuk ke POS Lapak'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Footer Info */}
      <div className="w-full max-w-sm text-center py-2 text-[11px] text-slate-500">
        PIN ditentukan oleh Owner saat menambahkan staf di menu Staf & Peran.
      </div>

      {/* FACTORY RESET CONFIRMATION MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-extrabold text-base text-rose-500 flex items-center gap-2">
              <RotateCcw className="w-5 h-5" />
              <span>Reset Seluruh Data ke Setelan Pabrik?</span>
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              Tindakan ini akan <strong>menghapus seluruh data kafe</strong> (termasuk semua akun pengguna, produk menu, transaksi penjualan, mutasi stok, dan laporan keuangan).
            </p>

            <p className="text-xs text-amber-300 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
              Setelah reset, Anda akan dialihkan ke layar pendaftaran Akun Pemilik (Owner) baru dari awal.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 font-bold text-xs hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20"
              >
                Ya, Reset Total
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
