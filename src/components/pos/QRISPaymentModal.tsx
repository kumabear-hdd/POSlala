import React, { useState } from 'react';
import { QrCode, ShieldAlert, CheckCircle2, Clock, X, AlertTriangle } from 'lucide-react';
import { formatRupiah } from '../../utils/format';
import { useApp } from '../../context/AppContext';

interface QRISPaymentModalProps {
  amount: number;
  transactionNumber: string;
  onCancel: () => void;
  onSaveAsAwaitingConfirmation: () => void;
  onConfirmVerifiedPayment: (referenceCode: string) => void;
}

export const QRISPaymentModal: React.FC<QRISPaymentModalProps> = ({
  amount,
  transactionNumber,
  onCancel,
  onSaveAsAwaitingConfirmation,
  onConfirmVerifiedPayment,
}) => {
  const { settings } = useApp();
  const [refCode, setRefCode] = useState('');
  const [showConfirmCheck, setShowConfirmCheck] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Pembayaran QRIS</h3>
              <p className="text-xs text-slate-400">{transactionNumber}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Graphic and Amount */}
        <div className="bg-white rounded-2xl p-5 text-slate-900 text-center shadow-inner space-y-3">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase pb-2 border-b border-slate-200">
            <span>QRIS Standar BI</span>
            <span>NMID: {settings.qrisNmid || 'ID1020304050607'}</span>
          </div>

          <div className="text-sm font-extrabold text-slate-900">
            {settings.qrisMerchantName || 'POS LAPAK INDONESIA'}
          </div>

          {/* Realistic Scalable QR Code Graphic SVG */}
          <div className="py-2 flex justify-center">
            <svg
              className="w-44 h-44 border-4 border-slate-900 p-2 rounded-xl bg-white"
              viewBox="0 0 100 100"
            >
              {/* Corner markers */}
              <rect x="5" y="5" width="28" height="28" fill="#0f172a" rx="4" />
              <rect x="9" y="9" width="20" height="20" fill="#ffffff" rx="2" />
              <rect x="13" y="13" width="12" height="12" fill="#0f172a" rx="1" />

              <rect x="67" y="5" width="28" height="28" fill="#0f172a" rx="4" />
              <rect x="71" y="9" width="20" height="20" fill="#ffffff" rx="2" />
              <rect x="75" y="13" width="12" height="12" fill="#0f172a" rx="1" />

              <rect x="5" y="67" width="28" height="28" fill="#0f172a" rx="4" />
              <rect x="9" y="71" width="20" height="20" fill="#ffffff" rx="2" />
              <rect x="13" y="75" width="12" height="12" fill="#0f172a" rx="1" />

              {/* Data pattern squares */}
              <rect x="38" y="10" width="8" height="8" fill="#0f172a" />
              <rect x="50" y="10" width="8" height="8" fill="#0f172a" />
              <rect x="38" y="24" width="8" height="8" fill="#0f172a" />
              <rect x="50" y="24" width="8" height="8" fill="#0f172a" />

              <rect x="10" y="38" width="8" height="8" fill="#0f172a" />
              <rect x="24" y="38" width="8" height="8" fill="#0f172a" />
              <rect x="38" y="38" width="24" height="24" fill="#0f172a" rx="2" />
              <circle cx="50" cy="50" r="6" fill="#ffffff" />
              <circle cx="50" cy="50" r="3" fill="#f59e0b" />

              <rect x="68" y="38" width="8" height="8" fill="#0f172a" />
              <rect x="82" y="38" width="8" height="8" fill="#0f172a" />

              <rect x="38" y="68" width="8" height="8" fill="#0f172a" />
              <rect x="50" y="68" width="8" height="8" fill="#0f172a" />
              <rect x="38" y="82" width="8" height="8" fill="#0f172a" />
              <rect x="50" y="82" width="8" height="8" fill="#0f172a" />

              <rect x="68" y="68" width="10" height="10" fill="#0f172a" />
              <rect x="80" y="80" width="12" height="12" fill="#0f172a" />
            </svg>
          </div>

          <div className="pt-1">
            <span className="text-xs text-slate-500">Total Nominal Pembayaran:</span>
            <div className="text-2xl font-black text-slate-950 tracking-tight">
              {formatRupiah(amount)}
            </div>
          </div>
        </div>

        {/* Safety Warning Notice (Crucial requirement) */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="text-amber-200">Protokol Keamanan QRIS:</strong>
            <p className="text-[11px] leading-relaxed text-amber-300/90">
              Menampilkan QRIS tidak otomatis menandakan pembayaran telah lunas. Pastikan dana benar-benar telah masuk ke notifikasi rekening/EDC sebelum memverifikasi lunas.
            </p>
          </div>
        </div>

        {/* Verification Actions */}
        <div className="space-y-3 pt-1">
          {!showConfirmCheck ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={onSaveAsAwaitingConfirmation}
                className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold border border-slate-700 transition"
              >
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Simpan (Menunggu Konfirmasi)</span>
              </button>

              <button
                onClick={() => setShowConfirmCheck(true)}
                className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Verifikasi Diterima</span>
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Konfirmasi Verifikasi Pembayaran</span>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Nomor Referensi / RRN Bank (Opsional):
                </label>
                <input
                  type="text"
                  placeholder="Contoh: REF987654321 / BCA-012"
                  value={refCode}
                  onChange={(e) => setRefCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowConfirmCheck(false)}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium"
                >
                  Kembali
                </button>
                <button
                  onClick={() => onConfirmVerifiedPayment(refCode || `MANUAL-${Date.now()}`)}
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                >
                  Tandai LUNAS
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
