import React, { useEffect, useState } from 'react';
import { Printer, X, CheckCircle, WifiOff } from 'lucide-react';
import { Sale } from '../../types';
import { getFromStore } from '../../services/db';
import { formatDateTime, formatRupiah } from '../../utils/format';
import { useApp } from '../../context/AppContext';

export const ReceiptModal: React.FC<{ saleId: string; onClose: () => void }> = ({ saleId, onClose }) => {
  const { settings } = useApp();
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSale() {
      try {
        const data = await getFromStore<Sale>('sales', saleId);
        setSale(data);
      } catch (err) {
        console.error('Failed to load sale receipt:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSale();
  }, [saleId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="bg-white rounded-2xl p-6 text-slate-900 text-center font-medium">
          Memuat struk transaksi...
        </div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="bg-white rounded-2xl p-6 text-slate-900 text-center">
          <p className="font-semibold text-rose-600">Struk tidak ditemukan.</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-slate-100 rounded-lg text-sm">
            Tutup
          </button>
        </div>
      </div>
    );
  }

  const isWidth58 = settings.paperWidth === '58mm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      {/* Container */}
      <div className="relative bg-white text-slate-900 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Modal Action Bar (Hidden when printing via CSS) */}
        <div className="print:hidden flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-sm">Struk Transaksi Penjualan</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Struk</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper */}
        <div
          id="receipt-print-area"
          className={`p-6 bg-white font-mono text-xs leading-relaxed mx-auto text-slate-900 ${
            isWidth58 ? 'max-w-[280px]' : 'max-w-[340px]'
          }`}
        >
          {/* Header */}
          <div className="text-center pb-3 border-b border-dashed border-slate-400">
            <h2 className="text-base font-extrabold uppercase tracking-wider">{settings.name}</h2>
            {settings.tagline && <p className="text-[10px] text-slate-600">{settings.tagline}</p>}
            <p className="text-[10px] text-slate-600 mt-1">{settings.address}</p>
            {settings.phone && <p className="text-[10px] text-slate-600">Telp: {settings.phone}</p>}
          </div>

          {/* Metadata */}
          <div className="py-2.5 border-b border-dashed border-slate-400 text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-600">No. Nota:</span>
              <span className="font-bold">{sale.transactionNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Waktu:</span>
              <span>{formatDateTime(sale.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Kasir:</span>
              <span>{sale.cashierName}</span>
            </div>
            {sale.customerName && (
              <div className="flex justify-between">
                <span className="text-slate-600">Pelanggan:</span>
                <span>{sale.customerName}</span>
              </div>
            )}
            {sale.tableNumber && (
              <div className="flex justify-between">
                <span className="text-slate-600">Meja:</span>
                <span className="font-bold">{sale.tableNumber}</span>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="py-2.5 border-b border-dashed border-slate-400 space-y-2">
            {sale.items.map((item, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="flex justify-between font-semibold">
                  <span className="truncate pr-2">{item.productName}</span>
                  <span>{formatRupiah(item.subtotal)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-600">
                  <span>
                    {item.quantity} x {formatRupiah(item.unitPrice)}
                    {item.selectedVariation && ` (${item.selectedVariation.name})`}
                  </span>
                </div>
                {item.selectedModifiers && Object.keys(item.selectedModifiers).length > 0 && (
                  <div className="text-[9px] text-slate-500 italic">
                    {Object.values(item.selectedModifiers).join(', ')}
                  </div>
                )}
                {item.notes && (
                  <div className="text-[9px] text-slate-500 italic">Catatan: {item.notes}</div>
                )}
              </div>
            ))}
          </div>

          {/* Totals Calculation */}
          <div className="py-2.5 border-b border-dashed border-slate-400 text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal:</span>
              <span>{formatRupiah(sale.subtotal)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Diskon:</span>
                <span>-{formatRupiah(sale.discount)}</span>
              </div>
            )}
            {sale.taxAmount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>PB1 / Pajak ({sale.taxRate}%):</span>
                <span>{formatRupiah(sale.taxAmount)}</span>
              </div>
            )}
            {sale.serviceAmount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Service Fee ({sale.serviceRate}%):</span>
                <span>{formatRupiah(sale.serviceAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm pt-1 border-t border-slate-300">
              <span>TOTAL:</span>
              <span>{formatRupiah(sale.totalAmount)}</span>
            </div>
          </div>

          {/* Payment Details */}
          <div className="py-2.5 border-b border-dashed border-slate-400 text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-600">Metode Bayar:</span>
              <span className="font-bold uppercase">{sale.paymentMethod}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Status Pembayaran:</span>
              <span
                className={`font-bold ${
                  sale.paymentStatus === 'paid'
                    ? 'text-emerald-700'
                    : sale.paymentStatus === 'awaiting_confirmation'
                    ? 'text-amber-600'
                    : 'text-rose-600'
                }`}
              >
                {sale.paymentStatus === 'paid'
                  ? 'LUNAS'
                  : sale.paymentStatus === 'awaiting_confirmation'
                  ? 'MENUNGGU KONFIRMASI'
                  : 'DIBATALKAN'}
              </span>
            </div>

            {sale.paymentMethod === 'cash' && sale.cashTendered !== undefined && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-600">Tunai Diterima:</span>
                  <span>{formatRupiah(sale.cashTendered)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Kembalian:</span>
                  <span>{formatRupiah(sale.cashChange || 0)}</span>
                </div>
              </>
            )}

            {sale.paymentMethod === 'qris' && sale.qrisReference && (
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-600">Ref QRIS:</span>
                <span className="truncate max-w-[150px]">{sale.qrisReference}</span>
              </div>
            )}

            {sale.refundStatus === 'refunded' && (
              <div className="mt-2 p-1.5 rounded bg-rose-50 text-rose-700 text-center font-bold text-[10px] border border-rose-200">
                ** TRANSAKSI DI-REFUND / DIBATALKAN **
              </div>
            )}
          </div>

          {/* Footer & Sync Status */}
          <div className="pt-3 text-center text-[10px] text-slate-600 space-y-1.5">
            <p className="whitespace-pre-line leading-relaxed">{settings.receiptFooter}</p>

            <div className="pt-2 text-[9px] text-slate-400 border-t border-slate-200 flex items-center justify-center gap-1">
              {sale.syncStatus === 'synced' ? (
                <>
                  <CheckCircle className="w-2.5 h-2.5 text-emerald-600 inline" />
                  <span>Tersinkronisasi Cloud</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-2.5 h-2.5 text-amber-600 inline" />
                  <span>Tersimpan di IndexedDB Lokal</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Print Stylesheet */}
        <style>{`
          @media print {
            body * {
              visibility: hidden;
            }
            #receipt-print-area, #receipt-print-area * {
              visibility: visible;
            }
            #receipt-print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              padding: 10px;
            }
          }
        `}</style>
      </div>
    </div>
  );
};
