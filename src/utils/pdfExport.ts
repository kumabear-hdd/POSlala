import jsPDF from 'jspdf';
import { formatRupiah, formatDate, formatDateTime } from './format';
import { CafeSettings, Expense, Sale } from '../types';

export interface MonthlyFinancialReportData {
  settings: CafeSettings;
  startDate: string;
  endDate: string;
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  grossMargin: number;
  totalExpenses: number;
  operatingProfit: number;
  netMargin: number;
  paidSalesCount: number;
  refundedCount: number;
  totalRefundAmount: number;
  expenses: Expense[];
  dailyTrends: { date: string; displayDate: string; revenue: number; orderCount: number }[];
  paymentBreakdown: { method: string; label: string; count: number; total: number; percentage: number }[];
}

export function exportFinancialReportPDF(data: MonthlyFinancialReportData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 14;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
      return true;
    }
    return false;
  };

  // Header banner background
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(margin, y, pageWidth - margin * 2, 28, 3, 3, 'F');

  // Cafe branding title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(data.settings.name || 'POS LAPAK', margin + 6, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225); // slate-300
  const addressLine = `${data.settings.address || 'Kafe & Resto'} • Telp: ${data.settings.phone || '-'}`;
  doc.text(addressLine, margin + 6, y + 16);

  // Right-aligned report badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(245, 158, 11); // amber-500
  doc.text('LAPORAN KEUANGAN BULANAN', pageWidth - margin - 6, y + 10, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(226, 232, 240);
  const periodText = `Periode: ${formatDate(data.startDate)} s/d ${formatDate(data.endDate)}`;
  doc.text(periodText, pageWidth - margin - 6, y + 16, { align: 'right' });

  const generatedText = `Dicetak: ${formatDateTime(new Date().toISOString())}`;
  doc.text(generatedText, pageWidth - margin - 6, y + 22, { align: 'right' });

  y += 34;

  // Key Financial Metric Highlights (4 Cards)
  const cardWidth = (pageWidth - margin * 2 - 9) / 4;
  const cardHeight = 22;

  const cards = [
    { label: 'Total Omzet (Revenue)', value: formatRupiah(data.totalRevenue), bg: [240, 253, 244], border: [187, 247, 208], text: [22, 101, 52] }, // emerald
    { label: 'HPP Bahan (COGS)', value: formatRupiah(data.totalCOGS), bg: [254, 243, 199], border: [253, 230, 138], text: [146, 64, 14] }, // amber
    { label: 'Beban Operasional', value: formatRupiah(data.totalExpenses), bg: [255, 241, 242], border: [254, 205, 211], text: [159, 18, 57] }, // rose
    { label: 'Laba Bersih Kafe', value: formatRupiah(data.operatingProfit), bg: [241, 245, 249], border: [203, 213, 225], text: [15, 23, 42] }, // slate
  ];

  cards.forEach((c, idx) => {
    const cx = margin + idx * (cardWidth + 3);
    doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
    doc.setDrawColor(c.border[0], c.border[1], c.border[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(cx, y, cardWidth, cardHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(c.label, cx + 3, y + 6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(c.text[0], c.text[1], c.text[2]);
    doc.text(c.value, cx + 3, y + 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    if (idx === 0) doc.text(`${data.paidSalesCount} Transaksi Lunas`, cx + 3, y + 19);
    if (idx === 1) doc.text(`Margin Kotor: ${data.grossMargin}%`, cx + 3, y + 19);
    if (idx === 2) doc.text(`${data.expenses.length} Item Beban`, cx + 3, y + 19);
    if (idx === 3) doc.text(`Margin Bersih: ${data.netMargin}%`, cx + 3, y + 19);
  });

  y += cardHeight + 8;

  // Section 1: Laporan Laba Rugi Komprehensif (Detailed Income Statement Table)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Laporan Laba Rugi Komprehensif', margin, y);
  y += 4;

  const isItems = [
    { label: 'Pendapatan Penjualan Bersih (Sales Revenue)', note: `${data.paidSalesCount} transaksi lunas`, value: formatRupiah(data.totalRevenue), isBold: true, isPositive: true },
    { label: 'Harga Pokok Penjualan (HPP / COGS Resep Bahan Baku)', note: `Estimasi pemakaian bahan baku terjual (${data.totalRevenue > 0 ? Math.round((data.totalCOGS / data.totalRevenue) * 100) : 0}%)`, value: `(${formatRupiah(data.totalCOGS)})`, isBold: false, isPositive: false },
    { label: 'LABA KOTOR (GROSS PROFIT)', note: `Margin Kotor: ${data.grossMargin}%`, value: formatRupiah(data.grossProfit), isHighlight: true, isPositive: data.grossProfit >= 0 },
    { label: 'Total Beban Operasional Kafe', note: `${data.expenses.length} pengeluaran operasional & utilitas`, value: `(${formatRupiah(data.totalExpenses)})`, isBold: false, isPositive: false },
    { label: 'LABA BERSIH OPERASIONAL (NET OPERATING PROFIT)', note: `Margin Bersih: ${data.netMargin}% dari total omzet`, value: formatRupiah(data.operatingProfit), isFinal: true, isPositive: data.operatingProfit >= 0 },
  ];

  isItems.forEach((row) => {
    checkPageBreak(12);
    if (row.isFinal) {
      doc.setFillColor(15, 23, 42);
      doc.rect(margin, y, pageWidth - margin * 2, 11, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(row.label, margin + 4, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(203, 213, 225);
      doc.text(row.note, margin + 4, y + 9);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(row.isPositive ? 251 : 248, row.isPositive ? 191 : 113, row.isPositive ? 36 : 113); // amber or red
      doc.text(row.value, pageWidth - margin - 4, y + 7, { align: 'right' });
      y += 13;
    } else if (row.isHighlight) {
      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(187, 247, 208);
      doc.rect(margin, y, pageWidth - margin * 2, 9, 'FD');
      doc.setTextColor(22, 101, 52);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(row.label, margin + 4, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(74, 222, 128);
      doc.text(` (${row.note})`, margin + 65, y + 6);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(22, 101, 52);
      doc.text(row.value, pageWidth - margin - 4, y + 6, { align: 'right' });
      y += 10.5;
    } else {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(241, 245, 249);
      doc.rect(margin, y, pageWidth - margin * 2, 8.5, 'FD');
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', row.isBold ? 'bold' : 'normal');
      doc.setFontSize(8);
      doc.text(row.label, margin + 4, y + 5.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(row.isPositive ? 16 : 225, row.isPositive ? 185 : 29, row.isPositive ? 129 : 72);
      doc.text(row.value, pageWidth - margin - 4, y + 5.5, { align: 'right' });
      y += 9.5;
    }
  });

  y += 4;

  // Section 2: Ringkasan Omzet 30 Hari Terakhir & Tren Harian (Top 10 Dates)
  checkPageBreak(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Rincian & Tren Omzet Harian (30 Hari Terakhir)', margin, y);
  y += 5;

  // Table Header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, pageWidth - margin * 2, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Tanggal', margin + 3, y + 4.5);
  doc.text('Jumlah Transaksi', margin + 45, y + 4.5);
  doc.text('Omzet Harian', margin + 95, y + 4.5);
  doc.text('Kontribusi %', pageWidth - margin - 4, y + 4.5, { align: 'right' });
  y += 7.5;

  // Show days that have revenue, or last 15 days if many
  const activeDays = data.dailyTrends.filter((d) => d.revenue > 0);
  const displayDays = activeDays.length > 0 ? activeDays.slice(-15) : data.dailyTrends.slice(-10);

  displayDays.forEach((day, index) => {
    checkPageBreak(7);
    const isEven = index % 2 === 0;
    if (isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, pageWidth - margin * 2, 6, 'F');
    }
    const dayContrib = data.totalRevenue > 0 ? Math.round((day.revenue / data.totalRevenue) * 1000) / 10 : 0;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(formatDate(day.date), margin + 3, y + 4.2);
    doc.text(`${day.orderCount} transaksi`, margin + 45, y + 4.2);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(formatRupiah(day.revenue), margin + 95, y + 4.2);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`${dayContrib}%`, pageWidth - margin - 4, y + 4.2, { align: 'right' });
    y += 6.5;
  });

  y += 4;

  // Section 3: Komposisi Metode Pembayaran
  checkPageBreak(35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('3. Komposisi Metode Pembayaran', margin, y);
  y += 5;

  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, pageWidth - margin * 2, 6.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Metode Pembayaran', margin + 3, y + 4.5);
  doc.text('Total Transaksi', margin + 65, y + 4.5);
  doc.text('Total Nominal', margin + 115, y + 4.5);
  doc.text('Porsi (%)', pageWidth - margin - 4, y + 4.5, { align: 'right' });
  y += 7.5;

  data.paymentBreakdown.forEach((pm, index) => {
    checkPageBreak(7);
    if (index % 2 === 0) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, pageWidth - margin * 2, 6, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(pm.label, margin + 3, y + 4.2);
    doc.text(`${pm.count} transaksi`, margin + 65, y + 4.2);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(formatRupiah(pm.total), margin + 115, y + 4.2);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`${pm.percentage}%`, pageWidth - margin - 4, y + 4.2, { align: 'right' });
    y += 6.5;
  });

  y += 8;

  // Signatures / Validation Footer
  checkPageBreak(30);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    '* Laporan keuangan ini di-generate secara otomatis melalui sistem POS Lapak. Seluruh kalkulasi tersinkronisasi dengan transaksi lokal & cloud.',
    margin,
    y
  );
  y += 10;

  // Signature columns
  const colW = (pageWidth - margin * 2) / 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Disiapkan oleh Sistem POS Lapak', margin + 15, y);
  doc.text('Disetujui oleh Pemilik Kafe (Owner)', margin + colW + 15, y);

  y += 16;
  doc.setDrawColor(148, 163, 184);
  doc.line(margin + 10, y, margin + 65, y);
  doc.line(margin + colW + 10, y, margin + colW + 65, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('( Kasir & Sistem Operasional )', margin + 15, y + 4);
  doc.text(`( ${data.settings.name || 'Owner Kafe'} )`, margin + colW + 18, y + 4);

  // Save PDF
  const filename = `Laporan_Keuangan_${data.settings.name ? data.settings.name.replace(/\s+/g, '_') : 'Kafe'}_${data.startDate}_sd_${data.endDate}.pdf`;
  doc.save(filename);
}
