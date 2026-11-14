const PDFDocument = require('pdfkit');

class DebtPdfService {
  generateDebtReportPdf({ purchaseDebts, overheadDebts }, dateRange, res) {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    const formatDate = (value) => value
      ? new Date(value).toLocaleDateString('id-ID')
      : '-';
    const formatAmount = (value) => `Rp ${(Number(value) || 0).toLocaleString('id-ID')}`;
    const formatRangeDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString('id-ID');
    const totalPurchaseDebt = purchaseDebts.reduce(
      (total, debt) => total + (Number(debt.amount_remaining) || 0),
      0
    );
    const totalOverheadDebt = overheadDebts.reduce(
      (total, debt) => total + (Number(debt.amount_remaining) || 0),
      0
    );
    const totalRemaining = totalPurchaseDebt + totalOverheadDebt;
    const debts = [
      ...purchaseDebts.map((debt) => ({
        type: 'Pembelian',
        reference_number: debt.purchase_number,
        party: debt.supplier_id?.name || 'Supplier',
        invoice_ref: debt.invoice_ref,
        date: debt.purchased_at,
        due_date: debt.due_date,
        payment_status: debt.payment_status,
        amount_remaining: debt.amount_remaining
      })),
      ...overheadDebts.map((debt) => ({
        type: 'Overhead',
        reference_number: debt.title,
        party: debt.vendor_recipient,
        invoice_ref: debt.invoice_ref,
        date: debt.expense_date,
        due_date: debt.due_date,
        payment_status: debt.payment_status,
        amount_remaining: debt.amount_remaining
      }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    const drawHeader = (continued = false) => {
      doc
        .fontSize(continued ? 12 : 18)
        .font('Helvetica-Bold')
        .text(continued ? 'DAFTAR HUTANG (LANJUTAN)' : 'DAFTAR HUTANG + OVERHEAD', 40, 40)
        .fontSize(10)
        .font('Helvetica')
        .text(`Periode transaksi: ${formatRangeDate(dateRange.startDate)} - ${formatRangeDate(dateRange.endDate)}`, 40, 68);

      if (!continued) {
        doc
          .text(`Jumlah pembelian: ${purchaseDebts.length}  |  Total hutang pembelian: ${formatAmount(totalPurchaseDebt)}`, 40, 86)
          .text(`Jumlah overhead: ${overheadDebts.length}  |  Total hutang overhead: ${formatAmount(totalOverheadDebt)}`, 40, 102)
          .font('Helvetica-Bold')
          .text(`TOTAL SISA HUTANG + OVERHEAD: ${formatAmount(totalRemaining)}`, 40, 118);
      }

      const headerY = continued ? 78 : 145;
      const columns = [
        { label: 'Jenis', x: 40, width: 48 },
        { label: 'No./Keperluan', x: 90, width: 85 },
        { label: 'Supplier/Vendor', x: 177, width: 75 },
        { label: 'Referensi', x: 254, width: 55 },
        { label: 'Tgl.', x: 311, width: 43 },
        { label: 'Tempo', x: 356, width: 50 },
        { label: 'Status', x: 408, width: 50 },
        { label: 'Sisa Hutang', x: 460, width: 95, align: 'right' }
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
        { text: debt.type, x: 40, width: 48 },
        { text: debt.reference_number || '-', x: 90, width: 85 },
        { text: debt.party || '-', x: 177, width: 75 },
        { text: debt.invoice_ref || '-', x: 254, width: 55 },
        { text: formatDate(debt.date), x: 311, width: 43 },
        { text: formatDate(debt.due_date), x: 356, width: 50 },
        { text: status, x: 408, width: 50 },
        { text: formatAmount(debt.amount_remaining), x: 460, width: 95, align: 'right' }
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
