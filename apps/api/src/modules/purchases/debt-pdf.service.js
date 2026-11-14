const PDFDocument = require('pdfkit');
const invoicePdfService = require('../invoices/invoice-pdf.service');

class DebtPdfService {
  generateDebtReportPdf({ purchaseDebts, overheadDebts, invoices = [] }, dateRange, res) {
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
    const marketlistRows = new Map();

    for (const debt of purchaseDebts) {
      const marketlistNumber = debt.marketlist_id?.marketlist_number || debt.purchase_number || '-';
      const date = debt.purchased_at ? new Date(debt.purchased_at) : null;
      const dateKey = date && Number.isFinite(date.getTime())
        ? date.toISOString().slice(0, 10)
        : '-';
      const key = `${debt.marketlist_id?._id?.toString() || marketlistNumber}:${dateKey}`;
      const row = marketlistRows.get(key) || {
        marketlistNumber,
        date: debt.purchased_at,
        amount: 0
      };
      row.amount += Number(debt.amount_remaining) || 0;
      marketlistRows.set(key, row);
    }

    const rows = [...marketlistRows.values()].sort(
      (first, second) => new Date(first.date || 0) - new Date(second.date || 0)
    );
    const drawMarketlistHeader = (y) => {
      const columns = [
        { label: 'Marketlist', x: 40, width: 200 },
        { label: 'Tanggal Tagihan', x: 244, width: 130 },
        { label: 'Total Hutang', x: 378, width: 177, align: 'right' }
      ];
      doc.fontSize(9).font('Helvetica-Bold');
      for (const column of columns) {
        doc.text(column.label, column.x, y, {
          width: column.width,
          align: column.align || 'left'
        });
      }
      doc.moveTo(40, y + 15).lineTo(555, y + 15).stroke('#000000');
      return y + 22;
    };

    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('REKAP TAGIHAN', 40, 40)
      .fontSize(10)
      .font('Helvetica')
      .text(`Periode: ${formatRangeDate(dateRange.startDate)} - ${formatRangeDate(dateRange.endDate)}`, 40, 66);

    let y = drawMarketlistHeader(100);
    doc.fontSize(9).font('Helvetica');
    for (const row of rows) {
      if (y > 640) {
        doc.addPage();
        doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('REKAP TAGIHAN (LANJUTAN)', 40, 40);
        y = drawMarketlistHeader(70);
        doc.fontSize(9).font('Helvetica');
      }

      doc
        .text(row.marketlistNumber, 40, y, { width: 200, height: 18, ellipsis: true })
        .text(formatDate(row.date), 244, y, { width: 130 })
        .text(formatAmount(row.amount), 378, y, { width: 177, align: 'right' });
      y += 22;
      doc.moveTo(40, y - 4).lineTo(555, y - 4).stroke('#e5e7eb');
    }

    if (y > 690) {
      doc.addPage();
      y = 55;
    }
    doc
      .moveTo(40, y + 4)
      .lineTo(555, y + 4)
      .stroke('#94a3b8')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(`Total marketlist / pembelian (${rows.length}): ${formatAmount(totalPurchaseDebt)}`, 40, y + 14)
      .font('Helvetica')
      .text(`Total overhead (${overheadDebts.length} tagihan): ${formatAmount(totalOverheadDebt)}`, 40, y + 34)
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(`TOTAL KESELURUHAN: ${formatAmount(totalRemaining)}`, 40, y + 56);

    if (invoices.length > 0) {
      doc.addPage();
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('LAMPIRAN INVOICE', 40, 40)
        .fontSize(10)
        .font('Helvetica')
        .text(`Jumlah invoice terlampir: ${invoices.length}`, 40, 68);

      const drawAppendixHeader = (headerY) => {
        const columns = [
          { label: 'No. Invoice', x: 40, width: 120 },
          { label: 'Marketlist', x: 162, width: 115 },
          { label: 'Tanggal', x: 279, width: 90 },
          { label: 'Total', x: 371, width: 184, align: 'right' }
        ];
        doc.fontSize(9).font('Helvetica-Bold');
        for (const column of columns) {
          doc.text(column.label, column.x, headerY, {
            width: column.width,
            align: column.align || 'left'
          });
        }
        doc.moveTo(40, headerY + 15).lineTo(555, headerY + 15).stroke('#000000');
        return headerY + 22;
      };

      let appendixY = drawAppendixHeader(100);
      doc.fontSize(9).font('Helvetica');
      for (const invoice of invoices) {
        if (appendixY > 770) {
          doc.addPage();
          doc.fontSize(12).font('Helvetica-Bold').text('LAMPIRAN INVOICE (LANJUTAN)', 40, 40);
          appendixY = drawAppendixHeader(68);
          doc.fontSize(9).font('Helvetica');
        }
        const values = [
          { text: invoice.invoice_number || '-', x: 40, width: 120 },
          { text: invoice.marketlist_id?.marketlist_number || '-', x: 162, width: 115 },
          { text: formatDate(invoice.invoice_date), x: 279, width: 90 },
          { text: formatAmount(invoice.grand_total), x: 371, width: 184, align: 'right' }
        ];
        for (const column of values) {
          doc.text(column.text, column.x, appendixY, {
            width: column.width,
            height: 18,
            ellipsis: true,
            align: column.align || 'left'
          });
        }
        appendixY += 22;
      }

      invoices.forEach((invoice) => {
        doc.addPage();
        invoicePdfService.renderInvoice(doc, invoice);
      });
    }

    doc.end();
  }
}

module.exports = new DebtPdfService();
