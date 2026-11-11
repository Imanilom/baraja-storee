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
  async getPurchaseRecapPrices(marketlistId, supplierIds = []) {
    const filter = {
      marketlist_id: marketlistId,
      status: PURCHASE_STATUS.VERIFIED
    };
    if (supplierIds.length > 0) filter.supplier_id = { $in: supplierIds };
    const purchases = await Purchase.find(filter).select('_id supplier_id');
    const purchaseIds = purchases.map((purchase) => purchase._id);
    if (purchaseIds.length === 0) return new Map();

    const purchaseSupplierMap = new Map(
      purchases.map((purchase) => [purchase._id.toString(), purchase.supplier_id.toString()])
    );
    const purchaseItems = await PurchaseItem.find({
      purchase_id: { $in: purchaseIds }
    }).select('purchase_id marketlist_item_id actual_qty actual_unit_price');

    const weightedPrices = new Map();
    for (const purchaseItem of purchaseItems) {
      const supplierId = purchaseSupplierMap.get(purchaseItem.purchase_id.toString());
      const itemId = purchaseItem.marketlist_item_id.toString();
      const key = `${supplierId}:${itemId}`;
      const total = weightedPrices.get(key) || { quantity: 0, amount: 0 };
      total.quantity += Number(purchaseItem.actual_qty) || 0;
      if (purchaseItem.actual_qty > 0 && purchaseItem.actual_unit_price > 0) {
        total.amount += purchaseItem.actual_qty * purchaseItem.actual_unit_price;
      }
      weightedPrices.set(key, total);
    }

    return new Map(
      [...weightedPrices].map(([key, total]) => [
        key,
        {
          quantity: total.quantity,
          unit_price: total.quantity > 0 ? total.amount / total.quantity : null,
          price_source: total.quantity > 0 && total.amount > 0 ? 'purchase_recap' : null
        }
      ])
    );
  }

  getInvoiceItemPrice(item, supplierId, purchasePrices) {
    const purchasePrice = purchasePrices.get(`${supplierId}:${item._id.toString()}`);
    if (purchasePrice?.unit_price > 0) return purchasePrice;
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

    const candidateItems = mlItems.filter((item) => item.item_status !== 'rejected');
    const existingInvoices = await Invoice.find({
      marketlist_id: marketlistId,
      marketlist_version: version
    });
    const targetExistingInvoices = options.supplier_id
      ? existingInvoices.filter(
          (invoice) => invoice.supplier_id.toString() === options.supplier_id.toString()
        )
      : existingInvoices;
    // Resolve missing suppliers using receipt and product history.
    let defaultSupplierId = null;
    for (const item of candidateItems) {
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

    const purchasePrices = await this.getPurchaseRecapPrices(marketlistId);
    const hasPurchaseRecap = marketlist.purchase_tracking_started || purchasePrices.size > 0;
    const getActualQuantity = (item, supplierId = item.supplier_id.toString()) => {
      const recap = purchasePrices.get(`${supplierId}:${item._id.toString()}`);
      if (hasPurchaseRecap) return recap?.quantity || 0;
      return acceptedMap.get(item._id.toString()) || 0;
    };
    const invoiceableItems = candidateItems.filter((item) => {
      if (!hasPurchaseRecap) return getActualQuantity(item) > 0;
      const itemId = item._id.toString();
      return [...purchasePrices.entries()].some(
        ([key, recap]) => key.endsWith(`:${itemId}`) && recap.quantity > 0
      );
    });
    if (invoiceableItems.length === 0 && targetExistingInvoices.length === 0) {
      throw new Error('No accepted goods or purchases exist for this marketlist');
    }

    // Group items by supplier_id
    const supplierGroup = new Map();
    const supplierIds = new Set();
    if (hasPurchaseRecap) {
      candidateItems.forEach((item) => supplierIds.add(item.supplier_id.toString()));
      for (const key of purchasePrices.keys()) {
        supplierIds.add(key.split(':')[0]);
      }
      for (const item of candidateItems) {
        const itemId = item._id.toString();
        const itemRecaps = [...purchasePrices.entries()].filter(([key]) => key.endsWith(`:${itemId}`));
        if (itemRecaps.some(([, recap]) => recap.quantity > 0)) {
          itemRecaps.forEach(([key, recap]) => {
            if (recap.quantity > 0) supplierIds.add(key.split(':')[0]);
          });
        }
      }
    } else {
      invoiceableItems.forEach((item) => supplierIds.add(item.supplier_id.toString()));
    }
    if (hasPurchaseRecap) {
      existingInvoices.forEach((invoice) => supplierIds.add(invoice.supplier_id.toString()));
    }
    for (const supplierId of supplierIds) {
      const items = candidateItems.filter((item) => {
        const assignedSupplierId = item.supplier_id.toString();
        const recap = purchasePrices.get(`${supplierId}:${item._id.toString()}`);
        return assignedSupplierId === supplierId || (hasPurchaseRecap && recap?.quantity > 0);
      });
      if (items.length > 0) supplierGroup.set(supplierId, items);
    }

    const generatedInvoices = [];

    // Target specific supplier if provided, otherwise all
    for (const [suppKey, items] of supplierGroup.entries()) {
      if (options.supplier_id && options.supplier_id.toString() !== suppKey) {
        continue;
      }

      // Calculate totals
      let subtotal = 0;
      const invoiceItems = items.map((item) => {
        const invoicedQty = getActualQuantity(item, suppKey);
        const price = this.getInvoiceItemPrice(item, suppKey, purchasePrices);
        const purchased = invoicedQty > 0;
        const itemSubtotal = invoicedQty * price.unit_price;
        subtotal += itemSubtotal;
        return {
          marketlist_item_id: item._id,
          product_name: item.product_snapshot?.name || item.product_id?.name || 'Item',
          sku: item.product_snapshot?.sku || '',
          quantity: invoicedQty,
          purchased,
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
          (existing.purchases_confirmed !== true || options.syncPurchases === true)
        ) {
          existing.items = invoiceItems;
          existing.subtotal = subtotal;
          existing.grand_total = grand_total;
          if (options.syncPurchases === true) existing.purchases_confirmed = false;
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
        (existing.purchases_confirmed === true && options.syncPurchases !== true) ||
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

  async syncMarketlistPurchaseQuantities(marketlistId, user) {
    const invoiceCount = await Invoice.countDocuments({
      marketlist_id: marketlistId,
      status: INVOICE_STATUS.GENERATED
    });
    if (invoiceCount === 0) return [];
    return this.generateInvoicesFromMarketlist(
      marketlistId,
      { syncPurchases: true },
      user
    );
  }

  async regenerateAllInvoices(user) {
    const eligibleStatuses = [
      MARKETLIST_STATUS.APPROVED,
      MARKETLIST_STATUS.IN_PROGRESS,
      MARKETLIST_STATUS.PARTIALLY_RECEIVED,
      MARKETLIST_STATUS.RECEIVED,
      MARKETLIST_STATUS.COMPLETED
    ];
    const marketlists = await Marketlist.find({ status: { $in: eligibleStatuses } })
      .select('_id');
    const marketlistIds = marketlists.map((marketlist) => marketlist._id);
    if (marketlistIds.length === 0) return [];

    const [invoiceMarketlistIds, purchaseMarketlistIds, receiptMarketlistIds] = await Promise.all([
      Invoice.distinct('marketlist_id', {
        marketlist_id: { $in: marketlistIds },
        status: INVOICE_STATUS.GENERATED
      }),
      Purchase.distinct('marketlist_id', { marketlist_id: { $in: marketlistIds } }),
      GoodsReceipt.distinct('marketlist_id', {
        marketlist_id: { $in: marketlistIds },
        status: { $ne: 'cancelled' }
      })
    ]);
    const eligibleIds = new Set(
      [...invoiceMarketlistIds, ...purchaseMarketlistIds, ...receiptMarketlistIds]
        .map((id) => id.toString())
    );

    const results = [];
    for (const marketlistId of marketlistIds) {
      if (!eligibleIds.has(marketlistId.toString())) continue;
      const invoices = await this.generateInvoicesFromMarketlist(
        marketlistId,
        { syncPurchases: true },
        user
      );
      results.push(...invoices);
    }
    return results;
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
