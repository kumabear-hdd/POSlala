import React, { useState } from 'react';
import { Download, HelpCircle, X, Smartphone, Check } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ variant?: 'navbar' | 'banner' | 'settings' }> = ({ variant = 'navbar' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  if (isInstalled) {
    if (variant === 'settings') {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 text-xs font-semibold border border-emerald-500/20">
          <Check className="w-4 h-4 text-emerald-600" />
          Aplikasi sudah terinstal di perangkat ini (PWA Standalone)
        </div>
      );
    }
    return null;
  }

  const handleInstallClick = async () => {
    setIsInstalling(true);
    try {
      await install();
    } finally {
      setIsInstalling(false);
    }
  };

  if (isInstallable) {
    if (variant === 'settings') {
      return (
        <button
          onClick={handleInstallClick}
          disabled={isInstalling}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm"
        >
          <Download className="w-4 h-4" />
          {isInstalling ? 'Memasang Aplikasi...' : 'Pasang Aplikasi POS Lapak (PWA)'}
        </button>
      );
    }

    return (
      <button
        onClick={handleInstallClick}
        disabled={isInstalling}
        title="Pasang POS Lapak sebagai aplikasi offline"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-semibold text-xs transition shadow-sm"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-700 text-slate-300 hover:bg-slate-800 transition ${
            variant === 'settings' ? 'bg-slate-800 px-4 py-2 text-sm text-slate-200' : ''
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 text-amber-400" />
          <span>Pasang di iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-amber-500" />
                  <h3 className="font-semibold text-base">Pasang di iPhone / iPad</h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold shrink-0">
                    1
                  </span>
                  <p>
                    Buka situs ini di browser <strong>Safari</strong> pada iPhone/iPad Anda.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold shrink-0">
                    2
                  </span>
                  <p>
                    Tekan tombol <strong>Bagikan / Share</strong> (ikon kotak panah ke atas) di menu bawah Safari.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold shrink-0">
                    3
                  </span>
                  <p>
                    Gulir ke bawah dan pilih opsi <strong>Add to Home Screen (Tambah ke Layar Utama)</strong>.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm transition"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  if (variant === 'settings') {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <HelpCircle className="w-4 h-4" />
        PWA dapat dipasang melalui menu browser (Chrome / Edge / Safari).
      </div>
    );
  }

  return null;
};
