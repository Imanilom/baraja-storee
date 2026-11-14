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
    const drawPurchaseHeader = (y) => {
      const columns = [
        { label: 'Marketlist', x: 40, width: 100 },
        { label: 'Tgl. Tagihan', x: 142, width: 75 },
        { label: 'Jatuh Tempo', x: 219, width: 75 },
        { label: 'Supplier', x: 296, width: 135 },
        { label: 'Sisa Hutang', x: 433, width: 122, align: 'right' }
      ];
      doc.fontSize(8).font('Helvetica-Bold');
      for (const column of columns) {
        doc.text(column.label, column.x, y, {
          width: column.width,
          align: column.align || 'left'
        });
      }
      doc.moveTo(40, y + 13).lineTo(555, y + 13).stroke('#000000');
      return y + 19;
    };

    const drawOverheadHeader = (y) => {
      const columns = [
        { label: 'Tgl. Tagihan', x: 40, width: 75 },
        { label: 'Jatuh Tempo', x: 117, width: 75 },
        { label: 'Rincian Overhead', x: 194, width: 150 },
        { label: 'Vendor', x: 346, width: 100 },
        { label: 'Sisa Hutang', x: 448, width: 107, align: 'right' }
      ];
      doc.fontSize(8).font('Helvetica-Bold');
      for (const column of columns) {
        doc.text(column.label, column.x, y, {
          width: column.width,
          align: column.align || 'left'
        });
      }
      doc.moveTo(40, y + 13).lineTo(555, y + 13).stroke('#000000');
      return y + 19;
    };

    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('RINCIAN TAGIHAN & HUTANG', 40, 40)
      .fontSize(10)
      .font('Helvetica')
      .text(`Periode tagihan: ${formatRangeDate(dateRange.startDate)} - ${formatRangeDate(dateRange.endDate)}`, 40, 66)
      .text(`Marketlist / pembelian (${purchaseDebts.length}): ${formatAmount(totalPurchaseDebt)}`, 40, 88)
      .text(`Overhead (${overheadDebts.length}): ${formatAmount(totalOverheadDebt)}`, 40, 104)
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(`TOTAL SISA TAGIHAN: ${formatAmount(totalRemaining)}`, 40, 124);

    let y = 158;
    if (purchaseDebts.length > 0) {
      doc.fontSize(10).font('Helvetica-Bold').text('HUTANG MARKETLIST / PEMBELIAN', 40, y);
      y = drawPurchaseHeader(y + 17);
      doc.font('Helvetica').fontSize(8);
      for (const debt of purchaseDebts) {
        if (y > 770) {
          doc.addPage();
          doc.fontSize(10).font('Helvetica-Bold').text('RINCIAN TAGIHAN (LANJUTAN)', 40, 40);
          y = drawPurchaseHeader(68);
          doc.font('Helvetica').fontSize(8);
        }
        const values = [
          { text: debt.marketlist_id?.marketlist_number || debt.purchase_number || '-', x: 40, width: 100 },
          { text: formatDate(debt.purchased_at), x: 142, width: 75 },
          { text: formatDate(debt.due_date), x: 219, width: 75 },
          { text: debt.supplier_id?.name || 'Supplier', x: 296, width: 135 },
          { text: formatAmount(debt.amount_remaining), x: 433, width: 122, align: 'right' }
        ];
        for (const column of values) {
          doc.text(column.text, column.x, y, {
            width: column.width,
            height: 16,
            ellipsis: true,
            align: column.align || 'left'
          });
        }
        y += 18;
        doc.moveTo(40, y - 3).lineTo(555, y - 3).stroke('#e5e7eb');
      }
      y += 8;
    }

    if (overheadDebts.length > 0) {
      if (y > 730) {
        doc.addPage();
        doc.fontSize(10).font('Helvetica-Bold').text('RINCIAN TAGIHAN (LANJUTAN)', 40, 40);
        y = 68;
      }
      doc.fontSize(10).font('Helvetica-Bold').text('HUTANG OVERHEAD', 40, y);
      y = drawOverheadHeader(y + 17);
      doc.font('Helvetica').fontSize(8);
      for (const debt of overheadDebts) {
        if (y > 770) {
          doc.addPage();
          doc.fontSize(10).font('Helvetica-Bold').text('RINCIAN TAGIHAN (LANJUTAN)', 40, 40);
          y = drawOverheadHeader(68);
          doc.font('Helvetica').fontSize(8);
        }
        const values = [
          { text: formatDate(debt.expense_date), x: 40, width: 75 },
          { text: formatDate(debt.due_date), x: 117, width: 75 },
          { text: debt.title || '-', x: 194, width: 150 },
          { text: debt.vendor_recipient || '-', x: 346, width: 100 },
          { text: formatAmount(debt.amount_remaining), x: 448, width: 107, align: 'right' }
        ];
        for (const column of values) {
          doc.text(column.text, column.x, y, {
            width: column.width,
            height: 16,
            ellipsis: true,
            align: column.align || 'left'
          });
        }
        y += 18;
        doc.moveTo(40, y - 3).lineTo(555, y - 3).stroke('#e5e7eb');
      }
    }

    if (invoices.length > 0) {
      doc.addPage();
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('LAMPIRAN INVOICE', 40, 40)
        .fontSize(10)
        .font('Helvetica')
        .text(`Jumlah invoice terlampir: ${invoices.length}`, 40, 68);

      let appendixY = 100;
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
      appendixY = drawAppendixHeader(appendixY);
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
