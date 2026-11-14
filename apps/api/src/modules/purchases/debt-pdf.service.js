const PDFDocument = require('pdfkit');

class DebtPdfService {
  generateDebtReportPdf(debts, dateRange, res) {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    const formatDate = (value) => value
      ? new Date(value).toLocaleDateString('id-ID')
      : '-';
    const formatAmount = (value) => `Rp ${(Number(value) || 0).toLocaleString('id-ID')}`;
    const formatRangeDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString('id-ID');
    const totalRemaining = debts.reduce(
      (total, debt) => total + (Number(debt.amount_remaining) || 0),
      0
    );

    const drawHeader = (continued = false) => {
      doc
        .fontSize(continued ? 12 : 18)
        .font('Helvetica-Bold')
        .text(continued ? 'DAFTAR HUTANG (LANJUTAN)' : 'DAFTAR HUTANG PEMBELIAN', 40, 40)
        .fontSize(10)
        .font('Helvetica')
        .text(`Periode transaksi: ${formatRangeDate(dateRange.startDate)} - ${formatRangeDate(dateRange.endDate)}`, 40, 68);

      if (!continued) {
        doc
          .text(`Jumlah hutang aktif: ${debts.length}`, 40, 86)
          .font('Helvetica-Bold')
          .text(`Total sisa hutang: ${formatAmount(totalRemaining)}`, 40, 102);
      }

      const headerY = continued ? 78 : 130;
      const columns = [
        { label: 'No. Transaksi', x: 40, width: 65 },
        { label: 'Supplier', x: 107, width: 85 },
        { label: 'Ref. Invoice', x: 194, width: 75 },
        { label: 'Tgl. Beli', x: 271, width: 55 },
        { label: 'Jatuh Tempo', x: 328, width: 65 },
        { label: 'Status', x: 395, width: 60 },
        { label: 'Sisa Hutang', x: 457, width: 98, align: 'right' }
      ];

      doc.fontSize(8).font('Helvetica-Bold');
      for (const column of columns) {
        doc.text(column.label, column.x, headerY, {
          width: column.width,
          align: column.align || 'left'
        });
      }
      doc.moveTo(40, headerY + 15).lineTo(555, headerY + 15).stroke('#000000');
      doc.font('Helvetica');
      return headerY + 22;
    };

    let y = drawHeader();
    for (const debt of debts) {
      if (y > 760) {
        doc.addPage();
        y = drawHeader(true);
      }

      const isOverdue = debt.payment_status === 'overdue' ||
        (debt.due_date && new Date(debt.due_date) < new Date());
      const status = isOverdue
        ? 'Jatuh tempo'
        : debt.payment_status === 'partial'
          ? 'Sebagian'
          : 'Belum bayar';
      const columns = [
        { text: debt.purchase_number || '-', x: 40, width: 65 },
        { text: debt.supplier_id?.name || 'Supplier', x: 107, width: 85 },
        { text: debt.invoice_ref || '-', x: 194, width: 75 },
        { text: formatDate(debt.purchased_at), x: 271, width: 55 },
        { text: formatDate(debt.due_date), x: 328, width: 65 },
        { text: status, x: 395, width: 60 },
        { text: formatAmount(debt.amount_remaining), x: 457, width: 98, align: 'right' }
      ];
      doc.fontSize(8);
      for (const column of columns) {
        doc.text(column.text, column.x, y, {
          width: column.width,
          height: 28,
          ellipsis: true,
          align: column.align || 'left'
        });
      }
      y += 30;
      doc.moveTo(40, y - 5).lineTo(555, y - 5).stroke('#e5e7eb');
    }

    doc.end();
  }
}

module.exports = new DebtPdfService();
