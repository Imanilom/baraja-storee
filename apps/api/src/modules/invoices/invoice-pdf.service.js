const PDFDocument = require('pdfkit');

class InvoicePdfService {
  renderInvoice(doc, invoice) {
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('PURCHASING INVOICE', 50, 50)
      .fontSize(10)
      .font('Helvetica')
      .text(`Invoice No: ${invoice.invoice_number}`, 50, 75)
      .text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString('id-ID')}`, 50, 90)
      .text(`Marketlist Ref: ${invoice.marketlist_id?.marketlist_number || invoice.marketlist_id || 'Manual'}`, 50, 105)
      .text(`Status: ${invoice.status.toUpperCase()}`, 50, 120);

    const supplierNames = [...new Set(
      invoice.items.map((item) => item.supplier_name).filter(Boolean)
    )];
    if (supplierNames.length === 0 && invoice.supplier_id?.name) {
      supplierNames.push(invoice.supplier_id.name);
    }
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('SUPPLIER(S):', 350, 75)
      .fontSize(10)
      .font('Helvetica')
      .text(supplierNames.join(', ') || 'N/A', 350, 90, { width: 200, height: 55 });

    doc.moveTo(50, 160).lineTo(550, 160).stroke('#cccccc');

    const drawItemsHeader = (y) => {
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Item Description', 50, y, { width: 145 })
        .text('Supplier', 200, y, { width: 90 })
        .text('Qty', 295, y, { width: 40, align: 'right' })
        .text('Unit', 340, y, { width: 35, align: 'center' })
        .text('Unit Price', 380, y, { width: 70, align: 'right' })
        .text('Subtotal', 460, y, { width: 90, align: 'right' });
      doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke('#000000');
      return y + 25;
    };

    let y = drawItemsHeader(175);
    doc.font('Helvetica');
    const purchasedItems = invoice.items.filter((item) => item.purchased !== false);
    for (const item of purchasedItems) {
      if (y > 700) {
        doc.addPage();
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(`Invoice ${invoice.invoice_number} (lanjutan)`, 50, 50);
        y = drawItemsHeader(75);
        doc.font('Helvetica');
      }

      doc
        .text(item.product_name, 50, y, { width: 145, ellipsis: true })
        .text(item.supplier_name || invoice.supplier_id?.name || '', 200, y, { width: 90, ellipsis: true })
        .text(item.quantity.toLocaleString('id-ID'), 295, y, { width: 40, align: 'right' })
        .text(item.unit || '', 340, y, { width: 35, align: 'center', ellipsis: true })
        .text(`Rp ${item.unit_price.toLocaleString('id-ID')}`, 380, y, { width: 70, align: 'right' })
        .text(`Rp ${item.subtotal.toLocaleString('id-ID')}`, 460, y, { width: 90, align: 'right' });
      y += 20;
    }
    if (purchasedItems.length === 0) {
      doc.font('Helvetica-Oblique').text('Tidak ada item yang dibeli.', 50, y);
      y += 20;
    }

    const totalRows = 2 + (invoice.discount > 0 ? 1 : 0) + (invoice.tax > 0 ? 1 : 0);
    if (y + totalRows * 15 + 55 > 770) {
      doc.addPage();
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(`Invoice ${invoice.invoice_number} (lanjutan)`, 50, 50);
      y = 80;
    }

    doc.moveTo(50, y).lineTo(550, y).stroke('#cccccc');
    y += 15;
    doc
      .font('Helvetica')
      .text('Subtotal:', 350, y, { width: 100, align: 'right' })
      .text(`Rp ${invoice.subtotal.toLocaleString('id-ID')}`, 460, y, { width: 90, align: 'right' });
    y += 15;

    if (invoice.discount > 0) {
      doc
        .text('Discount:', 350, y, { width: 100, align: 'right' })
        .text(`- Rp ${invoice.discount.toLocaleString('id-ID')}`, 460, y, { width: 90, align: 'right' });
      y += 15;
    }

    if (invoice.tax > 0) {
      doc
        .text('Tax:', 350, y, { width: 100, align: 'right' })
        .text(`+ Rp ${invoice.tax.toLocaleString('id-ID')}`, 460, y, { width: 90, align: 'right' });
      y += 15;
    }

    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .text('Grand Total:', 350, y, { width: 100, align: 'right' })
      .text(`Rp ${invoice.grand_total.toLocaleString('id-ID')}`, 460, y, { width: 90, align: 'right' });

    y += 40;
    doc
      .fontSize(9)
      .font('Helvetica-Oblique')
      .text('Catatan: Invoice ini merangkum transaksi aktual yang dialokasikan ke Marketlist dan item manual terkait.', 50, y);
  }

  generateInvoicePdf(invoice, res) {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);
    this.renderInvoice(doc, invoice);
    doc.end();
  }

  generateInvoicesPdf(invoices, res, dateRange, overheadTotal = 0) {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    const formatDate = (value) => {
      const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
      return Number.isFinite(date.getTime()) ? date.toLocaleDateString('id-ID') : '-';
    };
    const formatAmount = (value) => `Rp ${(Number(value) || 0).toLocaleString('id-ID', {
      maximumFractionDigits: 0
    })}`;
    const marketlists = new Map();
    for (const invoice of invoices) {
      const marketlist = invoice.marketlist_id;
      const marketlistNumber = marketlist?.marketlist_number || 'Tanpa Marketlist';
      const marketlistId = marketlist?._id?.toString() || marketlist?.toString() || marketlistNumber;
      const row = marketlists.get(marketlistId) || {
        marketlistNumber,
        date: marketlist?.date || invoice.invoice_date,
        total: 0
      };
      row.total += Number(invoice.grand_total) || 0;
      marketlists.set(marketlistId, row);
    }

    const marketlistRows = [...marketlists.values()].sort(
      (first, second) => new Date(first.date || 0) - new Date(second.date || 0)
    );
    const invoiceTotal = invoices.reduce(
      (total, invoice) => total + (Number(invoice.grand_total) || 0),
      0
    );
    const totalOverhead = Number(overheadTotal) || 0;
    const overallTotal = invoiceTotal + totalOverhead;

    const drawMarketlistHeader = (y) => {
      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('Marketlist', 50, y, { width: 200 })
        .text('Tanggal Marketlist', 255, y, { width: 125 })
        .text('Total Tagihan', 385, y, { width: 165, align: 'right' });
      doc.moveTo(50, y + 15).lineTo(550, y + 15).stroke('#cccccc');
      return y + 21;
    };

    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('RINGKASAN TAGIHAN', 50, 50)
      .fontSize(11)
      .font('Helvetica')
      .text(`Periode: ${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}`, 50, 90)
      .text(`Jumlah invoice: ${invoices.length}`, 50, 108);

    let y = drawMarketlistHeader(140);
    doc.fontSize(9).font('Helvetica');
    for (const row of marketlistRows) {
      if (y > 690) {
        doc.addPage();
        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .text('RINGKASAN TAGIHAN (LANJUTAN)', 50, 45);
        y = drawMarketlistHeader(80);
        doc.fontSize(9).font('Helvetica');
      }

      doc
        .text(row.marketlistNumber, 50, y, { width: 200, height: 16, ellipsis: true })
        .text(formatDate(row.date), 255, y, { width: 125 })
        .text(formatAmount(row.total), 385, y, { width: 165, align: 'right' });
      y += 18;
      doc.moveTo(50, y - 3).lineTo(550, y - 3).stroke('#eeeeee');
    }

    if (y > 700) {
      doc.addPage();
      y = 55;
    }
    doc
      .moveTo(50, y + 5)
      .lineTo(550, y + 5)
      .stroke('#000000')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(`Total Marketlist / Invoice: ${formatAmount(invoiceTotal)}`, 50, y + 15)
      .font('Helvetica')
      .text(`Total Overhead: ${formatAmount(totalOverhead)}`, 50, y + 35)
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(`TOTAL KESELURUHAN: ${formatAmount(overallTotal)}`, 50, y + 58);

    invoices.forEach((invoice) => {
      doc.addPage();
      this.renderInvoice(doc, invoice);
    });
    doc.end();
  }
}

module.exports = new InvoicePdfService();
