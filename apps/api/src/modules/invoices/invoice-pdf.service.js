const PDFDocument = require('pdfkit');

class InvoicePdfService {
  generateInvoicePdf(invoice, res) {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    doc.pipe(res);

    // Header
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

    // Divider
    doc.moveTo(50, 160).lineTo(550, 160).stroke('#cccccc');

    // Table Header
    let y = 175;
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Item Description', 50, y, { width: 145 })
      .text('Supplier', 200, y, { width: 90 })
      .text('Qty', 295, y, { width: 40, align: 'right' })
      .text('Unit', 340, y, { width: 35, align: 'center' })
      .text('Unit Price', 380, y, { width: 70, align: 'right' })
      .text('Subtotal', 460, y, { width: 90, align: 'right' });

    y += 15;
    doc.moveTo(50, y).lineTo(550, y).stroke('#000000');
    y += 10;

    // Items
    doc.font('Helvetica');
    const purchasedItems = invoice.items.filter((item) => item.purchased !== false);
    for (const item of purchasedItems) {
      if (y > 700) {
        doc.addPage();
        y = 50;
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

    doc.moveTo(50, y).lineTo(550, y).stroke('#cccccc');
    y += 15;

    // Totals
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

    doc.end();
  }
}

module.exports = new InvoicePdfService();
