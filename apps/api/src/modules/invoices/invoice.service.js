const Invoice = require('./invoice.model');
const Marketlist = require('../marketlists/marketlist.model');
const MarketlistItem = require('../marketlists/marketlist-item.model');
const auditService = require('../audit/audit.service');
const { generateInvoiceNumber } = require('../../utils/number-generator');
const { MARKETLIST_STATUS, INVOICE_STATUS } = require('@purchasing/constants');

class InvoiceService {
  async getAllInvoices(query = {}) {
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.supplier_id) filter.supplier_id = query.supplier_id;
    if (query.marketlist_id) filter.marketlist_id = query.marketlist_id;

    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Invoice.find(filter)
        .populate('supplier_id', 'name code phone')
        .populate('marketlist_id', 'marketlist_number required_date status')
        .populate('generated_by', 'name email role')
        .sort({ invoice_date: -1 })
        .skip(skip)
        .limit(limit),
      Invoice.countDocuments(filter)
    ]);

    return { items, total, page, limit };
  }

  async getInvoiceById(id) {
    return Invoice.findById(id)
      .populate('supplier_id', 'name code contact_person phone email address bank_account')
      .populate('marketlist_id', 'marketlist_number required_date status approval location_id')
      .populate('generated_by', 'name email role');
  }

  async generateInvoicesFromMarketlist(marketlistId, options = {}, user) {
    const marketlist = await Marketlist.findById(marketlistId);
    if (!marketlist) {
      throw new Error('Marketlist not found');
    }

    // Must be approved before invoice can be generated
    const allowedStatuses = [
      MARKETLIST_STATUS.APPROVED,
      MARKETLIST_STATUS.IN_PROGRESS,
      MARKETLIST_STATUS.PARTIALLY_RECEIVED,
      MARKETLIST_STATUS.RECEIVED,
      MARKETLIST_STATUS.COMPLETED
    ];

    if (!allowedStatuses.includes(marketlist.status)) {
      throw new Error(
        `Cannot generate invoice. Marketlist status is '${marketlist.status}'. Only approved marketlists can generate invoices.`
      );
    }

    const version = marketlist.approved_version || marketlist.current_version;

    // Fetch marketlist items
    const mlItems = await MarketlistItem.find({ marketlist_id: marketlistId }).populate('product_id');
    if (mlItems.length === 0) {
      throw new Error('Marketlist has no items to invoice');
    }

    // Group items by supplier_id
    const supplierGroup = new Map();
    for (const item of mlItems) {
      const suppKey = item.supplier_id ? item.supplier_id.toString() : 'NO_SUPPLIER';
      if (!supplierGroup.has(suppKey)) {
        supplierGroup.set(suppKey, []);
      }
      supplierGroup.get(suppKey).push(item);
    }

    const generatedInvoices = [];

    // Target specific supplier if provided, otherwise all
    for (const [suppKey, items] of supplierGroup.entries()) {
      if (suppKey === 'NO_SUPPLIER') {
        throw new Error('All items in marketlist must have an assigned supplier before invoice generation');
      }

      if (options.supplier_id && options.supplier_id.toString() !== suppKey) {
        continue;
      }

      // Check if invoice for this supplier and version already exists
      const existing = await Invoice.findOne({
        marketlist_id: marketlistId,
        supplier_id: suppKey,
        marketlist_version: version
      });

      if (existing) {
        generatedInvoices.push(existing);
        continue;
      }

      // Calculate totals
      let subtotal = 0;
      const invoiceItems = items.map((item) => {
        const itemSubtotal = item.requested_qty * item.unit_price;
        subtotal += itemSubtotal;
        return {
          marketlist_item_id: item._id,
          product_name: item.product_snapshot?.name || item.product_id?.name || 'Item',
          sku: item.product_snapshot?.sku || '',
          quantity: item.requested_qty,
          unit: item.product_snapshot?.unit_name || '',
          unit_price: item.unit_price,
          subtotal: itemSubtotal
        };
      });

      const discount = options.discount || 0;
      const tax = options.tax || 0;
      const grand_total = subtotal - discount + tax;

      const count = await Invoice.countDocuments();
      const invoice_number = generateInvoiceNumber(count + 1);

      const invoice = new Invoice({
        invoice_number,
        marketlist_id: marketlist._id,
        supplier_id: suppKey,
        marketlist_version: version,
        invoice_date: new Date(),
        items: invoiceItems,
        subtotal,
        discount,
        tax,
        grand_total,
        status: INVOICE_STATUS.GENERATED,
        generated_by: user._id,
        generated_at: new Date()
      });

      await invoice.save();

      await auditService.log({
        entity_type: 'invoice',
        entity_id: invoice._id,
        action: 'invoice_generated',
        performed_by: user._id,
        new_value: { invoice_number, grand_total },
        description: `Generated invoice ${invoice_number} from Marketlist ${marketlist.marketlist_number}`
      });

      generatedInvoices.push(invoice);
    }

    return generatedInvoices;
  }

  async verifyInvoice(id, user) {
    const invoice = await Invoice.findById(id);
    if (!invoice) throw new Error('Invoice not found');

    invoice.status = INVOICE_STATUS.VERIFIED;
    await invoice.save();

    await auditService.log({
      entity_type: 'invoice',
      entity_id: invoice._id,
      action: 'invoice_verified',
      performed_by: user._id,
      description: `Invoice ${invoice.invoice_number} verified by ${user.name}`
    });

    return invoice;
  }
}

module.exports = new InvoiceService();
