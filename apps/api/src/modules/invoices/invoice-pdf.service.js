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

  generateInvoicesPdf(invoices, res, dateRange) {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);
    invoices.forEach((invoice, index) => {
      if (index > 0) doc.addPage();
      this.renderInvoice(doc, invoice);
    });

    const formatDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString('id-ID');
    const subtotal = invoices.reduce((total, invoice) => total + (Number(invoice.subtotal) || 0), 0);
    const discount = invoices.reduce((total, invoice) => total + (Number(invoice.discount) || 0), 0);
    const tax = invoices.reduce((total, invoice) => total + (Number(invoice.tax) || 0), 0);
    const grandTotal = invoices.reduce((total, invoice) => total + (Number(invoice.grand_total) || 0), 0);

    doc.addPage();
    doc
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('REKAP TOTAL INVOICE', 50, 50)
      .fontSize(11)
      .font('Helvetica')
      .text(`Periode: ${formatDate(dateRange.startDate)} - ${formatDate(dateRange.endDate)}`, 50, 90)
      .text(`Jumlah invoice: ${invoices.length}`, 50, 110);

    doc.moveTo(50, 145).lineTo(550, 145).stroke('#cccccc');
    const rows = [
      ['Subtotal:', subtotal],
      ['Diskon:', -discount],
      ['Pajak:', tax]
    ];
    let y = 170;
    for (const [label, amount] of rows) {
      doc
        .fontSize(12)
        .font('Helvetica')
        .text(label, 320, y, { width: 130, align: 'right' })
        .text(`Rp ${amount.toLocaleString('id-ID')}`, 460, y, { width: 90, align: 'right' });
      y += 24;
    }

    doc
      .moveTo(320, y)
      .lineTo(550, y)
      .stroke('#000000')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('TOTAL AKHIR:', 320, y + 12, { width: 130, align: 'right' })
      .text(`Rp ${grandTotal.toLocaleString('id-ID')}`, 460, y + 12, { width: 90, align: 'right' });
    doc.end();
  }
}

module.exports = new InvoicePdfService();
