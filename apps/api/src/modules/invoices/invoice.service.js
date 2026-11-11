const Invoice = require('./invoice.model');
const Marketlist = require('../marketlists/marketlist.model');
const MarketlistItem = require('../marketlists/marketlist-item.model');
const GoodsReceipt = require('../receiving/goods-receipt.model');
const GoodsReceiptItem = require('../receiving/goods-receipt-item.model');
const Purchase = require('../purchases/purchase.model');
const PurchaseItem = require('../purchases/purchase-item.model');
const Supplier = require('../suppliers/supplier.model');
const auditService = require('../audit/audit.service');
const { generateInvoiceNumber } = require('../../utils/number-generator');
const { MARKETLIST_STATUS, INVOICE_STATUS, PURCHASE_STATUS } = require('@purchasing/constants');

class InvoiceService {
  async getPurchaseRecapPrices(marketlistId, supplierIds) {
    const purchases = await Purchase.find({
      marketlist_id: marketlistId,
      supplier_id: { $in: supplierIds },
      status: PURCHASE_STATUS.VERIFIED
    }).select('_id supplier_id');
    const purchaseIds = purchases.map((purchase) => purchase._id);
    if (purchaseIds.length === 0) return new Map();

    const purchaseSupplierMap = new Map(
      purchases.map((purchase) => [purchase._id.toString(), purchase.supplier_id.toString()])
    );
    const purchaseItems = await PurchaseItem.find({
      purchase_id: { $in: purchaseIds },
      actual_qty: { $gt: 0 },
      actual_unit_price: { $gt: 0 }
    }).select('purchase_id marketlist_item_id actual_qty actual_unit_price');

    const weightedPrices = new Map();
    for (const purchaseItem of purchaseItems) {
      const supplierId = purchaseSupplierMap.get(purchaseItem.purchase_id.toString());
      const itemId = purchaseItem.marketlist_item_id.toString();
      const key = `${supplierId}:${itemId}`;
      const total = weightedPrices.get(key) || { quantity: 0, amount: 0 };
      total.quantity += purchaseItem.actual_qty;
      total.amount += purchaseItem.actual_qty * purchaseItem.actual_unit_price;
      weightedPrices.set(key, total);
    }

    return new Map(
      [...weightedPrices].map(([key, total]) => [
        key,
        { unit_price: total.amount / total.quantity, price_source: 'purchase_recap' }
      ])
    );
  }

  getInvoiceItemPrice(item, supplierId, purchasePrices) {
    const purchasePrice = purchasePrices.get(`${supplierId}:${item._id.toString()}`);
    if (purchasePrice) return purchasePrice;
    if (Number(item.product_id?.last_purchase_price) > 0) {
      return {
        unit_price: Number(item.product_id.last_purchase_price),
        price_source: 'master_item'
      };
    }
    return { unit_price: Number(item.unit_price) || 0, price_source: 'marketlist' };
  }

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

    // Fetch any goods receipts for this marketlist to get actual received/accepted quantities
    const allReceipts = await GoodsReceipt.find({
      marketlist_id: marketlistId,
      status: { $ne: 'cancelled' }
    });
    const receiptIds = allReceipts.map((r) => r._id);
    const allReceiptItems = receiptIds.length > 0
      ? await GoodsReceiptItem.find({ receipt_id: { $in: receiptIds } })
      : [];

    const acceptedMap = new Map();
    allReceiptItems.forEach((ri) => {
      const k = ri.marketlist_item_id ? ri.marketlist_item_id.toString() : '';
      if (k) {
        const qty = Number(ri.accepted_qty !== undefined ? ri.accepted_qty : (ri.received_qty || 0));
        acceptedMap.set(k, (acceptedMap.get(k) || 0) + qty);
      }
    });

    const invoiceableItems = mlItems.filter((item) =>
      item.item_status !== 'rejected' &&
      (acceptedMap.get(item._id.toString()) || 0) > 0
    );
    const existingInvoices = await Invoice.find({
      marketlist_id: marketlistId,
      marketlist_version: version
    });
    const targetExistingInvoices = options.supplier_id
      ? existingInvoices.filter(
          (invoice) => invoice.supplier_id.toString() === options.supplier_id.toString()
        )
      : existingInvoices;
    if (invoiceableItems.length === 0 && targetExistingInvoices.length === 0) {
      throw new Error('No accepted goods have been received for this marketlist');
    }

    // Check if any items are missing supplier_id and resolve with fallback
    let defaultSupplierId = null;
    for (const item of invoiceableItems) {
      if (!item.supplier_id) {
        if (!defaultSupplierId) {
          const recWithSupp = allReceipts.find((r) => r.supplier_id);
          if (recWithSupp?.supplier_id) {
            defaultSupplierId = recWithSupp.supplier_id;
          } else if (item.product_id?.last_supplier_id) {
            defaultSupplierId = item.product_id.last_supplier_id;
          } else {
            let supp = await Supplier.findOne({ is_active: true });
            if (!supp) {
              supp = await Supplier.create({ name: 'Supplier Umum', code: 'SUPP-UMUM', is_active: true });
            }
            defaultSupplierId = supp._id;
          }
        }
        item.supplier_id = defaultSupplierId;
      }
    }

    // Group items by supplier_id
    const supplierGroup = new Map();
    for (const item of invoiceableItems) {
      const suppKey = item.supplier_id ? item.supplier_id.toString() : defaultSupplierId.toString();
      if (!supplierGroup.has(suppKey)) {
        supplierGroup.set(suppKey, []);
      }
      supplierGroup.get(suppKey).push(item);
    }

    const purchasePrices = await this.getPurchaseRecapPrices(
      marketlistId,
      [...supplierGroup.keys()]
    );
    const generatedInvoices = [];

    // Target specific supplier if provided, otherwise all
    for (const [suppKey, items] of supplierGroup.entries()) {
      if (options.supplier_id && options.supplier_id.toString() !== suppKey) {
        continue;
      }

      // Calculate totals
      let subtotal = 0;
      const invoiceItems = items.map((item) => {
        const invoicedQty = acceptedMap.get(item._id.toString()) || 0;
        const price = this.getInvoiceItemPrice(item, suppKey, purchasePrices);
        const itemSubtotal = invoicedQty * price.unit_price;
        subtotal += itemSubtotal;
        return {
          marketlist_item_id: item._id,
          product_name: item.product_snapshot?.name || item.product_id?.name || 'Item',
          sku: item.product_snapshot?.sku || '',
          quantity: invoicedQty,
          unit: item.product_snapshot?.unit_name || '',
          unit_price: price.unit_price,
          price_source: price.price_source,
          subtotal: itemSubtotal
        };
      });

      const discount = options.discount || 0;
      const tax = options.tax || 0;
      const grand_total = subtotal - discount + tax;

      // Check if invoice for this supplier and version already exists
      const existing = existingInvoices.find(
        (invoice) => invoice.supplier_id.toString() === suppKey
      );

      if (existing) {
        // If still in generated status, update with latest received quantities
        if (
          existing.status === INVOICE_STATUS.GENERATED &&
          existing.purchases_confirmed !== true
        ) {
          existing.items = invoiceItems;
          existing.subtotal = subtotal;
          existing.grand_total = grand_total;
          await existing.save();
        }
        generatedInvoices.push(existing);
        continue;
      }

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

    for (const existing of existingInvoices) {
      if (
        existing.status !== INVOICE_STATUS.GENERATED ||
        existing.purchases_confirmed === true ||
        supplierGroup.has(existing.supplier_id.toString()) ||
        (options.supplier_id &&
          existing.supplier_id.toString() !== options.supplier_id.toString())
      ) {
        continue;
      }

      existing.items = [];
      existing.subtotal = 0;
      existing.discount = 0;
      existing.tax = 0;
      existing.grand_total = 0;
      existing.status = INVOICE_STATUS.CANCELLED;
      await existing.save();
      await auditService.log({
        entity_type: 'invoice',
        entity_id: existing._id,
        action: 'invoice_cancelled',
        performed_by: user._id,
        description: `Invoice ${existing.invoice_number} cancelled because no accepted goods remain for its supplier`
      });
      generatedInvoices.push(existing);
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

  async updateInvoiceItems(id, data, user) {
    const invoice = await Invoice.findById(id);
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    if (invoice.status !== INVOICE_STATUS.GENERATED) {
      throw new Error('Only generated invoices can be edited');
    }

    const existingItems = new Map(
      invoice.items.map((item) => [item.marketlist_item_id?.toString(), item])
    );
    const updates = new Map();
    for (const input of data.items) {
      const itemId = input.marketlist_item_id.toString();
      if (!existingItems.has(itemId) || updates.has(itemId)) {
        throw new Error('Invoice item not found or duplicated');
      }
      if (input.purchased && input.quantity <= 0) {
        throw new Error('Purchased items must have a quantity greater than zero');
      }
      updates.set(itemId, input);
    }
    if (updates.size !== existingItems.size) {
      throw new Error('All invoice items must be included in the update');
    }

    const previousItems = invoice.items.map((item) => ({
      marketlist_item_id: item.marketlist_item_id,
      purchased: item.purchased !== false,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal
    }));
    let subtotal = 0;
    invoice.items = invoice.items.map((item) => {
      const update = updates.get(item.marketlist_item_id.toString());
      const purchased = update.purchased;
      const quantity = purchased ? update.quantity : 0;
      const unitPrice = update.unit_price;
      const itemSubtotal = quantity * unitPrice;
      subtotal += itemSubtotal;
      return {
        marketlist_item_id: item.marketlist_item_id,
        product_name: item.product_name,
        sku: item.sku,
        purchased,
        quantity,
        unit: item.unit,
        unit_price: unitPrice,
        price_source: 'manual',
        subtotal: itemSubtotal
      };
    });
    invoice.subtotal = subtotal;
    invoice.grand_total = subtotal - invoice.discount + invoice.tax;
    invoice.purchases_confirmed = true;
    await invoice.save();

    await auditService.log({
      entity_type: 'invoice',
      entity_id: invoice._id,
      action: 'invoice_items_updated',
      performed_by: user._id,
      old_value: previousItems,
      new_value: invoice.items.map((item) => ({
        marketlist_item_id: item.marketlist_item_id,
        purchased: item.purchased,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal
      })),
      description: `Invoice ${invoice.invoice_number} purchase quantities updated`
    });
    return invoice;
  }

  async refreshInvoicePrices(id, user) {
    const invoice = await Invoice.findById(id);
    if (!invoice) throw new Error('Invoice not found');
    if (invoice.status !== INVOICE_STATUS.GENERATED) {
      throw new Error('Only generated invoices can refresh prices');
    }

    const marketlistItems = await MarketlistItem.find({
      _id: { $in: invoice.items.map((item) => item.marketlist_item_id) }
    }).populate('product_id', 'last_purchase_price');
    const marketlistItemMap = new Map(
      marketlistItems.map((item) => [item._id.toString(), item])
    );
    const purchasePrices = await this.getPurchaseRecapPrices(
      invoice.marketlist_id,
      [invoice.supplier_id]
    );
    const previousItems = invoice.items.map((item) => ({
      marketlist_item_id: item.marketlist_item_id,
      unit_price: item.unit_price,
      subtotal: item.subtotal
    }));

    let subtotal = 0;
    invoice.items = invoice.items.map((invoiceItem) => {
      const marketlistItem = marketlistItemMap.get(invoiceItem.marketlist_item_id.toString());
      if (!marketlistItem) {
        throw new Error(`Marketlist item for '${invoiceItem.product_name}' was not found`);
      }
      const price = this.getInvoiceItemPrice(
        marketlistItem,
        invoice.supplier_id.toString(),
        purchasePrices
      );
      const itemSubtotal = invoiceItem.quantity * price.unit_price;
      subtotal += itemSubtotal;
      return {
        marketlist_item_id: invoiceItem.marketlist_item_id,
        product_name: invoiceItem.product_name,
        sku: invoiceItem.sku,
        quantity: invoiceItem.quantity,
        purchased: invoiceItem.purchased,
        unit: invoiceItem.unit,
        unit_price: price.unit_price,
        price_source: price.price_source,
        subtotal: itemSubtotal
      };
    });
    invoice.subtotal = subtotal;
    invoice.grand_total = subtotal - invoice.discount + invoice.tax;
    await invoice.save();

    await auditService.log({
      entity_type: 'invoice',
      entity_id: invoice._id,
      action: 'invoice_prices_refreshed',
      performed_by: user._id,
      old_value: previousItems,
      new_value: invoice.items.map((item) => ({
        marketlist_item_id: item.marketlist_item_id,
        unit_price: item.unit_price,
        price_source: item.price_source,
        subtotal: item.subtotal
      })),
      description: `Invoice ${invoice.invoice_number} unit prices refreshed from purchase recap and master items`
    });
    return invoice;
  }
}

module.exports = new InvoiceService();
